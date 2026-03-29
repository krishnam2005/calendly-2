import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
