import { NextResponse } from "next/server";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { transcodeVoiceToOpus } from "@/lib/sniper-crm/voice-engine";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo de audio no campo 'audio'." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Arquivo excede o limite de 15MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await transcodeVoiceToOpus({
      buffer,
      mimeType: file.type || "audio/mpeg",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({
      ok: true,
      mimeType: result.mimeType,
      fileName: result.suggestedFileName,
      base64: result.buffer.toString("base64"),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao transcodificar audio.",
      },
      { status: 500 },
    );
  }
}

