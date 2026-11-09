// Word cloud of 3,000 review sentences: which words are said in praise, which in complaints.
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


// STEP 4 · Keep a term only if it appears in enough sentences to be able to lean.
function selectTerms(terms) {
  const kept = terms.filter(t => t.count >= CONFIG.minCount)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  return { kept, leftOut: terms.length - kept.length };
}


// STEP 5 · Pack one source into one cloud. Largest word first, each starting at the centre
// and walking out along a spiral until its box overlaps nothing. No randomness.
const measure = document.createElement('canvas').getContext('2d');

function layoutCloud(terms, bandIndex, size, width, bandHeight) {
  const top = bandIndex * bandHeight + CONFIG.bandPad.top;
  const bottom = (bandIndex + 1) * bandHeight - CONFIG.bandPad.bottom;
  const centre = { x: width / 2, y: (top + bottom) / 2 };
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
      if (x - w / 2 < 4 || x + w / 2 > width - 4 || y - h / 2 < top || y + h / 2 > bottom) continue;
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
function drawCloud({ bands, width, bandHeight }, animate) {
  const height = bands.length * bandHeight;
  const svg = d3.select('#cloud').attr('width', width).attr('height', height);

  const g = svg.selectAll('g.band').data(bands).join(enter => {
    const b = enter.append('g').attr('class', 'band');
    b.append('line'); b.append('text').attr('class', 'band-name'); b.append('text').attr('class', 'band-note');
    return b;
  });
  g.select('line').attr('x2', width).attr('y1', (d, i) => i * bandHeight).attr('y2', (d, i) => i * bandHeight);
  g.select('.band-name').attr('x', 8).attr('y', (d, i) => i * bandHeight + 22).text(d => d.source);
  g.select('.band-note').attr('x', 8).attr('y', (d, i) => (i + 1) * bandHeight - 10)
    .text(d => `+${d.leftOut.toLocaleString('en-US')} words in fewer than ${CONFIG.minCount} sentences`);

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


// Run the six steps in order and print one checkpoint per step.
async function main() {
  const status = document.getElementById('status');
  try {
    const sentences = await loadData();
    console.log('[Step 2]', [...toTerms("The food isn't very good.")]);

    const scored = countTerms(sentences);
    const dining = new Map(scored[0].terms.map(t => [t.term, t]));
    console.log('[Step 3] Dining:', ['good', 'great', 'food', 'not good', 'bad']
      .map(k => `${k} ${dining.get(k).praise}/${dining.get(k).complaint} ${Math.round(dining.get(k).share * 100)}%`).join(' · '));

    const selected = scored.map(s => ({ ...s, ...selectTerms(s.terms) }));
    console.log('[Step 4] kept', selected.map(s => `${s.source} ${s.kept.length}`).join(' · '),
      '| left out', selected.map(s => s.leftOut).join(' / '));

    const maxCount = d3.max(selected.flatMap(s => s.kept), t => t.count);
    const render = animate => {
      const width = Math.max(600, document.getElementById('stage').clientWidth);
      // Fit all three clouds in one screen: each band gets a third of the visible height, fonts scale with it.
      const stage = document.getElementById('stage');
      const zoom = stage.getBoundingClientRect().width / stage.offsetWidth || 1;   // 1 unless the page is zoomed
      const screenH = innerHeight / zoom;                                             // the visible height, in page pixels
      const visible = screenH - Math.min(stage.offsetTop, screenH * 0.3) - 16;
      const fitted = Math.max(150, Math.min(420, Math.floor(visible / 3)));
      const size = d3.scaleSqrt().domain([CONFIG.minCount, maxCount])
        .range([CONFIG.fontRange[0], Math.round(CONFIG.fontRange[1] * Math.min(1.25 * fitted / CONFIG.bandHeight, width / 1000))]);
      CONFIG.spiral.squash = Math.max(1.6, Math.min(2.6, width / fitted / 2.2));   // wide, short bands → a wider spiral, but not a flat strip
      let bandHeight = fitted, bands;
      for (let attempt = 0; attempt < 15; attempt++) {     // grow all bands together until every word fits
        bands = selected.map((s, i) => ({ source: s.source, leftOut: s.leftOut, ...layoutCloud(s.kept, i, size, width, bandHeight) }));
        if (bands.every(b => b.unplaced === 0)) break;
        bandHeight += CONFIG.bandGrow;
      }
      console.log('[Step 5] unplaced', bands.map(b => `${b.source} ${b.unplaced}`).join(' · '), `| band height ${bandHeight}px`);
      drawCloud({ bands, width, bandHeight }, animate);
      console.log(`[Step 6] ${document.querySelectorAll('#cloud text.word').length} words drawn`);
    };

    await document.fonts.ready;
    render(true);
    status.hidden = true;
    let timer;
    addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => render(false), 150); });
  } catch (error) {
    status.textContent = `${error.message}. Open this folder with a local server (for example VS Code Live Server).`;
    status.classList.add('error');
    console.error(error);
  }
}

main();
