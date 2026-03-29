import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = process.env.SMTP_FROM || process.env.EMAIL_USER || 'noreply@schedulr.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

function isConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function platformName(p) {
  return ({ google_meet: 'Google Meet', zoom: 'Zoom', teams: 'Microsoft Teams', custom: 'Custom Link' })[p] || 'Meeting';
}

function buildMeetingDetails(booking) {
  let details = `
    <p><strong>Event:</strong> ${booking.event_name || 'Meeting'}</p>
    <p><strong>Date:</strong> ${formatDate(booking.start_time)}</p>
    <p><strong>Time:</strong> ${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}</p>
  `;

  if (booking.meeting_mode === 'online' && booking.meeting_link) {
    details += `
      <p><strong>Platform:</strong> ${platformName(booking.platform)}</p>
      <p><strong>Meeting Link:</strong> <a href="${booking.meeting_link}">${booking.meeting_link}</a></p>
    `;
  } else if (booking.meeting_mode === 'offline' && booking.location) {
    details += `<p><strong>Location:</strong> ${booking.location}</p>`;
  }

  return details;
}

export async function sendBookingConfirmation(booking) {
  if (!isConfigured() || !booking || !booking.email) return;

  const rescheduleUrl = `${APP_URL}/book/${booking.slug}?reschedule_token=${booking.reschedule_token}`;

  try {
    await transporter.sendMail({
      from: `"Schedulr" <${FROM}>`,
      to: booking.email,
      subject: `Meeting Confirmed: ${booking.event_name || 'Your booking'}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Your meeting is confirmed! ✓</h2>
          ${buildMeetingDetails(booking)}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 14px;">
            Need to change the time? <a href="${rescheduleUrl}">Reschedule your meeting</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Email] Failed to send booking confirmation:', err.message);
  }
}

export async function sendRescheduleConfirmation(booking) {
  if (!isConfigured() || !booking || !booking.email) return;

  const rescheduleUrl = `${APP_URL}/book/${booking.slug}?reschedule_token=${booking.reschedule_token}`;

  try {
    await transporter.sendMail({
      from: `"Schedulr" <${FROM}>`,
      to: booking.email,
      subject: `Meeting Rescheduled: ${booking.event_name || 'Your booking'}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Your meeting has been rescheduled</h2>
          <p style="color: #6b7280;">Here are your updated details:</p>
          ${buildMeetingDetails(booking)}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 14px;">
            Need to change again? <a href="${rescheduleUrl}">Reschedule your meeting</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Email] Failed to send reschedule confirmation:', err.message);
  }
}

export async function sendCancellationNotice(booking) {
  if (!isConfigured() || !booking || !booking.email) return;

  try {
    await transporter.sendMail({
      from: `"Schedulr" <${FROM}>`,
      to: booking.email,
      subject: `Meeting Cancelled: ${booking.event_name || 'Your booking'}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Your meeting has been cancelled</h2>
          <p style="color: #6b7280;">The following meeting has been cancelled:</p>
          ${buildMeetingDetails(booking)}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 14px;">
            Want to book again? Visit <a href="${APP_URL}">${APP_URL}</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Email] Failed to send cancellation notice:', err.message);
  }
}
