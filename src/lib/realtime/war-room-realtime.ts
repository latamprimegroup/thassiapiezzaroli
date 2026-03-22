type RealtimeCallback = () => void;

export async function subscribeWarRoomRealtime(onRefresh: RealtimeCallback) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return () => undefined;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });

    const channel = client
      .channel("war-room-os-realtime")
      .on("broadcast", { event: "refresh" }, () => onRefresh())
      .on("postgres_changes", { event: "*", schema: "public" }, () => onRefresh())
      .subscribe();

    return () => {
      void client.removeChannel(channel);
      void client.realtime.disconnect();
    };
  } catch {
    return () => undefined;
  }
}
