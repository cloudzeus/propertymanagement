import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logAPIUsage } from "@/lib/api-costs";
import { runMinutes } from "@/app/actions/assemblies";

function verify(raw: string, signature: string | null): boolean {
  const secret = env.DAILY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
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
    select: { id: true, buildingId: true, building: { select: { companyId: true, property: { select: { customerId: true } } } } },
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text(); // raw FIRST
  if (!verify(raw, req.headers.get("x-daily-signature"))) {
    return new Response("invalid signature", { status: 401 });
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
      if (assembly && p.download_link) await db.assembly.update({ where: { id: assembly.id }, data: { recordingUrl: p.download_link } });
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
