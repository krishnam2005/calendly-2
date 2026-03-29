import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Delete availability for a day
export async function DELETE(req, { params }) {
  try {
    const day_of_week = (await params).day_of_week;
    await db.query('DELETE FROM availability WHERE day_of_week = $1', [day_of_week]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
