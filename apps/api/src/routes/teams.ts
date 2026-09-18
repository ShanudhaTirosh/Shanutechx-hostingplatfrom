import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { sendTeamInviteNotification } from '../lib/notifications';
import { logger } from '../lib/logger';

export const teamsRouter = Router();

/**
 * GET /api/teams/public/invites/:token
 * Public unauthenticated endpoint to inspect invitation details before login/signup.
 */
teamsRouter.get('/teams/public/invites/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: {
      team: { include: { owner: { select: { id: true, displayName: true, email: true } } } },
      invitedByUser: { select: { id: true, displayName: true, email: true } },
    },
  });

  if (!invite) return res.status(404).json({ error: 'Invalid or expired invitation token' });
  if (invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(410).json({ error: 'This invitation link has expired or has already been used' });
  }

  res.json({
    id: invite.id,
    teamId: invite.teamId,
    teamName: invite.team.name,
    inviterName: invite.invitedByUser.displayName || invite.invitedByUser.email,
    inviterEmail: invite.invitedByUser.email,
    email: invite.email,
    role: invite.role,
    resourcePermissions: invite.resourcePermissions,
    expiresAt: invite.expiresAt,
    status: invite.status,
  });
});

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
  let [deployments, databases, vpsInstances, smtpAccounts] = await Promise.all([
    prisma.deployment.findMany({ where: { userId: team.ownerId }, select: { id: true, subdomain: true, status: true } }),
    prisma.managedDatabase.findMany({ where: { userId: team.ownerId }, select: { id: true, type: true, status: true, internalHost: true } }),
    prisma.vpsProvision.findMany({ where: { userId: team.ownerId }, select: { id: true, status: true, provider: true } }),
    prisma.smtpAccount.findMany({ where: { userId: team.ownerId }, select: { id: true, smtpHost: true, smtpUsername: true } }),
  ]);

  // Filter resources based on granular resource permissions for non-owner members
  const isStaff = req.user!.role === 'admin' || req.user!.role === 'dev';
  if (!isOwner && !isStaff && myMembership?.permissions && myMembership.permissions.length > 0) {
    const perms = myMembership.permissions;
    const allowed = (type: string, id: string) => perms.some((p: any) => p.resourceType === type && p.resourceId === id && p.permission !== 'none');
    deployments = deployments.filter((d: any) => allowed('deployment', d.id));
    databases = databases.filter((d: any) => allowed('managed_database', d.id));
    vpsInstances = vpsInstances.filter((v: any) => allowed('vps', v.id));
    smtpAccounts = smtpAccounts.filter((s: any) => allowed('smtp', s.id));
  }

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
 * Automatically dispatches an email notification to the target email.
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
    include: { members: true, owner: { select: { displayName: true, email: true } } },
  });

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const isOwner = team.ownerId === userId;
  const myMembership = team.members.find((m: any) => m.userId === userId);
  const canInvite = isOwner || myMembership?.role === 'admin' || req.user!.role === 'dev';

  if (!canInvite) return res.status(403).json({ error: 'Only team owners or admins can invite members' });

  // Validate that any specified resource permissions target valid resources owned by the team owner
  if (parsed.data.resourcePermissions && parsed.data.resourcePermissions.length > 0) {
    const check = await validateTeamResourcePermissions(team.ownerId, parsed.data.resourcePermissions);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }
  }

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

  const appBaseUrl = process.env.APP_URL || 'http://localhost:3000';
  const inviteLink = `${appBaseUrl}/team/accept?token=${token}`;
  const inviterName = (req.user as any).displayName || req.user!.email;

  // Dispatch background email notification automatically
  sendTeamInviteNotification({
    email: parsed.data.email.toLowerCase(),
    teamName: team.name,
    inviterName,
    role: parsed.data.role,
    inviteLink,
  }).catch((err) => {
    logger.error({ err, email: parsed.data.email, teamId }, 'Failed to send team invite email');
  });

  res.status(201).json({
    invite,
    inviteLink,
    message: `Invitation email sent automatically to ${parsed.data.email}`,
  });
});

/**
 * POST /api/teams/:id/invites/:inviteId/resend
 * Resend an invitation email.
 */
teamsRouter.post('/teams/:id/invites/:inviteId/resend', async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { id: teamId, inviteId } = req.params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.teamId !== teamId) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  const isOwner = team.ownerId === userId;
  const myMembership = team.members.find((m: any) => m.userId === userId);
  const canInvite = isOwner || myMembership?.role === 'admin' || req.user!.role === 'dev';

  if (!canInvite) return res.status(403).json({ error: 'Permission denied' });

  const appBaseUrl = process.env.APP_URL || 'http://localhost:3000';
  const inviteLink = `${appBaseUrl}/team/accept?token=${invite.token}`;
  const inviterName = (req.user as any).displayName || req.user!.email;

  await sendTeamInviteNotification({
    email: invite.email,
    teamName: team.name,
    inviterName,
    role: invite.role,
    inviteLink,
  });

  res.json({ ok: true, message: `Invitation email re-sent to ${invite.email}` });
});

/**
 * DELETE /api/teams/:id/invites/:inviteId
 * Revoke/delete a pending team invitation.
 */
teamsRouter.delete('/teams/:id/invites/:inviteId', async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { id: teamId, inviteId } = req.params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const isOwner = team.ownerId === userId;
  const myMembership = team.members.find((m: any) => m.userId === userId);
  const canRevoke = isOwner || myMembership?.role === 'admin' || req.user!.role === 'dev';

  if (!canRevoke) return res.status(403).json({ error: 'Permission denied' });

  await prisma.teamInvite.delete({ where: { id: inviteId } });
  res.json({ ok: true, deletedId: inviteId });
});

/**
 * GET /api/teams/invites/accept/:token
 * Inspect an invitation token (Authenticated version).
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
    if (parsed.data.permissions.length > 0) {
      const check = await validateTeamResourcePermissions(team.ownerId, parsed.data.permissions);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
    }
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

async function validateTeamResourcePermissions(
  ownerId: string,
  permissions: Array<{ resourceType: string; resourceId: string; permission: string }>
): Promise<{ valid: boolean; error?: string }> {
  for (const perm of permissions) {
    let exists = false;
    switch (perm.resourceType) {
      case 'deployment': {
        const item = await prisma.deployment.findUnique({ where: { id: perm.resourceId }, select: { userId: true } });
        exists = !!item && item.userId === ownerId;
        break;
      }
      case 'managed_database': {
        const item = await prisma.managedDatabase.findUnique({ where: { id: perm.resourceId }, select: { userId: true } });
        exists = !!item && item.userId === ownerId;
        break;
      }
      case 'vps': {
        const item = await prisma.vpsProvision.findUnique({ where: { id: perm.resourceId }, select: { userId: true } });
        exists = !!item && item.userId === ownerId;
        break;
      }
      case 'smtp': {
        const item = await prisma.smtpAccount.findUnique({ where: { id: perm.resourceId }, select: { userId: true } });
        exists = !!item && item.userId === ownerId;
        break;
      }
      case 'livekit': {
        const item = await prisma.liveKitProject.findUnique({ where: { id: perm.resourceId }, select: { userId: true } });
        exists = !!item && item.userId === ownerId;
        break;
      }
    }
    if (!exists) {
      return {
        valid: false,
        error: `Resource permission target "${perm.resourceId}" (${perm.resourceType}) does not exist or does not belong to the team owner.`,
      };
    }
  }
  return { valid: true };
}

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
