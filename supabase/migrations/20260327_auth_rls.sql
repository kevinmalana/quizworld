-- Enable RLS on all tables
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Quizzes: Public read, Auth write
CREATE POLICY "Public read quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Auth insert quizzes" ON quizzes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update quizzes" ON quizzes FOR UPDATE USING (auth.role() = 'authenticated');

-- Questions: Public read, Auth write
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Auth insert questions" ON questions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update questions" ON questions FOR UPDATE USING (auth.role() = 'authenticated');

-- Answers: Public read, Auth write
CREATE POLICY "Public read answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Auth insert answers" ON answers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update answers" ON answers FOR UPDATE USING (auth.role() = 'authenticated');

-- Game sessions: Public read/write for gameplay (no auth required for players)
CREATE POLICY "Public read game_sessions" ON game_sessions FOR SELECT USING (true);
CREATE POLICY "Public insert game_sessions" ON game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update game_sessions" ON game_sessions FOR UPDATE USING (true);

-- Players: Public read/write for gameplay
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update players" ON players FOR UPDATE USING (true);

-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
