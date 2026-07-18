"use server";
import { computeDemoSlots, createDemoBooking, type DemoSlotDay } from "@/lib/demo-booking";

/** Public: available demo slots for the booking modal. */
export async function getDemoSlots(): Promise<DemoSlotDay[]> {
  return computeDemoSlots();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Public: book a demo slot. `website` is a honeypot — real users never fill it. */
export async function bookDemo(input: {
  name: string; email: string; phone?: string; company?: string; message?: string;
  slotIso: string; locale: string; website?: string;
}): Promise<{ ok: true; whenLabel: string } | { ok: false; error: string }> {
  if (input.website) return { ok: true, whenLabel: "" }; // bot — pretend success
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  if (name.length < 2 || name.length > 120) return { ok: false, error: "NAME" };
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: "EMAIL" };
  if ((input.message ?? "").length > 2000 || (input.phone ?? "").length > 40 || (input.company ?? "").length > 160) {
    return { ok: false, error: "INVALID" };
  }
  if (!input.slotIso || isNaN(Date.parse(input.slotIso))) return { ok: false, error: "SLOT" };

  const res = await createDemoBooking({ ...input, name, email });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, whenLabel: res.whenLabel };
}
