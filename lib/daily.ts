import { env } from "./env";

const BASE = "https://api.daily.co/v1";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DAILY_API_KEY ?? ""}`,
  };
}

export function roomNameForBuilding(buildingId: string): string {
  return `assembly-${buildingId}`;
}

export function transcriptionSettings() {
  return { language: "el", model: "nova-3", punctuate: true } as const;
}

/** Get-or-create a persistent, audio-recording-enabled room for a building. */
export async function ensureRoom(buildingId: string): Promise<string> {
  const name = roomNameForBuilding(buildingId);
  const get = await fetch(`${BASE}/rooms/${name}`, { headers: authHeaders(), cache: "no-store" });
  if (get.ok) return name;

  const res = await fetch(`${BASE}/rooms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        enable_recording: "cloud",
        recordings_template: "{room_name}/{date}",
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily ensureRoom failed: ${res.status} ${await res.text()}`);
  return name;
}

/** Short-lived meeting token scoped to one room + participant. */
export async function createMeetingToken(opts: {
  room: string;
  userName: string;
  userId: string;
  isOwner: boolean;
  expEpochSeconds: number;
}): Promise<string> {
  const res = await fetch(`${BASE}/meeting-tokens`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: opts.room,
        user_name: opts.userName,
        user_id: opts.userId,
        is_owner: opts.isOwner,
        exp: opts.expEpochSeconds,
        start_cloud_recording: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}
