"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineStage, WarRoomData } from "@/lib/war-room/types";

type CreativeFactoryBoardProps = {
  tasks: WarRoomData["creativeFactory"]["tasks"];
};

const stages: PipelineStage[] = ["Roteiro", "Gravacao", "Edicao", "Teste", "Winner"];

function squadLabel(squad: WarRoomData["creativeFactory"]["tasks"][number]["squad"]) {
  if (squad === "facebook") {
    return "Facebook";
  }
  if (squad === "tiktok") {
    return "TikTok";
  }
  return "Google/YouTube";
}

function stageStyles(stage: PipelineStage) {
  if (stage === "Winner") {
    return "border-amber-300/40 bg-amber-500/15";
  }
  if (stage === "Teste") {
    return "border-cyan-300/40 bg-cyan-500/10";
  }
  return "border-white/15 bg-white/5";
}

export function CreativeFactoryBoard({ tasks }: CreativeFactoryBoardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Creative Factory - Pipeline de Producao</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {stages.map((stage) => (
            <div key={stage} className="space-y-2 rounded-lg border border-white/10 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-100">{stage}</h4>
                <Badge variant={stage === "Winner" ? "gold" : "default"}>
                  {tasks.filter((task) => task.status === stage).length}
                </Badge>
              </div>
              {tasks
                .filter((task) => task.status === stage)
                .map((task) => (
                  <div key={task.id} className={`rounded-md border p-2 ${stageStyles(stage)}`}>
                    <p className="text-sm font-medium text-slate-100">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-300">
                      {squadLabel(task.squad)} - {task.owner}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{task.metricContext}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Atualizado: {task.updatedAt}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
