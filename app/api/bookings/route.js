import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendBookingConfirmation, sendRescheduleConfirmation } from '@/lib/email';

const BOOKING_SELECT = `
  SELECT b.id, b.event_type_id, b.name AS invoke_name, b.email, 
         b.start_time, b.end_time, b.status,
         b.meeting_mode, b.meeting_link, b.platform, b.location,
         b.reschedule_token,
         e.name AS event_name, e.duration, e.slug
  FROM bookings b
  JOIN event_types e ON b.event_type_id = e.id
`;

async function hasOverlap(event_type_id, start_time, end_time, excludeIds = []) {
  let query = `
    SELECT id FROM bookings 
    WHERE event_type_id = $1 
    AND status = 'scheduled'
    AND (start_time < $3 AND end_time > $2)
  `;
  const params = [event_type_id, start_time, end_time];

  if (excludeIds.length > 0) {
    const placeholders = excludeIds.map((_, i) => `$${i + 4}`).join(', ');
    query += ` AND id NOT IN (${placeholders})`;
    params.push(...excludeIds);
  }

  const { rows } = await db.query(query, params);
  return rows.length > 0;
}

function generateMeetingLink(platform, custom_link) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const randChar = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const randNum = () => Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;

  switch (platform) {
    case 'google_meet':
      return `https://meet.google.com/${randChar(3)}-${randChar(4)}-${randChar(3)}`;
    case 'zoom':
      return `https://zoom.us/j/${randNum()}`;
    case 'teams':
      return `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${randChar(10)}%40thread.v2/0`;
    case 'custom':
      return custom_link || null;
    default:
      return `https://meet.google.com/${randChar(3)}-${randChar(4)}-${randChar(3)}`;
  }
}

export async function GET() {
  try {
    const { rows } = await db.query(`
      ${BOOKING_SELECT}
      WHERE b.status = 'scheduled'
      ORDER BY b.start_time DESC
    `);
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  const client = await db.getClient();
  try {
    const body = await req.json();
    const { event_type_id, name, email, start_time, end_time, reschedule_id, role } = body;

    await client.query('BEGIN');

    let rescheduled_from = null;
    let oldBooking = null;

    if (reschedule_id) {
      const { rows } = await client.query('SELECT * FROM bookings WHERE id = $1', [reschedule_id]);
      if (rows.length === 0) {
        throw new Error('Original booking not found');
      }
      oldBooking = rows[0];

      // Security check for User role
      if (role === 'user' && oldBooking.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: 'You are not authorized to reschedule this meeting.' }, { status: 403 });
      }
      rescheduled_from = oldBooking.id;
    }

    // Double booking prevention
    const excludeIds = rescheduled_from ? [rescheduled_from] : [];
    if (await hasOverlap(event_type_id, start_time, end_time, excludeIds)) {
      return NextResponse.json({ error: 'Time slot is already booked.' }, { status: 409 });
    }

    // Fetch event type config
    const eventTypeQuery = await client.query(
      'SELECT name, slug, meeting_mode, platform, location, custom_link, duration FROM event_types WHERE id = $1',
      [event_type_id]
    );
    if (eventTypeQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }
    const eventType = eventTypeQuery.rows[0];
    const mode = eventType.meeting_mode || 'online';

    let meeting_link = oldBooking?.meeting_link || null;
    let booking_location = oldBooking?.location || eventType.location || null;
    let platform = oldBooking?.platform || eventType.platform || null;

    if (mode === 'online' && !meeting_link) {
      meeting_link = generateMeetingLink(platform, eventType.custom_link);
    }

    if (rescheduled_from) {
      await client.query("UPDATE bookings SET status = 'rescheduled' WHERE id = $1", [rescheduled_from]);
    }

    const reschedule_token = crypto.randomBytes(32).toString('hex');

    const { rows } = await client.query(
      `INSERT INTO bookings 
        (event_type_id, name, email, start_time, end_time, meeting_mode, meeting_link, platform, location, reschedule_token, status, rescheduled_from) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled', $11) 
       RETURNING *`,
      [event_type_id, name, email, start_time, end_time, mode, meeting_link, platform, booking_location, reschedule_token, rescheduled_from]
    );

    const booking = {
      ...rows[0],
      invoke_name: rows[0].name,
      event_name: eventType.name,
      slug: eventType.slug,
      duration: eventType.duration,
    };

    await client.query('COMMIT');

    if (rescheduled_from) {
      sendRescheduleConfirmation(booking).catch(err => console.error('[Email] Reschedule failed:', err.message));
    } else {
      sendBookingConfirmation(booking).catch(err => console.error('[Email] Booking confirmation failed:', err.message));
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Time slot is already booked.' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
export { BOOKING_SELECT, hasOverlap };
