// TASK 1 · Keep the top N by count. Same six steps as the base; step 4 and main() change.
// D3 v7 only. Six functions, called in order by main() at the bottom.

const CONFIG = {
  files: [
    { source: 'Dining', path: 'data/yelp_labelled.txt' },
    { source: 'Film', path: 'data/imdb_labelled.txt' },
    { source: 'Tech', path: 'data/amazon_cells_labelled.txt' }
  ],
  prior: 5,          // imaginary sentences added on each side (step 3)
  praiseAt: 0.70,    // share >= 0.70 → green
  complaintAt: 0.30, // share <= 0.30 → pink, everything between → grey
  minCount: 7,       // fewest sentences that can reach 0.70 or 0.30 (7/0 → 0.706)
  negators: ['not', 'no', 'never'],
  skipWords: 'very really too quite all even ever much more'.split(' '),
  functionWords: ('a an the this that these those i me my mine we us our ours you your yours he him his she her hers ' +
    'it its they them their theirs myself yourself himself herself itself ourselves themselves who whom whose which ' +
    'what where when why how am is are was were be been being have has had having do does did doing will would shall ' +
    'should can could may might must of in on at by for with about against between into through during before after ' +
    'above below to from up down out off over under and or but nor so yet if then than because as while until ' +
    'although though there here').split(' '),
  bandHeight: 300, bandGrow: 20,
  bandPad: { top: 34, bottom: 28 },
  margin: 48,
  fontRange: [10, 40],
  spiral: { step: 0.12, gap: 1.2, squash: 1.6 },   // Archimedean spiral: r = gap × angle, stretched sideways
  font: 'Inter, system-ui, sans-serif',
  colors: { praise: '#a4ff64', neutral: '#f4f3f7', complaint: '#ff5b9e' }
};

const NEGATORS = new Set(CONFIG.negators);
const SKIP_WORDS = new Set(CONFIG.skipWords);
const FUNCTION_WORDS = new Set(CONFIG.functionWords);


// STEP 1 · Read the three files into one list of sentences.
async function loadData() {
  const sentences = [];
  for (const file of CONFIG.files) {
    const response = await fetch(file.path);
    if (!response.ok) throw new Error(`Could not load ${file.path} (HTTP ${response.status})`);
    for (const line of (await response.text()).split(/\r?\n/)) {
      const tab = line.lastIndexOf('\t');            // the label is after the LAST tab
      if (tab < 0) continue;
      sentences.push({ text: line.slice(0, tab).trim(), label: Number(line.slice(tab + 1)), source: file.source });
    }
  }
  console.log(`[Step 1] ${sentences.length} sentences`);
  return sentences;
}


// STEP 2 · One sentence → a Set of terms. "isn't very good" becomes the single term "not good".
function toTerms(text) {
  const tokens = text.toLowerCase()
    .replace(/\bcan['’]t\b|\bcannot\b/g, 'can not')
    .replace(/\bwon['’]t\b/g, 'will not')
    .replace(/n['’]t\b/g, ' not')
    .replace(/['’](m|re|ve|ll|d|s)\b/g, '')
    .match(/[a-z]+/g) || [];

  const terms = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (NEGATORS.has(word)) {
      let j = i + 1;                                   // look past up to 2 grammar/intensifier words
      while (j <= i + 2 && (FUNCTION_WORDS.has(tokens[j]) || SKIP_WORDS.has(tokens[j]))) j++;
      const next = tokens[j];
      if (next && !NEGATORS.has(next) && next.length > 1 && !FUNCTION_WORDS.has(next) && !SKIP_WORDS.has(next)) {
        terms.add(`${word === 'no' ? 'no' : 'not'} ${next}`);
        i = j;                                         // the joined word is used up
      }
      continue;
    }
    if (word.length > 1 && !FUNCTION_WORDS.has(word)) terms.add(word);
  }
  return terms;
}


// STEP 3 · Per source, count praise / complaint sentences for each term, then score it.
function countTerms(sentences) {
  const bySource = new Map(CONFIG.files.map(f => [f.source, new Map()]));
  for (const s of sentences) {
    const terms = bySource.get(s.source);
    for (const term of toTerms(s.text)) {            // a Set: each term once per sentence
      if (!terms.has(term)) terms.set(term, { term, praise: 0, complaint: 0, example: {} });
      const c = terms.get(term);
      const side = s.label === 1 ? 'praise' : 'complaint';
      c[side] += 1;
      c.example[side] ??= s.text;
    }
  }
  return CONFIG.files.map(({ source }) => ({
    source,
    terms: [...bySource.get(source).values()].map(c => {
      const count = c.praise + c.complaint;
      const share = (c.praise + CONFIG.prior) / (count + 2 * CONFIG.prior);
      const tone = share >= CONFIG.praiseAt ? 'praise' : share <= CONFIG.complaintAt ? 'complaint' : 'neutral';
      return { ...c, count, share, tone };
    })
  }));
}


// STEP 4 · TASK 1 · Instead of a rule: sort by count and keep the first N.
function selectTopN(terms, N) {
  const ranked = [...terms].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  const kept = ranked.slice(0, N);
  const last = kept.at(-1);
  const tied = ranked.filter(t => t.count === last.count);             // every term with the same count as rank N
  return { kept, last, tied: tied.length, cutTies: tied.filter(t => !kept.includes(t)).length };
}


// STEP 5 · Pack one source into one cloud. Largest word first, each starting at the centre
// and walking out along a spiral until its box overlaps nothing. No randomness.
const measure = document.createElement('canvas').getContext('2d');

function layoutCloud(terms, bandIndex, size, box) {                 // box = { x, y, w, h }: where this cloud may go
  const top = box.y + CONFIG.bandPad.top;
  const bottom = box.y + box.h - CONFIG.bandPad.bottom;
  const centre = { x: box.x + box.w / 2, y: (top + bottom) / 2 };
  const { step, gap, squash } = CONFIG.spiral;
  const placed = [];
  let unplaced = 0;
  const grid = new Map();                                  // 40-px cells: only nearby words are checked for overlap
  const cellsOf = (x, y, w, h) => {
    const keys = [];
    for (let gx = Math.floor((x - w / 2) / 40); gx <= Math.floor((x + w / 2) / 40); gx++)
      for (let gy = Math.floor((y - h / 2) / 40); gy <= Math.floor((y + h / 2) / 40); gy++) keys.push(`${gx},${gy}`);
    return keys;
  };

  for (const t of terms) {
    const fontSize = size(t.count);
    const italic = t.term.includes(' ');
    measure.font = `${italic ? 'italic ' : ''}${t.tone === 'neutral' ? 400 : 600} ${fontSize}px ${CONFIG.font}`;
    const w = measure.measureText(t.term).width + 3;
    const h = fontSize * 0.9 + 1;
    const target = centre.x;                                          // every word aims at the centre (Task 2 changes this)

    let spot = null;
    for (let k = 0; !spot && k < 8000; k++) {
      const angle = k * step;
      const x = target + gap * angle * Math.cos(angle) * squash;
      const y = centre.y + gap * angle * Math.sin(angle);
      if (x - w / 2 < box.x + 4 || x + w / 2 > box.x + box.w - 4 || y - h / 2 < top || y + h / 2 > bottom) continue;
      const near = cellsOf(x, y, w, h).flatMap(key => grid.get(key) || []);
      if (!near.some(p => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2)) spot = { x, y };
    }
    if (spot) {
      const word = { ...t, band: bandIndex, ...spot, w, h, fontSize, italic };
      placed.push(word);
      for (const key of cellsOf(spot.x, spot.y, w, h)) grid.set(key, [...(grid.get(key) || []), word]);
    }
    else unplaced += 1;
  }
  return { placed, unplaced };
}


// STEP 6 · Draw one cloud per source and its words; hover a word for its counts and one real sentence.
function drawCloud({ bands, width }, animate) {
  const height = d3.max(bands, b => b.box.y + b.box.h);
  const svg = d3.select('#cloud').attr('width', width).attr('height', height);

  const g = svg.selectAll('g.band').data(bands).join(enter => {
    const b = enter.append('g').attr('class', 'band');
    b.append('line'); b.append('text').attr('class', 'band-name'); b.append('text').attr('class', 'band-note');
    return b;
  });
  g.select('line').attr('x1', d => d.box.x).attr('x2', d => d.box.x + d.box.w).attr('y1', d => d.box.y).attr('y2', d => d.box.y);
  g.select('.band-name').attr('x', d => d.box.x + 8).attr('y', d => d.box.y + 22).text(d => d.source);
  g.select('.band-note').attr('x', d => d.box.x + 8).attr('y', d => d.box.y + d.box.h - 10)
    .text(d => d.note);

  const t = d3.transition().duration(animate ? 600 : 0);
  svg.selectAll('text.word')
    .data(bands.flatMap(b => b.placed), d => `${d.band}|${d.term}`)
    .join(
      enter => enter.append('text').attr('class', 'word').attr('opacity', 0)
        .attr('x', d => d.x).attr('y', d => d.y),
      update => update,
      exit => exit.transition(t).attr('opacity', 0).remove()
    )
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
    .attr('fill', d => CONFIG.colors[d.tone])
    .attr('font-weight', d => d.tone === 'neutral' ? 400 : 600)
    .attr('font-style', d => d.italic ? 'italic' : 'normal')
    .text(d => d.term)
    .transition(t)
    .attr('x', d => d.x).attr('y', d => d.y).attr('font-size', d => d.fontSize)
    .attr('opacity', d => d.tone === 'neutral' ? 0.45 : 1);

  const tip = d3.select('#tooltip');
  svg.selectAll('text.word')
    .on('mousemove', (event, d) => {
      const side = d.share >= 0.5 ? 'praise' : 'complaint';
      tip.property('hidden', false).html('')
        .call(el => el.append('strong').text(d.term))
        .call(el => el.append('span').text(` · ${d.praise} praise / ${d.complaint} complaints · ${Math.round(d.share * 100)}%`))
        .call(el => el.append('p').text(`“${d.example[side] ?? d.example.praise ?? d.example.complaint}”`));
      const node = tip.node();
      tip.style('left', `${Math.min(event.clientX + 14, innerWidth - node.offsetWidth - 8)}px`)
        .style('top', `${event.clientY + 16}px`);
    })
    .on('mouseleave', () => tip.property('hidden', true));
}


// Run the steps; the N buttons run steps 4–6 again.
async function main() {
  const status = document.getElementById('status');
  try {
    const scored = countTerms(await loadData());
    let N = 100;
    const render = animate => {
      const selected = scored.map(s => {
        const r = selectTopN(s.terms, N);
        const cut = r.cutTies ? ` · ${r.cutTies} of them cut off` : '';
        return { source: s.source, kept: r.kept,
          note: N <= 10                                                   // narrow columns: a short note
            ? `rank ${N} = ${r.last.count} sentences · ${r.tied} tied${cut}`
            : `Top ${N} of ${s.terms.length.toLocaleString('en-US')} · rank ${Math.min(N, s.terms.length)} = ${r.last.count} sentences · ${r.tied} terms share that count${cut}` };
      });
      const width = Math.max(600, document.getElementById('stage').clientWidth);
      const stage = document.getElementById('stage');
      const visible = innerHeight - Math.min(stage.offsetTop, innerHeight * 0.3) - 16;
      // Layout follows N: 10 → three clouds side by side · 50, 100 → stacked in one screen · 1000 → one source per screen
      const mode = N <= 10 ? 'columns' : N >= 1000 ? 'pages' : 'rows';
      const boxH = mode === 'columns' ? Math.max(260, visible) : mode === 'pages' ? Math.max(320, visible) : Math.max(150, Math.floor(visible / 3));
      const boxesFor = h => selected.map((s, i) => mode === 'columns'
        ? { x: i * width / 3, y: 0, w: width / 3, h }
        : { x: 0, y: i * h, w: width, h });
      const boxW = mode === 'columns' ? width / 3 : width;
      const fontMax = mode === 'columns' ? Math.min(60, boxW / 6) : mode === 'pages' ? Math.max(18, Math.round(30 * visible / 785)) : Math.round(CONFIG.fontRange[1] * Math.min(boxH / CONFIG.bandHeight, width / 1100));
      const size = d3.scaleSqrt().domain([1, d3.max(selected.flatMap(s => s.kept), t => t.count)]).range([mode === 'pages' ? (visible < 600 ? 7 : 8) : CONFIG.fontRange[0], fontMax]);
      CONFIG.spiral.squash = Math.max(1.6, Math.min(4, boxW / boxH / 2.2));
      let h = boxH, bands;
      for (let attempt = 0; attempt < 40; attempt++) {
        const boxes = boxesFor(h);
        bands = selected.map((s, i) => ({ source: s.source, note: s.note, box: boxes[i], ...layoutCloud(s.kept, i, size, boxes[i]) }));
        if (bands.every(b => b.unplaced === 0)) break;
        h += CONFIG.bandGrow * (mode === 'pages' ? 3 : 1);
      }
      drawCloud({ bands, width }, animate);
      console.log(`[Task 1] mode ${mode} · cloud height ${h}px · visible ${visible}px`);
      console.log(`[Task 1] top ${N}:`, bands.map(b => `${b.source}: ${b.note}`).join(' | '));
    };
    await document.fonts.ready;
    render(true);
    status.hidden = true;
    document.querySelectorAll('[data-n]').forEach(button => button.addEventListener('click', () => {
      N = Number(button.dataset.n);
      document.querySelectorAll('[data-n]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      render(true);
    }));
    let timer;
    addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => render(false), 150); });
  } catch (error) {
    status.textContent = `${error.message}. Open this folder with a local server (for example VS Code Live Server).`;
    status.classList.add('error');
    console.error(error);
  }
}

main();
