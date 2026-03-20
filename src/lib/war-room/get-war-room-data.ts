import { mockWarRoomData } from "./mock-data";
import { normalizeWarRoomData } from "./normalize";
import { loadWarRoomFromApi } from "./source-api";
import { loadWarRoomFromSheets } from "./source-sheet";
import type { WarRoomData } from "./types";

type DataSource = "mock" | "api" | "sheet" | "database";

function resolveSource(): DataSource {
  const source = (process.env.WAR_ROOM_SOURCE ?? "mock").toLowerCase();
  if (source === "api" || source === "sheet" || source === "database" || source === "mock") {
    return source;
  }
  return "mock";
}

async function loadBySource(source: DataSource): Promise<WarRoomData> {
  switch (source) {
    case "api":
      return loadWarRoomFromApi();
    case "sheet":
      return loadWarRoomFromSheets();
    case "database": {
      const { loadWarRoomFromDatabase } = await import("./source-db");
      return loadWarRoomFromDatabase();
    }
    case "mock":
    default:
      return normalizeWarRoomData(mockWarRoomData, "mock", "Mock local");
  }
}

export async function getWarRoomData(): Promise<WarRoomData> {
  const source = resolveSource();
  try {
    return await loadBySource(source);
  } catch (error) {
    console.error("[war-room] Falha ao carregar dados reais:", error);
    return normalizeWarRoomData(
      {
        ...mockWarRoomData,
        source: "fallback",
        sourceLabel: `Fallback (erro em ${source})`,
        updatedAt: new Date().toISOString(),
      },
      "fallback",
      `Fallback (erro em ${source})`,
    );
  }
}
