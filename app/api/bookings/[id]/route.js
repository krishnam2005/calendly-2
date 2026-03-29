import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendRescheduleConfirmation, sendCancellationNotice } from '@/lib/email';
import { BOOKING_SELECT, hasOverlap } from '../route';

export async function GET(req, { params }) {
  try {
    const id = (await params).id;
    const { rows } = await db.query(`
      ${BOOKING_SELECT}
      WHERE b.id = $1 AND b.status = 'scheduled'
    `, [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const id = (await params).id;
    const { start_time, end_time } = await req.json();

    const bookingQuery = await db.query(
      "SELECT event_type_id FROM bookings WHERE id = $1 AND status = 'scheduled'",
      [id]
    );
    if (bookingQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const { event_type_id } = bookingQuery.rows[0];

    if (await hasOverlap(event_type_id, start_time, end_time, [id])) {
      return NextResponse.json({ error: 'New time slot is already booked.' }, { status: 409 });
    }

    await db.query(
      'UPDATE bookings SET start_time = $1, end_time = $2 WHERE id = $3',
      [start_time, end_time, id]
    );

    const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
    const booking = rows[0];

    sendRescheduleConfirmation(booking).catch(() => { });

    return NextResponse.json(booking);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const id = (await params).id;

    const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = rows[0];

    await db.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);

    sendCancellationNotice(booking).catch(err => {
      console.error('[Email] Background cancellation email failed:', err.message);
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
