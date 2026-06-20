import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";
import { runMinutes } from "@/app/actions/assemblies";
import { uploadFile, buildingFolder } from "@/lib/bunnycdn";

// Daily signs each delivery as: base64( HMAC-SHA256( `${timestamp}.${rawBody}` ) )
// sent in headers X-Webhook-Signature + X-Webhook-Timestamp.
function verify(raw: string, signature: string | null, timestamp: string | null): boolean {
  const secret = env.DAILY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function findAssembly(roomName?: string) {
  if (!roomName) return null;
  return db.assembly.findFirst({
    where: { dailyRoomName: roomName, status: { in: ["SCHEDULED", "LIVE", "ENDED", "TRANSCRIBING"] } },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, buildingId: true, building: { select: { companyId: true, propertyId: true, property: { select: { customerId: true } } } } },
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text(); // raw FIRST

  // Daily's endpoint-verification ping during webhook creation: body is {"test":"test"}
  // and carries no valid signature. Must return 200 so the webhook can be created.
  if (raw.trim() === '{"test":"test"}') {
    return new Response("ok", { status: 200 });
  }

  const timestamp = req.headers.get("x-webhook-timestamp");
  if (!verify(raw, req.headers.get("x-webhook-signature"), timestamp)) {
    return new Response("invalid signature", { status: 401 });
  }

  // Replay protection: one row per delivery (keyed on the signed string). A replay
  // reuses the exact timestamp+body, so the insert conflicts and we drop it with 200.
  const dedupeId = crypto.createHash("sha256").update(`${timestamp}.${raw}`).digest("hex");
  try {
    await db.processedWebhook.create({ data: { id: dedupeId, source: "daily" } });
  } catch {
    return new Response("duplicate", { status: 200 });
  }

  const evt = JSON.parse(raw) as { type: string; payload?: any };
  const p = evt.payload ?? {};
  const assembly = await findAssembly(p.room ?? p.room_name);

  switch (evt.type) {
    case "meeting.started": {
      if (assembly) await db.assembly.update({ where: { id: assembly.id }, data: { status: "LIVE", dailySessionId: p.session_id ?? null } });
      break;
    }
    case "participant.joined": {
      if (assembly) {
        await db.assemblyParticipant.updateMany({
          where: { assemblyId: assembly.id, userId: p.user_id ?? undefined },
          data: { joinedAt: new Date() },
        });
      }
      break;
    }
    case "participant.left": {
      if (assembly && p.duration) {
        // accumulate seconds + bill participant-minutes
        await db.assemblyParticipant.updateMany({
          where: { assemblyId: assembly.id, userId: p.user_id ?? undefined },
          data: { leftAt: new Date(), durationSeconds: { increment: Math.round(p.duration) } },
        });
        await logAPIUsage({
          apiName: "daily",
          requestCount: Math.ceil(p.duration / 60), // minutes
          buildingId: assembly.buildingId,
          customerId: assembly.building.property?.customerId ?? undefined,
          companyId: assembly.building.companyId ?? undefined,
          assemblyId: assembly.id,
        });
      }
      break;
    }
    case "meeting.ended": {
      if (assembly) await db.assembly.update({ where: { id: assembly.id }, data: { status: "TRANSCRIBING" } });
      break;
    }
    case "recording.ready-to-download": {
      if (assembly && p.download_link) {
        try {
          const resp = await fetch(p.download_link);
          const buf = Buffer.from(await resp.arrayBuffer());
          const folder = buildingFolder(assembly.building.propertyId, assembly.buildingId);
          const path = `${folder}/assembly-${assembly.id}.mp3`;
          const up = await uploadFile({ path, buffer: buf, contentType: "audio/mpeg" });
          const url = up.url ?? p.download_link; // fall back to Daily link if upload shape differs
          await db.assembly.update({ where: { id: assembly.id }, data: { recordingUrl: url } });
          await db.buildingFile.create({
            data: {
              buildingId: assembly.buildingId,
              category: "OTHER",
              name: `Ηχογράφηση Συνέλευσης ${assembly.id}.mp3`,
              cdnPath: path,
              url,
              mimeType: "audio/mpeg",
              sizeBytes: buf.length,
            },
          });
        } catch (e) {
          console.error("recording archive failed", e);
          await db.assembly.update({ where: { id: assembly.id }, data: { recordingUrl: p.download_link } });
        }
      }
      break;
    }
    case "batch-processor.job-finished": {
      // transcription complete — p.output / p.transcription holds text or a fetch URL
      if (assembly) {
        const transcript: string = p.transcription?.text ?? p.output?.text ?? "";
        const minutes = Math.ceil((p.duration ?? 0) / 60);
        await db.assembly.update({ where: { id: assembly.id }, data: { transcriptRaw: transcript } });
        if (minutes > 0) {
          await logAPIUsage({
            apiName: "deepgram",
            requestCount: minutes,
            buildingId: assembly.buildingId,
            customerId: assembly.building.property?.customerId ?? undefined,
            companyId: assembly.building.companyId ?? undefined,
            assemblyId: assembly.id,
          });
        }
        if (transcript) await runMinutes(assembly.id).catch((e) => console.error("auto-minutes failed", e));
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
