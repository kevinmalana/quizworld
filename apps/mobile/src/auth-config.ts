export function validAuthConfig(url: string, key: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return false;
    if (key.startsWith('sb_publishable_')) return true;
    const payload = key.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}
