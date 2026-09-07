import { redirect } from "next/navigation";

/** Units are managed inside each property/building; the menu entry lands on the properties list. */
export default function UnitsRedirect() {
  redirect("/super-admin/properties");
}
