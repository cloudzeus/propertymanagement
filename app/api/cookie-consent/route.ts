import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, analytics, marketing, functional, essential } = body;

    // Get user IP and User-Agent for tracking
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // Calculate expiry date (12 months from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create or update cookie consent record
    await db.cookieConsent.upsert({
      where: { sessionId },
      create: {
        sessionId,
        analytics: analytics || false,
        marketing: marketing || false,
        functional: functional || false,
        essential: essential || true,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
      update: {
        analytics: analytics || false,
        marketing: marketing || false,
        functional: functional || false,
        essential: essential || true,
        expiresAt,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error saving cookie consent:', error);
    return new Response(JSON.stringify({ error: 'Failed to save preferences' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
