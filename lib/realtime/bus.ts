import { EventEmitter } from "node:events";

/** Building-scoped realtime notifications. In-process only — the deploy is a
 *  single Node instance; a Redis adapter replaces this if we ever scale out. */
export type BuildingEventType =
  | "payment" | "expense" | "announcement" | "maintenance" | "calendar"
  | "assembly" | "file" | "contact" | "koinochrista" | "unit";

export type BuildingEvent = { type: BuildingEventType };

/** Company-wide channel for staff screens that span every building (work center). */
export type CompanyEventType = "work";
export type CompanyEvent = { type: CompanyEventType };
const COMPANY_CHANNEL = "company";
/** Building event types that also change the company work center. */
const WORK_RELEVANT: ReadonlySet<BuildingEventType> = new Set(["maintenance", "calendar"]);

const g = globalThis as unknown as { __rtBus?: EventEmitter };
const bus = (g.__rtBus ??= (() => {
  const e = new EventEmitter();
  e.setMaxListeners(500);
  return e;
})());

export function publishBuildingEvent(buildingId: string, type: BuildingEventType): void {
  try {
    bus.emit(`building:${buildingId}`, { type } satisfies BuildingEvent);
  } catch {
    // Notifications must never break the mutation that triggered them.
  }
  if (WORK_RELEVANT.has(type)) publishCompanyEvent("work");
}

export function publishCompanyEvent(type: CompanyEventType): void {
  try {
    bus.emit(COMPANY_CHANNEL, { type } satisfies CompanyEvent);
  } catch {
    // never break the caller
  }
}

export function subscribeCompany(listener: (e: CompanyEvent) => void): () => void {
  const safe = (e: CompanyEvent) => { try { listener(e); } catch {} };
  bus.on(COMPANY_CHANNEL, safe);
  return () => bus.off(COMPANY_CHANNEL, safe);
}

export function subscribeBuilding(buildingId: string, listener: (e: BuildingEvent) => void): () => void {
  const channel = `building:${buildingId}`;
  const safe = (e: BuildingEvent) => { try { listener(e); } catch {} };
  bus.on(channel, safe);
  return () => bus.off(channel, safe);
}
