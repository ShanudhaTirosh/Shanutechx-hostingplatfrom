/**
 * projects.js — Provision Supabase-like database projects on the node.
 *
 * Each project gets:
 *   • A dedicated Postgres DB + role (via docker exec into the postgres container)
 *   • A lightweight auto-CRUD REST API container (using PostgREST)
 *
 * Requirements on the node:
 *   • A shared postgres container named `shanutechx-postgres` (started by
 *     the node-stack compose file).
 *   • Docker available via the docker socket.
 */
const { execFile } = require('child_process');
const util = require('util');
const net = require('net');

const execFileAsync = util.promisify(execFile);
const POSTGRES_CONTAINER = process.env.POSTGRES_CONTAINER || 'shanutechx-postgres';
const POSTGRES_SUPERUSER = process.env.POSTGRES_SUPERUSER || 'postgres';

function validateIdentifier(name, fieldName = 'Identifier') {
  if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid ${fieldName}: must contain only alphanumeric characters, underscores, or hyphens.`);
  }
}

function quoteSqlLiteral(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

/**
 * Run a SQL statement inside the shared postgres container via stdin using execFile.
 */
async function pgExec(sql, dbName = 'postgres', user = POSTGRES_SUPERUSER) {
  const { stdout, stderr } = await execFileAsync(
    'docker',
    ['exec', '-i', POSTGRES_CONTAINER, 'psql', '-U', user, '-d', dbName],
    { input: sql }
  );
  return { stdout, stderr };
}

/**
 * Provision a new project database.
 * Returns { apiPort, containerId } — the host port and container ID.
 */
async function provisionProject({ projectId, dbName, dbUsername, password }) {
  validateIdentifier(projectId, 'projectId');
  validateIdentifier(dbName, 'dbName');
  validateIdentifier(dbUsername, 'dbUsername');

  // 1. Create the role and database using superuser privileges
  await pgExec(`CREATE ROLE "${dbUsername}" WITH LOGIN PASSWORD ${quoteSqlLiteral(password)};`);
  await pgExec(`CREATE DATABASE "${dbName}" OWNER "${dbUsername}";`);
  await pgExec(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUsername}";`);

  // 2. Start a PostgREST container for instant CRUD API
  const containerName = `project-api-${projectId}`;
  await execFileAsync('docker', ['rm', '-f', containerName]).catch(() => {});

  const apiPort = await findAvailableApiPort(projectId);
  const postgresHost = process.env.POSTGRES_HOST || 'shanutechx-postgres';
  const encodedUser = encodeURIComponent(dbUsername);
  const encodedPass = encodeURIComponent(password);
  const pgrstConnStr = `postgres://${encodedUser}:${encodedPass}@${postgresHost}:5432/${dbName}`;
  const jwtSecret = process.env.NODE_AGENT_SECRET || process.env.JWT_SECRET || 'shanutechx_secure_jwt_secret_min_32_chars';

  await execFileAsync('docker', [
    'run', '-d',
    '--name', containerName,
    '--network', 'shanutechx-internal',
    '-p', `127.0.0.1:${apiPort}:3000`,
    '-e', `PGRST_DB_URI=${pgrstConnStr}`,
    '-e', 'PGRST_DB_SCHEMA=public',
    '-e', `PGRST_DB_ANON_ROLE=${dbUsername}`,
    '-e', `PGRST_JWT_SECRET=${jwtSecret}`,
    '--restart', 'unless-stopped',
    'postgrest/postgrest:latest'
  ]);

  const { stdout: cid } = await execFileAsync('docker', ['inspect', '-f', '{{.Id}}', containerName]);
  const containerId = cid.trim().slice(0, 12);

  return { apiPort, containerId };
}

/**
 * Deprovision a project — stops the API container and drops the DB/role.
 */
async function deprovisionProject({ projectId, dbName, dbUsername }) {
  if (projectId) validateIdentifier(projectId, 'projectId');
  if (dbName) validateIdentifier(dbName, 'dbName');
  if (dbUsername) validateIdentifier(dbUsername, 'dbUsername');

  const containerName = `project-api-${projectId}`;
  await execFileAsync('docker', ['rm', '-f', containerName]).catch(() => {});

  if (dbName) {
    await pgExec(`DROP DATABASE IF EXISTS "${dbName}";`).catch((err) => {
      console.warn(`[projects] Warning dropping database ${dbName}:`, err?.message || err);
    });
  }
  if (dbUsername) {
    await pgExec(`DROP ROLE IF EXISTS "${dbUsername}";`).catch((err) => {
      console.warn(`[projects] Warning dropping role ${dbUsername}:`, err?.message || err);
    });
  }
}

/**
 * Execute raw SQL in the project database via psql.
 * Connects under dbUsername (scoped role) if provided to prevent superuser escalation.
 */
async function execSql({ projectId, dbName, sql, dbUsername }) {
  if (projectId) validateIdentifier(projectId, 'projectId');
  if (dbName) validateIdentifier(dbName, 'dbName');
  if (dbUsername) validateIdentifier(dbUsername, 'dbUsername');

  const targetUser = dbUsername || POSTGRES_SUPERUSER;
  const guardedSql = `SET statement_timeout = 5000;\n${sql}`;

  const { stdout } = await execFileAsync(
    'docker',
    ['exec', '-i', POSTGRES_CONTAINER, 'psql', '-U', targetUser, '-d', dbName, '--csv'],
    { input: guardedSql, maxBuffer: 10 * 1024 * 1024 }
  );

  const lines = stdout.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { rows: [], fields: [], rowCount: 0 };

  const fields = lines[0].split(',').map((name) => ({ name: name.trim(), dataTypeID: 0 }));
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(fields.map((f, i) => [f.name, values[i] ?? null]));
  });

  return { rows, fields, rowCount: rows.length };
}

/** List tables + columns for a project DB. */
async function listTables({ dbName, dbUsername }) {
  if (dbName) validateIdentifier(dbName, 'dbName');
  if (dbUsername) validateIdentifier(dbUsername, 'dbUsername');

  const targetUser = dbUsername || POSTGRES_SUPERUSER;

  const { stdout } = await execFileAsync(
    'docker',
    [
      'exec', '-i', POSTGRES_CONTAINER, 'psql', '-U', targetUser, '-d', dbName, '--csv',
      '-c', "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
    ]
  );

  const lines = stdout.trim().split('\n').filter(Boolean).slice(1);
  const tableNames = lines.map((l) => l.trim().replace(/^"|"$/g, ''));

  const tables = await Promise.all(
    tableNames.map(async (tableName) => {
      validateIdentifier(tableName, 'tableName');
      const { stdout: colOut } = await execFileAsync(
        'docker',
        [
          'exec', '-i', POSTGRES_CONTAINER, 'psql', '-U', targetUser, '-d', dbName, '--csv',
          '-c', `SELECT column_name,data_type,is_nullable,(SELECT COUNT(*) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name WHERE tc.constraint_type='PRIMARY KEY' AND kcu.table_name='${tableName}' AND kcu.column_name=c.column_name)>0 AS is_pk FROM information_schema.columns c WHERE table_name='${tableName}' AND table_schema='public' ORDER BY ordinal_position;`
        ]
      );

      const colLines = colOut.trim().split('\n').filter(Boolean).slice(1);
      const columns = colLines.map((l) => {
        const parts = parseCsvLine(l);
        return {
          name: parts[0],
          type: parts[1],
          nullable: parts[2] === 'YES',
          isPrimaryKey: parts[3] === 't' || parts[3] === 'true',
        };
      });

      let rowCount = 0;
      try {
        const { stdout: countOut } = await execFileAsync(
          'docker',
          ['exec', '-i', POSTGRES_CONTAINER, 'psql', '-U', targetUser, '-d', dbName, '-t', '-c', `SELECT COUNT(*) FROM "${tableName}";`]
        );
        rowCount = parseInt(countOut.trim(), 10) || 0;
      } catch (err) {
        // Default to 0 rows if count query fails (e.g. view or permission restriction)
        rowCount = 0;
      }

      return { name: tableName, columns, rowCount };
    })
  );

  return tables;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function findAvailableApiPort(projectId) {
  const basePort = 18000 + (Math.abs(hashCode(projectId)) % 1000);
  if (await isPortAvailable(basePort)) return basePort;

  for (let offset = 1; offset < 1000; offset++) {
    const candidate = 18000 + ((Math.abs(hashCode(projectId)) + offset) % 1000);
    if (await isPortAvailable(candidate)) return candidate;
  }
  throw new Error('No available API ports found in range 18000-18999');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

async function insertRow({ projectId, dbName, tableName, row }) {
  if (projectId) validateIdentifier(projectId, 'projectId');
  validateIdentifier(dbName, 'dbName');
  validateIdentifier(tableName, 'tableName');
  const keys = Object.keys(row || {}).filter((k) => k !== 'dbName');
  if (keys.length === 0) throw new Error('At least one column value must be provided for insert');
  keys.forEach((k) => validateIdentifier(k, 'columnName'));
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const vals = keys.map((k) => quoteSqlLiteral(row[k])).join(', ');
  const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) RETURNING *;`;
  return execSql({ projectId, dbName, sql });
}

async function updateRow({ projectId, dbName, tableName, pkColumn = 'id', pkValue, row }) {
  if (projectId) validateIdentifier(projectId, 'projectId');
  validateIdentifier(dbName, 'dbName');
  validateIdentifier(tableName, 'tableName');
  validateIdentifier(pkColumn, 'pkColumn');
  const keys = Object.keys(row || {}).filter((k) => k !== 'dbName');
  if (keys.length === 0) throw new Error('At least one column value must be provided for update');
  keys.forEach((k) => validateIdentifier(k, 'columnName'));
  const setClauses = keys.map((k) => `"${k}" = ${quoteSqlLiteral(row[k])}`).join(', ');
  const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE "${pkColumn}" = ${quoteSqlLiteral(pkValue)} RETURNING *;`;
  return execSql({ projectId, dbName, sql });
}

async function deleteRow({ projectId, dbName, tableName, pkColumn = 'id', pkValue }) {
  if (projectId) validateIdentifier(projectId, 'projectId');
  validateIdentifier(dbName, 'dbName');
  validateIdentifier(tableName, 'tableName');
  validateIdentifier(pkColumn, 'pkColumn');
  const sql = `DELETE FROM "${tableName}" WHERE "${pkColumn}" = ${quoteSqlLiteral(pkValue)};`;
  return execSql({ projectId, dbName, sql });
}

module.exports = {
  provisionProject,
  deprovisionProject,
  execSql,
  listTables,
  validateIdentifier,
  insertRow,
  updateRow,
  deleteRow,
};

