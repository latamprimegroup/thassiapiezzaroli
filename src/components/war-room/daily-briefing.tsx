"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DailyReplyRole, SquadKey, WarRoomData } from "@/lib/war-room/types";

type DailyBriefingProps = {
  items: WarRoomData["dailyBriefing"];
  squadFilter?: SquadKey;
};

type ReplyFormState = {
  role: DailyReplyRole;
  author: string;
  version: string;
  assetUrl: string;
  note: string;
};

const initialReply: ReplyFormState = {
  role: "Copy",
  author: "",
  version: "",
  assetUrl: "",
  note: "",
};

function squadLabel(squad: SquadKey) {
  return squad === "facebook" ? "Facebook" : "Google/YouTube";
}

export function DailyBriefing({ items, squadFilter }: DailyBriefingProps) {
  const [briefings, setBriefings] = useState(items);
  const [forms, setForms] = useState<Record<string, ReplyFormState>>({});

  const visible = useMemo(
    () => (squadFilter ? briefings.filter((entry) => entry.squad === squadFilter) : briefings),
    [briefings, squadFilter],
  );

  function formState(id: string) {
    return forms[id] ?? initialReply;
  }

  function updateForm(id: string, partial: Partial<ReplyFormState>) {
    setForms((prev) => ({ ...prev, [id]: { ...formState(id), ...partial } }));
  }

  function addReply(briefingId: string) {
    const current = formState(briefingId);
    if (!current.author || !current.version || !current.assetUrl) {
      return;
    }

    setBriefings((prev) =>
      prev.map((entry) =>
        entry.id === briefingId
          ? {
              ...entry,
              replies: [
                ...entry.replies,
                {
                  role: current.role,
                  author: current.author,
                  version: current.version,
                  assetUrl: current.assetUrl,
                  note: current.note || "Atualizacao enviada via briefing.",
                },
              ],
            }
          : entry,
      ),
    );

    setForms((prev) => ({ ...prev, [briefingId]: initialReply }));
  }

  return (
    <div className="space-y-4">
      {visible.map((briefing) => (
        <Card key={briefing.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Daily Briefing - {squadLabel(briefing.squad)}</CardTitle>
              <Badge variant="sky">Gestao de Trafego</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Comentario tecnico do gestor</p>
              <p className="mt-2 text-sm text-slate-100">{briefing.trafficManagerComment}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Respostas do Copy / Edicao</p>
              {briefing.replies.map((reply, index) => (
                <div key={`${briefing.id}-${reply.version}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={reply.role === "Copy" ? "warning" : "success"}>{reply.role}</Badge>
                    <span className="text-sm font-medium text-slate-100">
                      {reply.author} - {reply.version}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{reply.note}</p>
                  <a
                    href={reply.assetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-cyan-300 underline underline-offset-2"
                  >
                    Link da nova versao
                  </a>
                </div>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <Input
                placeholder="Autor (ex: Ana)"
                value={formState(briefing.id).author}
                onChange={(event) => updateForm(briefing.id, { author: event.target.value })}
              />
              <Input
                placeholder="Versao (ex: V4)"
                value={formState(briefing.id).version}
                onChange={(event) => updateForm(briefing.id, { version: event.target.value })}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
              <select
                value={formState(briefing.id).role}
                onChange={(event) => updateForm(briefing.id, { role: event.target.value as DailyReplyRole })}
                className="h-9 rounded-md border border-white/15 bg-slate-900/70 px-2 text-sm text-slate-100 outline-none"
              >
                <option value="Copy">Copy</option>
                <option value="Edicao">Edicao</option>
              </select>
              <Input
                placeholder="URL da versao (Drive, Frame.io, etc)"
                value={formState(briefing.id).assetUrl}
                onChange={(event) => updateForm(briefing.id, { assetUrl: event.target.value })}
              />
            </div>
            <Textarea
              placeholder="Observacao da iteracao..."
              value={formState(briefing.id).note}
              onChange={(event) => updateForm(briefing.id, { note: event.target.value })}
            />
            <Button variant="outline" onClick={() => addReply(briefing.id)}>
              Publicar resposta no briefing
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
