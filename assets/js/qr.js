/* Beyond Nomad — qr.js
   A minimal QR encoder: byte mode, error-correction level L, versions 1–26.
   Exists so the desktop dialog can offer "scan this with your phone", which is
   the best desktop path to WhatsApp (03-ux-architecture.md §4.6).

   Loaded lazily, only when that dialog opens: 0 bytes on mobile, 0 bytes on
   desktop until the visitor asks for it. No dependencies, no CDN.

   Exposes window.BNQR.svg(text, pixelSize) -> <svg> element. */
(function () {
  'use strict';

  /* ------------------------------------------------- per-version tables (L) */
  /* [ecCodewordsPerBlock, group1Blocks, group1DataCW, group2Blocks, group2DataCW] */
  var RS = [null,
    [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0], [18, 2, 68, 2, 69], [20, 4, 81, 0, 0], [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88], [24, 5, 98, 1, 99],
    [28, 1, 107, 5, 108], [30, 5, 120, 1, 121], [28, 3, 113, 4, 114], [28, 3, 107, 5, 108],
    [28, 4, 116, 4, 117], [28, 2, 111, 7, 112], [30, 4, 121, 5, 122], [30, 6, 117, 4, 118],
    [26, 8, 106, 4, 107], [28, 10, 114, 2, 115]
  ];

  var ALIGN = [null, [],
    [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
    [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
    [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
    [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110], [6, 30, 58, 86, 114]
  ];

  function dataCodewords(v) {
    var r = RS[v];
    return r[1] * r[2] + r[3] * r[4];
  }

  /* --------------------------------------------------------------- GF(256) */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function generator(deg) {
    var g = [1];
    for (var i = 0; i < deg; i++) {
      var n = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        n[j] ^= g[j];
        n[j + 1] ^= gmul(g[j], EXP[i]);
      }
      g = n;
    }
    return g;
  }

  function ecc(data, n) {
    var g = generator(n);
    var rem = new Array(n).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift(); rem.push(0);
      for (var j = 0; j < n; j++) rem[j] ^= gmul(g[j + 1], factor);
    }
    return rem;
  }

  /* ---------------------------------------------------------------- encode */
  function utf8(str) {
    var out = [], s = encodeURIComponent(str);
    for (var i = 0; i < s.length; i++) {
      if (s[i] === '%') { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else out.push(s.charCodeAt(i));
    }
    return out;
  }

  function pickVersion(len) {
    for (var v = 1; v <= 26; v++) {
      var header = 4 + (v < 10 ? 8 : 16);
      if (dataCodewords(v) * 8 - header >= len * 8) return v;
    }
    throw new Error('too long for QR version 26 at level L');
  }

  function bitstream(bytes, v) {
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(0b0100, 4);                              /* byte mode */
    push(bytes.length, v < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var cap = dataCodewords(v) * 8;
    for (i = 0; i < 4 && bits.length < cap; i++) bits.push(0);   /* terminator */
    while (bits.length % 8) bits.push(0);
    var pads = [0xEC, 0x11], p = 0;
    var cw = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    while (cw.length < dataCodewords(v)) { cw.push(pads[p]); p ^= 1; }
    return cw;
  }

  function interleave(cw, v) {
    var r = RS[v], ecLen = r[0];
    var blocks = [], eccs = [], at = 0, i;
    for (i = 0; i < r[1]; i++) { blocks.push(cw.slice(at, at + r[2])); at += r[2]; }
    for (i = 0; i < r[3]; i++) { blocks.push(cw.slice(at, at + r[4])); at += r[4]; }
    for (i = 0; i < blocks.length; i++) eccs.push(ecc(blocks[i], ecLen));

    var out = [], max = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < max; i++) {
      for (var b = 0; b < blocks.length; b++) if (i < blocks[b].length) out.push(blocks[b][i]);
    }
    for (i = 0; i < ecLen; i++) {
      for (b = 0; b < eccs.length; b++) out.push(eccs[b][i]);
    }
    return out;
  }

  /* ----------------------------------------------------------- module grid */
  function newGrid(n) {
    var g = [];
    for (var i = 0; i < n; i++) g.push(new Int8Array(n).fill(-1));   /* -1 = free */
    return g;
  }

  function placeFinder(g, r, c) {
    for (var i = -1; i <= 7; i++) {
      for (var j = -1; j <= 7; j++) {
        var y = r + i, x = c + j;
        if (y < 0 || x < 0 || y >= g.length || x >= g.length) continue;
        var inner = (i >= 0 && i <= 6 && j >= 0 && j <= 6);
        var dark = inner && (i === 0 || i === 6 || j === 0 || j === 6 ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4));
        g[y][x] = dark ? 1 : 0;
      }
    }
  }

  function placeAlign(g, r, c) {
    for (var i = -2; i <= 2; i++) {
      for (var j = -2; j <= 2; j++) {
        var d = (Math.max(Math.abs(i), Math.abs(j)) !== 1) ? 1 : 0;
        g[r + i][c + j] = d;
      }
    }
  }

  var FORMAT_MASK = 0x5412;

  function formatBits(maskId) {
    /* level L = 01 */
    var data = (0b01 << 3) | maskId;
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
    return ((data << 10) | rem) ^ FORMAT_MASK;
  }

  function versionBits(v) {
    var rem = v << 12;
    for (var i = 17; i >= 12; i--) if (rem & (1 << i)) rem ^= 0x1F25 << (i - 12);
    return (v << 12) | rem;
  }

  function reserve(g, v) {
    var n = g.length, i;
    placeFinder(g, 0, 0); placeFinder(g, 0, n - 7); placeFinder(g, n - 7, 0);
    for (i = 8; i < n - 8; i++) {                       /* timing */
      g[6][i] = (i % 2 === 0) ? 1 : 0;
      g[i][6] = (i % 2 === 0) ? 1 : 0;
    }
    var a = ALIGN[v];
    for (i = 0; i < a.length; i++) {
      for (var j = 0; j < a.length; j++) {
        var r = a[i], c = a[j];
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
        placeAlign(g, r, c);
      }
    }
    g[n - 8][8] = 1;                                    /* dark module */
    /* format areas — filled after masking, reserved as 0 for now */
    for (i = 0; i <= 8; i++) {
      if (g[8][i] === -1) g[8][i] = 0;
      if (g[i][8] === -1) g[i][8] = 0;
    }
    for (i = 0; i < 8; i++) {
      if (g[8][n - 1 - i] === -1) g[8][n - 1 - i] = 0;
      if (g[n - 1 - i][8] === -1) g[n - 1 - i][8] = 0;
    }
    if (v >= 7) {
      for (i = 0; i < 18; i++) {
        var rr = Math.floor(i / 3), cc = i % 3;
        if (g[n - 11 + cc][rr] === -1) g[n - 11 + cc][rr] = 0;
        if (g[rr][n - 11 + cc] === -1) g[rr][n - 11 + cc] = 0;
      }
    }
  }

  function isFunction(g, free, r, c) { return !free[r][c]; }

  function placeData(g, free, cw) {
    var n = g.length, bit = 0, total = cw.length * 8;
    function nextBit() {
      if (bit >= total) return 0;
      var b = (cw[bit >> 3] >> (7 - (bit & 7))) & 1;
      bit++;
      return b;
    }
    var up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;                       /* skip the vertical timing column */
      for (var i = 0; i < n; i++) {
        var row = up ? n - 1 - i : i;
        for (var k = 0; k < 2; k++) {
          var c = col - k;
          if (free[row][c]) g[row][c] = nextBit();
        }
      }
      up = !up;
    }
  }

  function maskFn(id, r, c) {
    switch (id) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function penalty(g) {
    var n = g.length, p = 0, r, c, run, i;
    /* rule 1 — runs of five or more */
    for (r = 0; r < n; r++) {
      run = 1;
      for (c = 1; c < n; c++) {
        if (g[r][c] === g[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
        else run = 1;
      }
    }
    for (c = 0; c < n; c++) {
      run = 1;
      for (r = 1; r < n; r++) {
        if (g[r][c] === g[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
        else run = 1;
      }
    }
    /* rule 2 — 2x2 blocks */
    for (r = 0; r < n - 1; r++) {
      for (c = 0; c < n - 1; c++) {
        var v = g[r][c];
        if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) p += 3;
      }
    }
    /* rule 3 — finder-like patterns */
    var pat = [1, 0, 1, 1, 1, 0, 1];
    function look(get, len) {
      var hits = 0;
      for (var s = 0; s + 7 <= len; s++) {
        var ok = true;
        for (var k = 0; k < 7; k++) if (get(s + k) !== pat[k]) { ok = false; break; }
        if (!ok) continue;
        var before = true, after = true;
        for (k = 1; k <= 4; k++) { if (s - k < 0) continue; if (get(s - k) !== 0) before = false; }
        for (k = 0; k < 4; k++) { if (s + 7 + k >= len) continue; if (get(s + 7 + k) !== 0) after = false; }
        if (before || after) hits++;
      }
      return hits;
    }
    for (r = 0; r < n; r++) p += 40 * look(function (i2) { return g[r][i2]; }, n);
    for (c = 0; c < n; c++) p += 40 * look(function (i2) { return g[i2][c]; }, n);
    /* rule 4 — dark/light balance */
    var dark = 0;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (g[r][c]) dark++;
    var pct = dark * 100 / (n * n);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  function writeFormat(g, maskId, v) {
    var n = g.length, bits = formatBits(maskId), i;
    /* Copy 1, around the top-left finder. The low bits run DOWN column 8 and the
       high bits run LEFT along row 8 — the transpose of this is a very easy
       mistake to make and produces a symbol no scanner will read. Verified
       against CIQRCodeGenerator's own output. */
    for (i = 0; i <= 5; i++) g[i][8] = (bits >> i) & 1;
    g[7][8] = (bits >> 6) & 1;
    g[8][8] = (bits >> 7) & 1;
    g[8][7] = (bits >> 8) & 1;
    for (i = 9; i <= 14; i++) g[8][14 - i] = (bits >> i) & 1;
    /* Copy 2: bits 8–14 up the right of the bottom-left finder (7 modules, and
       it must not touch the dark module at (n-8, 8)), then bits 0–7 leftward
       along row 8 from the right edge (8 modules). */
    for (i = 8; i <= 14; i++) g[n - 1 - (14 - i)][8] = (bits >> i) & 1;
    for (i = 0; i <= 7; i++) g[8][n - 1 - i] = (bits >> i) & 1;
    if (v >= 7) {
      var vb = versionBits(v);
      for (i = 0; i < 18; i++) {
        var b = (vb >> i) & 1, rr = Math.floor(i / 3), cc = i % 3;
        g[n - 11 + cc][rr] = b;
        g[rr][n - 11 + cc] = b;
      }
    }
  }

  function encode(text) {
    var bytes = utf8(text);
    var v = pickVersion(bytes.length);
    var n = v * 4 + 17;
    var cw = interleave(bitstream(bytes, v), v);

    /* free[][] marks the data region: computed once from a grid with only
       function patterns placed. */
    var probe = newGrid(n);
    reserve(probe, v);
    var free = [];
    for (var r = 0; r < n; r++) {
      free.push(new Int8Array(n));
      for (var c = 0; c < n; c++) free[r][c] = probe[r][c] === -1 ? 1 : 0;
    }

    var best = null, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      var g = newGrid(n);
      reserve(g, v);
      placeData(g, free, cw);
      for (r = 0; r < n; r++) {
        for (c = 0; c < n; c++) if (free[r][c] && maskFn(m, r, c)) g[r][c] ^= 1;
      }
      writeFormat(g, m, v);
      var s = penalty(g);
      if (s < bestScore) { bestScore = s; best = g; }
    }
    return best;
  }

  /* ------------------------------------------------------------------ svg */
  function svg(text, px) {
    var g = encode(text), n = g.length, quiet = 4, size = n + quiet * 2;
    /* Size by module count, not a fixed pixel box. A long pre-filled message needs
       101 modules; at 190 px each module is ~1.7 px, which a phone camera cannot
       resolve — so the QR rendered, looked fine, and did not scan, and it failed
       precisely for the desktop visitor who had written the most. 3.5 px per module
       is the floor that scans. The dialog CSS lets it shrink to fit. */
    px = Math.max(px || 190, Math.round(size * 3.5));
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (g[r][c]) d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    var NS = 'http://www.w3.org/2000/svg';
    var el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    el.setAttribute('width', px || 190);
    el.setAttribute('height', px || 190);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'QR code that opens WhatsApp with your message already written');
    el.setAttribute('shape-rendering', 'crispEdges');
    var bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', size); bg.setAttribute('height', size); bg.setAttribute('fill', '#fff');
    el.appendChild(bg);
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d); path.setAttribute('fill', '#16211D');
    el.appendChild(path);
    return el;
  }

  window.BNQR = { svg: svg, encode: encode };
})();
