import type { CreativeFormat } from "@/lib/war-room/types";

export type NamingInput = {
  product: string;
  bigIdea: string;
  mechanism: string;
  format: CreativeFormat;
  hookVariation: string;
  uniqueId: string;
};

export const CREATIVE_DNA_REGEX = /^[A-Z0-9]+_[A-Z0-9]+_[A-Z0-9]+_(VSL|UGC|ADVERT|REELS)_H[0-9]{2}_ID[0-9A-Z]+$/;

export function sanitizeNamingToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeHookVariation(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  const padded = digits.length > 0 ? digits.padStart(2, "0").slice(-2) : "01";
  return `H${padded}`;
}

export function normalizeUniqueId(value: string) {
  const core = sanitizeNamingToken(value).replace(/^ID/, "");
  return `ID${core || "0000"}`;
}

export function buildCreativeDnaName(input: NamingInput) {
  const normalized = {
    product: sanitizeNamingToken(input.product),
    bigIdea: sanitizeNamingToken(input.bigIdea),
    mechanism: sanitizeNamingToken(input.mechanism),
    format: input.format,
    hookVariation: normalizeHookVariation(input.hookVariation),
    uniqueId: normalizeUniqueId(input.uniqueId),
  };
  const dnaName = `${normalized.product}_${normalized.bigIdea}_${normalized.mechanism}_${normalized.format}_${normalized.hookVariation}_${normalized.uniqueId}`;
  return {
    ...normalized,
    dnaName,
    valid: CREATIVE_DNA_REGEX.test(dnaName),
  };
}
