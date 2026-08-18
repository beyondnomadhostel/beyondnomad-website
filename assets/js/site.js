/* Beyond Nomad — site.js
   Menu, header, sticky bar, and the shared WhatsApp message composer.
   Spec: _redesign-docs/03-ux-architecture.md §4, §7.1–7.3 · _redesign-docs/06-copy.md §7.4
   No dependencies. No third-party requests. */
(function () {
  'use strict';

  var PHONE = '94773425595';
  var PHONE_HUMAN = '+94 77 342 5595';
  var EMAIL = 'beyondnomadluxuryhostelella@gmail.com';
  var ATTRIB = '— sent from beyondnomadhostel.com';

  /* --------------------------------------------------- dates, Colombo time
     The hostel is UTC+5:30. A traveller in Berlin at 23:00 on the 11th is
     already on the 12th here, so "today" must be computed in Asia/Colombo or
     the form rejects dates that have not passed. en-CA gives ISO YYYY-MM-DD,
     which is directly assignable to input.min and safely string-comparable. */
  function todayColombo() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function addDays(iso, n) {
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }

  function nightsBetween(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    var ms = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
    return Math.round(ms / 86400000);
  }

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* "Thu 12 Mar 2027" — unambiguous for both US and EU readers, unlike 12/03, and
     carrying the year because the form accepts dates ~18 months ahead and this
     string is the one artefact a human acts on. "Which March?" is a booking error. */
  function fmtDate(iso) {
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] +
      ' ' + d.getUTCFullYear();
  }

  /* ------------------------------------------------------ message composer
     Returns the plain-text body. Any line whose value is empty is omitted —
     never a label with nothing after it. 06-copy.md §7.4 */
  function compose(o) {
    o = o || {};
    var lines = [o.opening || 'Hi Beyond Nomad — I’d like to ask about a bed.', ''];
    if (o.dates) lines.push('Dates: ' + o.dates);
    if (o.guests) lines.push('Guests: ' + o.guests);
    if (o.room) lines.push('Room: ' + o.room);
    if (o.name) lines.push('Name: ' + o.name);
    if (o.contact) lines.push(o.contact);
    if (o.notes) { lines.push(''); lines.push('Notes: ' + o.notes); }
    lines.push('');
    lines.push(ATTRIB);
    return lines.join('\n');
  }

  var OPENINGS = {
    bed: 'Hi Beyond Nomad — I’d like to ask about a bed.',
    tonight: 'Hi Beyond Nomad — do you have a bed tonight?',
    'this-week': 'Hi Beyond Nomad — I’d like to ask about a bed.',
    'female-4': 'Hi Beyond Nomad — I’d like to ask about the Female Dorm.',
    'mixed-4': 'Hi Beyond Nomad — I’d like to ask about the 4-bed Mixed Dorm.',
    'mixed-6': 'Hi Beyond Nomad — I’d like to ask about the 6-bed Mixed Dorm.',
    'cooking-class': 'Hi Beyond Nomad — I’d like to ask about the cooking class.',
    'family-dinner': 'Hi Beyond Nomad — I’d like to join the family dinner.',
    scooter: 'Hi Beyond Nomad — I’d like to ask about renting a scooter.',
    train: 'Hi Beyond Nomad — I’m travelling to Ella soon. What’s the best way to get there at the moment?',
    breakfast: 'Hi Beyond Nomad — I’d like to ask about a bed.'
  };

  /* Message for a declarative link: <a data-wa data-wa-intent="tour" data-wa-label="Ella Rock"> */
  function messageFor(intent, label) {
    if (intent === 'tonight') {
      return compose({
        opening: OPENINGS.tonight,
        dates: 'tonight (1 night)', guests: '1', room: 'whatever you have'
      });
    }
    if (intent === 'this-week') {
      return compose({ opening: OPENINGS['this-week'], dates: 'sometime this week' });
    }
    if (intent === 'tour') {
      return compose({ opening: 'Hi Beyond Nomad — I’d like to ask about ' + label + '.' });
    }
    if (intent === 'train') return compose({ opening: OPENINGS.train });
    return compose({ opening: OPENINGS[intent] || OPENINGS.bed });
  }

  function waUrl(text) {
    return 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(text);
  }

  function mailtoUrl(subject, body) {
    return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  /* Capability test, not user-agent sniffing. 03-ux §4.6 */
  var isMobileLike = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ---------------------------------------------------------- desktop dialog
     wa.me on desktop redirects to web.whatsapp.com, which dead-ends without an
     already-paired session. So desktop gets a dialog, not a redirect. */
  var dialog = null;

  function buildDialog() {
    if (dialog) return dialog;
    var d = document.createElement('dialog');
    d.id = 'wa-dialog';
    d.innerHTML =
      '<div class="dialog__top">' +
        '<h2 style="font-size:var(--fs-h3)">Send this from your phone</h2>' +
        '<button type="button" class="dialog__close" aria-label="Close">Close</button>' +
      '</div>' +
      '<p class="meta" style="margin-bottom:var(--s5)">Your WhatsApp is on your phone, not on this computer. The quickest way is to scan this.</p>' +
      '<div class="dialog__qr" id="wa-qr"></div>' +
      '<p class="meta" id="wa-qr-note">Scan with your phone’s camera. It opens WhatsApp with the message already written.</p>' +
      '<ul class="dialog__options">' +
        '<li><a id="wa-web" href="#" target="_blank" rel="noopener">Open WhatsApp Web<small>Only works if you’re already signed in there.</small></a></li>' +
        '<li><a id="wa-mail" href="#">Email it instead<small>Same message, to ' + EMAIL + '</small></a></li>' +
        '<li><button type="button" id="wa-copy">Copy the message<small id="wa-copy-note">Paste it wherever suits you.</small></button></li>' +
      '</ul>' +
      '<p class="meta" style="margin-top:var(--s5)">Or just call: <a href="tel:+' + PHONE + '">' + PHONE_HUMAN + '</a></p>';
    document.body.appendChild(d);
    d.querySelector('.dialog__close').addEventListener('click', function () { d.close(); });
    dialog = d;
    return d;
  }

  var lastTrigger = null;

  function openDialog(text, subject) {
    var d = buildDialog();
    d.querySelector('#wa-web').href =
      'https://web.whatsapp.com/send?phone=' + PHONE + '&text=' + encodeURIComponent(text);
    d.querySelector('#wa-mail').href = mailtoUrl(subject || 'Asking about a bed', text);
    var copyBtn = d.querySelector('#wa-copy');
    var copyNote = d.querySelector('#wa-copy-note');
    copyNote.textContent = 'Paste it wherever suits you.';
    copyBtn.onclick = function () {
      copyText(text, function (ok) {
        copyNote.textContent = ok ? 'Copied.' : 'Select the text below and copy it.';
        if (!ok) showFallbackTextarea(d, text);
      });
    };

    /* The dialog is cached and reused, so this box must be HIDDEN on failure and
       never removed: removing it made the second and every later call throw on a
       null dereference, and because wireCTAs has already called preventDefault by
       then, the click did nothing at all. A desktop visitor filled in the whole
       form, pressed Send, and no window opened. */
    var qrBox = d.querySelector('#wa-qr');
    var note = d.querySelector('#wa-qr-note');
    if (qrBox) {
      qrBox.textContent = '';
      qrBox.hidden = false;
      /* Lazy-load the QR encoder: 0 KB on mobile, 0 KB until this dialog opens. */
      loadQR(function (ok) {
        if (ok && window.BNQR) {
          try {
            qrBox.appendChild(window.BNQR.svg(waUrl(text), 190));
            if (note) note.textContent = 'Scan with your phone’s camera. It opens WhatsApp with the message already written.';
            return;
          } catch (e) { /* fall through to the options below */ }
        }
        qrBox.hidden = true;
        if (note) note.textContent = 'Use one of the options below instead.';
      });
    }

    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    var first = d.querySelector('#wa-web');
    if (first) first.focus();
    d.addEventListener('close', function () {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    }, { once: true });
  }

  var qrState = 0;   /* 0 not tried, 1 loading, 2 ready, 3 failed */
  var qrQueue = [];

  function loadQR(cb) {
    if (qrState === 2) return cb(true);
    if (qrState === 3) return cb(false);
    qrQueue.push(cb);
    if (qrState === 1) return;
    qrState = 1;
    var s = document.createElement('script');
    s.src = '/assets/js/qr.js';
    s.onload = function () { qrState = 2; flushQR(true); };
    s.onerror = function () { qrState = 3; flushQR(false); };
    document.head.appendChild(s);
  }

  function flushQR(ok) {
    while (qrQueue.length) qrQueue.shift()(ok);
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  }

  function showFallbackTextarea(container, text) {
    if (container.querySelector('.copy-fallback')) return;
    var ta = document.createElement('textarea');
    ta.className = 'copy-fallback';
    ta.readOnly = true;
    ta.rows = 8;
    ta.value = text;
    ta.style.marginTop = 'var(--s4)';
    container.appendChild(ta);
    ta.focus();
    ta.select();
  }

  /* --------------------------------------------------------- declarative CTAs
     Every data-wa link gets a real href, so it works with JS half-loaded and
     is a genuine user-initiated navigation on mobile — never window.open() in
     a callback, which popup blockers kill. 03-ux §4.6 */
  function wireCTAs() {
    var links = document.querySelectorAll('a[data-wa]');
    Array.prototype.forEach.call(links, function (a) {
      var intent = a.getAttribute('data-wa-intent') || 'bed';
      var label = a.getAttribute('data-wa-label') || '';
      var text = messageFor(intent, label);
      a.href = waUrl(text);
      if (!isMobileLike) {
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          lastTrigger = a;
          var subject = intent === 'tour' && label
            ? 'Asking about ' + label
            : intent === 'family-dinner'
              ? 'Joining family dinner'
              : 'Asking about a bed';
          openDialog(text, subject);
        });
      }
    });
  }

  /* ------------------------------------------------------------------- menu */
  function wireMenu() {
    var panel = document.getElementById('site-menu');
    var openBtn = document.getElementById('menu-open');
    var closeBtn = document.getElementById('menu-close');
    if (!panel || !openBtn) return;

    var scrollY = 0;
    var focusables = 'a[href], button:not([disabled])';

    function open() {
      scrollY = window.scrollY;
      panel.setAttribute('data-open', 'true');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.position = 'fixed';
      document.body.style.top = -scrollY + 'px';
      document.body.style.width = '100%';
      var main = document.getElementById('main');
      if (main && 'inert' in HTMLElement.prototype) main.inert = true;
      var bar = document.querySelector('.stickybar');
      if (bar) bar.setAttribute('data-show', 'false');
      if (closeBtn) closeBtn.focus();
      document.addEventListener('keydown', onKey, true);
    }

    function close() {
      panel.setAttribute('data-open', 'false');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
      var main = document.getElementById('main');
      if (main && 'inert' in HTMLElement.prototype) main.inert = false;
      document.removeEventListener('keydown', onKey, true);
      openBtn.focus();
      updateBar();
    }

    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
      if (ev.key !== 'Tab') return;
      var items = panel.querySelectorAll(focusables);
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    panel.addEventListener('click', function (ev) {
      if (ev.target.tagName === 'A') close();
    });
  }

  /* ---------------------------------------------------- header + sticky bar */
  var bar = null, barVisible = false, primaryOnScreen = 0;

  function updateBar() {
    if (!bar) return;
    var show = window.scrollY > 400 && primaryOnScreen === 0 &&
      document.getElementById('site-menu') &&
      document.getElementById('site-menu').getAttribute('data-open') !== 'true';
    if (show !== barVisible) {
      barVisible = show;
      bar.setAttribute('data-show', show ? 'true' : 'false');
      /* transform moves the paint box, not the focus box: while the bar is translated
         off-screen it is still display:flex and still in the tab order, so tabbing to
         the end of the document focused an invisible control that then navigated.
         inert takes it out of both the tab order and the accessibility tree, and unlike
         display:none it keeps the transition and the :has() space reservation. */
      bar.inert = !show;
    }
  }

  function wireScroll() {
    bar = document.querySelector('.stickybar');
    var header = document.getElementById('site-header');
    var lastY = window.scrollY;

    /* The bar must never cover the thing it points at: it hides while any
       filled primary CTA is on screen. 03-ux §7.3 */
    if (bar && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          primaryOnScreen += e.isIntersecting ? 1 : -1;
        });
        if (primaryOnScreen < 0) primaryOnScreen = 0;
        updateBar();
      });
      Array.prototype.forEach.call(
        document.querySelectorAll('main .btn--primary, main .chip'),
        function (el) { io.observe(el); }
      );
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (header) {
          var hide = y > 400 && y > lastY;
          header.setAttribute('data-hidden', hide ? 'true' : 'false');
        }
        lastY = y;
        updateBar();
        ticking = false;
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ film */
  function wireFilms() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-film]'), function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-film');
        var poster = btn.getAttribute('data-poster') || '';
        var v = document.createElement('video');
        v.controls = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.setAttribute('poster', poster);
        v.src = src;
        btn.parentNode.replaceChild(v, btn);
        v.focus();
        var p = v.play();
        if (p && p.catch) p.catch(function () { /* user can press play */ });
      });
    });
  }

  /* --------------------------------------------------------------- exports */
  window.BN = {
    PHONE: PHONE, PHONE_HUMAN: PHONE_HUMAN, EMAIL: EMAIL, ATTRIB: ATTRIB,
    todayColombo: todayColombo, addDays: addDays, nightsBetween: nightsBetween,
    fmtDate: fmtDate, compose: compose, waUrl: waUrl, mailtoUrl: mailtoUrl,
    isMobileLike: isMobileLike, openDialog: openDialog, copyText: copyText,
    setTrigger: function (el) { lastTrigger = el; }
  };

  wireMenu();
  wireCTAs();
  wireScroll();
  wireFilms();
})();
