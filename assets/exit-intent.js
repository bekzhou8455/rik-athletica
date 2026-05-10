/* ─────────────────────────────────────────────────────────────────────────────
   RIK Athletica · Exit-intent popup for warm-lead conversion (v2 — mini-poster)
   ───────────────────────────────────────────────────────────────────────────────

   Triggered when a "warm lead" shows exit intent. Two-column poster layout:
   left half = hero photo (sand-tinted athlete shot, blurred at edges so text
   on top of it remains legible). Right half = giant WELCOME15 + WhatsApp CTA.

   ─── Warm-lead qualifier (all conditions must hold)
   • Hasn't previously visited /thank-you (no purchase logged in localStorage)
   • Spent ≥30 seconds on the current page
   • Scrolled ≥30% of page height
   • Hasn't already seen this popup in the last 7 days

   ─── Exit-intent triggers
   • DESKTOP: mouseleave from the top of the viewport (cursor → URL bar)
   • MOBILE:  scroll-up momentum after scroll-down (back-button intent
              proxy) OR ≥90s without interaction on a non-CTA element

   ─── Preview hooks (for testing)
   • Append  ?force-popup=1   to any URL on a customer page → fires immediately,
     ignoring all qualifier checks AND the 7-day cooldown. Use to iterate the
     design without waiting for the 30s/30% threshold every reload.
   • Append  ?force-popup=tier-bundle   to test Bundle-tier flow specifically.

   ─── GA4 events fired
   • exit_popup_shown          — when popup renders (includes is_forced flag)
   • exit_popup_promo_apply    — when athlete clicks "Apply 15% off"
   • exit_popup_whatsapp_open  — when athlete clicks WhatsApp CTA
   • exit_popup_dismissed      — when athlete closes the popup

   ─── Stripe coupon dependency (BEK ACTION REQUIRED)
   See: STRIPE_PROMO_SETUP.md
─────────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  if (window.__rikExitIntent) return;
  window.__rikExitIntent = true;

  // ─── Config
  var STORAGE_KEY = 'rik_exit_popup';
  var PURCHASE_KEY = 'rik_purchased';
  var PROMO_CODE = 'WELCOME15';
  var COOLDOWN_DAYS = 7;
  var MIN_TIME_ON_PAGE_MS = 30 * 1000;
  var MIN_SCROLL_PERCENT = 30;
  var MOBILE_IDLE_TRIGGER_MS = 90 * 1000;

  // Hero photo for the poster — al-DSC00295.jpg is a strong sand-warm action shot.
  // Falls back to a deep ink gradient if the image fails to load.
  var HERO_IMAGE = '/assets/web/al-DSC00295.jpg';

  var STRIPE_LINKS = {
    bundle:       'https://buy.stripe.com/4gM7sN6Wq3cc7T0fZ67Re00',
    sprint_703:   'https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02',
    sprint_full:  'https://buy.stripe.com/7sY28tfsW2887T07sA7Re03',
    sprint_pro:   'https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04',
    premium:      'https://buy.stripe.com/00waEZ1C68ww2yG0087Re06'
  };
  var WA_LINK = 'https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20saw%20Your%20note%20on%20the%20way%20out%20%E2%80%94%20';

  // ─── Force-popup preview hook
  var urlParams = new URLSearchParams(window.location.search);
  var FORCED = urlParams.has('force-popup');
  var FORCED_TIER = urlParams.get('force-popup'); // e.g. "tier-bundle", "tier-premium"

  function detectTier() {
    if (FORCED_TIER && FORCED_TIER.indexOf('tier-') === 0) {
      return FORCED_TIER.replace('tier-', '');
    }
    var path = window.location.pathname;
    if (path.indexOf('/premium')    !== -1) return 'premium';
    if (path.indexOf('/bundle')     !== -1) return 'bundle';
    if (path.indexOf('/sprint')     !== -1) return 'sprint_default';
    return null;
  }

  // ─── State helpers
  function isMobile() {
    return window.matchMedia('(max-width: 760px)').matches ||
           ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
  function nowMs() { return Date.now(); }
  function getState() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function setState(patch) {
    try {
      var s = Object.assign(getState(), patch);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function hasPurchased() {
    try { return !!localStorage.getItem(PURCHASE_KEY); } catch (e) { return false; }
  }
  window.__rikMarkPurchased = function () {
    try { localStorage.setItem(PURCHASE_KEY, String(nowMs())); } catch (e) {}
  };

  // ─── Tracking
  var startTime = nowMs();
  var maxScrollPct = 0;
  var lastInteraction = nowMs();
  function trackScroll() {
    var docH = Math.max(
      document.body.scrollHeight, document.body.offsetHeight,
      document.documentElement.scrollHeight, document.documentElement.offsetHeight
    );
    var winH = window.innerHeight;
    var scrolled = window.scrollY || window.pageYOffset;
    var pct = Math.round(((scrolled + winH) / docH) * 100);
    if (pct > maxScrollPct) maxScrollPct = pct;
  }
  window.addEventListener('scroll', function () {
    trackScroll(); lastInteraction = nowMs();
  }, { passive: true });
  function touchActivity() { lastInteraction = nowMs(); }
  document.addEventListener('click', touchActivity, { passive: true });
  document.addEventListener('touchstart', touchActivity, { passive: true });

  // ─── Qualifier
  function isWarmLead() {
    if (FORCED) return true;
    if (hasPurchased()) return false;
    if (nowMs() - startTime < MIN_TIME_ON_PAGE_MS) return false;
    if (maxScrollPct < MIN_SCROLL_PERCENT) return false;
    var s = getState();
    if (s.shown_at) {
      var hoursSince = (nowMs() - s.shown_at) / 36e5;
      if (hoursSince < COOLDOWN_DAYS * 24) return false;
    }
    return true;
  }

  // ─── Build markup (mini-poster layout)
  var POPUP_ID = 'rik-exit-popup';
  function buildPopup() {
    var tier = detectTier();
    var stripeUrl =
      tier === 'premium' ? STRIPE_LINKS.premium :
      tier === 'bundle'  ? STRIPE_LINKS.bundle :
      tier === 'sprint_default' ? '' : '';
    var stripeUrlWithPromo = stripeUrl
      ? stripeUrl + (stripeUrl.indexOf('?') === -1 ? '?' : '&') + 'prefilled_promo_code=' + PROMO_CODE
      : '';
    var primaryCtaHref = stripeUrlWithPromo || '#exit-popup-promo-applied';
    var primaryCtaText = stripeUrlWithPromo ? 'Apply 15% off' : 'Copy Code';

    // WhatsApp glyph SVG (compact)
    var waSvg = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M17.5 14.4c-.3-.2-1.7-.8-2-1-.3-.1-.4-.2-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.7-1.4-1.7-1.6-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2.1-.2-.5-.5-.5-.6-.5h-.5c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2 0 1.3.9 2.6 1.1 2.7.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.1-.6-.3zM12 0C5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.5 5.8L0 24l6.4-1.4c1.7.9 3.6 1.4 5.6 1.4 6.6 0 12-5.4 12-12S18.6 0 12 0zm0 22c-1.9 0-3.6-.5-5.1-1.4l-3.7.8.8-3.6C3 16.2 2.5 14.1 2.5 12 2.5 6.7 6.7 2.5 12 2.5S21.5 6.7 21.5 12 17.3 22 12 22z"/>' +
      '</svg>';

    return ''
      + '<div id="' + POPUP_ID + '-overlay" class="' + POPUP_ID + '-overlay" role="dialog" aria-modal="true" aria-labelledby="' + POPUP_ID + '-title">'
      + '  <div class="' + POPUP_ID + '-card" role="document">'
      + '    <button type="button" class="' + POPUP_ID + '-close" aria-label="Close">×</button>'
      + ''
      + '    <!-- LEFT: hero photo (mini-poster aesthetic) -->'
      + '    <div class="' + POPUP_ID + '-hero" aria-hidden="true">'
      + '      <div class="' + POPUP_ID + '-hero-img" style="background-image:url(\'' + HERO_IMAGE + '\')"></div>'
      + '      <div class="' + POPUP_ID + '-hero-scrim"></div>'
      + '      <div class="' + POPUP_ID + '-hero-text">'
      + '        <span class="' + POPUP_ID + '-hero-tag">─── &nbsp;Before You Go&nbsp; ───</span>'
      + '        <h2 class="' + POPUP_ID + '-hero-h" id="' + POPUP_ID + '-title">Wait. <span>Two ways</span><br>to stay.</h2>'
      + '        <span class="' + POPUP_ID + '-hero-foot">Either way — we don\'t want You leaving empty-handed.</span>'
      + '      </div>'
      + '    </div>'
      + ''
      + '    <!-- RIGHT: two stacked offers -->'
      + '    <div class="' + POPUP_ID + '-offers">'
      + ''
      + '      <!-- OFFER A: Discount code -->'
      + '      <div class="' + POPUP_ID + '-offer ' + POPUP_ID + '-offer--promo">'
      + '        <span class="' + POPUP_ID + '-offer-eyebrow">15% off · 48h · first-time</span>'
      + '        <div class="' + POPUP_ID + '-promo-pct">15<small>%</small></div>'
      + '        <div class="' + POPUP_ID + '-promo-code">'
      + '          <span class="' + POPUP_ID + '-promo-code-label">Code</span>'
      + '          <code>' + PROMO_CODE + '</code>'
      + '        </div>'
      + '        <a class="' + POPUP_ID + '-cta ' + POPUP_ID + '-cta--ink" href="' + primaryCtaHref + '" data-action="apply-promo" data-track="exit_popup_promo_apply">'
      + '          ' + primaryCtaText + ' &nbsp;↗'
      + '        </a>'
      + '      </div>'
      + ''
      + '      <!-- Divider -->'
      + '      <div class="' + POPUP_ID + '-or"><span>or</span></div>'
      + ''
      + '      <!-- OFFER B: WhatsApp -->'
      + '      <div class="' + POPUP_ID + '-offer ' + POPUP_ID + '-offer--wa">'
      + '        <span class="' + POPUP_ID + '-offer-eyebrow">Founder-direct · same biz day</span>'
      + '        <div class="' + POPUP_ID + '-wa-row">'
      + '          <div class="' + POPUP_ID + '-wa-icon">' + waSvg + '</div>'
      + '          <div class="' + POPUP_ID + '-wa-words">'
      + '            <strong>Talk to Bek.</strong>'
      + '            <span>Race-date doubt, gut question, "is Sprint right for Me" — anything.</span>'
      + '          </div>'
      + '        </div>'
      + '        <a class="' + POPUP_ID + '-cta ' + POPUP_ID + '-cta--wa" href="' + WA_LINK + '" target="_blank" rel="noopener" data-action="open-whatsapp" data-track="exit_popup_whatsapp_open">'
      + '          Open WhatsApp &nbsp;↗'
      + '        </a>'
      + '      </div>'
      + ''
      + '    </div>'
      + '  </div>'
      + '</div>';
  }

  // ─── Styles (injected once, scoped)
  function injectStyles() {
    if (document.getElementById(POPUP_ID + '-styles')) return;
    var css = ''
      // Overlay
      + '#' + POPUP_ID + '-overlay{position:fixed;inset:0;z-index:9998;background:rgba(14,14,14,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;animation:rxp-fade .25s ease forwards;font-family:"Outfit",-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif}'
      + '@keyframes rxp-fade{to{opacity:1}}'
      + '@keyframes rxp-up{from{opacity:0;transform:translateY(20px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}'
      // Card — wide poster, two columns
      + '.' + POPUP_ID + '-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);max-width:880px;width:100%;max-height:92vh;background:#EEEDEA;color:#0E0E0E;border-radius:18px;overflow:hidden;position:relative;box-shadow:0 32px 80px -16px rgba(0,0,0,.45);animation:rxp-up .4s cubic-bezier(.2,.9,.3,1) forwards}'
      // Close button
      + '.' + POPUP_ID + '-close{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:999px;border:1px solid rgba(255,255,255,.32);background:rgba(14,14,14,.55);color:#fff;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:0;transition:opacity .15s,transform .15s;z-index:5;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}'
      + '.' + POPUP_ID + '-close:hover{opacity:.8;transform:scale(1.05)}'
      // ─── HERO (left column)
      + '.' + POPUP_ID + '-hero{position:relative;min-height:480px;color:#fff;display:flex;align-items:flex-end;padding:40px 32px;isolation:isolate;background:linear-gradient(135deg,#0E0E0E 0%,#3a2418 100%)}'
      + '.' + POPUP_ID + '-hero-img{position:absolute;inset:0;background-size:cover;background-position:center 30%;background-repeat:no-repeat;z-index:0}'
      + '.' + POPUP_ID + '-hero-scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(135deg,rgba(14,14,14,.72) 0%,rgba(14,14,14,.42) 50%,rgba(14,14,14,.65) 100%),radial-gradient(ellipse 60% 60% at 30% 70%,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 75%)}'
      + '.' + POPUP_ID + '-hero-text{position:relative;z-index:2;display:flex;flex-direction:column;gap:14px;text-shadow:0 1px 0 rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.45),0 8px 24px rgba(0,0,0,.32)}'
      + '.' + POPUP_ID + '-hero-tag{font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,210,140,.92)}'
      + '.' + POPUP_ID + '-hero-h{font-family:"Outfit",sans-serif;font-size:clamp(34px,4.4vw,46px);font-weight:700;line-height:.96;letter-spacing:-.02em;color:#fff;margin:0;max-width:14ch}'
      + '.' + POPUP_ID + '-hero-h span{color:rgba(255,255,255,.55);font-weight:700}'
      + '.' + POPUP_ID + '-hero-foot{font-size:13px;line-height:1.5;color:rgba(255,255,255,.78);margin-top:6px;max-width:32ch}'
      // ─── OFFERS (right column)
      + '.' + POPUP_ID + '-offers{display:flex;flex-direction:column;justify-content:center;padding:36px 36px;gap:14px;background:#EEEDEA}'
      // Single offer card
      + '.' + POPUP_ID + '-offer{background:#fff;border:1px solid rgba(14,14,14,.10);border-radius:14px;padding:22px 22px}'
      + '.' + POPUP_ID + '-offer--promo{background:#0E0E0E;border-color:transparent;color:#fff}'
      + '.' + POPUP_ID + '-offer--wa{background:#fff;border-color:rgba(37,211,102,.32)}'
      + '.' + POPUP_ID + '-offer-eyebrow{display:inline-block;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,210,140,.92);margin-bottom:14px}'
      + '.' + POPUP_ID + '-offer--wa .' + POPUP_ID + '-offer-eyebrow{color:#0E5A1F}'
      // Promo block: giant 15% number
      + '.' + POPUP_ID + '-promo-pct{font-family:"Outfit",sans-serif;font-size:84px;font-weight:700;line-height:.85;letter-spacing:-.05em;color:#fff;margin:0 0 6px;display:flex;align-items:flex-start;font-variant-numeric:tabular-nums}'
      + '.' + POPUP_ID + '-promo-pct small{font-size:.45em;font-weight:600;color:rgba(255,210,140,.85);margin-top:6px;letter-spacing:0}'
      + '.' + POPUP_ID + '-promo-code{display:flex;align-items:center;gap:10px;margin:6px 0 18px;padding:10px 14px;background:rgba(255,255,255,.08);border:1px dashed rgba(255,255,255,.32);border-radius:8px}'
      + '.' + POPUP_ID + '-promo-code-label{font-size:9px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.55)}'
      + '.' + POPUP_ID + '-promo-code code{font-family:"Outfit",sans-serif;font-size:18px;font-weight:600;letter-spacing:.06em;color:#fff;font-variant-numeric:tabular-nums}'
      // OR divider
      + '.' + POPUP_ID + '-or{display:flex;align-items:center;justify-content:center;gap:14px;color:#8A8780;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;margin:0;padding:2px 0}'
      + '.' + POPUP_ID + '-or::before,.' + POPUP_ID + '-or::after{content:"";flex:1;height:1px;background:rgba(14,14,14,.18)}'
      + '.' + POPUP_ID + '-or span{padding:0 4px}'
      // WA block
      + '.' + POPUP_ID + '-wa-row{display:flex;align-items:center;gap:14px;margin:0 0 16px}'
      + '.' + POPUP_ID + '-wa-icon{width:48px;height:48px;border-radius:999px;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(37,211,102,.32)}'
      + '.' + POPUP_ID + '-wa-icon svg{width:22px;height:22px}'
      + '.' + POPUP_ID + '-wa-words{display:flex;flex-direction:column;gap:3px}'
      + '.' + POPUP_ID + '-wa-words strong{font-family:"Outfit",sans-serif;font-size:18px;font-weight:600;letter-spacing:-.005em;color:#0E0E0E;line-height:1.15}'
      + '.' + POPUP_ID + '-wa-words span{font-size:12.5px;color:#5A5853;line-height:1.5}'
      // CTA
      + '.' + POPUP_ID + '-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:999px;font-size:14px;font-weight:500;letter-spacing:-.005em;text-decoration:none;border:1px solid;cursor:pointer;font-family:inherit;width:100%;transition:opacity .15s,transform .15s}'
      + '.' + POPUP_ID + '-cta:hover{opacity:.9;transform:translateY(-1px)}'
      + '.' + POPUP_ID + '-cta--ink{background:#fff;color:#0E0E0E;border-color:#fff}'
      + '.' + POPUP_ID + '-cta--wa{background:#0E0E0E;color:#fff;border-color:#0E0E0E}'
      // ─── Mobile: stack vertical, photo on top
      + '@media (max-width:760px){'
      +   '.' + POPUP_ID + '-card{grid-template-columns:1fr;max-height:96vh;overflow-y:auto;border-radius:14px}'
      +   '.' + POPUP_ID + '-hero{min-height:240px;padding:32px 24px}'
      +   '.' + POPUP_ID + '-hero-h{font-size:30px;max-width:none}'
      +   '.' + POPUP_ID + '-offers{padding:24px}'
      +   '.' + POPUP_ID + '-promo-pct{font-size:60px}'
      +   '.' + POPUP_ID + '-offer{padding:18px}'
      + '}';
    var style = document.createElement('style');
    style.id = POPUP_ID + '-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Show + dismiss
  var shown = false;
  function showPopup() {
    if (shown) return;
    if (!isWarmLead()) return;
    shown = true;
    if (!FORCED) setState({ shown_at: nowMs() });

    injectStyles();
    var wrap = document.createElement('div');
    wrap.innerHTML = buildPopup();
    var node = wrap.firstChild;
    document.body.appendChild(node);
    document.body.style.overflow = 'hidden';

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'exit_popup_shown', {
        page: window.location.pathname,
        time_on_page_s: Math.round((nowMs() - startTime) / 1000),
        scroll_pct: maxScrollPct,
        is_forced: FORCED ? 1 : 0
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
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(PROMO_CODE);
          }
        } catch (err) {}
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'exit_popup_promo_apply', {
            page: window.location.pathname,
            promo_code: PROMO_CODE
          });
        }
        if (promoBtn.getAttribute('href') === '#exit-popup-promo-applied') {
          e.preventDefault();
          // For Sprint pages: copied + close popup so they can pick a tier
          promoBtn.textContent = '✓ Copied — pick Your tier below';
          setTimeout(function () { dismiss('promo-applied-no-direct-link'); }, 2200);
        }
      });
    }

    var waBtn = node.querySelector('[data-action="open-whatsapp"]');
    if (waBtn) {
      waBtn.addEventListener('click', function () {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'exit_popup_whatsapp_open', {
            page: window.location.pathname
          });
        }
      });
    }
  }

  // ─── Listeners
  function bindDesktop() {
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) showPopup();
    });
  }
  function bindMobile() {
    var lastY = window.scrollY;
    var maxY = lastY;
    var scrollUpAttempts = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y > maxY) maxY = y;
      var dy = y - lastY;
      lastY = y;
      if (dy < -250 && maxY > window.innerHeight * 0.6) {
        scrollUpAttempts++;
        if (scrollUpAttempts >= 2) showPopup();
      }
    }, { passive: true });
    setInterval(function () {
      if (nowMs() - lastInteraction > MOBILE_IDLE_TRIGGER_MS) {
        if (isWarmLead()) showPopup();
      }
    }, 5000);
  }

  // ─── Init
  function init() {
    if (FORCED) {
      // Force-popup preview hook — fire on next tick
      setTimeout(showPopup, 100);
      return;
    }
    if (hasPurchased()) return;
    if (isMobile()) bindMobile(); else bindDesktop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
