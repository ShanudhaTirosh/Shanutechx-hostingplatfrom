const { execFile } = require('child_process');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      cmd,
      args,
      { ...opts, maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve({ stdout, stderr });
      }
    );
    if (opts.onData) {
      child.stdout?.on('data', opts.onData);
      child.stderr?.on('data', opts.onData);
    }
  });
}

/**
 * Builds the workspace directory into a tagged image using Railpack.
 * Railpack auto-detects Node.js vs Python and produces an appropriate
 * image — this is what lets the platform support both runtimes without
 * per-runtime build logic here.
 *
 * Using Railpack rather than Nixpacks deliberately: as of when this was
 * written, Nixpacks is in maintenance mode (critical fixes only, no new
 * features or providers) and Railway — its own maintainer — recommends
 * Railpack as the replacement. Railpack covers both runtimes this platform
 * needs.
 *
 * Requires:
 *   - the `railpack` CLI installed on the node (via mise, per Railpack's
 *     own quickstart — see the node-agent Dockerfile)
 *   - a BuildKit instance reachable via BUILDKIT_HOST, since Railpack
 *     builds through BuildKit rather than bundling its own build mechanism
 *     the way Nixpacks did — see the `buildkit` service in
 *     infra/*-stack/docker-compose.yml and BUILDKIT_HOST in .env.example.
 *
 * onData(chunk) is called with build output as it streams, so the API can
 * relay live build logs to the client dashboard.
 */
async function buildImage({ workspaceDir, imageTag, envVars = {}, onData }) {
  const args = ['build', workspaceDir, '--name', imageTag];

  for (const [key, value] of Object.entries(envVars)) {
    args.push('--env', `${key}=${value}`);
  }

  await run('railpack', args, { onData });

  return { imageTag };
}

module.exports = { buildImage };
