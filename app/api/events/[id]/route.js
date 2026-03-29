import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req, { params }) {
  try {
    const slug = (await params).id;
    const { rows } = await db.query('SELECT * FROM event_types WHERE slug = $1', [slug]);
    if (rows.length === 0) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Update event type
export async function PUT(req, { params }) {
  try {
    const id = (await params).id;
    const body = await req.json();
    const { name, duration, slug, meeting_mode, platform, location, custom_link } = body;
    const mode = meeting_mode || 'online';

    const { rows } = await db.query(
      'UPDATE event_types SET name = $1, duration = $2, slug = $3, meeting_mode = $4, platform = $5, location = $6, custom_link = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *',
      [
        name, 
        duration, 
        slug, 
        mode, 
        mode === 'online' ? (platform || 'google_meet') : null, 
        mode === 'offline' ? (location || null) : null, 
        custom_link || null, 
        id
      ]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Delete event type
export async function DELETE(req, { params }) {
  try {
    const id = (await params).id;
    
    // Check if there are active bookings
    const check = await db.query('SELECT id FROM bookings WHERE event_type_id = $1 LIMIT 1', [id]);
    if (check.rows.length > 0) {
      return NextResponse.json({ error: 'Cannot delete event with active bookings' }, { status: 400 });
    }

    await db.query('DELETE FROM event_types WHERE id = $1', [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
