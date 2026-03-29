import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendRescheduleConfirmation } from '@/lib/email';
import { BOOKING_SELECT, hasOverlap } from '../../route';

export async function GET(req, { params }) {
  try {
    const token = (await params).token;
    const { rows } = await db.query(`
      ${BOOKING_SELECT}
      WHERE b.reschedule_token = $1 AND b.status = 'scheduled'
    `, [token]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const token = (await params).token;
    const { start_time, end_time } = await req.json();

    const existing = await db.query(
      "SELECT id, event_type_id FROM bookings WHERE reschedule_token = $1 AND status = 'scheduled'",
      [token]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found or already cancelled' }, { status: 404 });
    }

    const { id, event_type_id } = existing.rows[0];

    if (await hasOverlap(event_type_id, start_time, end_time, [id])) {
      return NextResponse.json({ error: 'New time slot is already booked.' }, { status: 409 });
    }

    await db.query(
      'UPDATE bookings SET start_time = $1, end_time = $2 WHERE id = $3',
      [start_time, end_time, id]
    );

    const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
    const booking = rows[0];

    sendRescheduleConfirmation(booking).catch(err => {
      console.error('[Email] Background reschedule email failed:', err.message);
    });

    return NextResponse.json(booking);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
