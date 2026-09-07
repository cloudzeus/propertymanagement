import { redirect } from "next/navigation";

/** The fault report moved to the shared, role-agnostic /report page. */
export default function NewRequestRedirect() {
  redirect("/report");
}
