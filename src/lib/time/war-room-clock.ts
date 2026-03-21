const DEFAULT_BUSINESS_TZ = "America/Sao_Paulo";
const DEFAULT_BUSINESS_UTC_OFFSET_HOURS = -3;

function resolveBusinessTimezone() {
  return process.env.WAR_ROOM_BUSINESS_TIMEZONE || DEFAULT_BUSINESS_TZ;
}

function resolveBusinessUtcOffsetHours() {
  const parsed = Number(process.env.WAR_ROOM_BUSINESS_UTC_OFFSET_HOURS ?? DEFAULT_BUSINESS_UTC_OFFSET_HOURS);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BUSINESS_UTC_OFFSET_HOURS;
}

export function toDateKeyInBusinessTimezone(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveBusinessTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safe);
  const year = parts.find((item) => item.type === "year")?.value ?? "1970";
  const month = parts.find((item) => item.type === "month")?.value ?? "01";
  const day = parts.find((item) => item.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function dayRangeFromTodayInBusinessTimezone(days: number) {
  const safeDays = Math.max(1, Math.floor(days));
  const now = new Date();
  const endDate = toDateKeyInBusinessTimezone(now);
  const startCandidate = new Date(now.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  const startDate = toDateKeyInBusinessTimezone(startCandidate);
  return { startDate, endDate };
}

// Retorna o início da janela em ISO UTC considerando o "começo do dia" no fuso de negócio.
// Ex.: UTC-3 e data 2026-03-20 => 2026-03-20T03:00:00.000Z
export function businessDayStartIsoUtc(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const offsetHours = resolveBusinessUtcOffsetHours();
  const utcHour = Math.abs(offsetHours);
  const utc = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0, 0));
  return utc.toISOString();
}

export function rollingDaysStartIsoByBusinessDay(days: number) {
  const { startDate } = dayRangeFromTodayInBusinessTimezone(days);
  return businessDayStartIsoUtc(startDate);
}

