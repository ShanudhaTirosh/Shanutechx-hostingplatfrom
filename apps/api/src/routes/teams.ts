import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

/**
 * GET /api/teams
 * List teams owned by or joined by the authenticated user.
 */
teamsRouter.get('/teams', async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  const [ownedTeams, memberships] = await Promise.all([
    prisma.team.findMany({
      where: { ownerId: userId },
      include: {
        members: { include: { user: { select: { id: true, email: true, displayName: true } } } },
        invites: { where: { status: 'pending' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            owner: { select: { id: true, email: true, displayName: true } },
            members: { include: { user: { select: { id: true, email: true, displayName: true } } } },
          },
        },
        permissions: true,
      },
    }),
  ]);

  res.json({
    ownedTeams,
    joinedTeams: memberships.map((m: any) => ({
      ...m.team,
      myRole: m.role,
      myPermissions: m.permissions,
    })),
  });
});

/**
 * POST /api/teams
 * Create a new team workspace owned by the caller.
 */
teamsRouter.post('/teams', async (req: AuthedRequest, res) => {
  const createSchema = z.object({
    name: z.string().min(2).max(50),
  });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: 'owner',
        },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, email: true, displayName: true } } } },
    },
  });

  res.status(201).json({ team });
});

/**
 * GET /api/teams/:id
 * Get details for a specific team, its members, pending invites, and purchased resources.
 */
teamsRouter.get('/teams/:id', async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const teamId = req.params.id;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: { select: { id: true, email: true, displayName: true } },
      members: {
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          permissions: true,
        },
      },
      invites: {
        include: { invitedByUser: { select: { id: true, email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const isOwner = team.ownerId === userId;
  const myMembership = team.members.find((m: any) => m.userId === userId);

  if (!isOwner && !myMembership && req.user!.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Fetch resources owned by team owner (deployments, databases, VPS, SMTP)
  const [deployments, databases, vpsInstances, smtpAccounts] = await Promise.all([
    prisma.deployment.findMany({ where: { userId: team.ownerId }, select: { id: true, subdomain: true, status: true } }),
    prisma.managedDatabase.findMany({ where: { userId: team.ownerId }, select: { id: true, type: true, status: true, internalHost: true } }),
    prisma.vpsProvision.findMany({ where: { userId: team.ownerId }, select: { id: true, status: true, provider: true } }),
    prisma.smtpAccount.findMany({ where: { userId: team.ownerId }, select: { id: true, smtpHost: true, smtpUsername: true } }),
  ]);

  res.json({
    team,
    myRole: isOwner ? 'owner' : myMembership?.role ?? 'viewer',
    resources: {
      deployments,
      databases,
      vpsInstances,
      smtpAccounts,
    },
  });
});

/**
 * POST /api/teams/:id/invites
 * Invite a new member by email with a role and optional per-resource permissions.
 */
teamsRouter.post('/teams/:id/invites', async (req: AuthedRequest, res) => {
  const inviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'developer', 'billing', 'viewer']),
    resourcePermissions: z.array(
      z.object({
        resourceType: z.enum(['deployment', 'managed_database', 'vps', 'smtp', 'livekit']),
        resourceId: z.string(),
        permission: z.enum(['manage', 'view', 'none']),
      })
    ).optional(),
  });

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const teamId = req.params.id;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const isOwner = team.ownerId === userId;
  const myMembership = team.members.find((m: any) => m.userId === userId);
  const canInvite = isOwner || myMembership?.role === 'admin' || req.user!.role === 'dev';

  if (!canInvite) return res.status(403).json({ error: 'Only team owners or admins can invite members' });

  // Generate secure invite token (expires in 7 days)
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const inviteData: any = {
    teamId,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    resourcePermissions: (parsed.data.resourcePermissions as any) ?? undefined,
    token,
    invitedByUserId: userId,
    expiresAt,
  };

  const invite = await prisma.teamInvite.create({
    data: inviteData,
  });

  const inviteLink = `${process.env.APP_URL || 'http://localhost:3000'}/team/accept?token=${token}`;

  res.status(201).json({
    invite,
    inviteLink,
    message: `Invitation generated for ${parsed.data.email}`,
  });
});

/**
 * GET /api/teams/invites/accept/:token
 * Inspect an invitation token.
 */
teamsRouter.get('/teams/invites/accept/:token', async (req: AuthedRequest, res) => {
  const invite = await prisma.teamInvite.findUnique({
    where: { token: req.params.token },
    include: {
      team: { include: { owner: { select: { id: true, displayName: true, email: true } } } },
      invitedByUser: { select: { id: true, displayName: true, email: true } },
    },
  });

  if (!invite) return res.status(404).json({ error: 'Invalid or expired invitation token' });
  if (invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(410).json({ error: 'This invitation link has expired or has already been used' });
  }

  res.json({ invite });
});

/**
 * POST /api/teams/invites/accept/:token
 * Claim invitation and join the team.
 */
teamsRouter.post('/teams/invites/accept/:token', async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const invite = await prisma.teamInvite.findUnique({
    where: { token: req.params.token },
  });

  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired invitation token' });
  }

  if (invite.email.toLowerCase() !== req.user!.email.toLowerCase()) {
    return res.status(403).json({ error: 'This invitation was issued for a different email address.' });
  }

  const existingMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId } },
  });

  if (existingMember) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted' },
    });
    return res.json({ ok: true, member: existingMember, message: 'You are already a member of this team.' });
  }

  // Create member record, granular resource permissions (if specified), and mark invite as accepted
  const member = await prisma.$transaction(async (tx) => {
    const newMember = await tx.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        role: invite.role,
      },
    });

    const rawPermissions = (invite as any).resourcePermissions;
    if (rawPermissions && Array.isArray(rawPermissions)) {
      await tx.resourcePermission.createMany({
        data: (rawPermissions as any[]).map((p) => ({
          teamMemberId: newMember.id,
          resourceType: p.resourceType,
          resourceId: p.resourceId,
          permission: p.permission,
        })),
      });
    }

    await tx.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted' },
    });

    return newMember;
  });

  res.json({ ok: true, member });
});

/**
 * PATCH /api/teams/:id/members/:memberId
 * Update a team member's role or resource permissions.
 */
teamsRouter.patch('/teams/:id/members/:memberId', async (req: AuthedRequest, res) => {
  const patchSchema = z.object({
    role: z.enum(['admin', 'developer', 'billing', 'viewer']).optional(),
    permissions: z.array(
      z.object({
        resourceType: z.enum(['deployment', 'managed_database', 'vps', 'smtp', 'livekit']),
        resourceId: z.string(),
        permission: z.enum(['manage', 'view', 'none']),
      })
    ).optional(),
  });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const { id: teamId, memberId } = req.params;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const targetMember = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!targetMember || targetMember.teamId !== teamId) {
    return res.status(404).json({ error: 'Member not found in this team' });
  }

  if (team.ownerId !== userId && req.user!.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Only the team owner can edit member roles' });
  }

  const updatedMember = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      role: parsed.data.role,
    },
  });

  // Update granular resource permissions if passed
  if (parsed.data.permissions) {
    await prisma.resourcePermission.deleteMany({ where: { teamMemberId: memberId } });
    await prisma.resourcePermission.createMany({
      data: parsed.data.permissions.map((p: any) => ({
        teamMemberId: memberId,
        resourceType: p.resourceType,
        resourceId: p.resourceId,
        permission: p.permission,
      })),
    });
  }

  res.json({ member: updatedMember });
});

/**
 * DELETE /api/teams/:id/members/:memberId
 * Remove a member from the team.
 */
teamsRouter.delete('/teams/:id/members/:memberId', async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { id: teamId, memberId } = req.params;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const isOwner = team.ownerId === userId;
  const isSelf = member.userId === userId;

  if (!isOwner && !isSelf && req.user!.role !== 'admin' && req.user!.role !== 'dev') {
    return res.status(403).json({ error: 'Permission denied' });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  res.json({ ok: true, deletedId: memberId });
});
