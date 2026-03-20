"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWarRoom } from "@/context/war-room-context";

function shelfLifeColor(saturation: number) {
  if (saturation >= 70) return "text-[#EA4335]";
  if (saturation >= 45) return "text-[#FF9900]";
  return "text-[#34A853]";
}

export function CopyResearchModule() {
  const { data, addActivity } = useWarRoom();
  const copyModule = data.enterprise.copyResearch;
  const [script, setScript] = useState(copyModule.scriptEditor);

  return (
    <section className="war-fade-in space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unique Mechanism Matrix</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
            <p className="mb-1 text-xs uppercase text-slate-400">Mecanismo Unico do Problema</p>
            <p>{copyModule.uniqueMechanismProblem}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
            <p className="mb-1 text-xs uppercase text-slate-400">Mecanismo Unico da Solucao</p>
            <p>{copyModule.uniqueMechanismSolution}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Big Idea Vault</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {copyModule.bigIdeaVault.map((idea) => (
            <div key={idea.id} className="rounded-md border border-white/10 bg-white/5 p-2 text-sm">
              <p className="font-medium text-slate-100">{idea.title}</p>
              <p className={`text-xs ${shelfLifeColor(idea.saturation)}`}>
                Saturacao: {idea.saturation}% | Shelf-life ate {idea.expiresAt}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar Dossier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {copyModule.avatarDossier.map((avatar, index) => (
            <div key={index} className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
              <p>Dor: {avatar.pain}</p>
              <p>Desejo: {avatar.desire}</p>
              <p>Objecao: {avatar.objection}</p>
              <p className="text-[#FF9900]">Insight do Suporte: {avatar.supportInsight}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Script Editor (Lead, Body, Offer)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            className="min-h-40 w-full rounded-md border border-white/10 bg-slate-900/70 p-3 text-sm"
          />
          <button
            onClick={() => addActivity("Copywriter", "Equipe Copy", "atualizou roteiro VSL", "Script Editor", "novo angulo de oferta")}
            className="rounded border border-[#FF9900]/40 bg-[#FF9900]/20 px-3 py-1 text-xs text-[#FFD39A]"
          >
            Salvar rascunho
          </button>
          <Badge variant="warning">Modulo Brain ativo</Badge>
        </CardContent>
      </Card>
    </section>
  );
}
