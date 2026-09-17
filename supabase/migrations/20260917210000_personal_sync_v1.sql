-- Personal practice ONLY. No official progress/XP/classroom/multiplayer objects touched.
-- Apply this exact file in a transaction, never a generic production db push.
CREATE TABLE public.personal_sync_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0)
);
CREATE TABLE public.personal_sync_limits (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 event_limit integer NOT NULL CHECK (event_limit BETWEEN 1 AND 2000)
);
-- Operational cap, not a researched usage allowance. No TTL or retention job.
INSERT INTO public.personal_sync_limits(singleton,event_limit) VALUES (true,1000);
CREATE TABLE public.personal_practice_events (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 event_id uuid NOT NULL,
 generation bigint NOT NULL CHECK (generation >= 0),
 cursor bigint GENERATED ALWAYS AS IDENTITY,
 payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 2048),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (user_id,event_id), UNIQUE (cursor)
);
ALTER TABLE public.personal_sync_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_sync_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_practice_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_sync_accounts,public.personal_sync_limits,public.personal_practice_events FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.personal_practice_events_cursor_seq FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.personal_sync_accounts,public.personal_practice_events TO authenticated;
CREATE POLICY personal_account_owner ON public.personal_sync_accounts FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY personal_event_owner ON public.personal_practice_events FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));

-- One canonical encoding shared with apps/mobile/src/personal-revision.ts.
-- Counts delimit arrays; each scalar is UTF8-byte-length ':' value. Never JSON text.
CREATE FUNCTION public.personal_public_revision_v1(p_quiz uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE quiz record; q record; a record; fields text[]; value text; encoded text=''; n integer; answer_count integer;
BEGIN
 SELECT id,title,coalesce(nullif(category,''),'Other') AS category INTO quiz FROM public.quizzes WHERE id=p_quiz AND is_public IS TRUE AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'personal_access_denied'; END IF;
 SELECT count(*) INTO n FROM public.questions WHERE quiz_id=p_quiz;
 IF n NOT BETWEEN 1 AND 100 OR quiz.title IS NULL OR length(quiz.title) NOT BETWEEN 1 AND 1000 OR length(quiz.category)>200 THEN RAISE EXCEPTION 'personal_unsupported'; END IF;
 fields:=ARRAY['qw-personal-1',quiz.id::text,quiz.title,quiz.category,n::text];
 FOR q IN SELECT id,text,explanation,image_url,video_url,question_type,order_index FROM public.questions WHERE quiz_id=p_quiz ORDER BY order_index,id LOOP
  IF q.question_type IS NULL OR q.question_type NOT IN ('multiple_choice','true_false') OR coalesce(q.image_url,'')<>'' OR coalesce(q.video_url,'')<>'' OR q.order_index IS NULL OR q.text IS NULL OR length(q.text) NOT BETWEEN 1 AND 12000 OR length(coalesce(q.explanation,''))>12000 THEN RAISE EXCEPTION 'personal_unsupported'; END IF;
  SELECT count(*) INTO answer_count FROM public.answers WHERE question_id=q.id;
  IF answer_count NOT BETWEEN 2 AND 8 OR (SELECT count(*) FROM public.answers WHERE question_id=q.id AND is_correct IS TRUE)<>1 THEN RAISE EXCEPTION 'personal_unsupported'; END IF;
  fields:=fields||ARRAY[q.id::text,q.text,coalesce(q.explanation,''),answer_count::text];
  FOR a IN SELECT id,text,is_correct,image_url FROM public.answers WHERE question_id=q.id ORDER BY id LOOP
   IF coalesce(a.image_url,'')<>'' OR a.text IS NULL OR length(a.text) NOT BETWEEN 1 AND 12000 OR a.is_correct IS NULL THEN RAISE EXCEPTION 'personal_unsupported'; END IF;
   fields:=fields||ARRAY[a.id::text,a.text,CASE WHEN a.is_correct THEN '1' ELSE '0' END];
  END LOOP;
 END LOOP;
 FOREACH value IN ARRAY fields LOOP encoded:=encoded||octet_length(convert_to(value,'UTF8'))::text||':'||value; END LOOP;
 RETURN encode(sha256(convert_to(encoded,'UTF8')),'hex');
END $$;
REVOKE ALL ON FUNCTION public.personal_public_revision_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.personal_sync_v1(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid=auth.uid(); epoch bigint; cap integer; ev public.personal_practice_events; event_uuid uuid; quiz_uuid uuid; question_uuid uuid; answer_uuid uuid; revision text; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'personal_auth_required'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>2048 THEN RAISE EXCEPTION 'personal_invalid'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('status','pull','submit','clear') THEN RAISE EXCEPTION 'personal_invalid'; END IF;
 -- Serializes first insert, clear, limit check, receipt ordering and pull per actor.
 INSERT INTO public.personal_sync_accounts(user_id) VALUES(actor) ON CONFLICT DO NOTHING;
 SELECT generation INTO epoch FROM public.personal_sync_accounts WHERE user_id=actor FOR UPDATE;
 SELECT event_limit INTO cap FROM public.personal_sync_limits WHERE singleton;
 IF cap IS NULL THEN RAISE EXCEPTION 'personal_unavailable'; END IF;
 result:=jsonb_build_object('contract',1,'owner',actor,'generation',epoch::text,'eventLimit',cap);
 IF p_action IN ('status','pull') THEN
  IF p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'personal_invalid'; END IF;
  IF p_action='pull' THEN
   RETURN result||jsonb_build_object('events',coalesce((SELECT jsonb_agg(jsonb_build_object('event',payload,'cursor',cursor::text,'receivedAt',received_at) ORDER BY cursor) FROM public.personal_practice_events WHERE user_id=actor),'[]'::jsonb));
  END IF;
  RETURN result;
 END IF;
 IF p_action='clear' THEN
  IF NOT (p_payload ? 'generation') OR (p_payload-'generation')<>'{}'::jsonb OR jsonb_typeof(p_payload->'generation')<>'string' OR (p_payload->>'generation')!~'^(0|[1-9][0-9]{0,18})$' THEN RAISE EXCEPTION 'personal_invalid'; END IF;
  -- Compare-and-swap: a timeout retry cannot clear newly accepted practice twice.
  IF p_payload->>'generation'=epoch::text THEN
   UPDATE public.personal_sync_accounts SET generation=generation+1 WHERE user_id=actor RETURNING generation INTO epoch;
   DELETE FROM public.personal_practice_events WHERE user_id=actor;
  END IF;
  RETURN result||jsonb_build_object('generation',epoch::text);
 END IF;
 IF (p_payload - ARRAY['version','eventId','generation','sessionId','quizId','revision','questionId','answerId','correct','kind','clientAt'])<>'{}'::jsonb OR NOT(p_payload ?& ARRAY['version','eventId','generation','sessionId','quizId','revision','questionId','answerId','correct','kind','clientAt']) THEN RAISE EXCEPTION 'personal_invalid'; END IF;
 IF p_payload->'version'<>'1'::jsonb OR jsonb_typeof(p_payload->'correct')<>'boolean' OR jsonb_typeof(p_payload->'generation')<>'string' OR jsonb_typeof(p_payload->'kind')<>'string' OR p_payload->>'kind' NOT IN ('answer','remove') OR jsonb_typeof(p_payload->'clientAt')<>'number' OR (p_payload->>'clientAt')::numeric NOT BETWEEN 0 AND 8640000000000000 OR (p_payload->>'clientAt')::numeric<>trunc((p_payload->>'clientAt')::numeric) THEN RAISE EXCEPTION 'personal_invalid'; END IF;
 IF p_payload->>'generation'<>epoch::text THEN RAISE EXCEPTION 'personal_generation_changed'; END IF;
 event_uuid:=(p_payload->>'eventId')::uuid; quiz_uuid:=(p_payload->>'quizId')::uuid; question_uuid:=(p_payload->>'questionId')::uuid; answer_uuid:=(p_payload->>'answerId')::uuid;
 IF event_uuid IS NULL OR quiz_uuid IS NULL OR question_uuid IS NULL OR (p_payload->>'sessionId')::uuid IS NULL THEN RAISE EXCEPTION 'personal_invalid'; END IF;
 IF event_uuid::text IS DISTINCT FROM p_payload->>'eventId' OR quiz_uuid::text IS DISTINCT FROM p_payload->>'quizId' OR question_uuid::text IS DISTINCT FROM p_payload->>'questionId' OR ((p_payload->>'sessionId')::uuid)::text IS DISTINCT FROM p_payload->>'sessionId' OR (p_payload->'answerId'<>'null'::jsonb AND answer_uuid::text IS DISTINCT FROM p_payload->>'answerId') THEN RAISE EXCEPTION 'personal_invalid'; END IF;
 revision:=public.personal_public_revision_v1(quiz_uuid);
 IF p_payload->>'revision' IS DISTINCT FROM revision THEN RAISE EXCEPTION 'personal_revision_changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.questions WHERE id=question_uuid AND quiz_id=quiz_uuid) OR (answer_uuid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.answers WHERE id=answer_uuid AND question_id=question_uuid)) THEN RAISE EXCEPTION 'personal_invalid_reference'; END IF;
 -- Access/revision are rechecked even for a retry. Payload equality binds all fields.
 SELECT * INTO ev FROM public.personal_practice_events WHERE user_id=actor AND event_id=event_uuid;
 IF NOT FOUND AND (SELECT count(*) FROM public.personal_practice_events WHERE user_id=actor)>=cap THEN RAISE EXCEPTION 'personal_event_limit'; END IF;
 INSERT INTO public.personal_practice_events(user_id,event_id,generation,payload) VALUES(actor,event_uuid,epoch,p_payload)
 ON CONFLICT (user_id,event_id) DO NOTHING;
 SELECT * INTO STRICT ev FROM public.personal_practice_events WHERE user_id=actor AND event_id=event_uuid;
 IF ev.payload<>p_payload THEN RAISE EXCEPTION 'personal_replay_conflict'; END IF;
 RETURN result||jsonb_build_object('receipt',jsonb_build_object('event',ev.payload,'cursor',ev.cursor::text,'receivedAt',ev.received_at));
END $$;
REVOKE ALL ON FUNCTION public.personal_sync_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.personal_sync_v1(text,jsonb) TO authenticated;
