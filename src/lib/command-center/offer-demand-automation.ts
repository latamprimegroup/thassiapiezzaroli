import type { OfferWithMetrics } from "@/lib/offers/types";
import type { WarRoomData } from "@/lib/war-room/types";

type DemandTask = WarRoomData["commandCenter"]["tasks"][number];

function nowIso() {
  return new Date().toISOString();
}

function nowClock() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function buildUpsellTask(offer: OfferWithMetrics): DemandTask {
  const createdAt = nowIso();
  const dueAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const impact: DemandTask["impact"] = offer.revenue7d >= 120_000 ? "critical" : "high";
  return {
    id: `AUTO-OFFERS-UPSELL-${offer.id}`,
    department: "copyResearch",
    title: `Upsell imediato para oferta validada ${offer.id}`,
    description: `Oferta ${offer.name} validada para escala (7D ${offer.revenue7d.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}, ROAS ${offer.roas7d.toFixed(2)}x). Criar copy de upsell e sequencia de follow-up.`,
    squadHead: "Chief Copy Officer (CCO)",
    assignee: "Copywriter Senior",
    status: "backlog",
    impact,
    createdAt,
    lastMovedAt: createdAt,
    dueAt,
    dependencyIds: [],
    doneApproval: {
      required: false,
      approved: false,
      approvedBy: "",
      approvedRole: "",
      approvedAt: "",
      note: "",
    },
    decisionLog: [
      {
        at: nowClock(),
        author: "WAR ROOM OS",
        note: "Demanda automatica gerada: oferta bateu 70k/7d com ROAS de escala.",
      },
    ],
  };
}

export function applyOfferScaleDemands(data: WarRoomData, validatedOffers: OfferWithMetrics[]) {
  if (validatedOffers.length === 0) {
    return data;
  }

  const next = structuredClone(data);
  const existingIds = new Set(next.commandCenter.tasks.map((task) => task.id));
  const newTasks = validatedOffers
    .slice(0, 10)
    .filter((offer) => offer.validatedForScale)
    .filter((offer) => !existingIds.has(`AUTO-OFFERS-UPSELL-${offer.id}`))
    .map((offer) => buildUpsellTask(offer));

  if (newTasks.length > 0) {
    next.commandCenter.tasks = [...newTasks, ...next.commandCenter.tasks];
  }
  return next;
}
