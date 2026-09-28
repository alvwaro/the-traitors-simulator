import { env } from '../shared/config/env';
import { pool } from '../infrastructure/database/connection';
import { checkDatabase } from '../infrastructure/database/healthCheck';
import { buildApp } from './app';

buildApp().listen(env.port, () => {
  console.log(`The Traitors API running on http://localhost:${env.port}`);
  void checkDatabase(pool);
});
