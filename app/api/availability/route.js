import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get all availability rules
export async function GET() {
  try {
    const { rows } = await db.query('SELECT * FROM availability ORDER BY day_of_week ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Update availability for a specific day
// (Creates if doesn't exist, updates if it does)
export async function POST(req) {
  try {
    const body = await req.json();
    const { day_of_week, start_time, end_time, timezone } = body;
    
    // Validate day
    if (day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: 'Invalid day_of_week (0-6)' }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO availability (day_of_week, start_time, end_time, timezone) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (day_of_week) 
       DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, timezone = EXCLUDED.timezone, created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [day_of_week, start_time, end_time, timezone]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
