"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreativeFactoryBoard } from "@/components/war-room/creative-factory-board";
import { LiveAdsTable } from "@/components/war-room/live-ads-table";
import { useWarRoom } from "@/context/war-room-context";

const percent = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

type EditorsProductionModuleProps = {
  canShowRoas: boolean;
  emphasizeRetention: boolean;
  simplified: boolean;
};

export function EditorsProductionModule({ canShowRoas, emphasizeRetention, simplified }: EditorsProductionModuleProps) {
  const { data } = useWarRoom();
  const editors = data.enterprise.editorsProduction;

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hook Library (ranking)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...editors.hookLibrary]
            .sort((a, b) => b.hookRate - a.hookRate)
            .map((item) => (
              <div key={item.creativeId} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span>
                  {item.creativeId} - {item.hook}
                </span>
                <span className={item.hookRate >= 25 ? "text-[#34A853]" : item.hookRate >= 20 ? "text-[#FF9900]" : "text-[#EA4335]"}>
                  {percent(item.hookRate)}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention Heatmap (drop por segundo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {editors.retentionHeatmap.map((slot) => (
            <div key={slot.second}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{slot.second}s</span>
                <span>{percent(slot.dropOff)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-[#FF9900]" style={{ width: `${Math.min(100, slot.dropOff)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pattern Interrupt Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{editors.patternInterruptChecklist.every3s ? "✅" : "❌"} Interrupt a cada 3s</p>
          <p>{editors.patternInterruptChecklist.soundDesign ? "✅" : "❌"} Sound Design</p>
          <p>{editors.patternInterruptChecklist.vfx ? "✅" : "❌"} VFX de retenção</p>
          <Badge variant="warning">The Retention Module</Badge>
        </CardContent>
      </Card>

      <CreativeFactoryBoard tasks={data.creativeFactory.tasks} />
      <LiveAdsTable
        title="Cockpit de Producao por Criativo"
        subtitle="Visao operacional para copy + edicao (foco em retencao e velocidade)"
        rows={data.liveAdsTracking}
        hideRoasReal={!canShowRoas}
        emphasizeRetention={emphasizeRetention}
        simplified={simplified}
        showDeepDive
      />
    </section>
  );
}
