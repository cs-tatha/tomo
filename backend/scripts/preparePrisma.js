import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootBackend = path.resolve(__dirname, '..');
const schemaPath = path.join(rootBackend, 'prisma', 'schema.prisma');

const databaseUrl = process.env.DATABASE_URL || '';

console.log('[Prisma Prepare] Checking database configuration...');

if (fs.existsSync(schemaPath)) {
  let schemaContent = fs.readFileSync(schemaPath, 'utf8');

  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    console.log('[Prisma Prepare] PostgreSQL connection detected. Setting provider to "postgresql".');
    schemaContent = schemaContent.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  } else if (databaseUrl.startsWith('file:') || !databaseUrl) {
    console.log('[Prisma Prepare] SQLite connection or default detected. Setting provider to "sqlite".');
    schemaContent = schemaContent.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
  }

  fs.writeFileSync(schemaPath, schemaContent, 'utf8');
}

console.log('[Prisma Prepare] Running prisma generate...');
execSync('npx prisma generate', { cwd: rootBackend, stdio: 'inherit' });

if (databaseUrl) {
  console.log('[Prisma Prepare] Pushing database schema (db push)...');
  try {
    execSync('npx prisma db push --skip-generate', { cwd: rootBackend, stdio: 'inherit' });
    console.log('[Prisma Prepare] Database schema synchronized successfully.');
  } catch (err) {
    console.warn('[Prisma Prepare] Warning: db push exited with code, may retry on server start:', err.message);
  }
}

console.log('[Prisma Prepare] Prisma preparation complete.');
