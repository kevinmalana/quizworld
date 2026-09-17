// Generated from the exact migration applied to disposable PostgreSQL.
// Regenerate: UPDATE_PERSONAL_TYPES=1 POSTGREST_BIN=... python3 supabase/tests/run_personal_sync_transport.py
export type PersonalDatabase = {
  Tables: {
    personal_practice_events: { Row: {
      user_id: string;
      event_id: string;
      generation: number;
      cursor: number;
      payload: unknown;
      received_at: string;
    } };
    personal_sync_accounts: { Row: {
      user_id: string;
      generation: number;
    } };
    personal_sync_limits: { Row: {
      singleton: boolean;
      event_limit: number;
    } };
  };
  Functions: { personal_sync_v1: { Args: { p_action: string; p_payload?: unknown }; Returns: unknown } };
};
