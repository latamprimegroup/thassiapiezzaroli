"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectionId, UserRole } from "@/lib/auth/rbac";

const TOTAL_SECONDS = 30;

type OnboardingStep = {
  id: string;
  section: SectionId;
  title: string;
  instruction: string;
  inputHint: string;
};

type OnboardingTourProps = {
  role: UserRole;
  userName: string;
  allowedSections: SectionId[];
  onNavigate: (sectionId: SectionId) => void;
  onComplete: () => void;
  onSkip: () => void;
};

const sectionTitles: Record<SectionId, string> = {
  commandCenterCeo: "The Command Center",
  ceoAudit: "CEO Audit Dashboard",
  offersLab: "Offers Lab",
  apiHub: "API Hub",
  ceoFinance: "The Boardroom",
  copyResearch: "Copy & Pesquisa",
  trafficAttribution: "Trafego & Atribuicao",
  testLaboratory: "Test Laboratory",
  commandCenter: "Command Center",
  squadSync: "Squad Sync",
  editorsProduction: "Creative Factory",
  techCro: "Tech & CRO",
  salesRecovery: "Sniper List",
  sniperCrm: "Sniper CRM",
  customerExperience: "Customer Experience",
  financeCompliance: "Finance & Compliance",
};

function buildRoleSteps(role: UserRole): OnboardingStep[] {
  switch (role) {
    case "copyJunior":
      return [
        {
          id: "copy-jr-1",
          section: "copyResearch",
          title: "Vault de Big Ideas",
          instruction: "Registre o gancho e o mecanismo unico da oferta do dia.",
          inputHint: "Preencha Hook + Mecanismo no dossie da ideia.",
        },
        {
          id: "copy-jr-2",
          section: "copyResearch",
          title: "Gerador UTM pre-aprovada",
          instruction: "Monte o link padrao para o trafego sem erro de nomenclatura.",
          inputHint: "Ajuste source + variacao de hook e copie o link.",
        },
        {
          id: "copy-jr-3",
          section: "squadSync",
          title: "Sincronizacao com squads",
          instruction: "Envie contexto para edicao e midia no fluxo oficial.",
          inputHint: "Registre comando no Squad Sync em vez de WhatsApp.",
        },
      ];
    case "copySenior":
    case "copywriter":
      return [
        {
          id: "copy-sr-1",
          section: "copyResearch",
          title: "Retencao por VSL",
          instruction: "Confira quais VSLs seguram atencao e quais precisam refatoracao.",
          inputHint: "Observe Hook/Hold/IC por ID antes de aprovar roteiro.",
        },
        {
          id: "copy-sr-2",
          section: "copyResearch",
          title: "Aprovacao de roteiros",
          instruction: "Aprove roteiros com score adequado para liberar producao.",
          inputHint: "Use a fila de aprovacao e libere somente score forte.",
        },
        {
          id: "copy-sr-3",
          section: "commandCenter",
          title: "Demandas intersetoriais",
          instruction: "Priorize tickets criticos ligados a queda de performance.",
          inputHint: "Faca log de decisao no card para auditoria.",
        },
      ];
    case "trafficJunior":
      return [
        {
          id: "traf-jr-1",
          section: "trafficAttribution",
          title: "Input diario de gastos",
          instruction: "Registre investimento por plataforma para fechar o dia correto.",
          inputHint: "Preencha Meta/Google/TikTok/Kwai no Traffic Hub.",
        },
        {
          id: "traf-jr-2",
          section: "trafficAttribution",
          title: "Monitor de CPA",
          instruction: "Atualize CPA das fontes para manter leitura real da operacao.",
          inputHint: "Ajuste campos de CPA no Squad Command.",
        },
        {
          id: "traf-jr-3",
          section: "squadSync",
          title: "Pedidos para producao/copy",
          instruction: "Abra demanda quando detectar queda ou fadiga de criativo.",
          inputHint: "Use Squad Sync/Command Center para acionar o time.",
        },
      ];
    case "trafficSenior":
    case "mediaBuyer":
      return [
        {
          id: "traf-sr-1",
          section: "offersLab",
          title: "Ofertas validadas para escala",
          instruction: "Identifique ofertas com 70k/7d e ROAS >= 1.8.",
          inputHint: "Filtre no Offers Lab e confirme candidatas.",
        },
        {
          id: "traf-sr-2",
          section: "trafficAttribution",
          title: "Scaling Advisor",
          instruction: "Use o advisor para decidir escala em um clique.",
          inputHint: "Acione escala quando o painel indicar winner estavel.",
        },
        {
          id: "traf-sr-3",
          section: "commandCenter",
          title: "Governanca de execucao",
          instruction: "Aprove gates de qualidade e priorize demandas criticas.",
          inputHint: "Acompanhe Done approval e SLA no Kanban.",
        },
      ];
    case "productionEditor":
    case "productionDesigner":
    case "videoEditor":
      return [
        {
          id: "prod-1",
          section: "editorsProduction",
          title: "Fila de producao por impacto",
          instruction: "Comece pelos criativos com maior impacto financeiro.",
          inputHint: "Siga a fila critica no Creative Factory.",
        },
        {
          id: "prod-2",
          section: "editorsProduction",
          title: "Upload do criativo final",
          instruction: "Vincule a entrega final ao ID de UTM correto.",
          inputHint: "Cole link Drive/Vimeo e associe ao UTM ID.",
        },
        {
          id: "prod-3",
          section: "commandCenter",
          title: "Sincronia com squads",
          instruction: "Atualize status e logs para liberar o proximo setor.",
          inputHint: "Registre decisoes no ticket antes de mover card.",
        },
      ];
    case "closer":
      return [
        {
          id: "closer-1",
          section: "sniperCrm",
          title: "Sniper List",
          instruction: "Ataque primeiro leads com score alto e compra perdida.",
          inputHint: "Priorize score 90+ e cartao recusado.",
        },
        {
          id: "closer-2",
          section: "sniperCrm",
          title: "One-Tap WhatsApp",
          instruction: "Dispare mensagem com script adequado a objecao.",
          inputHint: "Use botao de contato direto na linha do lead.",
        },
        {
          id: "closer-3",
          section: "commandCenter",
          title: "Feedback operacional",
          instruction: "Reporte bloqueios comerciais que impactam recuperacao.",
          inputHint: "Abra demanda com evidencia no board.",
        },
      ];
    case "financeManager":
      return [
        {
          id: "fin-1",
          section: "ceoFinance",
          title: "The Boardroom",
          instruction: "Atualize custos fixos e impostos para DRE real.",
          inputHint: "Aplique campos de custo/imposto no painel Boardroom.",
        },
        {
          id: "fin-2",
          section: "financeCompliance",
          title: "Compliance e documentos",
          instruction: "Revise itens pendentes no cofre legal da operacao.",
          inputHint: "Marque revisoes e execute scanner de compliance.",
        },
        {
          id: "fin-3",
          section: "ceoFinance",
          title: "Lucro liquido operacional",
          instruction: "Valide se o lucro exibido reflete cenario real.",
          inputHint: "Confira MER, Net Profit e provisoes.",
        },
      ];
    case "techAdmin":
      return [
        {
          id: "tech-1",
          section: "apiHub",
          title: "API Hub secreto",
          instruction: "Cadastre/atualize tokens das integracoes criticas.",
          inputHint: "Preencha UTMify, Gateways e Cloudflare.",
        },
        {
          id: "tech-2",
          section: "apiHub",
          title: "Modo API x Manual",
          instruction: "Defina modo manual quando APIs estiverem degradadas.",
          inputHint: "Alterne AUTO/MANUAL conforme saude do sistema.",
        },
        {
          id: "tech-3",
          section: "techCro",
          title: "Saude operacional",
          instruction: "Monitore observabilidade, incidentes e kill switch.",
          inputHint: "Acompanhe SLO, MTTR e status de integracoes.",
        },
      ];
    case "cxManager":
      return [
        {
          id: "cx-1",
          section: "customerExperience",
          title: "Customer Experience",
          instruction: "Acompanhe churn, ativacao e valor da safra.",
          inputHint: "Use sinais de risco para disparar acoes de retencao.",
        },
        {
          id: "cx-2",
          section: "sniperCrm",
          title: "Integracao com squads",
          instruction: "Abra demanda quando friccao de cliente impactar LTV.",
          inputHint: "Registre eventos no Squad Sync.",
        },
        {
          id: "cx-3",
          section: "commandCenter",
          title: "Prioridade por impacto",
          instruction: "Leve para o board apenas demandas de alto impacto.",
          inputHint: "Classifique ticket com impacto financeiro.",
        },
      ];
    case "ceo":
    default:
      return [
        {
          id: "ceo-1",
          section: "commandCenterCeo",
          title: "Visao master",
          instruction: "Observe MER, lucro e velocidade de vendas em tempo real.",
          inputHint: "Intervenha apenas nos blocos amarelos/vermelhos.",
        },
        {
          id: "ceo-2",
          section: "ceoFinance",
          title: "Boardroom",
          instruction: "Ajuste parametros financeiros e valide DRE operacional.",
          inputHint: "Confira custos, impostos e oportunidade perdida.",
        },
        {
          id: "ceo-3",
          section: "commandCenter",
          title: "Execucao por squads",
          instruction: "Monitore SLA, gargalos e entregas de impacto critico.",
          inputHint: "Use logs e approvals para governanca completa.",
        },
      ];
  }
}

export function OnboardingTour({
  role,
  userName,
  allowedSections,
  onNavigate,
  onComplete,
  onSkip,
}: OnboardingTourProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(TOTAL_SECONDS);
  const lastStepRef = useRef(-1);

  const filteredSteps = useMemo(() => {
    const steps = buildRoleSteps(role).filter((step) => allowedSections.includes(step.section));
    if (steps.length > 0) {
      return steps;
    }
    const fallbackSection = allowedSections[0] ?? "commandCenterCeo";
    return [
      {
        id: "fallback",
        section: fallbackSection,
        title: "Onboarding inicial",
        instruction: "Use este painel para inserir os dados operacionais do seu setor.",
        inputHint: "Procure os blocos de input e registre o dado diario antes do fechamento.",
      },
    ];
  }, [allowedSections, role]);

  const stepDuration = useMemo(
    () => Math.max(4, Math.floor(TOTAL_SECONDS / Math.max(1, filteredSteps.length))),
    [filteredSteps.length],
  );
  const elapsed = TOTAL_SECONDS - remainingSeconds;
  const currentStepIndex = Math.min(filteredSteps.length - 1, Math.floor(elapsed / stepDuration));
  const currentStep = filteredSteps[currentStepIndex] ?? filteredSteps[0];
  const progressPct = Math.min(100, Math.max(0, (elapsed / TOTAL_SECONDS) * 100));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentStepIndex !== lastStepRef.current) {
      lastStepRef.current = currentStepIndex;
      onNavigate(currentStep.section);
    }
  }, [currentStep.section, currentStepIndex, onNavigate]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      onComplete();
    }
  }, [onComplete, remainingSeconds]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl border-[#FF9900]/50 bg-[#050505]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>Onboarding do ERP - 30 segundos</span>
            <Badge variant="warning">
              {Math.max(0, remainingSeconds)}s
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded border border-white/10 bg-white/5 p-3 text-sm">
            <p className="text-slate-200">
              Bem-vindo, <span className="font-semibold">{userName}</span>. Este tour mostra onde voce registra os dados do seu setor.
            </p>
          </div>

          <div className="space-y-2 rounded border border-white/10 bg-black/30 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Passo {currentStepIndex + 1}/{filteredSteps.length} - {sectionTitles[currentStep.section]}
            </p>
            <p className="text-sm font-semibold text-slate-100">{currentStep.title}</p>
            <p className="text-sm text-slate-300">{currentStep.instruction}</p>
            <p className="text-xs text-[#FFD39A]">Como inputar: {currentStep.inputHint}</p>
          </div>

          <div className="h-2 rounded bg-slate-800">
            <div className="h-2 rounded bg-[#FF9900]" style={{ width: `${progressPct}%` }} />
          </div>

          <div className="flex flex-wrap gap-2">
            {filteredSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  const elapsedTarget = index * stepDuration;
                  setRemainingSeconds(Math.max(0, TOTAL_SECONDS - elapsedTarget));
                  onNavigate(step.section);
                }}
                className={`rounded border px-2 py-1 text-[11px] ${
                  index === currentStepIndex
                    ? "border-[#FF9900]/50 bg-[#FF9900]/20 text-[#FFD39A]"
                    : "border-white/20 bg-white/5 text-slate-300"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-8 px-3 text-xs" onClick={onComplete}>
              Concluir onboarding
            </Button>
            <Button type="button" className="h-8 px-3 text-xs" onClick={onSkip}>
              Pular por agora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
