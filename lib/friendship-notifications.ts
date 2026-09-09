import type { SupabaseClient } from "@supabase/supabase-js";

/** Both reads use the caller's ordinary client and remain subject to RLS. */
export async function loadFriendshipNotifications(client: SupabaseClient, userId: string) {
  // requester_id references auth.users, not profiles: PostgREST cannot embed it.
  const requests = await client.from("friendships")
    .select("id, requester_id")
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (requests.error) return { data: null, error: requests.error };
  if (!requests.data?.length) return { data: [], error: null };

  const requesterIds = [...new Set(requests.data.map(row => row.requester_id as string))];
  const profiles = await client.from("profiles")
    .select("id, username, display_name")
    .in("id", requesterIds);
  if (profiles.error) return { data: null, error: profiles.error };

  const names = new Map((profiles.data ?? []).map(profile => [
    profile.id, profile.display_name || profile.username || "Someone",
  ]));
  return {
    data: requests.data.map(row => ({
      id: row.id as string,
      requester_id: row.requester_id as string,
      name: names.get(row.requester_id) || "Someone",
    })),
    error: null,
  };
}
