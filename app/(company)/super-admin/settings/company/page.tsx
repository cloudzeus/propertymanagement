import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { RiBuildingLine, RiTeamLine, RiBriefcaseLine, RiUserLine } from "react-icons/ri";
import { CompanyDetailClient } from "../../companies/[id]/CompanyDetailClient";

export const metadata = { title: "Εταιρία — Super Admin" };

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") redirect("/admin");

  // Single-tenant: the managing company that runs the property management
  // business is mandatory — it must always exist. Bootstrap it if missing.
  const companyInclude = {
    _count: { select: { users: true, properties: true, departments: true, employees: true } },
  } as const;

  let company = await db.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: companyInclude,
  });

  if (!company) {
    const created = await db.company.create({
      data: {
        name: "Διαχειρίστρια Εταιρία",
        slug: "managing-company",
        status: "ACTIVE",
      },
    });
    company = await db.company.findUnique({
      where: { id: created.id },
      include: companyInclude,
    });
  }

  if (!company) redirect("/super-admin");

  const [departments, positions, employees] = await Promise.all([
    db.department.findMany({
      where: { companyId: company.id },
      include: { _count: { select: { positions: true, employees: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.jobPosition.findMany({
      where: { companyId: company.id },
      include: { department: { select: { name: true } }, _count: { select: { employees: true } } },
      orderBy: { title: "asc" },
    }),
    db.employee.findMany({
      where: { companyId: company.id },
      include: {
        department: { select: { name: true } },
        jobPosition: { select: { title: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: "var(--color-primary)18",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {company.logoUrl
            ? <img src={company.logoUrl} alt={company.name} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "contain" }} />
            : <RiBuildingLine style={{ fontSize: 20, color: "var(--color-primary)" }} />
          }
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            {company.name}
          </h1>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
            {company.afm && <>ΑΦΜ: {company.afm} · </>}
            {company.legalForm && <>{company.legalForm} · </>}
            {company.city && <>{company.city}</>}
          </p>
        </div>

        {/* Quick stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          {[
            { icon: RiBuildingLine, label: "Ακίνητα", val: company._count.properties },
            { icon: RiUserLine, label: "Χρήστες", val: company._count.users },
            { icon: RiTeamLine, label: "Τμήματα", val: company._count.departments },
            { icon: RiBriefcaseLine, label: "Υπάλληλοι", val: company._count.employees },
          ].map(({ icon: Icon, label, val }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)" }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs + content */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 24px 24px" }}>
        <CompanyDetailClient
          company={company}
          departments={departments}
          positions={positions}
          employees={employees}
        />
      </div>
    </div>
  );
}
