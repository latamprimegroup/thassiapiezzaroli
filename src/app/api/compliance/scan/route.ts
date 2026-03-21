import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { scanComplianceFromUrl } from "@/lib/compliance/compliance-scanner";

export const runtime = "nodejs";

type Payload = {
  urls?: string[];
};

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const urls = Array.isArray(payload.urls)
    ? payload.urls.map((value) => value.trim()).filter((value) => value.length > 0).slice(0, 10)
    : [];
  if (urls.length === 0) {
    return NextResponse.json({ error: "Informe ao menos uma URL para o scanner." }, { status: 400 });
  }

  const results = await Promise.all(urls.map((url) => scanComplianceFromUrl(url)));
  return NextResponse.json({
    ok: true,
    scannedAt: new Date().toISOString(),
    results,
  });
}
