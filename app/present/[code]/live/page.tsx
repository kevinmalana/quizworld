"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/supabase-provider";
import { PresentationLiveSession } from "@/components/present/live/presentation-live-session";

export default function PresentationLive() {
  const { code } = useParams();
  const { user } = useAuth();
  // Room/account changes own fresh state; old async work cannot target a new room.
  return <PresentationLiveSession key={`${code}:${user?.id ?? "guest"}`} code={code as string} userId={user?.id} />;
}
