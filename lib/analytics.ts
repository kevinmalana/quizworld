export const ANALYTICS_CONSENT_KEY = 'qw_analytics_consent_v1';
export type AnalyticsConsent = 'adult-granted' | 'denied' | null;

// No discovery, account, classroom, join, quiz detail, game or study routes.
const pages: Record<string, string> = {
  '/': 'home',
  '/kahoot-alternative': 'kahoot_alternative',
  '/aws-practice-test': 'aws_practice_test',
};

export function analyticsPage(pathname: string, consent: AnalyticsConsent, loading: boolean, signedIn: boolean): string | null {
  if (consent !== 'adult-granted' || loading || signedIn) return null;
  return Object.hasOwn(pages, pathname) ? pages[pathname] : null;
}

export function readAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'adult-granted' || value === 'denied' ? value : null;
  } catch { return null; }
}

// Only this integration's host-only, root-path cookies. Never clear auth cookies.
export function clearAnalyticsCookies() {
  for (const item of document.cookie.split(';')) {
    const name = item.trim().split('=')[0];
    if (/^qwga_(?:ga|ga_1YJEL65QPS)$/.test(name)) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  }
}
