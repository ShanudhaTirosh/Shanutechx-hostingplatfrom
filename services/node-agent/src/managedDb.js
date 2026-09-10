const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const IMAGES = {
  postgres: 'postgres:16-alpine',
  mysql: 'mysql:8',
  redis: 'redis:7-alpine',
  // Was declared in ManagedDatabaseType (packages/db/prisma/schema.prisma)
  // and exposed at the API layer, but never actually provisionable here —
  // requesting a mongodb database silently threw "Unknown database type".
  mongodb: 'mongo:7',
};

const DEFAULT_PORTS = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  mongodb: 27017,
};

/**
 * Runs a standalone database container on the node's internal Docker
 * network only — no port published to the host, no Traefik route. The
 * customer's app deployments reach it by container name (Docker's
 * internal DNS resolves container names within the same network), the
 * same way the control-plane's own Postgres/Redis are reached by `api`
 * and `worker` in docker-compose.yml.
 */
async function provisionDatabase({ databaseId, type, password }) {
  const image = IMAGES[type];
  if (!image) throw new Error(`Unknown database type: ${type}`);

  const containerName = `db-${databaseId}`;
  const internalPort = DEFAULT_PORTS[type];

  const env =
    type === 'postgres'
      ? [`POSTGRES_PASSWORD=${password}`, 'POSTGRES_USER=app', 'POSTGRES_DB=app']
      : type === 'mysql'
        ? [`MYSQL_ROOT_PASSWORD=${password}`, 'MYSQL_DATABASE=app']
        : type === 'mongodb'
          ? [`MONGO_INITDB_ROOT_USERNAME=app`, `MONGO_INITDB_ROOT_PASSWORD=${password}`, 'MONGO_INITDB_DATABASE=app']
          : [];

  const cmd = type === 'redis' ? ['redis-server', '--requirepass', password] : undefined;

  const container = await docker.createContainer({
    Image: image,
    name: containerName,
    Env: env,
    ...(cmd ? { Cmd: cmd } : {}),
    HostConfig: {
      NetworkMode: 'shanutechx-internal',
      RestartPolicy: { Name: 'unless-stopped' },
    },
  });

  await container.start();

  return { containerId: container.id, containerName, internalPort };
}

/**
 * Dynamically updates Docker cgroup resource limits (CPU cores, RAM memory)
 * for a running database container live without restarting it.
 */
async function scaleDatabase({ containerId, cpuLimit, memoryLimitMb }) {
  const container = docker.getContainer(containerId);
  const updateConfig = {};
  if (cpuLimit && cpuLimit > 0) {
    updateConfig.NanoCpus = Math.floor(cpuLimit * 1e9);
  }
  if (memoryLimitMb && memoryLimitMb > 0) {
    updateConfig.Memory = memoryLimitMb * 1024 * 1024;
  }

  await container.update(updateConfig);
  return { ok: true, containerId, cpuLimit, memoryLimitMb };
}

/**
 * Rotates master password live on a running database container.
 */
async function rotateDatabasePassword({ containerId, type, oldPassword, newPassword, masterUsername }) {
  const container = docker.getContainer(containerId);
  const username = masterUsername || (type === 'redis' ? 'default' : type === 'postgres' ? 'postgres' : 'root');

  let cmd = [];
  if (type === 'postgres') {
    const pgUser = username || 'postgres';
    cmd = ['psql', '-U', pgUser, '-c', `ALTER USER "${pgUser}" WITH PASSWORD '${newPassword}';` ];
  } else if (type === 'mysql') {
    const mysqlUser = username || 'root';
    cmd = ['mysql', `-u${mysqlUser}`, `-p${oldPassword}`, '-e', `ALTER USER '${mysqlUser}'@'%' IDENTIFIED BY '${newPassword}'; FLUSH PRIVILEGES;` ];
  } else if (type === 'redis') {
    cmd = oldPassword ? ['redis-cli', '-a', oldPassword, 'CONFIG', 'SET', 'requirepass', newPassword] : ['redis-cli', 'CONFIG', 'SET', 'requirepass', newPassword];
  } else if (type === 'mongodb') {
    const mongoUser = username || 'app';
    cmd = ['mongosh', '-u', mongoUser, '-p', oldPassword, '--eval', `db.changeUserPassword('${mongoUser}', '${newPassword}')` ];
  } else {
    throw new Error(`Unsupported database type for password rotation: ${type}`);
  }

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start();
  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const inspect = await exec.inspect();
  if (inspect.ExitCode !== 0) {
    throw new Error(`Live database password rotation failed (exit ${inspect.ExitCode}): ${output || 'exec error'}`);
  }

  return { ok: true, containerId };
}

module.exports = { provisionDatabase, scaleDatabase, rotateDatabasePassword };


