import Link from "next/link";
import { getLocale } from "next-intl/server";
import { MarketingShell } from "@/components/site/MarketingShell";
import { Wrap, btnClass } from "@/components/site/kit";

export const dynamic = "force-dynamic";

const COPY = {
  el: {
    confirmed: { title: "Η εγγραφή επιβεβαιώθηκε", body: "Ευχαριστούμε. Θα λαμβάνετε το μηνιαίο ενημερωτικό του Orithon. Μπορείτε να διαγραφείτε ανά πάσα στιγμή από τον σύνδεσμο στο τέλος κάθε email." },
    unsubscribed: { title: "Διαγραφήκατε από τη λίστα", body: "Δεν θα λάβετε άλλο ενημερωτικό. Τα στοιχεία σας παραμένουν μόνο ως απόδειξη της διαγραφής, όπως προβλέπει ο GDPR." },
    invalid: { title: "Ο σύνδεσμος δεν ισχύει", body: "Ο σύνδεσμος έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Αν θέλετε το ενημερωτικό, κάντε ξανά εγγραφή από τη σελίδα Νέα." },
    back: "Πίσω στην αρχική", news: "Νέα & άρθρα",
  },
  en: {
    confirmed: { title: "Subscription confirmed", body: "Thank you. You'll receive the monthly Orithon brief. You can unsubscribe at any time from the link at the bottom of every email." },
    unsubscribed: { title: "You have been unsubscribed", body: "No more newsletters will be sent. We keep your record only as proof of the opt-out, as GDPR requires." },
    invalid: { title: "This link is not valid", body: "The link has expired or was already used. To receive the brief, sign up again from the News page." },
    back: "Back to home", news: "News & articles",
  },
};

export default async function NewsletterStatusPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const locale = (await getLocale()) === "en" ? "en" : "el";
  const c = COPY[locale];
  const key = state === "confirmed" || state === "unsubscribed" ? state : "invalid";
  const m = c[key];
  return (
    <MarketingShell>
      <Wrap>
        <div className="mx-auto my-[80px] max-w-[560px] text-center">
          <h1 className="text-[length:var(--fs-32)] font-extrabold tracking-[-.02em] text-[var(--txt)]" style={{ textWrap: "balance" }}>{m.title}</h1>
          <p className="mt-4 text-[length:var(--fs-16)] leading-[1.65] text-[var(--mut)]">{m.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}`} className={btnClass("primary", "md")}>{c.back}</Link>
            <Link href={`/${locale}/blog`} className={btnClass("ghost", "md")}>{c.news}</Link>
          </div>
        </div>
      </Wrap>
    </MarketingShell>
  );
}
