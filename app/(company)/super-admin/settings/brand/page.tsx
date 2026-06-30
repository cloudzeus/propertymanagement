import { getAppSettings, upsertAppSettings } from "@/lib/app-settings";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { RiPaletteLine } from "react-icons/ri";
import { BrandForm } from "./BrandForm";

export const metadata = { title: "Brand Settings — Super Admin" };

async function saveBrandSettings(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;

  await upsertAppSettings(
    {
      companyName:    formData.get("companyName") as string || undefined,
      colorPrimary:   formData.get("colorPrimary") as string || undefined,
      colorPrimaryDk: formData.get("colorPrimaryDk") as string || undefined,
      colorAccent:    formData.get("colorAccent") as string || undefined,
      colorSuccess:   formData.get("colorSuccess") as string || undefined,
      colorWarning:   formData.get("colorWarning") as string || undefined,
      colorDanger:    formData.get("colorDanger") as string || undefined,
      colorPurple:    formData.get("colorPurple") as string || undefined,
      colorTeal:      formData.get("colorTeal") as string || undefined,
      contactEmail:   (formData.get("contactEmail") as string) || null,
      contactPhone:   (formData.get("contactPhone") as string) || null,
      contactAddress: (formData.get("contactAddress") as string) || null,
      websiteUrl:     (formData.get("websiteUrl") as string) || null,
    },
    session.user.id,
  );

  revalidatePath("/", "layout");
}

export default async function BrandSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "var(--color-purple)18",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <RiPaletteLine style={{ fontSize: 20, color: "var(--color-purple)" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Brand Settings</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            Χρώματα, στοιχεία εταιρείας και εμφάνιση της εφαρμογής
          </p>
        </div>
      </div>

      <BrandForm settings={settings} action={saveBrandSettings} />
    </div>
  );
}
