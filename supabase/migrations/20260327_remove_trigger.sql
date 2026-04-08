-- Drop trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop the profiles table only if it has no external dependencies.
DROP TABLE IF EXISTS public.profiles;
