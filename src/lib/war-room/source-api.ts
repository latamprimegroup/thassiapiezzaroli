import { normalizeWarRoomData } from "./normalize";
import type { WarRoomData } from "./types";

export async function loadWarRoomFromApi(): Promise<WarRoomData> {
  const apiUrl = process.env.WAR_ROOM_API_URL;
  if (!apiUrl) {
    throw new Error("WAR_ROOM_API_URL nao configurada.");
  }

  const headers: HeadersInit = {};
  if (process.env.WAR_ROOM_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.WAR_ROOM_API_TOKEN}`;
  }

  const response = await fetch(apiUrl, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar WAR_ROOM_API_URL: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  const data =
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  return normalizeWarRoomData(data, "api", "API externa");
}
