-- Disable transport safely, retaining generations forever (v1).
-- Production use still requires separate exact-SQL approval.
REVOKE EXECUTE ON FUNCTION public.personal_sync_v1(text,jsonb) FROM authenticated;
