// Page helpers only: progress checkboxes, language switch, the share calculator, a spiral sketch, and the "you are here" mark.

// Progress is saved in this browser. Storage can be unavailable (private mode), so every access is guarded.
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* not saved, still works */ } }
};
document.querySelectorAll('[data-progress]').forEach(box => {
  const key = `wordcloud-guide:${box.dataset.progress}`;
  box.checked = store.get(key) === '1';
  box.addEventListener('change', () => store.set(key, box.checked ? '1' : '0'));
  box.addEventListener('click', event => event.stopPropagation());   // ticking a box inside a link does not jump
});

// Language: English or Chinese. Every text exists twice (lang="en" / lang="zh"); CSS shows one.
function setUi(lang) {
  document.documentElement.dataset.ui = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  document.querySelectorAll('[data-set-ui]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setUi === lang)));
  store.set('wordcloud-guide:ui', lang);
}
document.querySelectorAll('[data-set-ui]').forEach(b => b.addEventListener('click', () => { setUi(b.dataset.setUi); if (typeof updateCalc === 'function') updateCalc(); }));
setUi(store.get('wordcloud-guide:ui') || 'en');

// A drawn spiral, no words: the path a word follows until it finds free space.
(function spiralSketch() {
  const svg = document.getElementById('spiral-sketch');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const pts = [];
  for (let k = 0; k < 420; k++) { const a = k * 0.12; pts.push([360 + 1.2 * a * Math.cos(a) * 1.6, 100 + 1.2 * a * Math.sin(a)]); }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L'));
  path.setAttribute('class', 'w-spiral');
  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('cx', 360); dot.setAttribute('cy', 100); dot.setAttribute('r', 5); dot.setAttribute('class', 'w-knob');
  svg.append(path, dot);
})();

// Smoothed share calculator: the formula from section 3, nothing more.
const praiseInput = document.getElementById('calc-praise');
const complaintInput = document.getElementById('calc-complaint');
const shareOut = document.getElementById('calc-share');
const toneOut = document.getElementById('calc-tone');
const TONES = [
  { test: s => s >= 0.70, name: 'praise', label: { en: 'praise', zh: '称赞' } },
  { test: s => s <= 0.30, name: 'complaint', label: { en: 'complaint', zh: '抱怨' } },
  { test: () => true, name: 'neutral', label: { en: 'either way', zh: '两边都用' } }
];
function updateCalc() {
  const p = Math.max(0, Number(praiseInput.value) || 0);
  const c = Math.max(0, Number(complaintInput.value) || 0);
  const share = (p + 5) / (p + c + 10);
  const tone = TONES.find(t => t.test(share));
  shareOut.textContent = `${Math.round(share * 100)}%`;
  toneOut.textContent = tone.label[document.documentElement.dataset.ui] || tone.label.en;
  toneOut.className = `chip ${tone.name}`;
}
praiseInput.addEventListener('input', updateCalc);
complaintInput.addEventListener('input', updateCalc);
document.querySelectorAll('.calc-examples button').forEach(button => button.addEventListener('click', () => {
  praiseInput.value = button.dataset.p;
  complaintInput.value = button.dataset.c;
  updateCalc();
}));
updateCalc();

// Highlight the section you are reading in the contents.
const links = [...document.querySelectorAll('.toc a')];
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(a => a.classList.toggle('here', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-30% 0px -60% 0px' });
document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
