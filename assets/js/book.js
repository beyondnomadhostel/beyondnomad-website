/* Beyond Nomad — book.js
   The request form. Composes a WhatsApp message; there is no server and nothing
   is ever asserted to have been delivered.
   Spec: _redesign-docs/03-ux-architecture.md §5 · _redesign-docs/06-copy.md §7.3 */
(function () {
  'use strict';
  var BN = window.BN;
  var form = document.getElementById('request-form');
  if (!form) return;

  /* The form ships hidden in the markup and is revealed here. If site.js did not
     arrive — one flaky request on 3G, which is journey J1's exact condition — the
     visitor gets the contact details instead of a Send button that opens an empty
     WhatsApp chat and silently discards everything they typed. */
  var direct = document.getElementById('direct-contact');
  if (!BN) {
    if (direct) direct.hidden = false;
    return;
  }
  form.hidden = false;
  if (direct) direct.hidden = true;

  var LOADED_AT = (window.performance && performance.now) ? performance.now() : Date.now();
  var DRAFT_KEY = 'bn.pendingRequest';
  var SUBMIT_KEY = 'bn.submits';

  var el = {
    checkin: document.getElementById('checkin'),
    checkout: document.getElementById('checkout'),
    guests: document.getElementById('guests'),
    room: document.getElementById('room'),
    name: document.getElementById('name'),
    whatsapp: document.getElementById('whatsapp'),
    email: document.getElementById('email'),
    notes: document.getElementById('notes'),
    consent: document.getElementById('consent'),
    website: document.getElementById('website'),
    nights: document.getElementById('nights'),
    submit: document.getElementById('submit-btn'),
    submitNote: document.getElementById('submit-note'),
    summary: document.getElementById('form-errors'),
    summaryTitle: document.getElementById('form-errors-title'),
    summaryList: document.getElementById('form-errors-list'),
    sent: document.getElementById('sent-panel'),
    sentSummary: document.getElementById('sent-summary'),
    offline: document.getElementById('offline-panel'),
    failed: document.getElementById('failed-panel'),
    restore: document.getElementById('restore-panel'),
    restoreWhen: document.getElementById('restore-when'),
    waOpt: document.getElementById('whatsapp-opt'),
    emailOpt: document.getElementById('email-opt')
  };

  var LABELS = {
    checkin: 'Check-in', checkout: 'Check-out', guests: 'How many of you?',
    name: 'Your name', whatsapp: 'Your WhatsApp number', email: 'Your email',
    consent: 'Consent to reply'
  };

  var touched = {};

  /* ------------------------------------------------------------ date bounds */
  var today = BN.todayColombo();
  el.checkin.min = today;
  el.checkin.max = BN.addDays(today, 550);          /* ~18 months */

  function syncCheckoutBounds() {
    var ci = el.checkin.value;
    if (!ci) { el.checkout.min = BN.addDays(today, 1); el.checkout.removeAttribute('max'); return; }
    el.checkout.min = BN.addDays(ci, 1);
    el.checkout.max = BN.addDays(ci, 60);
    if (el.checkout.value && el.checkout.value <= ci) {
      el.checkout.value = '';
      setError('checkout', 'We cleared your check-out date — the new arrival date is after it.');
    }
  }

  function nights() {
    if (!el.checkin.value || !el.checkout.value) return 0;
    var n = BN.nightsBetween(el.checkin.value, el.checkout.value);
    return n > 0 ? n : 0;
  }

  function updateNights() {
    var n = nights();
    el.nights.textContent = n === 0 ? '' : (n === 1 ? '1 night' : n + ' nights');
  }

  /* -------------------------------------------------------------- messaging */
  function contactMethod() {
    var r = form.querySelector('input[name="contact"]:checked');
    return r ? r.value : 'whatsapp';
  }

  function datesLine() {
    var n = nights();
    if (!el.checkin.value || !el.checkout.value) return 'not sure yet';
    return BN.fmtDate(el.checkin.value) + ' → ' + BN.fmtDate(el.checkout.value) +
      ' (' + n + (n === 1 ? ' night)' : ' nights)');
  }

  function buildMessage() {
    var method = contactMethod();
    var reply = '';
    if (method === 'whatsapp' && el.whatsapp.value.trim()) {
      reply = 'Reply to: ' + el.whatsapp.value.trim() + ' (WhatsApp)';
    } else if (method === 'email' && el.email.value.trim()) {
      reply = 'Reply to: ' + el.email.value.trim();
    }
    return BN.compose({
      opening: 'Hi Beyond Nomad — I’d like to ask about a bed.',
      dates: datesLine(),
      guests: el.guests.value ? String(parseInt(el.guests.value, 10)) : '',
      room: el.room.value || 'whatever you have',
      name: el.name.value.trim(),
      contact: reply,
      notes: el.notes.value.trim()
    });
  }

  function emailSubject() {
    var who = el.name.value.trim();
    var base = 'Asking about a bed';
    if (who && el.checkin.value) return base + ' — ' + who + ', ' + BN.fmtDate(el.checkin.value);
    if (who) return base + ' — ' + who;
    return base;
  }

  function refreshHref() {
    el.submit.href = BN.waUrl(buildMessage());
  }

  /* ------------------------------------------------------------- validation */
  function setError(field, msg) {
    var input = el[field];
    var p = document.getElementById(field + '-error');
    if (!p) return;
    if (msg) {
      p.textContent = msg;
      p.hidden = false;
      if (input) input.setAttribute('aria-invalid', 'true');
    } else {
      p.textContent = '';
      p.hidden = true;
      if (input) input.removeAttribute('aria-invalid');
    }
  }

  var TEL_RE = /^[+]?[0-9\s().-]{7,20}$/;
  var MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

  /* Returns a message that BLOCKS submit, or '' if fine.
     Soft advisories are shown by softCheck() and never block. */
  function hardCheck(field) {
    var v, method = contactMethod();
    switch (field) {
      case 'checkin':
        v = el.checkin.value;
        if (!v) return 'When would you arrive?';
        if (v < today) return 'That date has passed. Pick today or later.';
        if (v > BN.addDays(today, 550)) return 'That’s further ahead than we can plan. Message us directly.';
        return '';
      case 'checkout':
        v = el.checkout.value;
        if (!v) return 'And when would you leave?';
        if (el.checkin.value && v <= el.checkin.value) return 'Check-out needs to be after check-in.';
        return '';
      case 'guests':
        v = el.guests.value;
        if (!v || !/^\d+$/.test(v) || parseInt(v, 10) < 1) return 'How many people are staying?';
        return '';
      case 'name':
        if (el.name.value.trim().length < 2) return 'What should we call you?';
        return '';
      case 'whatsapp':
        if (method !== 'whatsapp') return '';
        v = el.whatsapp.value.trim();
        if (!v) return 'We’ll need a number to reply to.';
        if (!TEL_RE.test(v)) return 'That doesn’t look like a phone number. Include your country code.';
        return '';
      case 'email':
        v = el.email.value.trim();
        if (method !== 'email') {
          return (v && !MAIL_RE.test(v)) ? 'Check that address — there’s a typo somewhere.' : '';
        }
        if (!v) return 'We’ll need an email to reply to.';
        if (!MAIL_RE.test(v)) return 'Check that address — there’s a typo somewhere.';
        return '';
      case 'consent':
        return el.consent.checked ? '' : 'We need your OK before we can reply to you.';
      default:
        return '';
    }
  }

  /* Soft advisories — shown, still submittable. 06-copy.md §7.3.2 */
  function softCheck() {
    var g = parseInt(el.guests.value, 10);
    if (g > 6 && !hardCheck('guests')) {
      setError('guests', 'Our biggest dorm sleeps six. Send it anyway and we’ll see what we can do.');
    }
    var n = nights();
    if (n > 30 && !hardCheck('checkout')) {
      setError('checkout', 'That’s more than a month. Send it anyway and let’s talk about it properly.');
    }
  }

  function validateField(field) {
    var msg = hardCheck(field);
    setError(field, msg);
    return !msg;
  }

  var FIELDS = ['checkin', 'checkout', 'guests', 'name', 'whatsapp', 'email', 'consent'];

  function validateAll() {
    var bad = [];
    FIELDS.forEach(function (f) {
      var msg = hardCheck(f);
      setError(f, msg);
      if (msg) bad.push({ field: f, msg: msg });
    });
    softCheck();
    return bad;
  }

  function showSummary(bad) {
    el.summaryList.textContent = '';
    bad.forEach(function (b) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + b.field;
      a.textContent = LABELS[b.field] + ' — ' + b.msg;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var target = el[b.field];
        if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
      });
      li.appendChild(a);
      el.summaryList.appendChild(li);
    });
    el.summaryTitle.textContent = bad.length === 1
      ? 'There is 1 thing to fix.'
      : 'There are ' + bad.length + ' things to fix.';
    el.summary.hidden = false;
    el.summary.focus();
  }

  /* ------------------------------------------------------------ spam layers */
  function submitCount() {
    try { return parseInt(sessionStorage.getItem(SUBMIT_KEY) || '0', 10); } catch (e) { return 0; }
  }
  function bumpSubmits() {
    try { sessionStorage.setItem(SUBMIT_KEY, String(submitCount() + 1)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- drafts */
  function saveDraft(text) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        t: Date.now(), text: text,
        v: {
          checkin: el.checkin.value, checkout: el.checkout.value, guests: el.guests.value,
          room: el.room.value, name: el.name.value, whatsapp: el.whatsapp.value,
          email: el.email.value, notes: el.notes.value, contact: contactMethod()
        }
      }));
      return true;
    } catch (e) {
      return false;   /* private browsing or quota — the caller must not claim a save */
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.t || Date.now() - d.t > 7 * 86400000) { localStorage.removeItem(DRAFT_KEY); return null; }
      return d;
    } catch (e) { return null; }
  }

  function offerRestore() {
    var d = readDraft();
    if (!d || !el.restore || !d.v || !d.v.checkin) return;
    var when = new Date(d.t);
    el.restoreWhen.textContent = 'You started a message to us on ' +
      when.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) + '. Want to pick it up?';
    el.restore.hidden = false;
    document.getElementById('restore-yes').addEventListener('click', function () {
      Object.keys(d.v).forEach(function (k) {
        if (k === 'contact') {
          var r = form.querySelector('input[name="contact"][value="' + d.v.contact + '"]');
          if (r) { r.checked = true; }
        } else if (el[k]) {
          el[k].value = d.v[k];
        }
      });
      el.restore.hidden = true;
      syncCheckoutBounds(); updateNights(); syncContactRequirement(); refreshHref();
    });
    document.getElementById('restore-no').addEventListener('click', function () {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
      el.restore.hidden = true;
    });
  }

  /* --------------------------------------------------------- contact method */
  function syncContactRequirement() {
    var m = contactMethod();
    el.whatsapp.required = m === 'whatsapp';
    el.email.required = m === 'email';
    el.waOpt.textContent = m === 'whatsapp' ? '' : '(optional)';
    el.emailOpt.textContent = m === 'email' ? '' : '(optional)';
    if (touched.whatsapp) validateField('whatsapp');
    if (touched.email) validateField('email');
  }

  /* ----------------------------------------------------------------- panels */
  function showPanel(panel) {
    [el.sent, el.offline, el.failed].forEach(function (p) { if (p) p.hidden = true; });
    if (!panel) return;
    panel.hidden = false;
    var h = panel.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  function humanSummary() {
    var bits = [];
    if (el.checkin.value && el.checkout.value) {
      var n = nights();
      bits.push(BN.fmtDate(el.checkin.value) + ' → ' + BN.fmtDate(el.checkout.value));
      bits.push(n === 1 ? '1 night' : n + ' nights');
    }
    if (el.guests.value) bits.push(el.guests.value + (parseInt(el.guests.value, 10) === 1 ? ' guest' : ' guests'));
    bits.push(el.room.value || 'whichever dorm you recommend');
    return bits.join(' · ');
  }

  /* ------------------------------------------------------------------ submit */
  el.submit.addEventListener('click', function (ev) {
    Object.keys(LABELS).forEach(function (f) { touched[f] = true; });

    /* Honeypot: off-screen, not display:none — bots skip hidden fields but fill
       off-screen ones. Silent drop, no message. 03-ux §5.6 */
    if (el.website && el.website.value) { ev.preventDefault(); return; }

    /* Time trap. Not a fake success — we do not lie, even to a bot. */
    var elapsed = ((window.performance && performance.now) ? performance.now() : Date.now()) - LOADED_AT;
    if (elapsed < 3000) {
      ev.preventDefault();
      el.submitNote.textContent = 'Give that another tap.';
      return;
    }

    if (submitCount() >= 5) {
      ev.preventDefault();
      /* Never assert receipt — this page cannot know. And the counter now only
         increments on a confirmed handoff, so five means five that actually left. */
      el.submitNote.textContent = 'You’ve tapped Send five times. If those didn’t go through, call ' + BN.PHONE_HUMAN + ' — it’s quicker.';
      return;
    }

    var bad = validateAll();
    if (bad.length) { ev.preventDefault(); showSummary(bad); return; }
    el.summary.hidden = true;
    el.submitNote.textContent = '';

    var text = buildMessage();
    var saved = saveDraft(text);

    if (navigator.onLine === false) {
      ev.preventDefault();
      var op = document.getElementById('offline-saved');
      if (op) {
        op.textContent = saved
          ? 'We’ve saved this message on your phone. Tap Send again when you have signal and it will still be here.'
          : 'Your browser wouldn’t let us save it, so keep this tab open and tap Send again when you have signal.';
      }
      showPanel(el.offline);
      el.submit.textContent = 'Try again';
      return;
    }

    if (!BN.isMobileLike) {
      ev.preventDefault();
      BN.setTrigger(el.submit);
      BN.openDialog(text, emailSubject());
      return;
    }

    /* Mobile: this is a real user-initiated navigation on an <a href>, so no
       popup blocker is involved. We then probe whether WhatsApp actually took
       over — and we never claim the message was delivered. 03-ux §5.5 */
    el.sentSummary.textContent = humanSummary();
    var settled = false;
    function onHide() {
      if (document.visibilityState === 'hidden') {
        settled = true;
        document.removeEventListener('visibilitychange', onHide);
        /* This is the only evidence we have that the handoff happened, so it is also
           the only place the submit counter should move (R-06) and the only place the
           stored draft should be dropped (R-18: the privacy policy says seven days,
           and a message that has left should not sit there at all). */
        bumpSubmits();
        clearDraft();
        form.hidden = true;
        showPanel(el.sent);
      }
    }
    document.addEventListener('visibilitychange', onHide);
    setTimeout(function () {
      if (settled) return;
      document.removeEventListener('visibilitychange', onHide);
      var mail = document.getElementById('failed-email');
      if (mail) mail.href = BN.mailtoUrl(emailSubject(), text);
      var copy = document.getElementById('failed-copy');
      if (copy) {
        copy.onclick = function () {
          BN.copyText(text, function (ok) {
            document.getElementById('failed-copy-note').textContent =
              ok ? 'Copied.' : 'Long-press the message in WhatsApp instead, or call us.';
          });
        };
      }
      showPanel(el.failed);
    }, 2500);
  });

  /* -------------------------------------------------------------- listeners */
  FIELDS.forEach(function (f) {
    var input = el[f];
    if (!input) return;
    input.addEventListener('blur', function () { touched[f] = true; validateField(f); softCheck(); });
    input.addEventListener('input', function () {
      /* Only ever clear an error while typing — never raise one. 03-ux §5.3 */
      if (touched[f] && !hardCheck(f)) setError(f, '');
      refreshHref();
    });
    input.addEventListener('change', refreshHref);
  });

  el.checkin.addEventListener('change', function () {
    syncCheckoutBounds(); updateNights(); softCheck(); refreshHref();
    if (touched.checkin) validateField('checkin');
  });
  el.checkout.addEventListener('change', function () {
    updateNights(); softCheck(); refreshHref();
    if (touched.checkout) validateField('checkout');
  });
  el.room.addEventListener('change', refreshHref);
  el.notes.addEventListener('input', refreshHref);
  el.consent.addEventListener('change', function () { if (touched.consent) validateField('consent'); });
  Array.prototype.forEach.call(form.querySelectorAll('input[name="contact"]'), function (r) {
    r.addEventListener('change', function () { syncContactRequirement(); refreshHref(); });
  });

  form.addEventListener('submit', function (ev) { ev.preventDefault(); el.submit.click(); });

  /* The submit control is an <a>, deliberately — on mobile the tap has to be a genuine
     user-initiated navigation or a popup blocker kills it. But a form whose only control
     is a link never fires `submit`, so Enter in a field did nothing at all. Textareas
     keep Enter for newlines. QA 🟠-3. */
  form.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    var t = ev.target;
    if (!t || t.tagName === 'TEXTAREA' || t.tagName === 'A' || t.tagName === 'BUTTON') return;
    ev.preventDefault();
    el.submit.click();
  });

  /* The chip on this page focuses the first field and opens the native picker. */
  var pick = document.getElementById('chip-pick');
  if (pick) {
    pick.addEventListener('click', function () {
      setTimeout(function () {
        el.checkin.focus();
        if (el.checkin.showPicker) { try { el.checkin.showPicker(); } catch (e) { /* not allowed */ } }
      }, 60);
    });
  }
  if (location.hash === '#request') {
    setTimeout(function () { el.checkin.focus(); }, 100);
  }

  /* ------------------------------------------------------------------- init */
  el.submit.textContent = BN.isMobileLike ? 'Send on WhatsApp' : 'Send request';
  syncCheckoutBounds();
  syncContactRequirement();
  updateNights();
  refreshHref();
  offerRestore();
})();
