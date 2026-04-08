import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const subscribeToGame = (pin: string, callback: (payload: any) => void) => {
  const channel = supabase.channel(`game:${pin}`, {
    config: {
      broadcast: { self: false },
    },
  });

  channel
    .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `pin=eq.${pin}` }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `session_id=eq.${pin}` }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const broadcastGameUpdate = async (pin: string, event: string, payload: any) => {
  const channel = supabase.channel(`game:${pin}`);
  await channel.send({
    type: "broadcast",
    event,
    payload,
  });
};

export default supabase;
