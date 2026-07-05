export type Audience = "ALL" | "OWNERS" | "RESIDENTS" | "CUSTOM";

export type Person = {
  id: string;
  name: string | null;
  email: string;
  role: "OWNER" | "RESIDENT";
  buildingId: string;
  unit: string | null;
};

export type Recipient = {
  id: string;
  name: string | null;
  email: string;
  buildingId: string;
  unit: string | null;
};

/** Filter pooled people by audience, then dedup by user id (first-seen wins). */
export function resolveRecipients(people: Person[], audience: Audience, customIds?: string[]): Recipient[] {
  let pool = people;
  if (audience === "OWNERS") pool = people.filter((p) => p.role === "OWNER");
  else if (audience === "RESIDENTS") pool = people.filter((p) => p.role === "RESIDENT");
  else if (audience === "CUSTOM") {
    const set = new Set(customIds ?? []);
    pool = people.filter((p) => set.has(p.id));
  }
  const map = new Map<string, Recipient>();
  for (const p of pool) {
    if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, email: p.email, buildingId: p.buildingId, unit: p.unit });
  }
  return [...map.values()];
}
