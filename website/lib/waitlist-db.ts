import {readFileSync} from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

let connection: ReturnType<typeof postgres> | undefined;
export function waitlistDatabase() {
  if (!process.env.WAITLIST_DATABASE_URL) throw new Error('Waitlist database is not configured.');
  connection ??= postgres(process.env.WAITLIST_DATABASE_URL, {
    max: 1, prepare: false, connect_timeout: 10, idle_timeout: 20,
    ssl: {ca: readFileSync(path.join(process.cwd(), 'certs/supabase-ca.crt')), rejectUnauthorized: true},
  });
  return connection;
}
