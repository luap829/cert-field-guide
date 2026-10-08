/* CERT Field Guide app. No network calls except same-origin data files; no analytics; no personal data. */
'use strict';
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {   // settings + tally counts only; never personal or patient data
    get(k, d) { try { const v = localStorage.getItem('certfg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('certfg.' + k, JSON.stringify(v)); } catch (e) { /* storage full/blocked */ } },
    del(k) { try { localStorage.removeItem('certfg.' + k); } catch (e) {} },
  };

  const S = { c: null, lp: null, topics: {}, sectionOf: {}, index: [], walkCache: {} };

  // ---------- Quick tools (from app-structure.md) ----------
  const TOOLS = [
    { id: 'safe', n: 1, title: 'Is it safe?', sub: 'Damage level: rescue or not', hot: true,
      main: ['safety.rescue-by-damage'], related: ['safety.damage-task-matrix', 'safety.sar-safety', 'safety.ppe'] },
    { id: 'sizeup', n: 2, title: '9-step size-up', sub: 'Step-through checklist',
      walk: ['organization.size-up'], main: ['organization.size-up'], related: ['organization.size-up-worksheet', 'organization.team-structure'] },
    { id: 'triage', n: 3, title: 'START triage', sub: '30-2-Can Do: Immediate / Delayed / Minor / Black', hot: true, after: 'tags',
      walk: ['triage.six-steps'], main: ['triage.start-flow', 'triage.categories'], related: ['triage.rpm', 'triage.airway', 'triage.bleeding', 'triage.shock', 'triage.scene'] },
    { id: 'bleeding', n: 4, title: 'Stop the bleeding', sub: 'Pressure, tourniquet, shock, warmth', hot: true,
      walk: ['lifesaving.direct-pressure', 'lifesaving.tourniquet', 'lifesaving.shock', 'lifesaving.body-temp'],
      main: ['lifesaving.direct-pressure', 'lifesaving.tourniquet', 'lifesaving.shock', 'lifesaving.body-temp'], related: ['lifesaving.bleeding-signs', 'firstaid.wounds'] },
    { id: 'airway', n: 5, title: 'Airway', sub: 'Conscious? Breathing?', hot: true,
      main: ['lifesaving.airway', 'lifesaving.recovery-position', 'lifesaving.jaw-thrust'], related: ['lifesaving.approach'] },
    { id: 'h2t', n: 6, title: 'Head-to-toe', sub: 'DCAP-BTLS + PMS (nothing saved)',
      walk: ['medops.head-to-toe'], main: ['medops.head-to-toe'], related: ['medops.spine'] },
    { id: 'fire', n: 7, title: 'Fire: go / no-go', sub: 'Decision, 5-second timer, P.A.S.S.', hot: true, timer: true,
      walk: ['fire.pass', 'fire.buddy-suppression'], main: ['fire.extinguisher-decision', 'fire.pass', 'fire.buddy-suppression'], related: ['fire.five-second', 'fire.fire-classes', 'fire.fire-rules'] },
    { id: 'utilities', n: 8, title: 'Gas & electric shutoff', sub: 'Outside vs inside meter',
      walk: ['utilities.gas', 'utilities.electric'], main: ['utilities.gas', 'utilities.electric'], related: ['utilities.co-gas-facts', 'utilities.water-shutoff-gap'] },
    { id: 'marking', n: 9, title: 'Search marking', sub: 'Build the X mark', builder: 'marking',
      main: ['sar.search-marking'], related: ['sar.interior-search', 'sar.voids'] },
    { id: 'crib', n: 10, title: 'Lift & crib', sub: 'Lift an inch, crib an inch',
      walk: ['sar.crib'], main: ['sar.crib'], related: ['sar.carries', 'sar.rescue-precautions'] },
    { id: 'tally', n: 11, title: 'Tally: tags & team report', sub: 'Counts only, for your TL', builder: 'tally',
      main: [], related: ['triage.categories', 'organization.team-report', 'organization.documentation'] },
  ];
  const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
  const SECTION_ICON = { safety: '\u26A0\uFE0F', organization: '\uD83E\uDDED', triage: '\uD83C\uDFF7\uFE0F', lifesaving: '\u2764\uFE0F', firstaid: '\uD83E\uDE79', medops: '\u2695\uFE0F',
    psych: '\uD83E\uDD1D', fire: '\uD83D\uDD25', utilities: '\uD83D\uDD27', hazmat: '\u2623\uFE0F', sar: '\uD83D\uDD26', terrorism: '\uD83D\uDEA8', prep: '\uD83C\uDF92' };
  const REVIEW_LBL = { conflict: 'Manual conflict: instructor review', gap: 'Source gap: instructor review', verify: 'Instructor review: verify', transcription: 'Instructor review: verify' };
  const PRI_LABEL = { critical: 'Critical', field: 'Field', reference: 'Reference', background: 'Background' };

  // ---------- helpers ----------
  // 'U-N' = FEMA 2019 manual page; 'T-N' = program triage unit page N
  function citeParts(c) {
    const f = (c || []).filter((x) => !/^T-\d+$/.test(x)), t = (c || []).filter((x) => /^T-\d+$/.test(x)).map((x) => x.slice(2));
    const out = [];
    if (f.length) out.push(f.join(', '));
    if (t.length) out.push('Triage unit p. ' + t.join(', '));
    return out;
  }
  const citeTxt = (c) => { const p = citeParts(c); if (!p.length) return ''; return (c.some((x) => !/^T-/.test(x)) ? 'Manual ' : '') + p.join('; '); };
  const citeSpan = (c) => (c && c.length ? ` <span class="cite">(${esc(citeParts(c).join('; '))})</span>` : '');
  const T = (id) => S.topics[id];
  const href = { topic: (id) => '#/t/' + id, section: (id) => '#/s/' + id, tool: (id) => '#/tool/' + id, walk: (k) => '#/walk/' + k + '/0' };
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function setHeader(title, back) {
    const tb = $('#topbar');
    $('#topTitle').textContent = title || '';
    tb.classList.toggle('sub', !!title);
    $('#backBtn').hidden = !back;
    $('#backBtn').dataset.to = back || '';
    document.title = title ? title + ' \u2013 CERT Field Guide' : 'CERT Field Guide';
  }
  function setTab(name) { $$('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name)); }

  // ---------- theme & size ----------
  const THEMES = ['auto', 'light', 'dark'];
  function applyTheme() {
    const t = store.get('theme', 'auto');
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.size = store.get('size', 'normal');
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#0d1b2e' : '#0b2545');
    $('#themeBtn').setAttribute('aria-label', 'Theme: ' + t + ' (tap to change)');
    $('#themeBtn').title = 'Theme: ' + t;
  }

  // ---------- content renderers ----------
  function warningsHTML(ws) {
    if (!ws || !ws.length) return '';
    const sorted = ws.slice().sort((a, b) => (a.level === 'danger' ? -1 : 0) - (b.level === 'danger' ? -1 : 0));
    return sorted.map((w) => `<div class="box ${w.level === 'danger' ? 'danger' : 'caution'}" role="note"><span class="lbl">${w.level === 'danger' ? '\u26D4 Danger' : '\u26A0 Caution'}</span>${esc(w.text)}${citeSpan(w.cite)}</div>`).join('');
  }
  function reviewHTML(t) {
    let h = '';
    (t.corrections || []).forEach((r) => { h += `<div class="box correction"><span class="lbl">\u2714 Corrected misprint</span>${esc(r.text)}${citeSpan(r.cite)} <a href="#/about">Details</a></div>`; });
    (t.review || []).forEach((r) => { h += `<div class="box review"><span class="lbl">\u2691 ${REVIEW_LBL[r.kind] || 'Instructor review: verify'}</span>${esc(r.text)}${citeSpan(r.cite)}</div>`; });
    return h;
  }
  function localHTML(t) {
    if (!t.localProtocol) return '';
    return `<div class="box local"><span class="lbl">\uD83D\uDCCD Follow local protocol</span>${esc(t.localProtocol)} <a href="#/local">Local Protocols</a></div>`;
  }
  function stepsHTML(steps) {
    return `<ol class="steps">${steps.map((s) => `<li>${esc(s.text)}${citeSpan(s.cite)}</li>`).join('')}</ol>`;
  }
  function itemsHTML(items) {
    return `<ul class="check">${items.map((s) => `<li><button type="button" class="ck" aria-pressed="false"><span class="box2" aria-hidden="true"></span><span class="txt">${esc(s.text)}${citeSpan(s.cite)}</span></button></li>`).join('')}</ul>`;
  }
  function tablesHTML(tables) {
    return (tables || []).map((tb) => {
      const head = `<h3>${esc(tb.title)}${citeSpan(tb.cite)}</h3>`;
      if (tb.columns.length <= 2) {
        return head + `<table class="kv"><thead><tr>${tb.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      }
      return head + tb.rows.map((r) => `<div class="tcard"><div class="th">${esc(r[0])}</div><dl>${r.slice(1).map((v, i) => `<dt>${esc(tb.columns[i + 1])}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`).join('');
    }).join('');
  }
  function notesHTML(notes) {
    if (!notes || !notes.length) return '';
    return `<div class="box info"><span class="lbl">Notes</span><ul class="plain">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
  }
  function priChip(p) { return `<span class="chip ${esc(p)}">${esc(PRI_LABEL[p] || p)}</span>`; }

  // full topic body (used by topic pages and tool pages)
  function topicBlock(id, opts) {
    opts = opts || {};
    const t = T(id); if (!t) return '';
    const wrap = document.createElement('section');
    wrap.className = 'topic';
    const flags = (t.review && t.review.length) ? '<span class="chip review">Review</span>' : '';
    let h = '';
    if (opts.heading !== false) h += `<h2>${esc(t.title)}</h2>`;
    h += `<div class="metarow">${priChip(t.fieldPriority)}${flags}<span class="cite">${esc(citeTxt(t.cite))}</span></div>`;
    if (t.summary) h += `<p class="summary">${esc(t.summary)}</p>`;
    h += warningsHTML(t.warnings);
    h += reviewHTML(t);
    h += localHTML(t);
    h += '<div class="dmount"></div>';
    if (t.steps && t.steps.length) {
      h += `<div class="btnrow"><a class="btn primary big" href="${href.walk(id)}">\u25B6 Step-by-step (${t.steps.length} steps)</a></div>`;
      h += stepsHTML(t.steps);
    }
    if (t.items && t.items.length) h += (t.steps && t.steps.length ? '<h3>Also check</h3>' : '') + itemsHTML(t.items);
    h += tablesHTML(t.tables);
    h += notesHTML(t.notes);
    if (opts.link) h += `<p><a href="${href.topic(id)}">Open this topic on its own page</a></p>`;
    wrap.innerHTML = h;
    if (t.decision) mountDecision($('.dmount', wrap), t.decision, opts);
    return wrap;
  }

  // checklist toggles (ephemeral, in-memory only)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button.ck');
    if (!b) return;
    const li = b.parentElement; li.classList.toggle('done');
    b.setAttribute('aria-pressed', li.classList.contains('done') ? 'true' : 'false');
  });

  // ---------- decision widgets ----------
  function verdictClass(text) {
    const u = text.trim().toUpperCase();
    if (u.startsWith('NO') || u.startsWith('LEAVE')) return 'stop';
    if (u.startsWith('YES')) return 'go';
    return 'neutral';
  }
  const CAT = { immediate: ['IMMEDIATE', '\u201CI\u201D', 'RED'], delayed: ['DELAYED', '\u201CD\u201D', 'YELLOW'], minor: ['MINOR', '\u201CM\u201D', 'GREEN'], black: ['BLACK', 'Black', 'BLACK'] };
  function verdictHTML(a) {
    if (a.category && CAT[a.category]) {
      const [name, mark, color] = CAT[a.category];
      const meta = a.category === 'black' ? 'Status: Black' : `Tag ${esc(mark)} \u00B7 ${color}`;
      return `<div class="verdict tag tag-${a.category}" role="status" data-category="${a.category}"><span class="vh">${name}</span><span class="tagmeta">${meta}</span><p>${esc(a.text)}${citeSpan(a.cite)}</p>` +
        `<button type="button" class="btn big counttag" data-cat="${a.category}">+1 ${name} to tag tally</button>${a.category === 'immediate' ? `<a class="btn big" href="${href.topic('triage.shock')}">Treat for shock: steps</a>` : ''}</div>`;
    }
    const k = verdictClass(a.text);
    const head = k === 'stop' ? '\u26D4 STOP' : k === 'go' ? '\u2714 GO' : '\u27A1 DO THIS';
    return `<div class="verdict ${k}" role="status"><span class="vh">${head}</span>${esc(a.text)}${citeSpan(a.cite)}</div>`;
  }
  function mountDecision(el, d, opts) {
    if (d.options) mountTree(el, d); else if (d.sequence) mountSequence(el, d, opts);
  }
  function mountTree(el, root) {
    const path = [];
    function render() {
      let h = '<div class="decision">';
      let node = root, depth = 0;
      while (node) {
        const chosen = path[depth];
        h += `<p class="q">${esc(node.question)}${node.cite && chosen == null ? citeSpan(node.cite) : ''}</p>`;
        if (node.detail && chosen == null) h += `<ul class="qdetail">${node.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`;
        node.options.forEach((o, i) => {
          if (chosen != null && chosen !== i) return;
          const lvl = 'lvl-' + o.label.toLowerCase().replace(/[^a-z]/g, '');
          const ind = o.indicators && chosen == null ? `<ul>${o.indicators.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '';
          h += `<button type="button" class="opt ${lvl}${chosen === i ? ' sel' : ''}" data-depth="${depth}" data-i="${i}"><span class="ol">${esc(o.label)}${chosen === i ? ' \u2714' : ''}</span>${ind}</button>`;
        });
        if (chosen == null) break;
        const o = node.options[chosen];
        if (o.action) { h += verdictHTML(o.action); node = null; }
        else { node = o.next; depth++; }
      }
      if (path.length) h += `<div class="btnrow"><button type="button" class="btn reset">\u21BA ${node ? 'Start over' : 'Next survivor / start over'}</button></div>`;
      h += '</div>';
      el.innerHTML = h;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('reset')) { path.length = 0; render(); return; }
      if (b.classList.contains('counttag')) {
        const t = store.get('tags', {}); t[b.dataset.cat] = (t[b.dataset.cat] || 0) + 1; store.set('tags', t); store.set('tagsUpdated', new Date().toISOString());
        b.disabled = true; b.textContent = 'Counted \u2714 (total ' + t[b.dataset.cat] + ')';
        document.dispatchEvent(new CustomEvent('tags-changed'));
        return;
      }
      if (b.classList.contains('opt')) {
        const depth = +b.dataset.depth, i = +b.dataset.i;
        if (path[depth] === i) path.length = depth; else { path.length = depth; path[depth] = i; }
        render();
        const v = $('.verdict', el); if (v) v.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
    render();
  }
  function mountSequence(el, d, opts) {
    let idx = 0, result = null;
    function render() {
      let h = '<div class="decision">';
      h += `<p class="seqprog">Question ${Math.min(idx + 1, d.sequence.length)} of ${d.sequence.length}. Any NO means leave.</p>`;
      d.sequence.forEach((q, i) => { if (i < idx) h += `<p>\u2714 ${esc(q.text)}</p>`; });
      if (result === 'no') h += verdictHTML(d.onNo);
      else if (result === 'yes') h += verdictHTML(d.onAllYes);
      else {
        const q = d.sequence[idx];
        h += `<p class="q">${esc(q.text)}${citeSpan(q.cite)}</p>`;
        if (/5 seconds/i.test(q.text)) h += '<div class="tmount"></div>';
        h += '<div class="yn"><button type="button" class="btn yes" data-a="y">YES</button><button type="button" class="btn no" data-a="n">NO</button></div>';
      }
      if (idx > 0 || result) h += '<div class="btnrow"><button type="button" class="btn reset">\u21BA Start over</button></div>';
      h += '</div>';
      el.innerHTML = h;
      const tm = $('.tmount', el); if (tm) mountTimer(tm);
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.closest('.timer')) return;
      if (b.classList.contains('reset')) { idx = 0; result = null; render(); return; }
      if (b.dataset.a === 'n') result = 'no';
      else if (b.dataset.a === 'y') { idx++; if (idx >= d.sequence.length) { result = 'yes'; idx = d.sequence.length; } }
      render();
    });
    render();
  }
  function mountTimer(el) {
    let timer = null;
    el.innerHTML = '<div class="timer"><div class="count" aria-live="assertive">5</div><p class="tmsg muted">5-second rule: if it is not out in 5 seconds, it is too big. Leave.</p><button type="button" class="btn primary big tstart">Start 5-second count</button></div>';
    const box = $('.timer', el), cnt = $('.count', el), msg = $('.tmsg', el), btn = $('.tstart', el);
    btn.addEventListener('click', () => {
      clearInterval(timer); let n = 5; cnt.textContent = n; box.classList.remove('done'); btn.textContent = 'Restart';
      msg.textContent = 'Counting\u2026';
      timer = setInterval(() => {
        n--; cnt.textContent = n;
        if (n <= 0) { clearInterval(timer); box.classList.add('done'); msg.textContent = 'Not out? LEAVE NOW. Shut doors behind you. (6-1, 6-9)'; if (navigator.vibrate) navigator.vibrate([300, 100, 300]); }
      }, 1000);
    });
    window.addEventListener('hashchange', () => clearInterval(timer), { once: true });
  }

  // ---------- views ----------
  function vHome(v) {
    setHeader('', null); setTab('home');
    const c = S.c;
    let h = '';
    if (!c.app.reviewed) h += `<a class="notice draft compact" href="#/about"><strong>DRAFT: not for field use yet.</strong> Pending CERT instructor review. Not a FEMA product. \u203A</a>`;
    if (!isStandalone() && !store.get('installHintDismissed', false)) {
      h += `<div class="notice install compact"><a href="#/install" class="grow"><strong>Use it offline:</strong> ${isIOS() ? 'Safari <span class="kbd">Share \u2191</span> \u2192 <span class="kbd">Add to Home Screen</span>' : 'browser menu \u2192 Install app'} \u203A</a><button type="button" class="iconbtn x" id="hideInstall" aria-label="Hide install tip">\u2715</button></div>`;
    }
    h += `<a class="stopbar" href="${href.tool('safe')}"><span class="big" aria-hidden="true">\u270B</span><span>STOP: Is it safe?<small>Rescuer safety first. Check the damage level before you go in.</small></span></a>`;
    h += '<h2>Quick tools</h2><div class="grid">' + TOOLS.map((t) => `<a class="tile${t.hot ? ' hot' : ''}" href="${href.tool(t.id)}"><span class="num">${t.n}</span><span class="tt">${esc(t.title)}</span><span class="ts">${esc(t.sub)}</span></a>`).join('') + '</div>';
    h += '<h2>Sections</h2><ul class="list sections">' + c.sections.map((s) => `<li><a class="listlink" href="${href.section(s.id)}"><span aria-hidden="true">${SECTION_ICON[s.id] || '\u2022'}</span><span class="grow">${esc(s.title)}<span class="sub">${s.topics.length} topics \u00B7 Units ${esc(s.units.join(', '))}</span></span></a></li>`).join('') + '</ul>';
    h += `<div class="footlinks"><a class="btn" href="#/local">\uD83D\uDCCD Local protocols</a><a class="btn" href="#/search">Search</a><a class="btn" href="#/about">About &amp; sources</a><a class="btn" href="#/install">Add to Home Screen</a></div>`;
    h += `<p class="small muted">Condensed from the FEMA CERT Basic Training Participant Manual (2019). Not a FEMA product; not endorsed by FEMA. Page numbers like (3-4) mean Unit 3, page 4.</p>`;
    v.innerHTML = h;
    const hb = $('#hideInstall'); if (hb) hb.addEventListener('click', () => { store.set('installHintDismissed', true); route(); });
  }

  function vSection(v, id) {
    const s = S.c.sections.find((x) => x.id === id);
    if (!s) return vNotFound(v);
    setHeader(s.title, '#/'); setTab('home');
    const med = S.c.app.medicalSections.includes(s.id) && !S.c.app.reviewed;
    let h = `<p class="summary">${esc(s.summary)}</p>`;
    if (med) h += `<div class="box review"><span class="lbl">\u2691 Pending instructor review</span>${esc(S.c.app.reviewNote)}</div>`;
    h += '<ul class="list">' + s.topics.map((t) => `<li><a class="listlink" href="${href.topic(s.id + '.' + t.id)}"><span class="grow">${esc(t.title)}<span class="sub">${esc(PRI_LABEL[t.fieldPriority])} \u00B7 ${esc(t.type)}${t.review ? ' \u00B7 \u2691 review' : ''}${t.localProtocol ? ' \u00B7 \uD83D\uDCCD local' : ''}</span></span></a></li>`).join('') + '</ul>';
    v.innerHTML = h;
  }

  function vTopic(v, id) {
    const t = T(id); if (!t) return vNotFound(v);
    const sid = S.sectionOf[id];
    setHeader(t.title, href.section(sid)); setTab('home');
    v.innerHTML = '';
    if (S.c.app.medicalSections.includes(sid) && !S.c.app.reviewed) {
      const n = document.createElement('div'); n.className = 'box review';
      n.innerHTML = `<span class="lbl">\u2691 Pending instructor review</span>Medical content has not yet been reviewed by a CERT instructor.`;
      v.appendChild(n);
    }
    v.appendChild(topicBlock(id, { heading: false }));
    const sec = S.c.sections.find((x) => x.id === sid);
    const p = document.createElement('p');
    p.innerHTML = `<a class="btn" href="${href.section(sid)}">\u2190 All ${esc(sec.title)} topics</a>`;
    v.appendChild(p);
  }

  function vTool(v, id) {
    const tool = TOOL[id]; if (!tool) return vNotFound(v);
    setHeader(tool.title, '#/'); setTab(id === 'tally' ? 'tally' : 'home');
    v.innerHTML = '';
    const top = document.createElement('div');
    let h = '';
    if (tool.walk) {
      const n = flatten(tool.walk).length;
      h += `<div class="btnrow"><a class="btn primary big" href="${href.walk(tool.id)}">\u25B6 Step-by-step (${n} cards)</a></div>`;
    }
    const med = !S.c.app.reviewed && tool.main.some((tid) => S.c.app.medicalSections.includes(S.sectionOf[tid]));
    if (med) h = `<div class="box review"><span class="lbl">\u2691 Pending instructor review</span>Medical content has not yet been reviewed by a CERT instructor.</div>` + h;
    top.innerHTML = h; v.appendChild(top);
    if (tool.builder === 'tally') { mountTagTally(v); mountTally(v); }
    if (tool.builder === 'marking') mountMarking(v);
    tool.main.forEach((tid) => v.appendChild(topicBlock(tid, { link: true })));
    if (tool.after === 'tags') mountTagTally(v);
    if (tool.related && tool.related.length) {
      const r = document.createElement('div');
      r.innerHTML = '<h2>Related</h2><ul class="list">' + tool.related.map((tid) => T(tid) ? `<li><a class="listlink" href="${href.topic(tid)}"><span class="grow">${esc(T(tid).title)}<span class="sub">${esc(citeTxt(T(tid).cite))}</span></span></a></li>` : '').join('') + '</ul>';
      v.appendChild(r);
    }
  }

  // ---------- step-by-step walkthrough ----------
  function flatten(ids) {
    const out = [];
    ids.forEach((id) => {
      const t = T(id); if (!t) return;
      const warn = t.warnings || [];
      if (t.steps && t.steps.length) t.steps.forEach((s, i) => out.push({ topic: id, title: t.title, kind: `Step ${i + 1} of ${t.steps.length}`, text: s.text, cite: s.cite, warn, first: i === 0, review: t.review }));
      else if (t.items) t.items.forEach((s, i) => out.push({ topic: id, title: t.title, kind: `Check ${i + 1} of ${t.items.length}`, text: s.text, cite: s.cite, warn, first: i === 0, review: t.review }));
    });
    return out;
  }
  function vWalk(v, key, i) {
    const tool = TOOL[key];
    const ids = tool ? tool.walk : (T(key) ? [key] : null);
    if (!ids) return vNotFound(v);
    const cards = flatten(ids);
    i = Math.max(0, Math.min(cards.length - 1, i | 0));
    const c = cards[i];
    const back = tool ? href.tool(key) : href.topic(key);
    setHeader(tool ? tool.title : T(key).title, back); setTab('');
    document.body.classList.add('walking');
    const pct = Math.round(((i + 1) / cards.length) * 100);
    let h = `<div class="walk"><div class="wtop"><span class="prog">${i + 1} / ${cards.length}</span><a class="btn" href="${back}">Exit</a></div><div class="bar"><i class="w${pct}"></i></div>`;
    if (ids.length > 1) h += `<div class="wtopic">${esc(c.title)}</div>`;
    h += `<div class="wkind">${esc(c.kind)}</div><p class="wtext">${esc(c.text)}</p><p class="cite">${esc(citeTxt(c.cite))}</p>`;
    if (c.first && c.review && c.review.length) h += c.review.map((r) => `<div class="box review"><span class="lbl">\u2691 Instructor review</span>${esc(r.text)}</div>`).join('');
    if (c.warn.length) h += `<details class="pinned"${c.first ? ' open' : ''}><summary>\u26D4 ${c.warn.length} warning${c.warn.length > 1 ? 's' : ''} for ${esc(c.title)}</summary>${warningsHTML(c.warn)}</details>`;
    h += '</div>';
    const last = i === cards.length - 1;
    h += `<nav class="walknav"><a class="btn" href="#/walk/${key}/${Math.max(0, i - 1)}"${i === 0 ? ' aria-disabled="true"' : ''}>\u2190 Back</a>${last ? `<a class="btn primary" href="${back}">\u2714 Done</a>` : `<a class="btn primary" href="#/walk/${key}/${i + 1}" id="nextBtn">Next \u2192</a>`}</nav>`;
    v.innerHTML = h;
    const bar = $('.bar > i', v); bar.style.width = pct + '%';   // CSSOM is allowed under CSP
    // swipe
    let x0 = null, y0 = null;
    v.ontouchstart = (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
    v.ontouchend = (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && !last) location.replace(`#/walk/${key}/${i + 1}`);
        else if (dx > 0 && i > 0) location.replace(`#/walk/${key}/${i - 1}`);
      }
    };
  }
  document.addEventListener('keydown', (e) => {
    const m = location.hash.match(/^#\/walk\/([^/]+)\/(\d+)/);
    if (!m) return;
    if (e.key === 'ArrowRight') { const n = $('#nextBtn'); if (n) location.replace(n.getAttribute('href')); }
    if (e.key === 'ArrowLeft' && +m[2] > 0) location.replace(`#/walk/${m[1]}/${+m[2] - 1}`);
  });

  // ---------- team report tally (counts only, localStorage) ----------
  function tallyGroups() {
    const t = T('organization.team-report');
    return t.tables[0].rows.map((r) => ({ cat: r[0], fields: r[1].split(',').map((x) => x.trim()) }));
  }
  function mountTally(v) {
    const el = document.createElement('div');
    v.appendChild(el);
    const groups = tallyGroups();
    function counts() { return store.get('tally', {}); }
    function readout() {
      const c = counts();
      return groups.map((g) => {
        const parts = g.fields.map((f) => [f, c[g.cat + '|' + f] || 0]).filter((p) => p[1] > 0).map((p) => `${p[0]} ${p[1]}`);
        return `${g.cat}: ${parts.length ? parts.join(', ') : 'none'}`;
      }).join('\n');
    }
    function render() {
      const c = counts();
      let h = `<div class="box info"><span class="lbl">Counts only</span>Based on the "Report from Response Team" block of the Briefing Assignment Form (2-17). No names, conditions, or locations. Counts stay on this device until you reset them.</div>`;
      h += groups.map((g) => `<div class="tgroup"><h3>${esc(g.cat)}</h3>${g.fields.map((f) => {
        const k = g.cat + '|' + f;
        return `<div class="trow"><span class="tl">${esc(f)}</span><button type="button" class="minus" data-k="${esc(k)}" aria-label="${esc(g.cat + ' ' + f)} minus one">\u2212</button><span class="tv" aria-live="polite">${c[k] || 0}</span><button type="button" class="plus" data-k="${esc(k)}" aria-label="${esc(g.cat + ' ' + f)} plus one">+</button></div>`;
      }).join('')}</div>`).join('');
      h += `<h3>Read-out for your team leader</h3><pre class="readout">${esc(readout())}</pre>`;
      h += '<div class="btnrow"><button type="button" class="btn" id="tCopy">Copy read-out</button><button type="button" class="btn warn" id="tReset">Reset all counts</button></div>';
      h += '<p class="small muted">Write the official numbers on the paper form. This counter is only a memory aid.</p>';
      el.innerHTML = h;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const c = counts();
      if (b.dataset.k) {
        const k = b.dataset.k; c[k] = Math.max(0, (c[k] || 0) + (b.classList.contains('plus') ? 1 : -1));
        store.set('tally', c); render();
        const nb = el.querySelector(`button.${b.classList.contains('plus') ? 'plus' : 'minus'}[data-k="${CSS.escape(k)}"]`); if (nb) nb.focus();
      } else if (b.id === 'tReset') {
        if (confirm('Reset all team report counts to zero?')) { store.del('tally'); render(); }
      } else if (b.id === 'tCopy') {
        const txt = readout();
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { b.textContent = 'Copied \u2714'; }, () => { b.textContent = 'Copy failed'; });
      }
    });
    render();
  }

  // ---------- triage tag tally (counts only; categories from the triage unit, T-16 / T-20) ----------
  function mountTagTally(v) {
    const el = document.createElement('div');
    el.className = 'tagtally';
    v.appendChild(el);
    const cats = ['immediate', 'delayed', 'minor', 'black'];
    const readout = () => {
      const t = store.get('tags', {}), up = store.get('tagsUpdated', null);
      const total = cats.reduce((n, k) => n + (t[k] || 0), 0);
      const when = up ? new Date(up).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '\u2013';
      return `Triage tags, status as of ${when}\n` + cats.map((k) => (k === 'black' ? 'Black' : `${CAT[k][0][0] + CAT[k][0].slice(1).toLowerCase()} (${CAT[k][1].replace(/[\u201C\u201D]/g, '"')}, ${CAT[k][2].toLowerCase()})`) + `: ${t[k] || 0}`).join('\n') + `\nTotal: ${total}`;
    };
    function render() {
      const t = store.get('tags', {});
      let h = `<h2>Triage tag tally</h2><div class="box info"><span class="lbl">Counts only</span>A quick count of casualties by category (T-19, T-20). No names, conditions, or locations. Counts stay on this device until you reset them.</div>`;
      h += '<div class="tgroup">' + cats.map((k) => `<div class="trow tagrow tag-${k}"><span class="tl"><span class="tagdot tag-${k}" aria-hidden="true"></span>${CAT[k][0]}${k === 'black' ? '' : ` <small>${esc(CAT[k][1])}</small>`}</span><button type="button" class="minus" data-tag="${k}" aria-label="${CAT[k][0]} minus one">\u2212</button><span class="tv" aria-live="polite" data-tv="${k}">${t[k] || 0}</span><button type="button" class="plus" data-tag="${k}" aria-label="${CAT[k][0]} plus one">+</button></div>`).join('') + '</div>';
      h += `<pre class="readout tagreadout">${esc(readout())}</pre><div class="btnrow"><button type="button" class="btn" id="tagCopy">Copy tag read-out</button><button type="button" class="btn warn" id="tagReset">Reset tag counts</button></div>`;
      h += '<p class="small muted">Record official numbers on your program\u2019s documentation form. Never abbreviate Black to \u201CD\u201D (T-16). Illinois rule: use only \u201CBlack\u201D for this category. <a href="#/about">Why</a></p>';
      el.innerHTML = h;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tag) {
        const t = store.get('tags', {}), k = b.dataset.tag;
        t[k] = Math.max(0, (t[k] || 0) + (b.classList.contains('plus') ? 1 : -1));
        store.set('tags', t); store.set('tagsUpdated', new Date().toISOString()); render();
        const nb = el.querySelector(`button.${b.classList.contains('plus') ? 'plus' : 'minus'}[data-tag="${k}"]`); if (nb) nb.focus();
      } else if (b.id === 'tagReset') {
        if (confirm('Reset all triage tag counts to zero?')) { store.del('tags'); store.del('tagsUpdated'); render(); }
      } else if (b.id === 'tagCopy' && navigator.clipboard) {
        navigator.clipboard.writeText(readout()).then(() => { b.textContent = 'Copied \u2714'; }, () => { b.textContent = 'Copy failed'; });
      }
    });
    const onChange = () => { if (el.isConnected) render(); else document.removeEventListener('tags-changed', onChange); };
    document.addEventListener('tags-changed', onChange);
    render();
  }

  // ---------- search marking builder (in memory only) ----------
  function mountMarking(v) {
    const el = document.createElement('div');
    v.appendChild(el);
    const st = { mode: 'entry', id: '', tin: '', tout: '', right: '', live: '', dcount: '', taken: '' };
    const wrapT = (s, n) => {   // word-aware wrap, max 3 lines
      const out = []; let line = '';
      String(s || '').split(/\s+/).filter(Boolean).forEach((w) => {
        while (w.length > n) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
        if (!line) line = w; else if ((line + ' ' + w).length <= n) line += ' ' + w; else { out.push(line); line = w; }
      });
      if (line) out.push(line);
      return out.slice(0, 3);
    };
    function svg() {
      const tx = (x, y, lines, anchor) => lines.map((l, i) => `<text x="${x}" y="${y + i * 22}" text-anchor="${anchor || 'middle'}" font-size="19" font-weight="700" fill="#111" font-family="-apple-system, Helvetica, Arial, sans-serif">${esc(l)}</text>`).join('');
      let s = '<svg viewBox="0 0 400 400" role="img" aria-label="Search marking preview">';
      s += '<line x1="40" y1="360" x2="360" y2="40" stroke="#d1001c" stroke-width="12" stroke-linecap="round"/>';
      if (st.mode === 'exit') s += '<line x1="40" y1="40" x2="360" y2="360" stroke="#d1001c" stroke-width="12" stroke-linecap="round"/>';
      s += tx(95, 195, wrapT(st.id || 'ID', 8));
      const top = [st.tin ? 'IN ' + st.tin : 'date/time in'];
      if (st.mode === 'exit') top.push(st.tout ? 'OUT ' + st.tout : 'time out');
      s += tx(200, 60, top.flatMap((t) => wrapT(t, 16)));
      if (st.mode === 'exit') {
        s += tx(305, 185, wrapT(st.right || 'areas / hazards', 9));
        const b = [];
        if (st.live !== '' || st.dcount !== '') b.push(`${st.live || 0}-L  ${st.dcount || 0}-D`); else b.push('L / D');
        if (st.taken) b.push(...wrapT('to ' + st.taken, 16));
        s += tx(200, 300, b);
      }
      return s + '</svg>';
    }
    function render() {
      const f = (k, label, ph, type) => `<div class="field"><label for="m_${k}">${label}</label><input id="m_${k}" data-k="${k}" ${type === 'num' ? 'inputmode="numeric" pattern="[0-9]*"' : ''} autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${esc(ph)}" value="${esc(st[k])}"></div>`;
      let h = `<div class="box info"><span class="lbl">Not saved</span>This builder shows what to write. Nothing you type is stored. Mark next to the door, not on it or where it swings (7-15).</div>`;
      h += `<div class="seg" role="group" aria-label="Entry or exit"><button type="button" data-mode="entry" class="${st.mode === 'entry' ? 'on' : ''}">Entering (/)</button><button type="button" data-mode="exit" class="${st.mode === 'exit' ? 'on' : ''}">Exiting (X)</button></div>`;
      h += `<div class="marking"><div class="svgwrap">${svg()}</div><div class="fields">`;
      h += f('id', 'Left (9 o\u2019clock): agency / group ID', 'e.g. CERT 3');
      h += `<div class="two">${f('tin', 'Top: date & time IN', 'MM/DD HH:MM')}${st.mode === 'exit' ? f('tout', 'Top: time OUT', 'HH:MM') : '<div></div>'}</div>`;
      h += '<div class="btnrow"><button type="button" class="btn" id="mNow">Fill \u201Cnow\u201D</button></div>';
      if (st.mode === 'exit') {
        h += f('right', 'Right: areas searched, hazards', 'e.g. 1st fl, gas');
        h += `<div class="two">${f('live', 'Bottom: L (living)', '0', 'num')}${f('dcount', 'Bottom: D count (see Local Protocols)', '0', 'num')}</div>`;
        h += f('taken', 'Bottom: where survivors were taken', 'e.g. treatment area');
      }
      h += '</div></div>';
      el.innerHTML = h;
    }
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      let val = e.target.value.slice(0, 40);
      if (k === 'live' || k === 'dcount') val = val.replace(/\D/g, '').slice(0, 3);
      st[k] = val; $('.svgwrap', el).innerHTML = svg();
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { st.mode = b.dataset.mode; render(); }
      if (b.id === 'mNow') {
        const d = new Date(), p = (n) => String(n).padStart(2, '0');
        const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
        if (st.mode === 'entry' || !st.tin) st.tin = `${p(d.getMonth() + 1)}/${p(d.getDate())} ${hm}`; else st.tout = hm;
        render();
      }
    });
    render();
  }

  // ---------- offline search ----------
  const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9%\u00b0.]+/g, ' ');
  function collectText(o, out) {
    if (o == null) return out;
    if (typeof o === 'string') { out.push(o); return out; }
    if (Array.isArray(o)) { o.forEach((x) => collectText(x, out)); return out; }
    if (typeof o === 'object') Object.keys(o).forEach((k) => { if (k !== 'cite' && k !== 'id' && k !== 'type' && k !== 'fieldPriority' && k !== 'level' && k !== 'kind') collectText(o[k], out); });
    return out;
  }
  function buildIndex() {
    S.index = [];
    S.c.sections.forEach((s) => s.topics.forEach((t) => {
      const id = s.id + '.' + t.id;
      const body = collectText(t, []).join(' \u00B7 ');
      S.index.push({ href: href.topic(id), title: t.title, where: s.title, body, nt: norm(t.title), nb: norm(body + ' ' + s.title) });
    }));
    TOOLS.forEach((t) => S.index.push({ href: href.tool(t.id), title: 'Quick tool: ' + t.title, where: 'Quick tools', body: t.sub, nt: norm(t.title), nb: norm(t.sub) }));
    S.lp.items.forEach((it) => S.index.push({ href: '#/local', title: 'Local protocol: ' + it.title, where: 'Local Protocols', body: it.why, nt: norm(it.title), nb: norm(it.why + ' local protocol milton township') }));
    S.index.push({ href: '#/about', title: 'About & sources', where: 'About', body: 'FEMA credit, corrections, review flags, privacy', nt: 'about sources', nb: norm('fema credit copyright corrections review privacy version offline') });
    S.index.push({ href: '#/install', title: 'Add to Home Screen', where: 'Help', body: 'Install on iPhone, iPad, Android for offline use', nt: 'add to home screen install', nb: 'install iphone ipad android offline home screen' });
  }
  function search(q) {
    const terms = norm(q).split(' ').filter((x) => x.length > 1 || /\d/.test(x));
    if (!terms.length) return [];
    const res = [];
    S.index.forEach((e) => {
      let score = 0;
      for (const w of terms) {
        const inT = e.nt.includes(w), inB = e.nb.includes(w);
        if (!inT && !inB) return;
        score += (inT ? 10 : 0) + (inB ? 2 : 0) + (new RegExp('(^| )' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(e.nt) ? 5 : 0);
      }
      res.push({ e, score });
    });
    return res.sort((a, b) => b.score - a.score).slice(0, 40).map((r) => r.e);
  }
  function highlight(text, q) {
    const terms = norm(q).split(' ').filter((x) => x.length > 1).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    let s = esc(text);
    if (terms.length) s = s.replace(new RegExp('(' + terms.join('|') + ')', 'gi'), '<mark>$1</mark>');
    return s;
  }
  function snippet(body, q) {
    const terms = norm(q).split(' ').filter((x) => x.length > 1);
    const low = body.toLowerCase();
    let pos = -1;
    for (const w of terms) { pos = low.indexOf(w); if (pos >= 0) break; }
    const start = Math.max(0, pos - 50);
    return (start > 0 ? '\u2026' : '') + body.slice(start, start + 150) + (body.length > start + 150 ? '\u2026' : '');
  }
  function vSearch(v, q) {
    setHeader('Search', '#/'); setTab('search');
    v.innerHTML = `<div class="searchbox"><label class="small muted" for="q">Search all topics (works offline)</label><input id="q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="e.g. tourniquet, gas, shock" value="${esc(q || '')}"></div><div id="results"></div>`;
    const inp = $('#q', v), out = $('#results', v);
    function run() {
      const qq = inp.value.trim();
      history.replaceState(null, '', '#/search' + (qq ? '/' + encodeURIComponent(qq) : ''));
      if (!qq) { out.innerHTML = '<p class="muted">Try: bleeding, airway, P.A.S.S., gas, crib, decon, shelter in place, hypothermia.</p>'; return; }
      const r = search(qq);
      out.innerHTML = r.length ? `<p class="small muted">${r.length} result${r.length > 1 ? 's' : ''}</p><ul class="list res">` + r.map((e) => `<li><a class="listlink" href="${e.href}"><span class="grow">${highlight(e.title, qq)}<span class="sub">${esc(e.where)}</span><span class="snip">${highlight(snippet(e.body, qq), qq)}</span></span></a></li>`).join('') + '</ul>' : '<p>No matches. Try a shorter word.</p>';
    }
    inp.addEventListener('input', run);
    run();
    if (!q) setTimeout(() => inp.focus(), 50);
  }

  // ---------- local protocols ----------
  function vLocal(v) {
    setHeader('Local Protocols', '#/'); setTab('local');
    const lp = S.lp;
    let h = `<div class="notice draft"><strong>${esc(lp.status)}</strong></div>`;
    h += '<p>The FEMA manual leaves these items to your sponsoring agency. Until the Milton Township CERT program fills them in, follow your team leader and your training.</p>';
    h += lp.items.map((it) => {
      const linked = it.topic && T(it.topic) ? ` <a href="${href.topic(it.topic)}">Related topic</a>` : '';
      const body = it.placeholder || !it.value
        ? `<div class="box local"><span class="lbl">Placeholder: Milton Township CERT program to fill in</span><span class="muted">Not yet provided.</span></div>`
        : `<div class="box ok">${esc(it.value)}</div>`;
      return `<section><h3>${esc(it.title)}</h3><p class="small">${esc(it.why)}${citeSpan(it.cite)}${linked}</p>${body}</section>`;
    }).join('');
    h += `<p class="small muted">For maintainers: ${esc(lp.howToEdit)}</p>`;
    v.innerHTML = h;
  }

  // ---------- about & sources ----------
  async function offlineStatus() {
    try {
      if (!('serviceWorker' in navigator) || !('caches' in window)) return [false, 'This browser does not support offline mode.'];
      const keys = (await caches.keys()).filter((k) => k.startsWith('cert-fg-'));
      if (!keys.length) return [false, 'Not cached yet. Keep the app open for a moment while online.'];
      const n = (await (await caches.open(keys[keys.length - 1])).keys()).length;
      return [!!navigator.serviceWorker.controller || n > 0, `Saved for offline use (${n} files, version ${keys[keys.length - 1].replace('cert-fg-', '')}).`];
    } catch (e) { return [false, 'Could not check offline status.']; }
  }
  function vAbout(v) {
    setHeader('About & Sources', '#/'); setTab('about');
    const c = S.c, src = c.source;
    let h = '';
    h += `<div class="notice draft"><strong>${c.app.reviewed ? 'Reviewed.' : 'DRAFT: not for field use yet.'}</strong> ${esc(c.app.reviewNote)}</div>`;
    h += '<h2>Source and credit</h2>';
    h += `<p>Content is condensed from the <strong>${esc(src.title)}</strong>, ${esc(src.edition)}, published by ${esc(src.publisher)}. Credit: FEMA / Emergency Management Institute.</p>`;
    h += `<p><a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">Open the full manual (PDF on ready.gov)</a> <span class="small muted">(needs internet)</span></p>`;
    h += '<div class="box caution"><span class="lbl">Important</span>This is a <strong>condensed field reference</strong>. It is <strong>not a FEMA product</strong> and is <strong>not endorsed by FEMA</strong> or DHS. It summarizes the manual and does not replace it, your training, your team leader, or local protocols. <strong>Medical content is pending instructor review.</strong></div>';
    h += `<p class="small">${esc(c.usage.statementInPdf)} ${esc(c.usage.femaPolicy)}</p>`;
    h += `<p class="small">${esc(src.citationFormat.split(' pdfPageMap')[0])}</p>`;
    const ts = c.triageSource;
    if (ts) {
      h += '<h2>Triage source</h2>';
      h += `<p>The Triage section and the START triage tool come from <strong>${esc(ts.title)}</strong>, ${ts.pages} pages. Publisher: ${esc(ts.publisher.toLowerCase())}. ${esc(ts.date)} ${esc(ts.provenance)}</p>`;
      h += `<p class="small">${esc(ts.usage)} Citations like \u201CTriage unit p. 17\u201D refer to its printed page numbers.</p>`;
      h += '<div class="box caution"><span class="lbl">Important</span>The triage content is a <strong>condensed field reference</strong>. It is <strong>not a FEMA product</strong> and is <strong>not endorsed by FEMA</strong> or by the authors or publisher of the triage unit. <strong>Triage content is pending instructor review.</strong></div>';
    }
    if (c.app.illinoisRule) {
      h += '<h2>Illinois rule: \u201CBlack\u201D only</h2>';
      h += `<div class="box review"><span class="lbl">Program direction</span>${esc(c.app.illinoisRule)} The FEMA team report\u2019s third \u201CPeople\u201D field is relabeled \u201CBlack (per triage)\u201D. Guidance on handling people in the Black category is listed only under <a href="#/local">Local Protocols</a>.</div>`;
    }
    h += '<h2>Corrections</h2><p>Misprints in the manual that this app corrects:</p>';
    h += c.corrections.map((r) => `<div class="box correction"><span class="lbl">${esc(r.title)}</span>${esc(r.text)}${citeSpan(r.cite)} <a href="${href.topic(r.topic)}">View topic</a></div>`).join('');
    h += '<h2>Flagged for instructor review</h2><p>Where the manual contradicts itself, both versions are shown and flagged. Figures transcribed from images are flagged for verification.</p><ul class="list">';
    h += c.reviewFlags.map((r) => `<li><a class="listlink" href="${href.topic(r.topic)}"><span class="grow">${esc(r.title)}<span class="sub">${esc(r.text)}</span></span></a></li>`).join('') + '</ul>';
    h += '<p class="small">Not included: CPR (neither source teaches it, 3-1, T-5). The FEMA 2019 manual names triage only as a function (4-4); triage comes from the program\u2019s triage unit above.</p>';
    h += '<h2>Privacy and security</h2><ul class="plain">' + c.privacy.rules.map((r) => `<li>${esc(r)}</li>`).join('') + '<li>No cookies, trackers, ads, fonts, or scripts from other sites. Everything ships with the app.</li></ul>';
    h += '<h2>Offline</h2><p id="offStat">Checking\u2026</p><p><a class="btn" href="#/install">How to add to Home Screen</a></p>';
    h += '<h2>Settings</h2><div class="btnrow"><button type="button" class="btn" id="sTheme"></button><button type="button" class="btn" id="sSize"></button></div>';
    h += '<div class="btnrow"><button type="button" class="btn warn" id="sReset">Reset counts &amp; settings</button></div>';
    h += `<p class="small muted">Content schema ${esc(c.schemaVersion)} \u00B7 built ${esc(c.app.built)} \u00B7 source generated ${esc(c.generated)}</p>`;
    v.innerHTML = h;
    const paint = () => { $('#sTheme').textContent = 'Theme: ' + store.get('theme', 'auto'); $('#sSize').textContent = 'Text: ' + store.get('size', 'normal'); };
    paint();
    $('#sTheme').onclick = () => { cycleTheme(); paint(); };
    $('#sSize').onclick = () => { store.set('size', store.get('size', 'normal') === 'normal' ? 'large' : 'normal'); applyTheme(); paint(); };
    $('#sReset').onclick = () => { if (confirm('Reset tally counts and settings on this device?')) { ['tally', 'tags', 'tagsUpdated', 'theme', 'size', 'installHintDismissed', 'draftAck'].forEach(store.del); applyTheme(); route(); } };
    offlineStatus().then(([ok, msg]) => { const e = $('#offStat'); if (e) { e.className = ok ? 'status-ok' : 'status-no'; e.textContent = (ok ? '\u2714 ' : '') + msg; } });
  }

  function vInstall(v) {
    setHeader('Add to Home Screen', '#/'); setTab('about');
    v.innerHTML = `
      <h2>iPhone (Safari)</h2>
      <ol class="howto"><li>Open this page in <strong>Safari</strong>. Other iPhone browsers may not offer this.</li>
      <li>Tap the <span class="kbd">Share \u2191</span> button (bottom of screen).</li>
      <li>Scroll down and tap <span class="kbd">Add to Home Screen</span>, then <span class="kbd">Add</span>.</li>
      <li><strong>Open it once from the new Home Screen icon while you have signal</strong>, and wait a few seconds. The Home Screen app saves its own offline copy.</li>
      <li>Test it: turn on Airplane Mode and open the icon.</li></ol>
      <h2>iPad</h2><p>Same steps. The <span class="kbd">Share \u2191</span> button is at the top right of Safari.</p>
      <h2>Android (Chrome)</h2><ol class="howto"><li>Tap the <span class="kbd">\u22EE</span> menu.</li><li>Tap <span class="kbd">Install app</span> or <span class="kbd">Add to Home screen</span>.</li><li>Open it once while online, then test in Airplane Mode.</li></ol>
      <div class="box info"><span class="lbl">Status</span><span id="offStat2">Checking\u2026</span><br>${isStandalone() ? 'Running as an installed app.' : 'Running in the browser.'}</div>
      <p class="small muted">Updates download in the background when you are online. Tap \u201CUpdate\u201D when asked.</p>`;
    offlineStatus().then(([ok, msg]) => { const e = $('#offStat2'); if (e) e.textContent = (ok ? '\u2714 ' : '') + msg; });
  }
  function vNotFound(v) { setHeader('Not found', '#/'); v.innerHTML = '<p>That page does not exist.</p><p><a class="btn" href="#/">Home</a></p>'; }

  // ---------- router ----------
  function route() {
    const v = $('#view');
    document.body.classList.remove('walking');
    v.ontouchstart = v.ontouchend = null;
    const parts = (location.hash || '#/').slice(2).split('/').map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    const [a, b, c2] = parts;
    try {
      if (!a) vHome(v);
      else if (a === 's') vSection(v, b);
      else if (a === 't') vTopic(v, b);
      else if (a === 'tool') vTool(v, b);
      else if (a === 'walk') vWalk(v, b, parseInt(c2 || '0', 10));
      else if (a === 'search') vSearch(v, b || '');
      else if (a === 'local') vLocal(v);
      else if (a === 'about') vAbout(v);
      else if (a === 'install') vInstall(v);
      else vNotFound(v);
    } catch (err) {
      v.innerHTML = '<p>Something went wrong showing this page.</p><p><a class="btn" href="#/">Home</a></p>';
      console.error(err);
    }
    window.scrollTo(0, 0);
  }
  // walkthrough Next/Back replace history so the header Back returns to the tool
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.walknav a');
    if (!a) return;
    e.preventDefault();
    if (a.getAttribute('aria-disabled') === 'true') return;
    location.replace(a.getAttribute('href'));
  });

  function cycleTheme() {
    const cur = store.get('theme', 'auto');
    store.set('theme', THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
    applyTheme();
  }

  function draftNotice() {
    const reviewed = S.c.app.reviewed;
    $('#draftChip').hidden = reviewed;
    if (reviewed || store.get('draftAck', null) === S.c.app.built) return;
    const m = $('#draftModal'); m.hidden = false;
    $('#draftOk').focus();
    $('#draftOk').onclick = () => { store.set('draftAck', S.c.app.built); m.hidden = true; };
  }

  // ---------- service worker ----------
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      const showUpdate = (w) => {
        $('#updateBar').hidden = false;
        $('#updateBtn').onclick = () => { w.postMessage('SKIP_WAITING'); };
      };
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
      });
      // check for updates when the app comes back to the foreground (no-op when offline)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloading = false;
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }   // first install: no reload needed
      if (reloading) return; reloading = true; location.reload();
    });
  }

  // ---------- init ----------
  async function init() {
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    $('#themeBtn').addEventListener('click', cycleTheme);
    $('#backBtn').addEventListener('click', () => { const to = $('#backBtn').dataset.to; location.hash = to || '#/'; });
    try {
      const [c, lp] = await Promise.all([
        fetch('data/content.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch('data/local-protocols.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      ]);
      S.c = c; S.lp = lp;
    } catch (e) {
      $('#view').innerHTML = '<div class="box danger"><span class="lbl">Could not load content</span>Open the app once while online so it can save an offline copy.</div>';
      registerSW();
      return;
    }
    S.c.sections.forEach((s) => s.topics.forEach((t) => { const id = s.id + '.' + t.id; S.topics[id] = t; S.sectionOf[id] = s.id; }));
    buildIndex();
    window.addEventListener('hashchange', route);
    route();
    draftNotice();
    registerSW();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
