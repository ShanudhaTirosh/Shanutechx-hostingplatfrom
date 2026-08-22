/**
 * projects.js — Provision Supabase-like database projects on the node.
 *
 * Each project gets:
 *   • A dedicated Postgres DB + role (via docker exec into the postgres container)
 *   • A lightweight auto-CRUD REST API container (using PostgREST)
 *
 * The auto-generated REST API is exposed on an ephemeral host port that the
 * control-plane stores and hands back to customers.
 *
 * Requirements on the node:
 *   • A shared postgres container named `shanutechx-postgres` (started by
 *     the node-stack compose file).
 *   • Docker available via the docker socket.
 */
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const POSTGRES_CONTAINER = process.env.POSTGRES_CONTAINER || 'shanutechx-postgres';
const POSTGRES_SUPERUSER = process.env.POSTGRES_SUPERUSER || 'postgres';

/**
 * Run a SQL statement inside the shared postgres container.
 */
async function pgExec(sql) {
  const escaped = sql.replace(/'/g, "\\'");
  const { stdout, stderr } = await execAsync(
    `docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_SUPERUSER} -c '${escaped}'`
  );
  return { stdout, stderr };
}

/**
 * Provision a new project database.
 * Returns { apiPort } — the host port where PostgREST is running.
 */
async function provisionProject({ projectId, dbName, dbUsername, password }) {
  // 1. Create the role and database
  await pgExec(`CREATE ROLE "${dbUsername}" WITH LOGIN PASSWORD '${password}';`);
  await pgExec(`CREATE DATABASE "${dbName}" OWNER "${dbUsername}";`);
  await pgExec(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUsername}";`);

  // 2. Start a PostgREST container for instant CRUD API
  const containerName = `project-api-${projectId}`;

  // Pick a random free port in 18000-19000 range
  const apiPort = 18000 + (Math.abs(hashCode(projectId)) % 1000);

  // Postgres host from PostgREST's perspective — same docker network
  const postgresHost = process.env.POSTGRES_HOST || 'shanutechx-postgres';

  const pgrstConnStr = `postgres://${dbUsername}:${password}@${postgresHost}:5432/${dbName}`;

  await execAsync(
    `docker run -d --name ${containerName} ` +
    `--network shanutechx-internal ` +
    `-p ${apiPort}:3000 ` +
    `-e PGRST_DB_URI="${pgrstConnStr}" ` +
    `-e PGRST_DB_SCHEMA="public" ` +
    `-e PGRST_DB_ANON_ROLE="${dbUsername}" ` +
    `-e PGRST_JWT_SECRET="${process.env.NODE_AGENT_SECRET}" ` +
    `--restart unless-stopped ` +
    `postgrest/postgrest:latest`
  );

  // Get container ID
  const { stdout: cid } = await execAsync(`docker inspect -f '{{.Id}}' ${containerName}`);
  const containerId = cid.trim().slice(0, 12);

  return { apiPort, containerId };
}

/**
 * Deprovision a project — stops the API container and drops the DB/role.
 */
async function deprovisionProject({ projectId, dbName, dbUsername }) {
  const containerName = `project-api-${projectId}`;

  // Stop and remove the PostgREST container (best-effort)
  await execAsync(`docker rm -f ${containerName}`).catch(() => {});

  // Drop the database and role
  await pgExec(`DROP DATABASE IF EXISTS "${dbName}";`).catch(() => {});
  await pgExec(`DROP ROLE IF EXISTS "${dbUsername}";`).catch(() => {});
}

/**
 * Execute raw SQL in the project database via psql.
 * Returns { rows, fields, rowCount } compatible with the pg client format.
 */
async function execSql({ projectId, dbName, sql, dbUsername }) {
  // Write SQL to a temp file to avoid shell quoting issues
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpFile = path.join(os.tmpdir(), `shanutechx-sql-${Date.now()}.sql`);

  fs.writeFileSync(tmpFile, sql, 'utf8');

  try {
    const { stdout, stderr } = await execAsync(
      `docker exec -i ${POSTGRES_CONTAINER} ` +
      `psql -U ${POSTGRES_SUPERUSER} -d "${dbName}" ` +
      `--csv -c "$(cat ${tmpFile})"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse CSV output into rows/fields
    const lines = stdout.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return { rows: [], fields: [], rowCount: 0 };

    const fields = lines[0].split(',').map((name) => ({ name: name.trim(), dataTypeID: 0 }));
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(fields.map((f, i) => [f.name, values[i] ?? null]));
    });

    return { rows, fields, rowCount: rows.length };
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

/** List tables + columns for a project DB. */
async function listTables({ dbName }) {
  const { stdout } = await execAsync(
    `docker exec ${POSTGRES_CONTAINER} ` +
    `psql -U ${POSTGRES_SUPERUSER} -d "${dbName}" --csv -c ` +
    `"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"`
  );

  const lines = stdout.trim().split('\n').filter(Boolean).slice(1); // skip header
  const tableNames = lines.map((l) => l.trim().replace(/^"|"$/g, ''));

  const tables = await Promise.all(
    tableNames.map(async (tableName) => {
      const { stdout: colOut } = await execAsync(
        `docker exec ${POSTGRES_CONTAINER} ` +
        `psql -U ${POSTGRES_SUPERUSER} -d "${dbName}" --csv -c ` +
        `"SELECT column_name,data_type,is_nullable,` +
        `(SELECT COUNT(*) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name WHERE tc.constraint_type='PRIMARY KEY' AND kcu.table_name='${tableName}' AND kcu.column_name=c.column_name)>0 AS is_pk ` +
        `FROM information_schema.columns c WHERE table_name='${tableName}' AND table_schema='public' ORDER BY ordinal_position;"`
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

      // Row count
      let rowCount = 0;
      try {
        const { stdout: countOut } = await execAsync(
          `docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_SUPERUSER} -d "${dbName}" -t -c "SELECT COUNT(*) FROM \\"${tableName}\\";"`
        );
        rowCount = parseInt(countOut.trim(), 10) || 0;
      } catch (_) {}

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

module.exports = { provisionProject, deprovisionProject, execSql, listTables };
