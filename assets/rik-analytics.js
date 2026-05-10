/**
 * RIK Athletica analytics — Phase 1.6 instrumentation
 *
 * Loaded on every page via <script defer src="/assets/rik-analytics.js"></script>
 * before </body>. Provides helper functions for GA4 + Kit tag fires.
 *
 * Event taxonomy locked in PLAN.md "Phase 1.6 instrumentation" section.
 *
 * Required globals:
 *   - GA4: window.gtag (loaded via Google Tag config snippet earlier in page)
 *   - Kit: tagged via direct API calls or Kit form embeds (no client lib needed)
 */

(function () {
  "use strict";

  /* ──────────────────────────────────────────────────────────────────────
   * GA4 helper
   * ────────────────────────────────────────────────────────────────────── */

  function track(eventName, params) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      // Quiet in dev; in prod GA4 should be loaded
      if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        console.warn("[rik-analytics] gtag not loaded; skipping event:", eventName);
      }
      return;
    }
    try {
      window.gtag("event", eventName, params || {});
    } catch (err) {
      console.error("[rik-analytics] track error:", err);
    }
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Scroll depth tracker
   *  Fires scroll_depth_25 / 50 / 75 / 100 once per page load.
   * ────────────────────────────────────────────────────────────────────── */

  var scrollMarks = { 25: false, 50: false, 75: false, 100: false };
  function onScroll() {
    var doc = document.documentElement;
    var winH = window.innerHeight;
    var scrolled = doc.scrollTop + winH;
    var total = doc.scrollHeight;
    if (total <= winH) return;
    var pct = Math.round((scrolled / total) * 100);
    [25, 50, 75, 100].forEach(function (mark) {
      if (!scrollMarks[mark] && pct >= mark) {
        scrollMarks[mark] = true;
        track("scroll_depth_" + mark, { page_path: window.location.pathname });
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Exit tracker (best-effort)
   * ────────────────────────────────────────────────────────────────────── */

  var enteredAt = Date.now();
  function onExit() {
    var dwellSec = Math.round((Date.now() - enteredAt) / 1000);
    track("page_exit", {
      page_path: window.location.pathname,
      dwell_seconds: dwellSec,
    });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Calculator-page events
   *
   * Page must call: window.RIK.calc.bindForm(formEl) on DOMContentLoaded.
   * ────────────────────────────────────────────────────────────────────── */

  function bindCalcForm(formEl) {
    if (!formEl) return;
    // Per-field focus
    formEl.querySelectorAll("input, select").forEach(function (input) {
      input.addEventListener(
        "focus",
        function () {
          track("calc_field_focus", {
            field_name: input.name || input.id || "unknown",
          });
        },
        { passive: true, once: true } // Only fire once per field per session
      );
    });
    // Submit
    formEl.addEventListener("submit", function () {
      track("calc_submit", { page_path: window.location.pathname });
    });
  }

  function calcResultViewed(payload) {
    track("calc_result_view", payload || {});
  }

  function calcCtaClick(target) {
    track("calc_cta_" + target + "_click", { page_path: window.location.pathname });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Audit-page events
   *
   * Page must call: window.RIK.audit.bindForm(formEl, totalSteps).
   * ────────────────────────────────────────────────────────────────────── */

  var currentAuditStep = 0;
  function bindAuditForm(formEl, totalSteps) {
    if (!formEl) return;
    // Field focus
    formEl.querySelectorAll("input, select, textarea").forEach(function (input) {
      input.addEventListener(
        "focus",
        function () {
          track("audit_field_focus", {
            field_name: input.name || input.id || "unknown",
            step: currentAuditStep,
          });
        },
        { passive: true, once: true }
      );
    });
    // Step advance/back: page should call window.RIK.audit.stepView(n) when changing step
    // Submit
    formEl.addEventListener("submit", function () {
      track("audit_submit", {
        page_path: window.location.pathname,
        total_steps: totalSteps,
      });
    });
    // Abandon: fire once on visibility change with current step
    var fired = false;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && !fired && currentAuditStep > 0 && currentAuditStep < totalSteps) {
        fired = true;
        track("audit_abandon_at_step", {
          step: currentAuditStep,
          dwell_seconds: Math.round((Date.now() - enteredAt) / 1000),
        });
      }
    });
  }

  function auditStepView(n) {
    currentAuditStep = n;
    track("audit_step_view", { step: n, page_path: window.location.pathname });
  }

  function auditStepAdvance(n) {
    track("audit_step_advance", { from_step: n });
  }

  function auditStepBack(n) {
    track("audit_step_back", { from_step: n });
  }

  function auditConfirmationViewed() {
    track("audit_confirmation_view", { page_path: window.location.pathname });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Generic CTA tracker
   *  Use on bundle/sprint/premium/home: window.RIK.cta(name)
   * ────────────────────────────────────────────────────────────────────── */

  function ctaClick(name) {
    track("cta_click", {
      cta_name: name,
      page_path: window.location.pathname,
    });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Page view fires automatically (gtag config does this).
   * Wire scroll + exit on every page.
   * ────────────────────────────────────────────────────────────────────── */

  if (typeof window !== "undefined") {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", onExit);

    window.RIK = window.RIK || {};
    window.RIK.track = track;
    window.RIK.cta = ctaClick;
    window.RIK.calc = {
      bindForm: bindCalcForm,
      resultViewed: calcResultViewed,
      ctaClick: calcCtaClick,
    };
    window.RIK.audit = {
      bindForm: bindAuditForm,
      stepView: auditStepView,
      stepAdvance: auditStepAdvance,
      stepBack: auditStepBack,
      confirmationViewed: auditConfirmationViewed,
    };
  }
})();
