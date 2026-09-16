// Google only executes in this disposable, empty document, never the app DOM.
// Do not replace this with a root-layout Google tag: enhanced measurement can
// observe private SPA history/forms even when manual pageviews are filtered.
(() => {
  const ID = 'G-1YJEL65QPS';
  const pages = {
    home: '/',
    kahoot_alternative: '/kahoot-alternative',
    aws_practice_test: '/aws-practice-test',
  };
  let started = false;
  let previous = null;
  window.dataLayer = [];
  function gtag() { window.dataLayer.push(arguments); }
  window.addEventListener('message', (event) => {
    if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
    const page = event.data?.page;
    if (typeof page !== 'string' || !Object.hasOwn(pages, page) || event.data?.event) return;
    if (page === previous) return;
    previous = page;
    const fields = {
      page_location: `https://www.quizworld.xyz${pages[page]}`,
      page_title: page,
      page_referrer: '',
    };
    if (!started) {
      started = true;
      gtag('consent', 'default', {
        analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      });
      gtag('js', new Date());
      gtag('config', ID, {
        ...fields, send_page_view: false,
        allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_domain: 'none', cookie_path: '/', cookie_prefix: 'qwga',
        cookie_expires: 0, cookie_update: false,
      });
      const script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
      document.head.appendChild(script);
    }
    gtag('set', fields);
    gtag('event', 'page_view', { ...fields, send_to: ID });
  });
})();
