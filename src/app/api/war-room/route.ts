import { NextResponse } from "next/server";
import { getWarRoomData } from "@/lib/war-room/get-war-room-data";

export const runtime = "nodejs";

export async function GET() {
  const data = await getWarRoomData();
  return NextResponse.json(data);
}
