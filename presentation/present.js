// Presentation deck: navigation, live iframes, small charts, and our real code shown by section.

const STUDENT_SITE_URL = 'https://shimyawn.github.io/wordcloud-workshop/student-guide/';
const CODE_FILES = {                       // the slides read the real files, so the deck always shows the current code
  js: '../Wordcloud_clean/wordcloud.js',
  html: '../Wordcloud_clean/index.html'
};
// The course rule: presenting groups do not share complete prompts. The deck shows code and explains it; no prompt text.

// Terms from the lectures (Munzner, Visualization Analysis and Design), used on the slides with a dotted underline.
const GLOSSARY = {
  idiom: ['Idiom', 'A distinct way to create and manipulate a visual representation, analysed by what data, why (task) and how (encoding and interaction).'],
  item: ['Item', 'An individual, discrete entity: one row of a table. Here: one sentence, and after deriving, one term.'],
  attribute: ['Attribute', 'A property that is measured or observed for each item: a column. Here: text, label and source.'],
  categorical: ['Categorical attribute', 'Values with no implicit order; we can only compare them for equality. Here: source, and the 1/0 label.'],
  ordered: ['Ordinal attribute', 'Values with an order but no meaningful arithmetic. Here: tone (complaint < neutral < praise).'],
  quantitative: ['Quantitative attribute', 'Values with meaningful magnitude, so arithmetic is possible. Here: count and share.'],
  derived: ['Derived data', 'New attributes computed from the original data to show within the view. Here: count, share and tone.'],
  mark: ['Mark', 'A geometric primitive that represents an item. Here the mark is a piece of text: the term itself.'],
  channel: ['Channel', 'Controls the appearance of marks based on attributes: position, size, colour and others.'],
  magnitude: ['Magnitude channel', 'A channel that shows how much: position, length, size, luminance. Matched to ordered and quantitative attributes.'],
  identity: ['Identity channel', 'A channel that shows what: hue, shape. Matched to categorical attributes.'],
  expressiveness: ['Expressiveness', 'Match the channel to the data type: magnitude channels for ordered data, identity channels for categorical data.'],
  effectiveness: ['Effectiveness', 'Channels differ in how accurately we perceive them; spatial position ranks highest, so it goes to the most important attribute.'],
  redundant: ['Redundant encoding', 'Showing one attribute with several channels. It sends a stronger message but uses up channels. Here: share drives both position and colour.'],
  popout: ['Popout', 'Some differences are found in parallel, without searching item by item, so a bright or large word is seen at once.'],
  grouping: ['Grouping by proximity', 'Items in the same spatial region are read as a group, alongside containment, connection and similarity.'],
  commonscale: ['Common scale', 'Perception mostly makes relative judgements; it is more accurate when marks share one scale and frame. Here: one size scale for all clouds.'],
  diverging: ['Diverging palette', 'For data with a meaningful midpoint: a neutral colour (white, yellow or grey) at the midpoint, saturated colours at the two ends.'],
  hue: ['Hue', 'What colour: an identity channel. Luminance and saturation are magnitude channels.'],
  size: ['Size', 'A magnitude channel. Area is judged less accurately than length or position.'],
  longtail: ['Long tail', 'Most items are rare: here 58% of distinct words appear in one sentence only (Zipf\'s law).'],
  overview: ['Overview', 'See the whole dataset at once, before zooming or reading details.'],
  task: ['Task abstraction', 'The why of a vis, in general verbs: discover, present, compare, look up, identify, summarise.'],
  detailsondemand: ['Details on demand', 'Extra information shown only when asked for, for example a tooltip on hover. It does not replace the overview.'],
  smallmultiples: ['Small multiples', 'Several views with the same encoding, each showing a different slice of the data. Here: one cloud per source.'],
  filter: ['Filter', 'Reduce the number of items shown by a rule. Here: terms in 7 sentences or more.'],
  sampling: ['Sampling', 'Showing a subset chosen at random. It keeps the variety of the data but loses evidence.'],
  smoothing: ['Additive smoothing', 'Adding imaginary counts (here 5 on each side) so small samples are pulled towards the neutral value.'],
  negation: ['Negation handling', 'Treating "not good" as one term, so the negator changes the meaning instead of being dropped.'],
  tokenization: ['Tokenization', 'Splitting text into words (tokens) before counting them.'],
  stopwords: ['Stop words', 'Very common grammar words (the, of, is) removed before counting because they carry no topic.'],
  scale: ['Scale (D3)', 'A function from a data domain to a visual range, for example d3.scaleSqrt().domain([7, 120]).range([10, 40]).'],
  sqrt: ['Square-root scale', 'Font size grows with the square root of the count, so the area of a word grows in proportion to the count.'],
  join: ['Data join (D3)', 'selection.data(data, key).join(...) binds data items to DOM elements: enter creates, update changes, exit removes.'],
  transition: ['Animated transition', 'A smooth change from one state to the next. It supports item tracking better than a jump cut.'],
  spiral: ['Spiral layout', 'Each word starts at a target point and moves outwards along a spiral until it finds free space, as in Wordle.'],
  collision: ['Collision detection', 'Checking whether two word boxes overlap before placing a word.']
};

const QUIZ = [
  { q: 'Why does a word need at least 7 sentences to be shown?',
    options: ['It is a round number that keeps the cloud small', 'With 7 one-sided sentences the smoothed share first reaches 70%', 'Words in fewer sentences are always stop words'],
    answer: 1, why: '(7 + 5) ÷ (7 + 10) = 71%. With 6 it is 69%: a word in fewer than 7 sentences can never turn green or pink.' },
  { q: 'The biggest words (food, movie, phone) are grey. Is that a mistake?',
    options: ['Yes, the colour scale is broken', 'No: they appear in praise and complaints about equally, which is a finding', 'Yes, they should have been filtered out as stop words'],
    answer: 1, why: 'food is 59 praise / 61 complaints: 49%. People talk about the same things either way; only the evaluative words lean.' },
  { q: 'In Task 2, why do good and great sit near the middle of the triangle?',
    options: ['They are the biggest words, so they are placed first', 'All three sources use them often, so the three corners pull them about equally', 'The layout puts praise and complaint words in the centre'],
    answer: 1, why: 'Each word starts at the average of the corners, weighted by its count per source. good is in 78 Dining, 48 Film and 67 Tech sentences. Judgement words are shared across domains; topic words like food, movie and phone stay in one corner.' }
];

// ---------------- Scale for large screens ----------------
function fitScale() {
  const k = Math.max(1, Math.min(1.8, Math.min(innerWidth / 1500, (innerHeight - 56) / 800)));
  document.documentElement.style.setProperty('--k', k.toFixed(3));
}
fitScale();
addEventListener('resize', fitScale);

// ---------------- Navigation ----------------
const slides = [...document.querySelectorAll('.slide')];
const menuButtons = [...document.querySelectorAll('[data-menu]')].filter(el => el.tagName === 'BUTTON');
const counter = document.getElementById('counter');
const bar = document.getElementById('bar');
let current = 0;

// Each slide gets an id like "3-2": menu number, then its place inside the menu.
const seen = {};
slides.forEach(slide => {
  const menu = slide.dataset.menu;
  seen[menu] = (seen[menu] || 0) + 1;
  slide.dataset.id = `${menu}-${seen[menu]}`;
});

function show(index) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  const slide = slides[current];
  slides.forEach(s => s.classList.toggle('active', s === slide));
  menuButtons.forEach(b => b.classList.toggle('current', b.dataset.menu === slide.dataset.menu));
  counter.textContent = `${slide.dataset.id} · ${current + 1} / ${slides.length}`;
  bar.style.width = `${((current + 1) / slides.length) * 100}%`;
  history.replaceState(null, '', `#${slide.dataset.id}`);
  document.dispatchEvent(new Event('slidechange'));
  slide.querySelectorAll('iframe[data-src]').forEach(frame => {        // load live charts only when needed
    if (!frame.src) frame.src = frame.dataset.src;
  });
}

menuButtons.forEach(button => button.addEventListener('click', () => {
  show(slides.findIndex(s => s.dataset.menu === button.dataset.menu));
}));

document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea')) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); show(current + 1); }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); show(current - 1); }
  if (/^[0-7]$/.test(event.key)) show(slides.findIndex(s => s.dataset.menu === event.key));
});

// Inside a slide the chart's own title and footer are hidden, so the words are what you see first.
// This is done from here, so the word cloud's code stays exactly what students build.
const EMBED_CSS = `
  .intro h1, .intro .subtitle, .intro .kicker, .intro .eyebrow, footer.how, .how-to-read { display: none !important; }
  .intro { padding: 12px 0 0 !important; }
  .intro, .axis, .stage { width: calc(100% - 32px) !important; }   /* use the whole frame, not the page's reading width */
  body { min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-start; }   /* clouds start at the top and fill the frame */
  html { zoom: 0.82; }
`;

// Arrow keys pressed while a live chart has focus still move the deck.
document.querySelectorAll('iframe').forEach(frame => frame.addEventListener('load', () => {
  try {
    const style = frame.contentDocument.createElement('style');
    style.textContent = EMBED_CSS;
    frame.contentDocument.head.append(style);
    frame.contentWindow.dispatchEvent(new Event('resize'));
  } catch (e) { /* different origin: ignore */ }
  try {
    frame.contentWindow.addEventListener('keydown', event => {
      if (event.target.closest('input')) return;          // the Task 2 slider uses arrow keys
      if (event.key === 'ArrowRight') show(current + 1);
      if (event.key === 'ArrowLeft') show(current - 1);
    });
  } catch (e) { /* different origin: ignore */ }
}));

addEventListener('hashchange', () => {                 // a link like #4-3 typed into the address bar
  const k = slides.findIndex(s => `#${s.dataset.id}` === location.hash);
  if (k >= 0 && k !== current) show(k);
});
const start = slides.findIndex(s => `#${s.dataset.id}` === location.hash);
show(start >= 0 ? start : 0);

// ---------------- Charts ----------------
const C = { ink: '#f4f3f7', muted: '#93939e', rule: '#2a2b35', praise: '#a4ff64', complaint: '#ff5b9e', faint: '#5d5e69' };

(function longTail() {
  const rows = [[1, 226], [2, 224], [5, 171], [10, 137], [20, 90], [50, 46], [80, 32], [100, 26], [101, 26], [120, 22],
    [150, 19], [200, 15], [300, 11], [500, 7], [700, 4], [1000, 3], [1272, 3]].map(([rank, n]) => ({ rank, n }));
  const svg = d3.select('#chart-tail');
  const m = { l: 56, r: 24, t: 24, b: 48 }, W = 760, H = 400;
  const x = d3.scaleLog().domain([1, 1272]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, 230]).range([H - m.b, m.t]);
  svg.append('g').selectAll('line').data([0, 50, 100, 150, 200]).join('line')
    .attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).attr('stroke', C.rule);
  svg.append('g').selectAll('text').data([0, 50, 100, 150, 200]).join('text')
    .attr('x', m.l - 10).attr('y', d => y(d) + 4).attr('text-anchor', 'end').attr('class', 'tick').text(d => d);
  svg.append('g').selectAll('text').data([1, 10, 100, 1000]).join('text')
    .attr('x', x).attr('y', H - m.b + 22).attr('text-anchor', 'middle').attr('class', 'tick').text(d => d.toLocaleString('en-US'));
  svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').attr('class', 'tick').text('rank (log scale)');
  svg.append('text').attr('x', m.l - 10).attr('y', m.t - 8).attr('text-anchor', 'end').attr('class', 'tick').text('sentences');
  svg.append('path').datum(rows).attr('fill', 'none').attr('stroke', C.faint).attr('stroke-width', 2.5)
    .attr('d', d3.line().x(d => x(d.rank)).y(d => y(d.n)));
  svg.append('line').attr('x1', x(100)).attr('x2', x(100)).attr('y1', m.t).attr('y2', H - m.b)
    .attr('stroke', C.praise).attr('stroke-dasharray', '3 4');
  svg.append('circle').attr('cx', x(100)).attr('cy', y(26)).attr('r', 6).attr('fill', C.praise);
  svg.append('text').attr('x', x(100) + 12).attr('y', y(26) - 40).attr('fill', C.praise).attr('class', 'callout').text('rank 100 = 26 sentences');
  svg.append('text').attr('x', x(100) + 12).attr('y', y(26) - 18).attr('fill', C.muted).attr('class', 'callout small').text('rank 101 = 26 sentences too');
})();

(function negation() {
  const rows = [
    { term: 'good', before: 76, after: 85, neg: 'not good', negShare: 4 },
    { term: 'recommend', before: 68, after: 89, neg: 'not recommend', negShare: 8 },
    { term: 'work', before: 31, after: 55, neg: 'not work', negShare: 4 },
    { term: 'disappointed', before: 17, after: 6, neg: 'not disappointed', negShare: 100 }
  ];
  const svg = d3.select('#chart-negation');
  const m = { l: 150, r: 40, t: 36 }, W = 760;
  const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]);
  const rowY = i => m.t + 30 + i * 66;
  svg.append('g').selectAll('line').data([0, 25, 50, 75, 100]).join('line')
    .attr('x1', x).attr('x2', x).attr('y1', m.t).attr('y2', rowY(3) + 30)
    .attr('stroke', d => d === 50 ? '#4a4b56' : C.rule).attr('stroke-dasharray', d => d === 50 ? '3 4' : null);
  svg.append('g').selectAll('text').data([0, 25, 50, 75, 100]).join('text')
    .attr('x', x).attr('y', m.t - 12).attr('text-anchor', 'middle').attr('class', 'tick').text(d => `${d}%`);
  const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (d, i) => `translate(0,${rowY(i)})`);
  g.append('text').attr('x', m.l - 16).attr('y', 5).attr('text-anchor', 'end').attr('class', 'row-label').text(d => d.term);
  g.append('line').attr('x1', d => x(d.before)).attr('x2', d => x(d.after)).attr('stroke', C.faint).attr('stroke-width', 2);
  g.append('circle').attr('cx', d => x(d.before)).attr('r', 6).attr('fill', C.faint);
  g.append('circle').attr('cx', d => x(d.after)).attr('r', 7).attr('fill', d => d.after >= 50 ? C.praise : C.complaint);
  g.append('text').attr('x', d => x(Math.max(d.before, d.after)) + 14).attr('y', 5).attr('class', 'callout small')
    .attr('fill', C.muted).text(d => `${d.before}% → ${d.after}%`);
  g.append('text').attr('x', m.l - 16).attr('y', 26).attr('text-anchor', 'end').attr('class', 'neg-label')
    .attr('fill', d => d.negShare >= 50 ? C.praise : C.complaint).text(d => `${d.neg} ${d.negShare}%`);
  svg.append('text').attr('x', W - m.r).attr('y', rowY(3) + 52).attr('text-anchor', 'end').attr('class', 'tick')
    .text('grey = word counted alone · colour = after "not" phrases are counted separately · share of praise sentences');
})();

// ---------------- Real code, cut by "// STEP n" sections ----------------
function cutSection(source, key) {
  const markers = [...source.matchAll(/^\/\/ (STEP \d+|Run the)/gm)].map(m => ({ label: m[1], index: m.index }));
  if (key === 'CONFIG') {
    const startAt = source.indexOf('const CONFIG');
    return source.slice(startAt, markers[0].index).trimEnd();
  }
  const label = key === 'MAIN' ? 'Run the' : `STEP ${key}`;
  const i = markers.findIndex(mk => mk.label === label);
  if (i < 0) return `// Could not find "// ${label}" in ${CODE_FILES.js}`;
  return source.slice(markers[i].index, markers[i + 1] ? markers[i + 1].index : undefined).trimEnd();
}

function highlight(code, isHtml = false) {
  const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pattern = isHtml
    ? /(<!--[\s\S]*?-->)|("[^"\n]*")|(<\/?[a-z0-9]+)|(\b\d+\b)/g
    : /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(const|let|function|async|await|return|if|else|for|of|in|new|continue|break|throw|try|catch)\b|\b(\d+(?:\.\d+)?)\b/g;
  let html = '', last = 0;
  for (const m of code.matchAll(pattern)) {
    html += escape(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : 'n';
    html += `<span class="${cls}">${escape(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  html += escape(code.slice(last));
  return html.split('\n').map(line => `<span class="line">${line || ' '}</span>`).join('');
}

const range = text => { const [a, b] = String(text).split('-').map(Number); return [a, b || a]; };

function markLines(pre, spec, cls, scroll) {
  const lines = [...pre.querySelectorAll('.line')];
  lines.forEach(l => l.classList.remove(cls));
  if (!spec) return;
  const [a, b] = range(spec);
  lines.slice(a - 1, b).forEach(l => l.classList.add(cls));
  if (scroll && lines[a - 1]) {
    pre.scrollTo({ top: Math.max(0, lines[a - 1].offsetTop - pre.clientHeight * 0.25), behavior: scroll });
  }
}

document.querySelectorAll('pre.snippet').forEach(pre => { pre.innerHTML = highlight(pre.textContent); });

// ---------------- Glossary: dotted terms, tooltip, and the glossary slide ----------------
const glossTip = document.getElementById('gloss-tip');
document.querySelectorAll('dfn[data-g]').forEach(el => {
  const entry = GLOSSARY[el.dataset.g];
  if (!entry) return;
  el.tabIndex = 0;
  const showTip = () => {
    glossTip.innerHTML = '';
    const b = document.createElement('b'); b.textContent = entry[0];
    const p = document.createElement('p'); p.textContent = entry[1];
    glossTip.append(b, p);
    glossTip.hidden = false;
    const r = el.getBoundingClientRect();
    glossTip.style.left = `${Math.min(r.left, innerWidth - glossTip.offsetWidth - 16)}px`;
    glossTip.style.top = `${r.bottom + 10 + glossTip.offsetHeight > innerHeight ? r.top - glossTip.offsetHeight - 10 : r.bottom + 10}px`;
  };
  el.addEventListener('mouseenter', showTip);
  el.addEventListener('focus', showTip);
  el.addEventListener('mouseleave', () => { glossTip.hidden = true; });
  el.addEventListener('blur', () => { glossTip.hidden = true; });
});
const glossary = document.getElementById('glossary');
if (glossary) Object.values(GLOSSARY).sort((a, b) => a[0].localeCompare(b[0])).forEach(([term, def]) => {
  const div = document.createElement('div');
  const dt = document.createElement('b'); dt.textContent = term;
  const dd = document.createElement('p'); dd.textContent = def;
  div.append(dt, dd);
  glossary.append(div);
});

// ---------------- Quiz ----------------
const quiz = document.getElementById('quiz');
if (quiz) QUIZ.forEach((item, n) => {
  const box = document.createElement('div'); box.className = 'q';
  const h = document.createElement('h3'); h.textContent = `${n + 1}. ${item.q}`;
  const opts = document.createElement('div'); opts.className = 'opts';
  const why = document.createElement('p'); why.className = 'why'; why.hidden = true; why.textContent = item.why;
  item.options.forEach((text, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    b.addEventListener('click', () => {
      opts.querySelectorAll('button').forEach((x, i) => x.classList.toggle('right', i === item.answer));
      if (k !== item.answer) b.classList.add('wrong');
      why.hidden = false;
    });
    opts.append(b);
  });
  box.append(h, opts, why);
  quiz.append(box);
});

// ---------------- Speaker notes (N), timer (T, R), full screen (F), glossary (G) ----------------
const notesPanel = document.getElementById('notes-panel');
const timerEl = document.getElementById('timer');
let timerStart = null, timerElapsed = 0, timerId = null;
const fmt = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function tick() { timerEl.textContent = fmt(timerElapsed + (timerStart ? Date.now() - timerStart : 0)); }
function toggleTimer() {
  if (timerStart) { timerElapsed += Date.now() - timerStart; timerStart = null; clearInterval(timerId); timerEl.classList.remove('running'); }
  else { timerStart = Date.now(); timerId = setInterval(tick, 500); timerEl.classList.add('running'); }
  tick();
}
timerEl.addEventListener('click', toggleTimer);
function updateNotes() {
  const aside = slides[current].querySelector('aside.notes');
  notesPanel.textContent = aside ? aside.textContent.trim() : 'No notes for this slide.';
}
document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
  const k = event.key.toLowerCase();
  if (k === 'n') { notesPanel.hidden = !notesPanel.hidden; updateNotes(); }
  if (k === 't') toggleTimer();
  if (k === 'r') { timerElapsed = 0; if (timerStart) timerStart = Date.now(); tick(); }
  if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
});
document.addEventListener('slidechange', () => {
  updateNotes();
  slides[current]._scrollToFocus?.();
});

document.getElementById('student-url').textContent = STUDENT_SITE_URL;

// ---------------- Smoothed share calculator (slide 2-3) ----------------
const pcPraise = document.getElementById('pc-praise'), pcComplaint = document.getElementById('pc-complaint');
function updatePcalc() {
  const pr = Math.max(0, Number(pcPraise.value) || 0), co = Math.max(0, Number(pcComplaint.value) || 0);
  const share = (pr + 5) / (pr + co + 10);
  const tone = share >= 0.70 ? ['praise', 'praise'] : share <= 0.30 ? ['complaint', 'complaint'] : ['neutral', 'either way'];
  document.getElementById('pc-share').textContent = `${Math.round(share * 100)}%`;
  const chip = document.getElementById('pc-tone'); chip.textContent = tone[1]; chip.className = `pchip ${tone[0]}`;
  const n = pr + co, raw = n ? Math.round(pr / n * 100) : null;
  document.getElementById('pc-note').textContent = n === 0 ? 'no sentences: 50%, the midpoint'
    : `raw ${raw}% · ${n} sentence${n === 1 ? '' : 's'}${n < 7 ? ' · too few to reach a colour' : ''}`;
}
if (pcPraise) {
  [pcPraise, pcComplaint].forEach(el => el.addEventListener('input', updatePcalc));
  document.querySelectorAll('.pcalc-examples button').forEach(b => b.addEventListener('click', () => {
    pcPraise.value = b.dataset.p; pcComplaint.value = b.dataset.c; updatePcalc();
  }));
  updatePcalc();
}

// ---------------- Spiral sketch (slide 3-2) ----------------
(function spiralSketch() {
  const svg = document.getElementById('spiral-pres');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg', pts = [];
  for (let k = 0; k < 420; k++) { const a = k * 0.12; pts.push([180 + 1.2 * a * Math.cos(a) * 1.6, 110 + 1.2 * a * Math.sin(a)]); }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M' + pts.map(q => q.map(v => v.toFixed(1)).join(',')).join('L'));
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#5d5e69'); path.setAttribute('stroke-width', '1.2');
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', 180); dot.setAttribute('cy', 110); dot.setAttribute('r', 5); dot.setAttribute('fill', '#a4ff64');
  svg.append(path, dot);
})();
