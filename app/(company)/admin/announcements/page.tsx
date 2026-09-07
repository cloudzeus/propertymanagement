import { redirect } from "next/navigation";

/** The announcements composer lives at /announcements; the menu href stays stable. */
export default function AdminAnnouncementsRedirect() {
  redirect("/announcements");
}
