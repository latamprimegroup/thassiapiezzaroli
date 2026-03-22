import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getDemoUserById } from "@/lib/auth/users";
import {
  listAssetWorkflow,
  markAssetReadyForTraffic,
  submitScriptForEditing,
} from "@/lib/persistence/asset-workflow-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const items = await listAssetWorkflow(300);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
  const user = getDemoUserById(session.userId);
  const userName = user?.name ?? session.userId;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "submit_script" | "finalize_edit";
    title?: string;
    offerId?: string;
    assetId?: string;
    creativeUrl?: string;
  };

  if (body.action === "submit_script") {
    if (!["copyJunior", "copySenior", "copywriter", "cco", "ceo"].includes(session.role)) {
      return NextResponse.json({ error: "Sem permissao para subir roteiro." }, { status: 403 });
    }
    const title = String(body.title ?? "").trim();
    const offerId = String(body.offerId ?? "").trim();
    if (!title || !offerId) {
      return NextResponse.json({ error: "title e offerId obrigatorios." }, { status: 400 });
    }
    const record = await submitScriptForEditing({
      title,
      offerId,
      createdByUserId: session.userId,
      createdByName: userName,
    });
    return NextResponse.json({ ok: true, record });
  }

  if (body.action === "finalize_edit") {
    if (!["productionEditor", "productionDesigner", "videoEditor", "ceo"].includes(session.role)) {
      return NextResponse.json({ error: "Sem permissao para finalizar edicao." }, { status: 403 });
    }
    const assetId = String(body.assetId ?? "").trim();
    const creativeUrl = String(body.creativeUrl ?? "").trim();
    if (!assetId || !creativeUrl) {
      return NextResponse.json({ error: "assetId e creativeUrl obrigatorios." }, { status: 400 });
    }
    const record = await markAssetReadyForTraffic({
      assetId,
      creativeUrl,
      editorName: userName,
    });
    if (!record) {
      return NextResponse.json({ error: "Ativo nao encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, record });
  }

  return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
}
