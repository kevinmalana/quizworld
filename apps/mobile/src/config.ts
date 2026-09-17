// Only public, read-only anonymous configuration is accepted. Never add a service key.
export const catalogConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
};
export const catalogConfigured = Boolean(catalogConfig.url.startsWith('https://') && catalogConfig.key);
export const website = 'https://www.quizworld.xyz';
