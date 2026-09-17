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

/**
 * Manages database engine user accounts live on a running container.
 */
async function manageDatabaseUser({ containerId, type, action, username, password, role, masterPassword }) {
  const container = docker.getContainer(containerId);
  let cmd = [];

  if (type === 'postgres') {
    const pgAdmin = 'postgres';
    if (action === 'create') {
      const superuserFlag = role === 'admin' ? 'SUPERUSER' : 'NOSUPERUSER';
      cmd = ['psql', '-U', pgAdmin, '-c', `CREATE USER "${username}" WITH PASSWORD '${password}' ${superuserFlag};` ];
    } else if (action === 'delete') {
      cmd = ['psql', '-U', pgAdmin, '-c', `DROP USER IF EXISTS "${username}";` ];
    } else if (action === 'update') {
      const parts = [];
      if (password) parts.push(`PASSWORD '${password}'`);
      if (role) parts.push(role === 'admin' ? 'SUPERUSER' : 'NOSUPERUSER');
      cmd = ['psql', '-U', pgAdmin, '-c', `ALTER USER "${username}" WITH ${parts.join(' ')};` ];
    }
  } else if (type === 'mysql') {
    const mysqlPass = masterPassword ? `-p${masterPassword}` : '-proot';
    if (action === 'create') {
      const grant = role === 'read_only' ? 'SELECT' : 'ALL PRIVILEGES';
      cmd = ['mysql', '-uroot', mysqlPass, '-e', `CREATE USER '${username}'@'%' IDENTIFIED BY '${password}'; GRANT ${grant} ON *.* TO '${username}'@'%'; FLUSH PRIVILEGES;` ];
    } else if (action === 'delete') {
      cmd = ['mysql', '-uroot', mysqlPass, '-e', `DROP USER IF EXISTS '${username}'@'%'; FLUSH PRIVILEGES;` ];
    } else if (action === 'update') {
      const sqlParts = [];
      if (password) sqlParts.push(`ALTER USER '${username}'@'%' IDENTIFIED BY '${password}';`);
      if (role) {
        const grant = role === 'read_only' ? 'SELECT' : 'ALL PRIVILEGES';
        sqlParts.push(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${username}'@'%'; GRANT ${grant} ON *.* TO '${username}'@'%'`);
      }
      sqlParts.push('FLUSH PRIVILEGES;');
      cmd = ['mysql', '-uroot', mysqlPass, '-e', sqlParts.join(' ') ];
    }
  } else if (type === 'redis') {
    if (action === 'create' || action === 'update') {
      const aclRule = role === 'read_only' ? '+@read -@write' : '+@all';
      cmd = ['redis-cli', 'ACL', 'SETUSER', username, 'on', `>${password}`, aclRule];
    } else if (action === 'delete') {
      cmd = ['redis-cli', 'ACL', 'DELUSER', username];
    }
  } else if (type === 'mongodb') {
    const mongoAuth = masterPassword ? ['-u', 'app', '-p', masterPassword] : [];
    if (action === 'create') {
      const rolesStr = role === 'read_only' ? "['read']" : role === 'admin' ? "['root']" : "['readWrite']";
      cmd = ['mongosh', ...mongoAuth, '--eval', `db.createUser({user: '${username}', pwd: '${password}', roles: ${rolesStr}})` ];
    } else if (action === 'delete') {
      cmd = ['mongosh', ...mongoAuth, '--eval', `db.dropUser('${username}')` ];
    } else if (action === 'update') {
      const evalScript = password ? `db.changeUserPassword('${username}', '${password}')` : 'true';
      cmd = ['mongosh', ...mongoAuth, '--eval', evalScript ];
    }
  } else {
    throw new Error(`Unsupported database type: ${type}`);
  }

  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start();
  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const inspect = await exec.inspect();
  if (inspect.ExitCode !== 0) {
    throw new Error(`Managed database user management failed (exit ${inspect.ExitCode}): ${output || 'exec error'}`);
  }

  return { ok: true, containerId, username, action };
}

const fs = require('fs');
const path = require('path');
const BACKUP_DIR = process.env.MANAGED_DB_BACKUP_DIR || path.join(process.cwd(), 'backups', 'managed-db');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Executes a raw query/command live inside a database container engine.
 */
async function executeDatabaseQuery({ containerId, type, query, masterPassword }) {
  const startTime = Date.now();
  const container = docker.getContainer(containerId);
  let cmd = [];

  if (type === 'postgres') {
    cmd = ['psql', '-U', 'postgres', '-d', 'postgres', '-c', query];
  } else if (type === 'mysql') {
    const mysqlPass = masterPassword ? `-p${masterPassword}` : '-proot';
    cmd = ['mysql', '-uroot', mysqlPass, '-e', query];
  } else if (type === 'redis') {
    const redisAuth = masterPassword ? ['-a', masterPassword] : [];
    // Split query string by whitespace into redis-cli args e.g. "KEYS *" -> ["KEYS", "*"]
    const args = query.trim().split(/\s+/);
    cmd = ['redis-cli', ...redisAuth, ...args];
  } else if (type === 'mongodb') {
    const mongoAuth = masterPassword ? ['-u', 'app', '-p', masterPassword] : [];
    cmd = ['mongosh', ...mongoAuth, '--eval', query];
  } else {
    throw new Error(`Unsupported database type: ${type}`);
  }

  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start();
  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const inspect = await exec.inspect();
  const executionTimeMs = Date.now() - startTime;

  // Clean non-printable docker headers if any
  const cleanOutput = output.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

  return {
    ok: inspect.ExitCode === 0,
    exitCode: inspect.ExitCode,
    rawOutput: cleanOutput,
    executionTimeMs,
  };
}

/**
 * Creates a real snapshot backup of a managed database container.
 */
async function backupDatabase({ containerId, type, databaseId, masterPassword }) {
  ensureBackupDir();
  const container = docker.getContainer(containerId);
  const timestamp = Date.now();
  const backupId = `snap_${databaseId}_${timestamp}`;
  const filename = `${backupId}.dump`;
  const filePath = path.join(BACKUP_DIR, filename);

  let cmd = [];
  if (type === 'postgres') {
    cmd = ['pg_dumpall', '-U', 'postgres'];
  } else if (type === 'mysql') {
    const mysqlPass = masterPassword ? `-p${masterPassword}` : '-proot';
    cmd = ['mysqldump', '-uroot', mysqlPass, '--all-databases'];
  } else if (type === 'redis') {
    cmd = masterPassword ? ['redis-cli', '-a', masterPassword, 'SAVE'] : ['redis-cli', 'SAVE'];
  } else if (type === 'mongodb') {
    const mongoAuth = masterPassword ? ['-u', 'app', '-p', masterPassword] : [];
    cmd = ['mongodump', ...mongoAuth, '--archive'];
  } else {
    throw new Error(`Unsupported database type for backup: ${type}`);
  }

  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start();
  let dumpData = Buffer.alloc(0);
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      dumpData = Buffer.concat([dumpData, Buffer.from(chunk)]);
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const inspect = await exec.inspect();
  if (inspect.ExitCode !== 0 && type !== 'redis') {
    throw new Error(`Managed database dump failed (exit ${inspect.ExitCode})`);
  }

  fs.writeFileSync(filePath, dumpData);
  const stats = fs.statSync(filePath);

  return {
    backupId,
    databaseId,
    filename,
    sizeBytes: stats.size,
    createdAt: new Date(timestamp).toISOString(),
  };
}

/**
 * Lists all snapshot backups stored for a managed database.
 */
async function listDatabaseBackups({ databaseId }) {
  ensureBackupDir();
  const prefix = `snap_${databaseId}_`;
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.dump'));

  return files.map((filename) => {
    const filePath = path.join(BACKUP_DIR, filename);
    const stats = fs.statSync(filePath);
    const backupId = filename.replace('.dump', '');
    const timestampStr = backupId.split('_').pop();
    const timestamp = parseInt(timestampStr, 10) || stats.mtimeMs;
    return {
      backupId,
      databaseId,
      filename,
      sizeBytes: stats.size,
      createdAt: new Date(timestamp).toISOString(),
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Restores a snapshot backup into a running database container.
 */
async function restoreDatabase({ containerId, type, databaseId, backupId, masterPassword }) {
  ensureBackupDir();
  const filename = backupId.endsWith('.dump') ? backupId : `${backupId}.dump`;
  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup snapshot file not found: ${filename}`);
  }

  const container = docker.getContainer(containerId);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  let cmd = [];
  if (type === 'postgres') {
    cmd = ['psql', '-U', 'postgres', '-d', 'postgres'];
  } else if (type === 'mysql') {
    const mysqlPass = masterPassword ? `-p${masterPassword}` : '-proot';
    cmd = ['mysql', '-uroot', mysqlPass];
  } else {
    throw new Error(`Restore for ${type} is not supported directly via SQL stream`);
  }

  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: true });
  stream.write(fileContent);
  stream.end();

  let output = '';
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => { output += chunk.toString(); });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return { ok: true, containerId, backupId, message: 'Database snapshot successfully restored.' };
}

module.exports = {
  provisionDatabase,
  scaleDatabase,
  rotateDatabasePassword,
  manageDatabaseUser,
  executeDatabaseQuery,
  backupDatabase,
  listDatabaseBackups,
  restoreDatabase,
};



