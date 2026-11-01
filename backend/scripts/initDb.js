import net from 'net';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootBackend = path.resolve(__dirname, '..');

const schemaPostgresPath = path.join(rootBackend, 'prisma', 'schema.postgresql.prisma');
const schemaSqlitePath = path.join(rootBackend, 'prisma', 'schema.sqlite.prisma');
const activeSchemaPath = path.join(rootBackend, 'prisma', 'schema.prisma');
const envPath = path.join(rootBackend, '.env');

function checkPort(host, port, timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  // Backup postgresql schema if not backed up
  if (!fs.existsSync(schemaPostgresPath) && fs.existsSync(activeSchemaPath)) {
    fs.copyFileSync(activeSchemaPath, schemaPostgresPath);
  }

  const isPostgresRunning = await checkPort('127.0.0.1', 5432);

  if (isPostgresRunning) {
    console.log('[DB Init] PostgreSQL is active on port 5432. Using PostgreSQL schema.');
    if (fs.existsSync(schemaPostgresPath)) {
      fs.copyFileSync(schemaPostgresPath, activeSchemaPath);
    }
    const envContent = `PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realtime_workspace?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=access_secret_super_secure_key_12345
JWT_REFRESH_SECRET=refresh_secret_super_secure_key_67890
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CHAT_MESSAGE_TTL_SECONDS=86400
`;
    fs.writeFileSync(envPath, envContent);
  } else {
    console.log('[DB Init] PostgreSQL not detected on port 5432.');
    console.log('[DB Init] Automatically configuring SQLite provider for local development.');
    fs.copyFileSync(schemaSqlitePath, activeSchemaPath);
    const envContent = `PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="file:./dev.db"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=access_secret_super_secure_key_12345
JWT_REFRESH_SECRET=refresh_secret_super_secure_key_67890
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CHAT_MESSAGE_TTL_SECONDS=86400
`;
    fs.writeFileSync(envPath, envContent);
  }

  console.log('[DB Init] Running prisma generate & db push...');
  execSync('npx prisma generate', { cwd: rootBackend, stdio: 'inherit' });
  execSync('npx prisma db push --skip-generate', { cwd: rootBackend, stdio: 'inherit' });
  console.log('[DB Init] Database ready!');
}

main().catch((err) => {
  console.error('[DB Init] Error initializing database:', err);
  process.exit(1);
});
