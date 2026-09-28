import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

/** Recria o banco de testes do zero e aplica todas as migrações (as frases e comportamentos vêm junto). */
export default async function setup(): Promise<void> {
  const base = new URL(process.env.DATABASE_URL!);
  const name = `${base.pathname.slice(1).replace(/_test$/, '')}_test`;
  const admin = new Client({ connectionString: base.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const testUrl = new URL(base);
  testUrl.pathname = `/${name}`;
  const db = new Client({ connectionString: testUrl.toString() });
  await db.connect();
  const dir = join(process.cwd(), 'src', 'infrastructure', 'database', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort((a, b) => a.localeCompare(b))) {
    await db.query(readFileSync(join(dir, file), 'utf8'));
  }
  await db.end();
}
