import { EventEmitter } from "node:events";

/** Building-scoped realtime notifications. In-process only — the deploy is a
 *  single Node instance; a Redis adapter replaces this if we ever scale out. */
export type BuildingEventType =
  | "payment" | "expense" | "announcement" | "maintenance" | "calendar"
  | "assembly" | "file" | "contact" | "koinochrista" | "unit";

export type BuildingEvent = { type: BuildingEventType };

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
}

export function subscribeBuilding(buildingId: string, listener: (e: BuildingEvent) => void): () => void {
  const channel = `building:${buildingId}`;
  const safe = (e: BuildingEvent) => { try { listener(e); } catch {} };
  bus.on(channel, safe);
  return () => bus.off(channel, safe);
}
