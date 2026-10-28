const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

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
 * Auto-detects runtime (Node.js, Python, Go, Rust, Static Web) and generates a smart Dockerfile
 * if no Dockerfile is present in the workspace.
 */
function generateSmartDockerfile(workspaceDir, { startCommand, entryFile, frameworkPreset }) {
  const dockerfilePath = path.join(workspaceDir, 'Dockerfile');
  const lowerDockerfilePath = path.join(workspaceDir, 'dockerfile');

  if (fs.existsSync(dockerfilePath) || fs.existsSync(lowerDockerfilePath)) {
    return { isGenerated: false, runtime: 'custom-dockerfile' };
  }

  const pkgJsonPath = path.join(workspaceDir, 'package.json');
  const reqsTxtPath = path.join(workspaceDir, 'requirements.txt');
  const pyProject = path.join(workspaceDir, 'pyproject.toml');
  const mainPy = path.join(workspaceDir, 'main.py');
  const appPy = path.join(workspaceDir, 'app.py');
  const goModPath = path.join(workspaceDir, 'go.mod');
  const cargoPath = path.join(workspaceDir, 'Cargo.toml');
  const indexHtmlPath = path.join(workspaceDir, 'index.html');
  const indexPhpPath = path.join(workspaceDir, 'index.php');
  const composerPath = path.join(workspaceDir, 'composer.json');
  const lavalinkJarPath = path.join(workspaceDir, 'Lavalink.jar');

  let dockerfileContent = '';
  let runtime = 'unknown';

  if (fs.existsSync(pkgJsonPath)) {
    runtime = 'nodejs';
    let pkg = {};
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    } catch {
      // ignore json parse error
    }

    const scripts = pkg.scripts || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const hasBuild = Boolean(scripts.build);
    const hasStart = Boolean(scripts.start);
    const isNext = frameworkPreset === 'nextjs' || Boolean(deps.next);
    const isVite = frameworkPreset === 'react_vite' || Boolean(deps.vite);

    let startCmd = '["npm", "start"]';
    if (startCommand) {
      startCmd = `["sh", "-c", "${startCommand.replace(/"/g, '\\"')}"]`;
    } else if (isVite && !hasStart) {
      startCmd = '["sh", "-c", "if [ -d dist ]; then npx serve -s dist -l 3000; elif [ -d build ]; then npx serve -s build -l 3000; else npx serve -s . -l 3000; fi"]';
    } else if (!hasStart && entryFile) {
      startCmd = `["node", "${entryFile}"]`;
    } else if (!hasStart && fs.existsSync(path.join(workspaceDir, 'src', 'index.js'))) {
      startCmd = `["node", "src/index.js"]`;
    } else if (!hasStart && fs.existsSync(path.join(workspaceDir, 'src', 'index.ts'))) {
      startCmd = `["npx", "ts-node", "src/index.ts"]`;
    } else if (!hasStart && fs.existsSync(path.join(workspaceDir, 'index.js'))) {
      startCmd = `["node", "index.js"]`;
    }

    dockerfileContent = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
${hasBuild || isNext ? 'RUN npm run build\n' : ''}EXPOSE 3000 4000 8080
CMD ${startCmd}
`;
  } else if (fs.existsSync(reqsTxtPath) || fs.existsSync(pyProject) || fs.existsSync(mainPy) || fs.existsSync(appPy)) {
    runtime = 'python';
    const pyEntry = fs.existsSync(mainPy) ? 'main.py' : fs.existsSync(appPy) ? 'app.py' : 'main.py';
    const startCmd = startCommand ? `["sh", "-c", "${startCommand.replace(/"/g, '\\"')}"]` : `["python", "${pyEntry}"]`;

    dockerfileContent = `FROM python:3.11-slim
WORKDIR /app
COPY . .
${fs.existsSync(reqsTxtPath) ? 'RUN pip install --no-cache-dir -r requirements.txt\n' : ''}EXPOSE 8000 5000 3000
CMD ${startCmd}
`;
  } else if (fs.existsSync(goModPath)) {
    runtime = 'go';
    dockerfileContent = `FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o server .
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080 3000
CMD ["./server"]
`;
  } else if (fs.existsSync(cargoPath)) {
    runtime = 'rust';
    dockerfileContent = `FROM rust:1.78-alpine AS builder
WORKDIR /app
COPY . .
RUN cargo build --release
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/target/release/* /app/
EXPOSE 8080 3000
CMD ["sh", "-c", "find /app -maxdepth 1 -type f -executable -exec {} \\;"]
`;
  } else if (fs.existsSync(lavalinkJarPath) || frameworkPreset === 'lavalink_java') {
    runtime = 'java-lavalink';
    const startCmd = startCommand ? `["sh", "-c", "${startCommand.replace(/"/g, '\\"')}"]` : `["java", "-jar", "Lavalink.jar"]`;
    dockerfileContent = `FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY . .
EXPOSE 2333 8080
CMD ${startCmd}
`;
  } else if (fs.existsSync(indexPhpPath) || fs.existsSync(composerPath)) {
    runtime = 'php';
    dockerfileContent = `FROM php:8.2-apache
WORKDIR /var/www/html
COPY . /var/www/html
RUN a2enmod rewrite || true
EXPOSE 80 3000
CMD ["apache2-foreground"]
`;
  } else if (fs.existsSync(indexHtmlPath)) {
    runtime = 'static-html';
    dockerfileContent = `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80 3000
CMD ["nginx", "-g", "daemon off;"]
`;
  } else {
    runtime = 'generic-fallback';
    const startCmd = startCommand ? `["sh", "-c", "${startCommand.replace(/"/g, '\\"')}"]` : `["sh", "-c", "echo App ready && tail -f /dev/null"]`;
    dockerfileContent = `FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE 8080 3000
CMD ${startCmd}
`;
  }

  fs.writeFileSync(dockerfilePath, dockerfileContent, 'utf8');
  return { isGenerated: true, runtime, dockerfilePath };
}

/**
 * Serializes a NixpacksConfig object into a nixpacks.toml file content.
 */
function generateNixpacksToml(config) {
  if (!config || typeof config !== 'object') return '';
  const lines = ['# Generated by ShanuTechX Platform'];
  if (config.providers && Array.isArray(config.providers)) {
    lines.push(`providers = ${JSON.stringify(config.providers)}`);
  }
  if (config.buildImage) {
    lines.push(`buildImage = "${config.buildImage}"`);
  }
  if (config.variables && typeof config.variables === 'object') {
    lines.push('\n[variables]');
    for (const [k, v] of Object.entries(config.variables)) {
      lines.push(`${k} = "${v}"`);
    }
  }
  if (config.staticEnv && typeof config.staticEnv === 'object') {
    lines.push('\n[staticEnv]');
    for (const [k, v] of Object.entries(config.staticEnv)) {
      lines.push(`${k} = "${v}"`);
    }
  }
  if (config.phases && typeof config.phases === 'object') {
    for (const [phaseName, phase] of Object.entries(config.phases)) {
      if (!phase) continue;
      lines.push(`\n[phases.${phaseName}]`);
      if (phase.nixPkgs && Array.isArray(phase.nixPkgs)) {
        lines.push(`nixPkgs = ${JSON.stringify(phase.nixPkgs)}`);
      }
      if (phase.aptPkgs && Array.isArray(phase.aptPkgs)) {
        lines.push(`aptPkgs = ${JSON.stringify(phase.aptPkgs)}`);
      }
      if (phase.cmds && Array.isArray(phase.cmds)) {
        lines.push(`cmds = ${JSON.stringify(phase.cmds)}`);
      }
      if (phase.dependsOn && Array.isArray(phase.dependsOn)) {
        lines.push(`dependsOn = ${JSON.stringify(phase.dependsOn)}`);
      }
    }
  }
  if (config.start && typeof config.start === 'object') {
    lines.push('\n[start]');
    if (config.start.cmd) lines.push(`cmd = "${config.start.cmd}"`);
    if (config.start.runImage) lines.push(`runImage = "${config.start.runImage}"`);
    if (config.start.onlyIncludeFiles && Array.isArray(config.start.onlyIncludeFiles)) {
      lines.push(`onlyIncludeFiles = ${JSON.stringify(config.start.onlyIncludeFiles)}`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Helper to build with native Docker / Smart Dockerfile
 */
async function executeDockerBuild({
  workspaceDir,
  imageTag,
  envVars = {},
  startCommand,
  entryFile,
  frameworkPreset,
  log,
  onData,
}) {
  const dockerfileInfo = generateSmartDockerfile(workspaceDir, { startCommand, entryFile, frameworkPreset });

  if (dockerfileInfo.isGenerated) {
    log(`Auto-generated Dockerfile for detected runtime (${dockerfileInfo.runtime}).`);
  } else {
    log('Using custom Dockerfile from repository root.');
  }

  const dockerArgs = ['build', '-t', imageTag, '.'];
  for (const [key, value] of Object.entries(envVars)) {
    dockerArgs.push('--build-arg', `${key}=${value}`);
  }

  await run('docker', dockerArgs, { cwd: workspaceDir, onData });
  log('Docker Engine build succeeded!');
  return { imageTag, builder: dockerfileInfo.isGenerated ? 'smart-dockerfile' : 'dockerfile' };
}

/**
 * Builds the workspace directory into a tagged image.
 * Multi-Tier Build Engine Strategy:
 *   Tier 1: Railpack CLI (Railway's open-source successor to Nixpacks)
 *   Tier 2: Nixpacks CLI (Railway's buildpack CLI)
 *   Tier 3: Containerized Nixpacks Runner (Official Railway Docker Nixpacks)
 *   Tier 4: Native Dockerfile & Smart Dockerfile Auto-Detector & Generator
 *
 * Supports explicit builder override via `builder`:
 *   - 'RAILWAYPACK': Prioritizes Railpack / Nixpacks with smart fallback.
 *   - 'NIXPACKS': Prioritizes Nixpacks CLI / Container with smart fallback.
 *   - 'DOCKERFILE': Skips buildpacks and builds using Docker / Smart Dockerfile.
 *   - 'AUTO' (default): Multi-tier resilient fallback.
 */
async function buildImage({
  workspaceDir,
  imageTag,
  envVars = {},
  startCommand,
  entryFile,
  frameworkPreset,
  builder,
  nixpacksConfig,
  onData,
}) {
  const log = (msg) => {
    if (onData) onData(Buffer.from(`[ShanutechX Builder] ${msg}\n`));
  };

  const selectedBuilder = (builder || 'AUTO').toUpperCase();
  log(`Build engine mode: ${selectedBuilder}`);

  // If nixpacksConfig was supplied, write nixpacks.toml into workspace if absent
  if (nixpacksConfig && typeof nixpacksConfig === 'object' && Object.keys(nixpacksConfig).length > 0) {
    const nixpacksTomlPath = path.join(workspaceDir, 'nixpacks.toml');
    if (!fs.existsSync(nixpacksTomlPath)) {
      try {
        const tomlContent = generateNixpacksToml(nixpacksConfig);
        fs.writeFileSync(nixpacksTomlPath, tomlContent, 'utf8');
        log('Generated nixpacks.toml from deployment configuration.');
      } catch (err) {
        log(`Warning: Failed to generate nixpacks.toml: ${err.message}`);
      }
    }
  }

  const hasCustomDockerfile = fs.existsSync(path.join(workspaceDir, 'Dockerfile')) || fs.existsSync(path.join(workspaceDir, 'dockerfile'));

  // If DOCKERFILE was explicitly selected, or if AUTO has a custom Dockerfile already provided in repo
  if (selectedBuilder === 'DOCKERFILE' || (selectedBuilder === 'AUTO' && hasCustomDockerfile)) {
    log('Building directly using Dockerfile...');
    return await executeDockerBuild({
      workspaceDir,
      imageTag,
      envVars,
      startCommand,
      entryFile,
      frameworkPreset,
      log,
      onData,
    });
  }

  // Tier 1: Railpack CLI (Railway Open-Source Engine)
  if (selectedBuilder === 'AUTO' || selectedBuilder === 'RAILWAYPACK') {
    try {
      log('Attempting build with Railpack CLI...');
      const railpackArgs = ['build', workspaceDir, '--name', imageTag];
      for (const [key, value] of Object.entries(envVars)) {
        railpackArgs.push('--env', `${key}=${value}`);
      }
      if (startCommand) {
        railpackArgs.push('--start-command', startCommand);
      }
      await run('railpack', railpackArgs, { onData });
      log('Railpack build succeeded!');
      return { imageTag, builder: 'railpack' };
    } catch (errRailpack) {
      log(`Railpack notice: ${errRailpack.message || errRailpack}`);
    }
  }

  // Tier 2: Nixpacks CLI (Railway Engine)
  if (selectedBuilder === 'AUTO' || selectedBuilder === 'NIXPACKS' || selectedBuilder === 'RAILWAYPACK') {
    try {
      log('Attempting build with Nixpacks CLI...');
      const nixpacksArgs = ['build', workspaceDir, '--name', imageTag];
      for (const [key, value] of Object.entries(envVars)) {
        nixpacksArgs.push('--env', `${key}=${value}`);
      }
      if (startCommand) {
        nixpacksArgs.push('--start-cmd', startCommand);
      }
      await run('nixpacks', nixpacksArgs, { onData });
      log('Nixpacks build succeeded!');
      return { imageTag, builder: 'nixpacks' };
    } catch (errNixpacks) {
      log(`Nixpacks CLI notice: ${errNixpacks.message || errNixpacks}`);
    }
  }

  // Tier 3: Containerized Nixpacks Runner (Official Railway Docker Nixpacks)
  if (selectedBuilder === 'AUTO' || selectedBuilder === 'NIXPACKS' || selectedBuilder === 'RAILWAYPACK') {
    try {
      log('Attempting containerized Nixpacks builder (ghcr.io/railwayapp/nixpacks:latest)...');
      const dockerSock = process.platform === 'win32' ? '//var/run/docker.sock' : '/var/run/docker.sock';
      const containerArgs = [
        'run', '--rm',
        '-v', `${dockerSock}:/var/run/docker.sock`,
        '-v', `${path.resolve(workspaceDir)}:/app`,
        '-w', '/app',
      ];
      for (const [key, value] of Object.entries(envVars)) {
        containerArgs.push('-e', `${key}=${value}`);
      }
      containerArgs.push('ghcr.io/railwayapp/nixpacks:latest', 'build', '/app', '--name', imageTag);
      if (startCommand) {
        containerArgs.push('--start-cmd', startCommand);
      }
      await run('docker', containerArgs, { onData });
      log('Containerized Nixpacks build succeeded!');
      return { imageTag, builder: 'nixpacks-container' };
    } catch (errContainerNixpacks) {
      log(`Containerized Nixpacks notice: ${errContainerNixpacks.message || errContainerNixpacks}`);
    }
  }

  // Tier 4: Smart Docker Engine Auto-Detector & Generator
  log('Switching to Smart Docker Engine...');
  return await executeDockerBuild({
    workspaceDir,
    imageTag,
    envVars,
    startCommand,
    entryFile,
    frameworkPreset,
    log,
    onData,
  });
}

module.exports = { buildImage, generateSmartDockerfile, generateNixpacksToml };
