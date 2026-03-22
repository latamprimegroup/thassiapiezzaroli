import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSniperSession } from "@/app/api/sniper-crm/_auth";
import { listSniperFunnels } from "@/lib/persistence/sniper-crm-repository";
import { createOrUpdateFunnel } from "@/lib/sniper-crm/sniper-crm-service";

export const runtime = "nodejs";

const funnelStepSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(180),
  waitSeconds: z.coerce.number().int().min(0).max(86_400),
  kind: z.enum(["text", "audio", "image", "video"]),
  text: z.string().max(4000),
  mediaUrl: z.string().max(1000).optional(),
});

const funnelSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(160),
  active: z.boolean().default(true),
  steps: z.array(funnelStepSchema).min(1).max(30),
});

export async function GET() {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const includeAll = auth.session.role === "ceo";
  const items = await listSniperFunnels({
    ownerUserId: includeAll ? undefined : auth.session.userId,
    includeAll,
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireSniperSession();
  if (!auth.ok || !auth.session) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = funnelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload invalido para funil.",
        detail: parsed.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 400 },
    );
  }
  try {
    const funnel = await createOrUpdateFunnel({
      session: auth.session,
      funnel: {
        id: parsed.data.id,
        title: parsed.data.title,
        active: parsed.data.active,
        steps: parsed.data.steps.map((step) => ({
          id: step.id || "",
          label: step.label,
          waitSeconds: step.waitSeconds,
          kind: step.kind,
          text: step.text,
          mediaUrl: step.mediaUrl || "",
        })),
      },
    });
    return NextResponse.json({ ok: true, funnel });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao salvar funil.",
      },
      { status: 400 },
    );
  }
}

