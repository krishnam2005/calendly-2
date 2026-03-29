import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get all event types
export async function GET() {
  try {
    const { rows } = await db.query('SELECT * FROM event_types ORDER BY id ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Create new event type
export async function POST(req) {
  try {
    const body = await req.json();
    const { name, duration, slug, meeting_mode, platform, location, custom_link } = body;
    const mode = meeting_mode || 'online';
    
    const { rows } = await db.query(
      'INSERT INTO event_types (name, duration, slug, meeting_mode, platform, location, custom_link) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        name, 
        duration, 
        slug, 
        mode, 
        mode === 'online' ? (platform || 'google_meet') : null, 
        mode === 'offline' ? (location || null) : null, 
        custom_link || null
      ]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
