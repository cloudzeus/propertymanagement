import { db } from '@/lib/db';
import { sendNotificationEmail } from '@/lib/mailgun';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, subject, message, consent, consentText } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user IP and User-Agent for tracking
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // Save contact message to database
    const contactMessage = await db.contactMessage.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
        ipAddress: ip,
        userAgent,
        status: 'NEW',
        // GDPR trail: only when the person ticked the box (the form requires it).
        consentText: consent ? String(consentText ?? 'Συναίνεση επικοινωνίας (φόρμα επικοινωνίας)') : null,
        consentedAt: consent ? new Date() : null,
      },
    });

    // Send confirmation email to user
    await sendNotificationEmail(
      email,
      'Λάβαμε το μήνυμά σας',
      `Γεια σας ${name},\n\nευχαριστούμε που επικοινωνήσατε μαζί μας. Λάβαμε το μήνυμά σας «${subject}» και θα σας απαντήσουμε εντός 24 εργάσιμων ωρών.\n\nΜε εκτίμηση,\nη ομάδα του Orithon`,
      { eyebrow: 'Φόρμα επικοινωνίας', tags: ['contact'] }
    );

    // Optionally: Send notification to admin
    // await sendNotificationEmail(
    //   'support@propertypro.com',
    //   `New contact form submission from ${name}`,
    //   `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubject: ${subject}\n\nMessage:\n${message}`
    // );

    return new Response(JSON.stringify({ success: true, messageId: contactMessage.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing contact form:', error);
    return new Response(JSON.stringify({ error: 'Failed to process contact form' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
