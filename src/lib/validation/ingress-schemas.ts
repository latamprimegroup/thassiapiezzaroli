import { z } from "zod";
import { WAR_ROOM_OPS_CONSTANTS } from "@/lib/config/war-room-ops.constants";

export const looseObjectSchema = z.record(z.string(), z.unknown());

const callbackEventsSchema = z.array(looseObjectSchema).max(WAR_ROOM_OPS_CONSTANTS.offersLab.maxBatchEventsPerRequest);

export const offersLabCallbackPayloadSchema = z.union([
  z.object({
    events: callbackEventsSchema.optional(),
  }).catchall(z.unknown()),
  callbackEventsSchema,
]);

export function normalizeOffersLabCallbackPayload(payload: unknown) {
  const parsed = offersLabCallbackPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Payload invalido para callback Offers Lab.",
      events: [] as Record<string, unknown>[],
      single: null as Record<string, unknown> | null,
    };
  }

  const data = parsed.data;
  if (Array.isArray(data)) {
    return {
      ok: true as const,
      message: "",
      events: data,
      single: null,
    };
  }

  const events = Array.isArray(data.events) ? data.events : [];
  return {
    ok: true as const,
    message: "",
    events,
    single: events.length === 0 ? data : null,
  };
}

export const webhookPayloadSchema = looseObjectSchema;
