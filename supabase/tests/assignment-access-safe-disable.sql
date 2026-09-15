-- Safe feature disable, not a historical security rollback.
-- Retain restrictive child guards: dropping them reopens legacy USING(true) leaks.
DROP POLICY "Members read creator-assigned active quizzes" ON public.quizzes;
DROP POLICY "Questions read visible quiz" ON public.questions;
DROP POLICY "Answers read visible question" ON public.answers;
