/* ─────────────────────────────────────────────────────────────────────────────
   RIK Athletica · Exit-intent popup — v3 (engaged-only, cross-tab safe)
   ─────────────────────────────────────────────────────────────────────────────

   Who sees it:
     • Has NOT purchased (no rik_purchased in localStorage)
     • Has NOT seen it in the last 24 hours (cross-tab, cross-page cooldown)
     • Has visited ≥2 pages on this site during the current browser session
     • Has spent ≥3 minutes on the CURRENT page (desktop) / ≥4 min (mobile)
     • Has scrolled ≥70% of the current page (both platforms)
     Only then does exit intent detection arm itself.

   Desktop trigger (Mac + Windows browsers):
     mouseleave from the top of the viewport (cursor → tab bar / URL bar /
     window close button). Cursor must exit through the top 0px boundary.
     Fires ONLY when fully qualified — the engagement gate keeps it from
     triggering on casual reads.

   Mobile trigger:
     pagehide event — fires when the user closes the tab, navigates away, or
     backgrounds the browser app. This is the closest real "leaving" signal
     on mobile; scroll-up momentum was too noisy and has been removed.
     Also catches the `visibilitychange → hidden` path as a secondary signal
     (fires on app-switch to home screen or another app).

   Cooldown:
     24-hour localStorage key. One visitor, one browser — one show per day
     across ALL tabs and page navigations. No per-tab / per-page re-fires.

   Page-view counting:
     A lightweight page-visit counter in localStorage (rik_pv) is incremented
     on every page load. Resets after 24 hours of inactivity. The popup will
     not arm unless the visitor has accumulated ≥2 page views.

   Preview hooks (testing only):
     ?force-popup=1          → fires immediately, skips all qualifiers + cooldown
     ?force-popup=tier-bundle → force Bundle tier flow

   GA4 events:
     exit_popup_shown · exit_popup_promo_apply
     exit_popup_whatsapp_open · exit_popup_dismissed
─────────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  if (window.__rikExitIntent) return;
  window.__rikExitIntent = true;

  // ─── Config ──────────────────────────────────────────────────────────────
  var STORAGE_KEY   = 'rik_exit_popup';    // main state (shown_at timestamp)
  var SEEN_KEY      = 'rik_ep_seen';       // cross-tab 24h cooldown
  var PURCHASE_KEY  = 'rik_purchased';
  var PV_KEY        = 'rik_pv';            // cross-page visit counter
  var PV_TS_KEY     = 'rik_pv_ts';         // timestamp of first visit in window

  var PROMO_CODE      = 'WELCOME15';
  var COOLDOWN_HOURS  = 24;                // hours between shows (across all tabs)
  var MIN_PAGE_VIEWS  = 2;                 // must have visited ≥2 pages this session

  // ─── Engagement thresholds per platform
  var DESKTOP_MIN_TIME_MS  = 3 * 60 * 1000;  // 3 min on current page
  var DESKTOP_MIN_SCROLL   = 70;              // 70% scroll depth

  var MOBILE_MIN_TIME_MS   = 4 * 60 * 1000;  // 4 min on current page
  var MOBILE_MIN_SCROLL    = 70;              // 70% scroll depth

  var HERO_IMAGE = '/assets/web/al-DSC00295.jpg';

  var STRIPE_LINKS = {
    bundle:      'https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00',
    sprint_703:  'https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02',
    sprint_full: 'https://buy.stripe.com/7sY28tfsW2887T07sA7Re03',
    sprint_pro:  'https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04',
    premium:     'https://buy.stripe.com/00waEZ1C68ww2yG0087Re06'
  };
  var WA_LINK = 'https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20saw%20Your%20note%20on%20the%20way%20out%20%E2%80%94%20';

  // ─── Force-popup preview hook
  var urlParams  = new URLSearchParams(window.location.search);
  var FORCED     = urlParams.has('force-popup');
  var FORCED_TIER = urlParams.get('force-popup');

  // ─── Helpers
  function nowMs()    { return Date.now(); }
  function isMobile() {
    return window.matchMedia('(max-width: 760px)').matches ||
           ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
  function ls(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) {}
  }

  // ─── Purchases
  function hasPurchased() { return !!ls(PURCHASE_KEY); }
  window.__rikMarkPurchased = function () { ls(PURCHASE_KEY, String(nowMs())); };

  // ─── Cross-tab 24h cooldown (replaces per-tab sessionStorage guard)
  function hasSeenRecently() {
    var ts = parseInt(ls(SEEN_KEY) || '0', 10);
    if (!ts) return false;
    return (nowMs() - ts) < COOLDOWN_HOURS * 3600000;
  }
  function markSeen() { ls(SEEN_KEY, String(nowMs())); }

  // ─── Page-view counter
  // Increments on each page load. Resets PV window after 4h of inactivity.
  (function trackPageView() {
    var pvTs = parseInt(ls(PV_TS_KEY) || '0', 10);
    var age  = nowMs() - pvTs;
    var pv   = parseInt(ls(PV_KEY) || '0', 10);
    if (age > 4 * 3600000) { pv = 0; } // reset stale session
    pv++;
    ls(PV_KEY,    String(pv));
    ls(PV_TS_KEY, String(nowMs()));
  })();
  function pageViews() { return parseInt(ls(PV_KEY) || '1', 10); }

  // ─── Tier detection
  function detectTier() {
    if (FORCED_TIER && FORCED_TIER.indexOf('tier-') === 0) {
      return FORCED_TIER.replace('tier-', '');
    }
    var p = window.location.pathname;
    if (p.indexOf('/premium') !== -1) return 'premium';
    if (p.indexOf('/bundle')  !== -1) return 'bundle';
    if (p.indexOf('/sprint')  !== -1) return 'sprint_default';
    return null;
  }

  // ─── Engagement tracking
  var startTime    = nowMs();
  var maxScrollPct = 0;

  window.addEventListener('scroll', function () {
    var docH = Math.max(
      document.body.scrollHeight, document.body.offsetHeight,
      document.documentElement.scrollHeight, document.documentElement.offsetHeight
    );
    var pct = Math.round(((window.scrollY + window.innerHeight) / docH) * 100);
    if (pct > maxScrollPct) maxScrollPct = pct;
  }, { passive: true });

  // ─── Warm-lead qualifier
  function minTimeMs() { return isMobile() ? MOBILE_MIN_TIME_MS : DESKTOP_MIN_TIME_MS; }
  function minScroll()  { return isMobile() ? MOBILE_MIN_SCROLL  : DESKTOP_MIN_SCROLL; }

  function isWarmLead() {
    if (FORCED)            return true;
    if (hasPurchased())    return false;
    if (hasSeenRecently()) return false;  // 24h cross-tab cooldown
    if (pageViews() < MIN_PAGE_VIEWS)    return false;  // must have browsed ≥2 pages
    if (nowMs() - startTime < minTimeMs()) return false; // time on page
    if (maxScrollPct < minScroll())        return false; // scroll depth
    return true;
  }

  // ─── Markup
  var POPUP_ID = 'rik-exit-popup';
  function buildPopup() {
    var tier = detectTier();
    var stripeUrl =
      tier === 'premium' ? STRIPE_LINKS.premium :
      tier === 'bundle'  ? STRIPE_LINKS.bundle  : '';
    var withPromo = stripeUrl
      ? stripeUrl + (stripeUrl.indexOf('?') === -1 ? '?' : '&') + 'prefilled_promo_code=' + PROMO_CODE
      : '';
    var ctaHref = withPromo || '#exit-popup-promo-applied';
    var ctaText = withPromo ? 'Apply 15% off' : 'Copy Code';
    var waSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
      + '<path d="M17.5 14.4c-.3-.2-1.7-.8-2-1-.3-.1-.4-.2-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.7-1.4-1.7-1.6-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2.1-.2-.5-.5-.5-.6-.5h-.5c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2 0 1.3.9 2.6 1.1 2.7.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.1-.6-.3zM12 0C5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.5 5.8L0 24l6.4-1.4c1.7.9 3.6 1.4 5.6 1.4 6.6 0 12-5.4 12-12S18.6 0 12 0zm0 22c-1.9 0-3.6-.5-5.1-1.4l-3.7.8.8-3.6C3 16.2 2.5 14.1 2.5 12 2.5 6.7 6.7 2.5 12 2.5S21.5 6.7 21.5 12 17.3 22 12 22z"/>'
      + '</svg>';

    return ''
      + '<div id="' + POPUP_ID + '-overlay" class="' + POPUP_ID + '-overlay" role="dialog" aria-modal="true" aria-labelledby="' + POPUP_ID + '-title">'
      + '  <div class="' + POPUP_ID + '-card" role="document">'
      + '    <button type="button" class="' + POPUP_ID + '-close" aria-label="Close">×</button>'
      + '    <div class="' + POPUP_ID + '-hero" aria-hidden="true">'
      + '      <div class="' + POPUP_ID + '-hero-img" style="background-image:url(\'' + HERO_IMAGE + '\')"></div>'
      + '      <div class="' + POPUP_ID + '-hero-scrim"></div>'
      + '      <div class="' + POPUP_ID + '-hero-text">'
      + '        <span class="' + POPUP_ID + '-hero-tag">─── &nbsp;Before You Go&nbsp; ───</span>'
      + '        <h2 class="' + POPUP_ID + '-hero-h" id="' + POPUP_ID + '-title">Wait. <span>Two ways</span><br>to stay.</h2>'
      + '        <span class="' + POPUP_ID + '-hero-foot">Either way — we don\'t want You leaving empty-handed.</span>'
      + '      </div>'
      + '    </div>'
      + '    <div class="' + POPUP_ID + '-offers">'
      + '      <div class="' + POPUP_ID + '-offer ' + POPUP_ID + '-offer--promo">'
      + '        <span class="' + POPUP_ID + '-offer-eyebrow">15% off · 48h · first-time</span>'
      + '        <div class="' + POPUP_ID + '-promo-pct">15<small>%</small></div>'
      + '        <div class="' + POPUP_ID + '-promo-code">'
      + '          <span class="' + POPUP_ID + '-promo-code-label">Code</span>'
      + '          <code>' + PROMO_CODE + '</code>'
      + '        </div>'
      + '        <a class="' + POPUP_ID + '-cta ' + POPUP_ID + '-cta--ink" href="' + ctaHref + '" data-action="apply-promo" data-track="exit_popup_promo_apply">' + ctaText + ' &nbsp;↗</a>'
      + '      </div>'
      + '      <div class="' + POPUP_ID + '-or"><span>or</span></div>'
      + '      <div class="' + POPUP_ID + '-offer ' + POPUP_ID + '-offer--wa">'
      + '        <span class="' + POPUP_ID + '-offer-eyebrow">Founder-direct · same biz day</span>'
      + '        <div class="' + POPUP_ID + '-wa-row">'
      + '          <div class="' + POPUP_ID + '-wa-icon">' + waSvg + '</div>'
      + '          <div class="' + POPUP_ID + '-wa-words">'
      + '            <strong>Talk to Bek.</strong>'
      + '            <span>Race-date doubt, gut question, "is Sprint right for Me" — anything.</span>'
      + '          </div>'
      + '        </div>'
      + '        <a class="' + POPUP_ID + '-cta ' + POPUP_ID + '-cta--wa" href="' + WA_LINK + '" target="_blank" rel="noopener" data-action="open-whatsapp" data-track="exit_popup_whatsapp_open">Open WhatsApp &nbsp;↗</a>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
  }

  // ─── Styles
  function injectStyles() {
    if (document.getElementById(POPUP_ID + '-styles')) return;
    var css = ''
      + '#' + POPUP_ID + '-overlay{position:fixed;inset:0;z-index:9998;background:rgba(14,14,14,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;animation:rxp-fade .25s ease forwards;font-family:"Outfit",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif}'
      + '@keyframes rxp-fade{to{opacity:1}}'
      + '@keyframes rxp-up{from{opacity:0;transform:translateY(20px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}'
      + '.' + POPUP_ID + '-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);max-width:880px;width:100%;max-height:92vh;background:#EEEDEA;color:#0E0E0E;border-radius:18px;overflow:hidden;position:relative;box-shadow:0 32px 80px -16px rgba(0,0,0,.45);animation:rxp-up .4s cubic-bezier(.2,.9,.3,1) forwards}'
      + '.' + POPUP_ID + '-close{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:999px;border:1px solid rgba(255,255,255,.32);background:rgba(14,14,14,.55);color:#fff;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:0;transition:opacity .15s,transform .15s;z-index:5;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}'
      + '.' + POPUP_ID + '-close:hover{opacity:.8;transform:scale(1.05)}'
      + '.' + POPUP_ID + '-hero{position:relative;min-height:480px;color:#fff;display:flex;align-items:flex-end;padding:40px 32px;isolation:isolate;background:linear-gradient(135deg,#0E0E0E 0%,#3a2418 100%)}'
      + '.' + POPUP_ID + '-hero-img{position:absolute;inset:0;background-size:cover;background-position:center 30%;background-repeat:no-repeat;z-index:0}'
      + '.' + POPUP_ID + '-hero-scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(135deg,rgba(14,14,14,.72) 0%,rgba(14,14,14,.42) 50%,rgba(14,14,14,.65) 100%),radial-gradient(ellipse 60% 60% at 30% 70%,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 75%)}'
      + '.' + POPUP_ID + '-hero-text{position:relative;z-index:2;display:flex;flex-direction:column;gap:14px;text-shadow:0 1px 0 rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.45),0 8px 24px rgba(0,0,0,.32)}'
      + '.' + POPUP_ID + '-hero-tag{font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,210,140,.92)}'
      + '.' + POPUP_ID + '-hero-h{font-family:"Outfit",sans-serif;font-size:clamp(34px,4.4vw,46px);font-weight:700;line-height:.96;letter-spacing:-.02em;color:#fff;margin:0;max-width:14ch}'
      + '.' + POPUP_ID + '-hero-h span{color:rgba(255,255,255,.55);font-weight:700}'
      + '.' + POPUP_ID + '-hero-foot{font-size:13px;line-height:1.5;color:rgba(255,255,255,.78);margin-top:6px;max-width:32ch}'
      + '.' + POPUP_ID + '-offers{display:flex;flex-direction:column;justify-content:center;padding:36px;gap:14px;background:#EEEDEA}'
      + '.' + POPUP_ID + '-offer{background:#fff;border:1px solid rgba(14,14,14,.10);border-radius:14px;padding:22px}'
      + '.' + POPUP_ID + '-offer--promo{background:#0E0E0E;border-color:transparent;color:#fff}'
      + '.' + POPUP_ID + '-offer--wa{background:#fff;border-color:rgba(37,211,102,.32)}'
      + '.' + POPUP_ID + '-offer-eyebrow{display:inline-block;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,210,140,.92);margin-bottom:14px}'
      + '.' + POPUP_ID + '-offer--wa .' + POPUP_ID + '-offer-eyebrow{color:#0E5A1F}'
      + '.' + POPUP_ID + '-promo-pct{font-family:"Outfit",sans-serif;font-size:84px;font-weight:700;line-height:.85;letter-spacing:-.05em;color:#fff;margin:0 0 6px;display:flex;align-items:flex-start;font-variant-numeric:tabular-nums}'
      + '.' + POPUP_ID + '-promo-pct small{font-size:.45em;font-weight:600;color:rgba(255,210,140,.85);margin-top:6px;letter-spacing:0}'
      + '.' + POPUP_ID + '-promo-code{display:flex;align-items:center;gap:10px;margin:6px 0 18px;padding:10px 14px;background:rgba(255,255,255,.08);border:1px dashed rgba(255,255,255,.32);border-radius:8px}'
      + '.' + POPUP_ID + '-promo-code-label{font-size:9px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.55)}'
      + '.' + POPUP_ID + '-promo-code code{font-family:"Outfit",sans-serif;font-size:18px;font-weight:600;letter-spacing:.06em;color:#fff;font-variant-numeric:tabular-nums}'
      + '.' + POPUP_ID + '-or{display:flex;align-items:center;justify-content:center;gap:14px;color:#8A8780;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;margin:0;padding:2px 0}'
      + '.' + POPUP_ID + '-or::before,.' + POPUP_ID + '-or::after{content:"";flex:1;height:1px;background:rgba(14,14,14,.18)}'
      + '.' + POPUP_ID + '-or span{padding:0 4px}'
      + '.' + POPUP_ID + '-wa-row{display:flex;align-items:center;gap:14px;margin:0 0 16px}'
      + '.' + POPUP_ID + '-wa-icon{width:48px;height:48px;border-radius:999px;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(37,211,102,.32)}'
      + '.' + POPUP_ID + '-wa-icon svg{width:22px;height:22px}'
      + '.' + POPUP_ID + '-wa-words{display:flex;flex-direction:column;gap:3px}'
      + '.' + POPUP_ID + '-wa-words strong{font-family:"Outfit",sans-serif;font-size:18px;font-weight:600;letter-spacing:-.005em;color:#0E0E0E;line-height:1.15}'
      + '.' + POPUP_ID + '-wa-words span{font-size:12.5px;color:#5A5853;line-height:1.5}'
      + '.' + POPUP_ID + '-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:999px;font-size:14px;font-weight:500;letter-spacing:-.005em;text-decoration:none;border:1px solid;cursor:pointer;font-family:inherit;width:100%;transition:opacity .15s,transform .15s}'
      + '.' + POPUP_ID + '-cta:hover{opacity:.9;transform:translateY(-1px)}'
      + '.' + POPUP_ID + '-cta--ink{background:#fff;color:#0E0E0E;border-color:#fff}'
      + '.' + POPUP_ID + '-cta--wa{background:#0E0E0E;color:#fff;border-color:#0E0E0E}'
      + '@media (max-width:760px){'
      +   '.' + POPUP_ID + '-card{grid-template-columns:1fr;max-height:96vh;overflow-y:auto;border-radius:14px}'
      +   '.' + POPUP_ID + '-hero{min-height:240px;padding:32px 24px}'
      +   '.' + POPUP_ID + '-hero-h{font-size:30px;max-width:none}'
      +   '.' + POPUP_ID + '-offers{padding:24px}'
      +   '.' + POPUP_ID + '-promo-pct{font-size:60px}'
      +   '.' + POPUP_ID + '-offer{padding:18px}'
      + '}';
    var el = document.createElement('style');
    el.id = POPUP_ID + '-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ─── Show + dismiss
  var shown = false;
  function showPopup() {
    if (shown) return;
    if (!isWarmLead()) return;
    shown = true;
    if (!FORCED) markSeen();

    injectStyles();
    var wrap = document.createElement('div');
    wrap.innerHTML = buildPopup();
    var node = wrap.firstChild;
    document.body.appendChild(node);
    document.body.style.overflow = 'hidden';

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'exit_popup_shown', {
        page:         window.location.pathname,
        time_on_page_s: Math.round((nowMs() - startTime) / 1000),
        scroll_pct:   maxScrollPct,
        page_views:   pageViews(),
        platform:     isMobile() ? 'mobile' : 'desktop',
        is_forced:    FORCED ? 1 : 0
      });
    }

    function dismiss(reason) {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'exit_popup_dismissed', { reason: reason || 'close' });
      }
      var n = document.getElementById(POPUP_ID + '-overlay');
      if (n && n.parentNode) n.parentNode.removeChild(n);
      document.body.style.overflow = '';
    }

    node.querySelector('.' + POPUP_ID + '-close').addEventListener('click', function () { dismiss('close-button'); });
    node.addEventListener('click', function (e) { if (e.target === node) dismiss('overlay-click'); });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { dismiss('escape'); document.removeEventListener('keydown', escHandler); }
    });

    var promoBtn = node.querySelector('[data-action="apply-promo"]');
    if (promoBtn) {
      promoBtn.addEventListener('click', function (e) {
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(PROMO_CODE); } catch (err) {}
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'exit_popup_promo_apply', { page: window.location.pathname, promo_code: PROMO_CODE });
        }
        if (promoBtn.getAttribute('href') === '#exit-popup-promo-applied') {
          e.preventDefault();
          promoBtn.textContent = '✓ Copied — pick Your tier below';
          setTimeout(function () { dismiss('promo-applied-no-direct-link'); }, 2200);
        }
      });
    }

    var waBtn = node.querySelector('[data-action="open-whatsapp"]');
    if (waBtn) {
      waBtn.addEventListener('click', function () {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'exit_popup_whatsapp_open', { page: window.location.pathname });
        }
      });
    }
  }

  // ─── Desktop listener
  // Fires when cursor leaves the viewport through the top edge (toward tab bar,
  // address bar, or window close button). Only arms after engagement gate passes.
  function bindDesktop() {
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) showPopup();
    });
  }

  // ─── Mobile listener
  // pagehide: fires when the tab is closed, navigated away from, or the browser
  // app is backgrounded (home button / app-switcher on iOS/Android). This is the
  // most reliable "leaving" signal available on mobile — scroll-up momentum was
  // too noisy and is intentionally absent here.
  // visibilitychange acts as a secondary path for backgrounding the browser.
  function bindMobile() {
    var fired = false;
    function onLeave() {
      if (fired) return;
      fired = true;
      // We're inside a unload/visibility event — showPopup may not render in
      // time before the page unloads. Use a very short rAF to try, but don't
      // block — if the user is truly closing the tab they won't see it anyway;
      // this mainly catches "switch to another app then come back" on iOS.
      requestAnimationFrame(showPopup);
    }

    window.addEventListener('pagehide', onLeave, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) onLeave();
    }, { passive: true });
  }

  // ─── Init
  function init() {
    if (FORCED) { setTimeout(showPopup, 100); return; }
    if (hasPurchased()) return;
    if (isMobile()) bindMobile(); else bindDesktop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
