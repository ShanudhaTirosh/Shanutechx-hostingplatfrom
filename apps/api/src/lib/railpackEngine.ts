import { prisma } from './prisma';
import { logger } from './logger';
import { buildAndRun, BuildEvent } from './nodeAgentClient';

export type RailpackStage =
  | 'source'
  | 'build'
  | 'test'
  | 'image'
  | 'deploy'
  | 'health_check'
  | 'live'
  | 'failed';

export interface RailpackPipelineOptions {
  deploymentId: string;
  repoUrl?: string;
  branch?: string;
  onStageChange?: (stage: RailpackStage, logs: string) => void;
  healthCheckUrl?: string;
  /** The node where the deployment lives — required to actually run the build. */
  node: { id: string; ip: string };
  internalPort: number;
  envVars?: Record<string, string>;
}

export interface PipelineResult {
  ok: boolean;
  pipelineRunId: string;
  finalStage: RailpackStage;
  error?: string;
  containerId?: string;
}

/**
 * Railpack Unified Build & Deployment Pipeline Engine
 * Executes multi-stage builds by delegating to buildAndRun on the target
 * node-agent. Each build event from the agent is mapped to a Railpack stage
 * and persisted in PipelineRun for dashboard visibility.
 *
 * Previously this was a stub that only wrote log strings without performing
 * any real work, causing every pipeline run to silently report success.
 */
export async function executeRailpackPipeline(
  options: RailpackPipelineOptions,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stageLogs: Partial<Record<RailpackStage, string>> = {};

  if (!options.repoUrl) {
    throw new Error('repoUrl is required to execute a Railpack pipeline');
  }

  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      deploymentId: options.deploymentId,
      currentStage: 'source',
      stageLogs: {},
    },
  });

  async function updateStage(stage: RailpackStage, logText: string, failed = false) {
    stageLogs[stage] = logText;
    options.onStageChange?.(stage, logText);
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        currentStage: failed ? 'failed' : stage,
        ...(failed ? { failedStage: stage } : { failedStage: null }),
        stageLogs: stageLogs as any,
      },
    });
  }

  try {
    await updateStage(
      'source',
      `[Source] Pulling repository source from ${options.repoUrl} (branch: ${options.branch || 'main'})`,
    );

    // Map node-agent BuildEvent phases to Railpack stages for progress tracking.
    const PHASE_TO_STAGE: Partial<Record<string, RailpackStage>> = {
      fetch: 'source',
      build: 'build',
      run: 'deploy',
      done: 'live',
    };

    let lastContainerId: string | undefined;

    const finalEvent = await buildAndRun(
      options.node,
      {
        deploymentId: options.deploymentId,
        repoUrl: options.repoUrl,
        branch: options.branch,
        internalPort: options.internalPort,
        envVars: options.envVars,
      },
      async (event: BuildEvent) => {
        if (event.containerId) lastContainerId = event.containerId;
        const stage = PHASE_TO_STAGE[event.phase];
        if (stage) {
          const logText = event.log ?? event.message ?? `[${stage}] In progress...`;
          // Best-effort stage update — don't let a DB error abort the build stream.
          await updateStage(stage, logText).catch((err) =>
            logger.warn({ deploymentId: options.deploymentId, err }, 'Failed to persist pipeline stage update'),
          );
        }
      },
    );

    if (finalEvent.phase === 'error') {
      throw new Error(finalEvent.message ?? 'Build failed on node agent');
    }

    const durationMs = Date.now() - startTime;
    await updateStage('live', `[Live] Deployment live & operational. Pipeline duration: ${durationMs}ms`);
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: { currentStage: 'live', durationMs, completedAt: new Date() },
    });

    return {
      ok: true,
      pipelineRunId: pipelineRun.id,
      finalStage: 'live',
      containerId: lastContainerId,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error({ deploymentId: options.deploymentId, err }, 'Railpack pipeline failed');

    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        currentStage: 'failed',
        errorMessage: err.message || 'Pipeline stage execution failed',
        durationMs,
        completedAt: new Date(),
      },
    });

    return {
      ok: false,
      pipelineRunId: pipelineRun.id,
      finalStage: 'failed',
      error: err.message || 'Pipeline stage execution failed',
    };
  }
}
