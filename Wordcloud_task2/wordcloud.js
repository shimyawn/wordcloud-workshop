// TASK 2 · One cloud for all three sources: each word sits between the Dining, Tech and Film corners,
// closest to the source that uses it most. Colour still shows praise or complaint.
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
  cloudHeight: 760, bandGrow: 20,
  // TASK 2 · each source is a corner of an upside-down triangle (fractions of width and height)
  corners: { Dining: [0.17, 0.16], Tech: [0.83, 0.16], Film: [0.5, 0.86] },
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


// STEP 4 · Keep a term if it appears in at least 7 sentences of one source.
function selectTerms(terms) {
  const kept = terms.filter(t => t.count >= CONFIG.minCount);
  return { kept, leftOut: terms.length - kept.length };
}

// STEP 4b · TASK 2 · Merge the three sources into one list. Each term keeps its count per source.
function mergeSources(scored) {
  const merged = new Map();
  for (const { source, terms } of scored) {
    const keep = new Set(selectTerms(terms).kept.map(t => t.term));
    for (const t of terms) {
      if (!merged.has(t.term)) merged.set(t.term, { term: t.term, by: { Dining: 0, Film: 0, Tech: 0 }, praise: 0, complaint: 0, example: {}, keep: false });
      const m = merged.get(t.term);
      m.by[source] += t.count;
      m.praise += t.praise;
      m.complaint += t.complaint;
      m.example.praise ??= t.example.praise;
      m.example.complaint ??= t.example.complaint;
      m.keep ||= keep.has(t.term);
    }
  }
  const all = [...merged.values()].map(m => {
    const count = m.praise + m.complaint;
    const share = (m.praise + CONFIG.prior) / (count + 2 * CONFIG.prior);       // the same rule as step 3, over all sources
    const tone = share >= CONFIG.praiseAt ? 'praise' : share <= CONFIG.complaintAt ? 'complaint' : 'neutral';
    return { ...m, count, share, tone };
  });
  const kept = all.filter(m => m.keep).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  return { kept, leftOut: all.length - kept.length };
}


// STEP 5 · TASK 2 · Pack all words into one cloud. Each word starts between the three corners,
// pulled towards each source by how often that source uses it, then walks out along a spiral.
const measure = document.createElement('canvas').getContext('2d');

function layoutCloud(terms, size, width, height) {
  const top = 8, bottom = height - 8;
  const corner = source => [CONFIG.corners[source][0] * width, CONFIG.corners[source][1] * height];
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
    const total = t.by.Dining + t.by.Film + t.by.Tech;               // weighted average of the three corners
    const target = ['Dining', 'Film', 'Tech'].reduce((p, s) => [p[0] + corner(s)[0] * t.by[s] / total, p[1] + corner(s)[1] * t.by[s] / total], [0, 0]);

    let spot = null;
    for (let k = 0; !spot && k < 8000; k++) {
      const angle = k * step;
      const x = target[0] + gap * angle * Math.cos(angle) * squash;
      const y = target[1] + gap * angle * Math.sin(angle);
      if (x - w / 2 < 4 || x + w / 2 > width - 4 || y - h / 2 < top || y + h / 2 > bottom) continue;
      const near = cellsOf(x, y, w, h).flatMap(key => grid.get(key) || []);
      if (!near.some(p => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2)) spot = { x, y };
    }
    if (spot) {
      const word = { ...t, band: 0, ...spot, w, h, fontSize, italic };
      placed.push(word);
      for (const key of cellsOf(spot.x, spot.y, w, h)) grid.set(key, [...(grid.get(key) || []), word]);
    }
    else unplaced += 1;
  }
  return { placed, unplaced };
}


// STEP 6 · TASK 2 · Draw one cloud and its three corners; hover a word for its counts per source and one sentence.
function drawCloud({ placed, leftOut, width, height }, animate) {
  const svg = d3.select('#cloud').attr('width', width).attr('height', height);

  // TASK 2 · name the three corners, outside the cloud
  const labels = { Dining: [12, 22, 'start', '↖ Dining'], Tech: [width - 12, 22, 'end', 'Tech ↗'], Film: [width / 2, height - 6, 'middle', '↓ Film'] };
  svg.selectAll('text.corner').data(Object.values(labels)).join('text').attr('class', 'corner')
    .attr('x', d => d[0]).attr('y', d => d[1]).attr('text-anchor', d => d[2]).text(d => d[3]);
  svg.selectAll('text.note').data([null]).join('text').attr('class', 'band-note note')
    .attr('x', 12).attr('y', height - 6).text(`+${leftOut.toLocaleString('en-US')} words in fewer than ${CONFIG.minCount} sentences in every source`);

  const t = d3.transition().duration(animate ? 600 : 0);
  svg.selectAll('text.word')
    .data(placed, d => d.term)
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
        .call(el => el.append('span').text(` · ${d.praise} praise / ${d.complaint} complaints · ${Math.round(d.share * 100)}% · Dining ${d.by.Dining} · Film ${d.by.Film} · Tech ${d.by.Tech}`))
        .call(el => el.append('p').text(`“${d.example[side] ?? d.example.praise ?? d.example.complaint}”`));
      const node = tip.node();
      tip.style('left', `${Math.min(event.clientX + 14, innerWidth - node.offsetWidth - 8)}px`)
        .style('top', `${event.clientY + 16}px`);
    })
    .on('mouseleave', () => tip.property('hidden', true));
}


// Run the steps: 1–3 as before, then merge, lay out one cloud and draw it.
async function main() {
  const status = document.getElementById('status');
  try {
    const scored = countTerms(await loadData());
    const { kept, leftOut } = mergeSources(scored);
    console.log(`[Task 2] ${kept.length} terms in one cloud, ${leftOut} left out`);
    const size = d3.scaleSqrt().domain([CONFIG.minCount, d3.max(kept, t => t.count)]).range(CONFIG.fontRange);
    const render = animate => {
      const width = Math.max(720, document.getElementById('stage').clientWidth);
      let height = CONFIG.cloudHeight, layout;
      for (let attempt = 0; attempt < 15; attempt++) {
        layout = layoutCloud(kept, size, width, height);
        if (layout.unplaced === 0) break;
        height += CONFIG.bandGrow;
      }
      console.log(`[Task 2] unplaced ${layout.unplaced} | height ${height}px`);
      drawCloud({ placed: layout.placed, leftOut, width, height }, animate);
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
