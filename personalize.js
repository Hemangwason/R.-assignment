/* ============================================================
   Travel DNA — personalization capture flow

   State machine over 5 mechanisms:
     1. Mood Board       (image grid + free-text fallback)
     2. This or That     (binary cards)
     3. How you travel   (sliders + photo previews)
     4. Travel DNA Radar (radar chart, every axis editable,
                          add custom axes)
     5. Activation       → opens existing Goa results flow

   Each input contributes to a taste vector keyed by axis id.
   The vector is the source of truth for the radar chart in
   step 4, the personalized chips on the homepage, and the
   ambient toast copy.
   ============================================================ */

const DNA_KEY = 'tripadvisor:dna';

const MOOD_CARDS = [
  { id: 'sunset-beach', label: 'Sunset · beach', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80&auto=format&fit=crop',
    tags: ['Beach', 'Sunsets'], vec: { adventure: 1, foodie: 0, culture: 0, nightlife: 1, comfort: 2, budget: 0 } },
  { id: 'mountain-trail', label: 'Mountain trail', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80&auto=format&fit=crop',
    tags: ['Hiking', 'Wilderness'], vec: { adventure: 3, foodie: 0, culture: 0, nightlife: -2, comfort: -1, budget: 1 } },
  { id: 'street-food', label: 'Street food', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&auto=format&fit=crop',
    tags: ['Foodie', 'Local'], vec: { adventure: 1, foodie: 3, culture: 2, nightlife: 0, comfort: -1, budget: 2 } },
  { id: 'cafe-quiet', label: 'Quiet café', img: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80&auto=format&fit=crop',
    tags: ['Slow mornings'], vec: { adventure: -1, foodie: 1, culture: 1, nightlife: -1, comfort: 2, budget: 0 } },
  { id: 'temple', label: 'Heritage', img: 'https://images.unsplash.com/photo-1466442929976-97f336a657be?w=400&q=80&auto=format&fit=crop',
    tags: ['Heritage', 'Culture'], vec: { adventure: 0, foodie: 0, culture: 3, nightlife: -1, comfort: 0, budget: 1 } },
  { id: 'pool-deck', label: 'Pool deck', img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&q=80&auto=format&fit=crop',
    tags: ['Resort', 'Comfort'], vec: { adventure: -1, foodie: 0, culture: -1, nightlife: 0, comfort: 3, budget: -2 } },
  { id: 'forest', label: 'Forest hike', img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80&auto=format&fit=crop',
    tags: ['Nature', 'Quiet'], vec: { adventure: 2, foodie: 0, culture: 0, nightlife: -2, comfort: -1, budget: 1 } },
  { id: 'rooftop-bar', label: 'Rooftop · nightlife', img: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&q=80&auto=format&fit=crop',
    tags: ['Nightlife', 'Social'], vec: { adventure: 0, foodie: 1, culture: 0, nightlife: 3, comfort: 1, budget: -2 } },
  { id: 'market', label: 'Local market', img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&q=80&auto=format&fit=crop',
    tags: ['Markets', 'Foodie'], vec: { adventure: 1, foodie: 2, culture: 2, nightlife: 0, comfort: -1, budget: 2 } },
  { id: 'museum', label: 'Art museum', img: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=400&q=80&auto=format&fit=crop',
    tags: ['Art', 'Culture'], vec: { adventure: -1, foodie: 0, culture: 3, nightlife: 0, comfort: 1, budget: 0 } },
  { id: 'safari', label: 'Wildlife safari', img: 'https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=400&q=80&auto=format&fit=crop',
    tags: ['Adventure', 'Wild'], vec: { adventure: 3, foodie: 0, culture: 1, nightlife: -1, comfort: 0, budget: -2 } },
  { id: 'snow', label: 'Snow & quiet', img: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=400&q=80&auto=format&fit=crop',
    tags: ['Snow', 'Calm'], vec: { adventure: 1, foodie: 0, culture: 0, nightlife: -2, comfort: 1, budget: -1 } },
];

const TOT_ROUNDS = [
  {
    eyebrow: 'Where you sleep',
    options: [
      { id: 'cliff-villa', sup: 'Option A', title: 'Cliff villa, ocean view', desc: 'No neighbours, no menu — just a private cook and silence.',
        img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 0, culture: 0, foodie: 0, nightlife: -2, comfort: 3, budget: -3 } },
      { id: 'beach-hostel', sup: 'Option B', title: 'Beach hostel, music & people', desc: 'Live DJs, a shared kitchen and ten new friends by Sunday.',
        img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 1, culture: 0, foodie: 0, nightlife: 3, comfort: -2, budget: 3 } },
    ],
  },
  {
    eyebrow: 'How you eat',
    options: [
      { id: 'street-thali', sup: 'Option A', title: 'Plastic chair, ₹120 thali', desc: 'Wherever the locals queue. Spice, sweat, story.',
        img: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 1, culture: 2, foodie: 3, nightlife: 0, comfort: -2, budget: 3 } },
      { id: 'tasting-menu', sup: 'Option B', title: 'Tasting menu, candle-lit', desc: 'Twelve courses. A wine pairing. Quiet conversation.',
        img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 0, culture: 1, foodie: 2, nightlife: 0, comfort: 2, budget: -3 } },
    ],
  },
  {
    eyebrow: 'How you spend the day',
    options: [
      { id: 'packed', sup: 'Option A', title: 'Pack it · see everything', desc: 'Six stops, a tight schedule, a checklist you finish.',
        img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 1, culture: 3, foodie: 1, nightlife: 0, comfort: -1, budget: 0 } },
      { id: 'slow', sup: 'Option B', title: 'One thing, slowly', desc: 'A long lunch. A bookshop. No alarm tomorrow.',
        img: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: -1, culture: 1, foodie: 1, nightlife: 0, comfort: 3, budget: 1 } },
    ],
  },
  {
    eyebrow: 'After dark',
    options: [
      { id: 'city-lights', sup: 'Option A', title: 'City lights · late nights', desc: 'Rooftops, music, dancing past midnight.',
        img: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 0, culture: 0, foodie: 0, nightlife: 3, comfort: 0, budget: -2 } },
      { id: 'stars', sup: 'Option B', title: 'Stars · no signal', desc: 'Bonfire, no Wi-Fi, the night sky as your screen.',
        img: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 3, culture: 0, foodie: 0, nightlife: -3, comfort: -1, budget: 1 } },
    ],
  },
  {
    eyebrow: 'Who comes with',
    options: [
      { id: 'one-friend', sup: 'Option A', title: 'You + one friend', desc: 'Two flexible days, two opinions, two cameras.',
        img: 'https://images.unsplash.com/photo-1530653333484-8f4eef38275b?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 1, culture: 1, foodie: 1, nightlife: 1, comfort: 1, budget: 1 } },
      { id: 'big-group', sup: 'Option B', title: 'Big group · house rental', desc: 'A villa, a long table, music until 3am.',
        img: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=600&q=80&auto=format&fit=crop',
        vec: { adventure: 0, culture: 0, foodie: 1, nightlife: 3, comfort: 2, budget: -2 } },
    ],
  },
];

/* Slider model — five stops each. Each stop has a preview image
   + a short tag rendered inside the preview tile. */
const HOWY_SLIDERS = [
  {
    id: 'pace',
    title: 'Pace',
    sub: 'How full do you want the days?',
    leftEnd: 'Chill',
    rightEnd: 'Packed',
    trackClass: 'howy-track-pace',
    stops: [
      { tag: 'A book + a long lunch', img: 'https://images.unsplash.com/photo-1499023032476-d4341f246568?w=400&q=80&auto=format&fit=crop',
        v: 'A book and a long lunch.' },
      { tag: 'Two stops then a nap', img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80&auto=format&fit=crop',
        v: 'Two stops, then a nap.' },
      { tag: 'A morning plan, free evening', img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80&auto=format&fit=crop',
        v: 'Balanced — a morning plan and a free evening.' },
      { tag: 'Most boxes ticked', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80&auto=format&fit=crop',
        v: 'Most boxes ticked by sunset.' },
      { tag: 'Up at 6, back at 11', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80&auto=format&fit=crop',
        v: 'Up at 6, back at 11. Every minute used.' },
    ],
  },
  {
    id: 'wallet',
    title: 'Budget',
    sub: 'What does a great trip cost you?',
    leftEnd: 'Frugal',
    rightEnd: 'Splurge',
    trackClass: 'howy-track-wallet',
    stops: [
      { tag: 'Hostels · buses · street food', img: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&q=80&auto=format&fit=crop',
        v: 'Hostels, buses, street food.' },
      { tag: 'Mid-tier hotels · taxis', img: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400&q=80&auto=format&fit=crop',
        v: 'Mid-tier hotels, occasional taxis.' },
      { tag: 'A nice room · a tasting menu', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&q=80&auto=format&fit=crop',
        v: 'A nice room, one tasting menu.' },
      { tag: 'Boutique · private guides', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&q=80&auto=format&fit=crop',
        v: 'Boutique stays, private guides.' },
      { tag: 'Villa · helicopter transfer', img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&q=80&auto=format&fit=crop',
        v: 'Five-star villa, helicopter transfer.' },
    ],
  },
  {
    id: 'crowd',
    title: 'Company',
    sub: 'How busy do you want it around you?',
    leftEnd: 'Solo / Quiet',
    rightEnd: 'Social',
    trackClass: 'howy-track-crowd',
    stops: [
      { tag: 'Empty trails · strangers at most', img: 'https://images.unsplash.com/photo-1502136969935-8d8eef54d77b?w=400&q=80&auto=format&fit=crop',
        v: 'Empty trails. Strangers at most.' },
      { tag: 'A few cafés · mostly alone', img: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80&auto=format&fit=crop',
        v: 'A few cafés. Mostly alone.' },
      { tag: 'Mix of busy and quiet', img: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&q=80&auto=format&fit=crop',
        v: 'Mix of busy and quiet days.' },
      { tag: 'Group dinners · bar nights', img: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&q=80&auto=format&fit=crop',
        v: 'Group dinners. Bar nights.' },
      { tag: 'Festivals · hostels · dance floors', img: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&q=80&auto=format&fit=crop',
        v: 'Festivals, hostels, dance floors.' },
    ],
  },
];

const HOWY_COSTS = [3000, 6500, 12000, 22000, 45000];

/* Default 6 axes — every one is editable, and the user can add more. */
const DEFAULT_AXES = [
  { id: 'adventure', label: 'Adventure', glyph: '⛰' },
  { id: 'culture', label: 'Culture', glyph: '◫' },
  { id: 'foodie', label: 'Foodie', glyph: '◉' },
  { id: 'nightlife', label: 'Nightlife', glyph: '◐' },
  { id: 'comfort', label: 'Comfort', glyph: '✦' },
  { id: 'budget', label: 'Budget-aware', glyph: '₹' },
];

const state = {
  step: 1,
  picked: new Set(),
  customMoods: [],
  totChoices: {},
  totIndex: 0,
  howy: { pace: 50, wallet: 50, crowd: 50 },
  axes: DEFAULT_AXES.map((a) => ({ ...a })),
  vec: { adventure: 50, culture: 50, foodie: 50, nightlife: 50, comfort: 50, budget: 50 },
  manuallyTuned: false,
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ============================================================
   Vector math — accumulate signals from moods + picks + sliders
   ============================================================ */

function recomputeVec() {
  const base = {};
  state.axes.forEach((a) => { base[a.id] = state.vec[a.id] ?? 50; });

  ['adventure', 'culture', 'foodie', 'nightlife', 'comfort', 'budget'].forEach((k) => {
    base[k] = 50;
  });

  state.picked.forEach((id) => {
    const m = MOOD_CARDS.find((c) => c.id === id);
    if (!m) return;
    for (const k in m.vec) base[k] = (base[k] ?? 50) + m.vec[k] * 6;
  });

  state.customMoods.forEach((txt) => {
    const t = txt.toLowerCase();
    if (/quiet|peace|calm|solo|alone|nature/.test(t)) { base.comfort += 6; base.nightlife -= 6; base.adventure += 2; }
    if (/food|eat|culinary|street/.test(t)) { base.foodie += 12; }
    if (/party|night|club|dance/.test(t)) { base.nightlife += 12; base.comfort += 3; }
    if (/budget|cheap|frugal|hostel/.test(t)) { base.budget += 10; base.comfort -= 4; }
    if (/luxury|splurge|five|5-star/.test(t)) { base.comfort += 10; base.budget -= 12; }
    if (/culture|heritage|history|art|museum|temple/.test(t)) { base.culture += 12; }
    if (/adventure|trek|hike|wild|safari/.test(t)) { base.adventure += 12; }
  });

  Object.values(state.totChoices).forEach((choice) => {
    for (const k in choice.vec) base[k] = (base[k] ?? 50) + choice.vec[k] * 5;
  });

  base.comfort += (state.howy.pace - 50) * -0.3 + (state.howy.wallet - 50) * 0.4;
  base.budget += (state.howy.wallet - 50) * -0.7;
  base.nightlife += (state.howy.crowd - 50) * 0.5;
  base.adventure += (state.howy.pace - 50) * 0.35;

  for (const k in base) base[k] = Math.round(clamp(base[k], 8, 96));

  state.axes.forEach((a) => {
    if (!(a.id in base)) base[a.id] = state.vec[a.id] ?? 50;
  });

  state.vec = base;
}

/* ============================================================
   Step 1 — Mood Board (+ custom text fallback)
   ============================================================ */

function renderMoodGrid() {
  const grid = document.getElementById('mood-grid');
  if (!grid) return;
  grid.innerHTML = MOOD_CARDS.map((m) => `
    <button class="mood-card" data-mood="${m.id}" type="button">
      <img src="${m.img}" alt="${m.label}" loading="lazy"/>
      <div class="mood-card-check">✓</div>
      <div class="mood-card-label">${m.label}</div>
    </button>
  `).join('');

  grid.querySelectorAll('.mood-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mood;
      if (state.picked.has(id)) state.picked.delete(id);
      else state.picked.add(id);
      btn.classList.toggle('picked');
      updateMoodMeter();
      gateNext();
    });
  });
}

function renderCustomMoodChips() {
  const wrap = document.getElementById('mood-custom-chips');
  if (!wrap) return;
  wrap.innerHTML = state.customMoods.map((t, i) => `
    <span class="mood-custom-chip" data-i="${i}">
      <span>“${t}”</span>
      <button type="button" data-remove="${i}" aria-label="Remove">✕</button>
    </span>
  `).join('');
  wrap.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.customMoods.splice(Number(btn.dataset.remove), 1);
      renderCustomMoodChips();
      updateMoodMeter();
      gateNext();
    });
  });
}

function addCustomMood(txt) {
  const v = (txt || '').trim();
  if (!v || state.customMoods.includes(v)) return false;
  if (v.length > 60) return false;
  state.customMoods.push(v);
  renderCustomMoodChips();
  updateMoodMeter();
  gateNext();
  return true;
}

function updateMoodMeter() {
  const count = state.picked.size + state.customMoods.length;
  document.getElementById('mood-count').textContent = count;
  const all = [...state.picked].flatMap((id) => MOOD_CARDS.find((c) => c.id === id)?.tags || []);
  const uniq = [...new Set([...all, ...state.customMoods.map((t) => t.split(' ').slice(0, 2).join(' '))])].slice(0, 5);
  document.getElementById('mood-tags').innerHTML = uniq.map((t) => `<span class="mood-meter-tag">${t}</span>`).join('');
}

/* ============================================================
   Step 2 — This or That
   ============================================================ */

function renderTot() {
  const stage = document.getElementById('tot-stage');
  if (!stage) return;
  const round = TOT_ROUNDS[state.totIndex];
  if (!round) return;

  document.getElementById('tot-eyebrow').textContent = round.eyebrow;
  document.getElementById('tot-progress-label').textContent = `${state.totIndex + 1} of ${TOT_ROUNDS.length}`;
  document.getElementById('tot-progress-fill').style.width = `${(state.totIndex / TOT_ROUNDS.length) * 100}%`;

  stage.innerHTML = `
    ${round.options.map((o) => `
      <button class="tot-option" data-pick="${o.id}" type="button">
        <img src="${o.img}" alt="" loading="lazy"/>
        <div class="tot-option-veil"></div>
        <div class="tot-option-text">
          <small>${o.sup}</small>
          <h4>${o.title}</h4>
          <p>${o.desc}</p>
        </div>
      </button>
    `).join('')}
    <div class="tot-vs">vs</div>
  `;

  stage.querySelectorAll('.tot-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pick;
      const chosen = round.options.find((o) => o.id === id);
      state.totChoices[round.eyebrow] = chosen;
      btn.classList.add('chose');
      document.getElementById('tot-progress-fill').style.width = `${((state.totIndex + 1) / TOT_ROUNDS.length) * 100}%`;
      setTimeout(() => {
        if (state.totIndex < TOT_ROUNDS.length - 1) {
          state.totIndex++;
          renderTot();
        } else {
          gateNext(true);
        }
      }, 340);
    });
  });
}

/* ============================================================
   Step 3 — How you travel (sliders + photo previews)
   ============================================================ */

function renderHowy() {
  const stack = document.getElementById('howy-stack');
  if (!stack) return;
  stack.innerHTML = HOWY_SLIDERS.map((s) => `
    <div class="howy-slider" data-slider="${s.id}">
      <div class="howy-side-head">
        <div>
          <div class="howy-side-title">${s.title}</div>
          <div class="howy-side-sub">${s.sub}</div>
        </div>
        <span class="howy-side-value" id="howy-${s.id}-val">${s.stops[2].v}</span>
      </div>

      <div class="howy-tooltip-wrap">
        <div class="howy-tooltip" id="howy-${s.id}-tooltip" style="left:50%">
          <div class="howy-tooltip-img">
            ${s.stops.map((stop, i) => `
              <img src="${stop.img}" alt="${stop.tag}" loading="lazy" data-stop="${i}" class="${i === 2 ? 'show' : ''}"/>
            `).join('')}
          </div>
          <div class="howy-tooltip-tag" id="howy-${s.id}-tag">${s.stops[2].tag}</div>
        </div>
      </div>

      <div class="howy-track ${s.trackClass}">
        <div class="howy-track-notches">${'<div class="howy-notch"></div>'.repeat(5)}</div>
        <div class="howy-thumb" style="left:50%"></div>
      </div>

      <div class="howy-ends">
        <span>${s.leftEnd}</span>
        <span>${s.rightEnd}</span>
      </div>
    </div>
  `).join('');

  HOWY_SLIDERS.forEach((s) => attachSlider(s));
  updateHowySummary();
}

function attachSlider(s) {
  const wrap = document.querySelector(`[data-slider="${s.id}"]`);
  if (!wrap) return;
  const track = wrap.querySelector('.howy-track');
  const thumb = wrap.querySelector('.howy-thumb');
  const tooltip = document.getElementById(`howy-${s.id}-tooltip`);
  const valEl = document.getElementById(`howy-${s.id}-val`);
  const tagEl = document.getElementById(`howy-${s.id}-tag`);
  const imgs = wrap.querySelectorAll('.howy-tooltip-img img');

  let dragging = false;

  const setFromX = (clientX) => {
    const rect = track.getBoundingClientRect();
    const pct = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    state.howy[s.id] = pct;
    thumb.style.left = pct + '%';
    if (tooltip) tooltip.style.left = `clamp(96px, ${pct}%, calc(100% - 96px))`;
    const idx = Math.min(4, Math.floor(pct / 20));
    valEl.textContent = s.stops[idx].v;
    tagEl.textContent = s.stops[idx].tag;
    imgs.forEach((img, i) => img.classList.toggle('show', i === idx));
    updateHowySummary();
  };

  track.addEventListener('mousedown', (e) => { dragging = true; setFromX(e.clientX); });
  window.addEventListener('mousemove', (e) => { if (dragging) setFromX(e.clientX); });
  window.addEventListener('mouseup', () => { dragging = false; });

  track.addEventListener('touchstart', (e) => { dragging = true; setFromX(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (dragging) setFromX(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => { dragging = false; });
}

function updateHowySummary() {
  const paceIdx = Math.min(4, Math.floor(state.howy.pace / 20));
  const walletIdx = Math.min(4, Math.floor(state.howy.wallet / 20));
  const crowdIdx = Math.min(4, Math.floor(state.howy.crowd / 20));
  const cost = HOWY_COSTS[walletIdx];

  document.getElementById('howy-summary-text').innerHTML = `
    Sounds like <strong>${HOWY_SLIDERS[0].stops[paceIdx].tag.toLowerCase()}</strong>,
    <strong>${HOWY_SLIDERS[1].stops[walletIdx].tag.toLowerCase()}</strong>,
    <strong>${HOWY_SLIDERS[2].stops[crowdIdx].tag.toLowerCase()}</strong>.
  `;
  document.getElementById('howy-summary-amt').textContent = '₹' + cost.toLocaleString();
}

/* ============================================================
   Step 4 — Travel DNA Radar (every axis editable + add new)
   ============================================================ */

function renderRadar() {
  const svg = document.getElementById('dna-radar-svg');
  if (!svg) return;
  const cx = 160, cy = 160, R = 110;
  const n = state.axes.length;

  const rings = [0.25, 0.5, 0.75, 1].map((r) => `<circle class="dna-radar-ring" cx="${cx}" cy="${cy}" r="${R * r}"/>`).join('');

  const axisLines = state.axes.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    return `<line class="dna-radar-axis-line" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  }).join('');

  const points = state.axes.map((ax, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = ((state.vec[ax.id] ?? 50) / 100) * R;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });

  const path = 'M' + points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + ' Z';
  const dots = points.map((p) => `<circle class="dna-radar-point" cx="${p.x}" cy="${p.y}" r="4"/>`).join('');

  const labels = state.axes.map((ax, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const lx = cx + Math.cos(a) * (R + 24);
    const ly = cy + Math.sin(a) * (R + 24);
    const score = state.vec[ax.id] ?? 50;
    return `
      <text class="dna-radar-label" x="${lx}" y="${ly}">${ax.label}</text>
      <text class="dna-radar-label-num" x="${lx}" y="${ly + 13}">${score}</text>
    `;
  }).join('');

  svg.innerHTML = `
    <g>
      ${rings}
      ${axisLines}
      <path class="dna-radar-shape" d="${path}"/>
      ${dots}
      ${labels}
    </g>
  `;

  const tuner = document.getElementById('dna-axis-tuner');
  tuner.innerHTML = state.axes.map((ax) => {
    const v = state.vec[ax.id] ?? 50;
    const isCustom = !DEFAULT_AXES.find((d) => d.id === ax.id);
    return `
      <div class="dna-axis-row ${isCustom ? 'custom' : ''}" data-axis="${ax.id}">
        <span class="dna-axis-name">
          <span class="dna-axis-name-ico">${ax.glyph || '◆'}</span>
          ${ax.label}
        </span>
        <div class="dna-axis-bar"><div class="dna-axis-bar-fill" style="width:${v}%"></div></div>
        <span class="dna-axis-val">${v}</span>
        ${isCustom ? `<button class="dna-axis-remove" type="button" data-remove="${ax.id}" aria-label="Remove">✕</button>` : `<span></span>`}
      </div>
    `;
  }).join('');

  tuner.querySelectorAll('.dna-axis-row').forEach((row) => {
    const bar = row.querySelector('.dna-axis-bar');
    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.round(clamp(((e.clientX - rect.left) / rect.width) * 100, 5, 95));
      const key = row.dataset.axis;
      state.vec[key] = pct;
      state.manuallyTuned = true;
      renderRadar();
    });
  });

  tuner.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.remove;
      state.axes = state.axes.filter((a) => a.id !== id);
      delete state.vec[id];
      renderRadar();
    });
  });
}

function addCustomAxis(label) {
  const v = (label || '').trim();
  if (!v) return false;
  if (state.axes.length >= 9) return false;
  const id = 'custom-' + v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + state.axes.length;
  state.axes.push({ id, label: v.charAt(0).toUpperCase() + v.slice(1, 18), glyph: '+' });
  state.vec[id] = 60;
  renderRadar();
  return true;
}

/* ============================================================
   Step 5 — Activation
   ============================================================ */

function topDnaTags() {
  const entries = state.axes
    .map((a) => [a, state.vec[a.id] ?? 50])
    .sort((a, b) => b[1] - a[1]);
  return entries.slice(0, 4).map(([a]) => `${a.glyph || '◆'} ${a.label}`);
}

function renderActivate() {
  const tags = topDnaTags();
  document.getElementById('dna-activate-tags').innerHTML = tags.map((t) => `<span class="dna-activate-tag">${t}</span>`).join('');
}

/* ============================================================
   Step navigation
   ============================================================ */

const STEP_LABELS = ['Moods', 'Compare', 'Travel', 'Tune', 'Done'];

const STEP_TIPS = {
  1: { ico: '✓', html: '<strong>Tip ·</strong> Pick at least 3 — the more we read, the sharper your picks' },
  2: { ico: '✓', html: '<strong>Tip ·</strong> No wrong answers — just whichever feels more like you' },
  3: { ico: '✓', html: '<strong>Tip ·</strong> Drag any slider — the photo and the live estimate move with you' },
  4: { ico: '✓', html: '<strong>Tip ·</strong> Drag bars to tune, or add a dimension we missed' },
  5: { ico: '✓', html: '<strong>Tip ·</strong> Your DNA travels across hotels, things to do and restaurants' },
};

function renderStepper(n) {
  const stepper = document.getElementById('dna-stepper');
  if (!stepper) return;
  const progress = n / STEP_LABELS.length;
  stepper.style.setProperty('--step-progress', progress.toFixed(3));
  stepper.innerHTML = STEP_LABELS.map((label, i) => {
    const num = i + 1;
    const cls = num < n ? 'done' : num === n ? 'active' : '';
    const inner = num < n ? '✓' : num;
    return `
      <div class="dna-stepper-item ${cls}">
        <span class="dna-stepper-num">${num}</span>
        <div class="dna-stepper-circle">${inner}</div>
        <span class="dna-stepper-label">${label}</span>
      </div>
    `;
  }).join('');
}

function renderTip(n) {
  const tip = document.getElementById('dna-tip');
  if (!tip) return;
  const t = STEP_TIPS[n];
  tip.innerHTML = `<span class="dna-tip-ico">${t.ico}</span><span>${t.html}</span>`;
}

function setStep(n) {
  state.step = n;
  document.querySelectorAll('.dna-step').forEach((s) => s.classList.remove('active'));
  document.getElementById(`dna-step-${n}`).classList.add('active');

  renderStepper(n);
  renderTip(n);

  document.getElementById('dna-back').disabled = n === 1;

  const next = document.getElementById('dna-next');
  if (n === 5) {
    next.innerHTML = `Activate &amp; plan my trip <span class="dna-next-arrow">→</span>`;
  } else if (n === 4) {
    next.innerHTML = `Looks right · continue <span class="dna-next-arrow">→</span>`;
  } else {
    next.innerHTML = `Next <span class="dna-next-arrow">→</span>`;
  }

  if (n === 2) renderTot();
  if (n === 3) renderHowy();
  if (n === 4) {
    if (!state.manuallyTuned) recomputeVec();
    renderRadar();
  }
  if (n === 5) renderActivate();

  gateNext();

  document.querySelector('.dna-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function gateNext(forceEnabled) {
  const next = document.getElementById('dna-next');
  if (state.step === 1) {
    const total = state.picked.size + state.customMoods.length;
    next.disabled = total < 3;
  } else if (state.step === 2) {
    next.disabled = Object.keys(state.totChoices).length < TOT_ROUNDS.length && !forceEnabled;
  } else {
    next.disabled = false;
  }
}

/* ============================================================
   Modal open / close / finish → opens existing Goa results flow
   ============================================================ */

function openModal() {
  document.getElementById('dna-modal').classList.add('open');
  setStep(1);
}

function closeModal() {
  document.getElementById('dna-modal').classList.remove('open');
}

function finishAndPersist() {
  const payload = {
    vec: state.vec,
    picks: [...state.picked],
    customMoods: state.customMoods,
    totChoices: state.totChoices,
    howy: state.howy,
    axes: state.axes,
    ts: Date.now(),
  };
  try { localStorage.setItem(DNA_KEY, JSON.stringify(payload)); } catch (e) {}
  closeModal();
  showBadge();
  showPersonalStrip();
  scheduleToasts();

  if (typeof window.showView === 'function') {
    window.showView(2);
    if (typeof window.renderHotels === 'function') window.renderHotels();
  }
}

/* ============================================================
   Persistent badge + personalized chips on homepage
   ============================================================ */

function showBadge() {
  document.getElementById('dna-badge').classList.add('show');
}

function showPersonalStrip() {
  const strip = document.getElementById('dna-personal-strip');
  const top = topDnaTags();
  strip.innerHTML = `
    <span class="dna-personal-label">Tuned for you ·</span>
    ${top.slice(0, 4).map((t) => {
      const [g, ...rest] = t.split(' ');
      return `<span class="dna-personal-chip"><span class="dna-personal-chip-ico">${g}</span>${rest.join(' ')}</span>`;
    }).join('')}
  `;
  strip.classList.add('show');
}

/* ============================================================
   Ambient learning toasts — fire periodically after activation
   ============================================================ */

const TOAST_BANK = [
  { eyebrow: 'DNA · just learned', text: 'You spent <strong>14s</strong> on the Casa Anjuna card — strengthened your <strong>quiet beach</strong> signal.' },
  { eyebrow: 'DNA · inferred', text: 'You skipped 3 nightlife stays. Down-weighting <strong>Baga / Calangute</strong> by 22%.' },
  { eyebrow: 'DNA · matched', text: 'Travelers with your DNA loved <strong>Coco Shambala</strong>. Pushed it up your list.' },
  { eyebrow: 'DNA · refined', text: 'Two heritage saves in a row — your <strong>Culture</strong> axis moved from 62 → 74.' },
  { eyebrow: 'DNA · suggestion', text: 'Your taste profile also fits <strong>Pondicherry</strong>. Want a peek?' },
];

let toastTimer = null;
let toastIdx = 0;

function scheduleToasts() {
  if (toastTimer) clearTimeout(toastTimer);
  const fire = () => {
    showToast(TOAST_BANK[toastIdx % TOAST_BANK.length]);
    toastIdx++;
    toastTimer = setTimeout(fire, 16000);
  };
  toastTimer = setTimeout(fire, 7000);
}

function showToast({ eyebrow, text }) {
  const t = document.getElementById('dna-toast');
  t.querySelector('.dna-toast-eyebrow').textContent = eyebrow;
  t.querySelector('.dna-toast-text').innerHTML = text;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), 8000);
}

/* ============================================================
   Wire up
   ============================================================ */

function hasDna() {
  try {
    const saved = JSON.parse(localStorage.getItem(DNA_KEY) || 'null');
    return !!(saved && saved.vec);
  } catch (e) { return false; }
}

/* Hijack the existing Search button + the post-parse Next button so
   the first time anyone tries to go to results, the Travel DNA flow
   opens instead. After activation, the original results flow runs
   exactly as before. */
function interceptSearchFlow() {
  const intercept = (e) => {
    if (hasDna()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openModal();
  };

  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) searchBtn.addEventListener('click', (e) => {
    if (!document.getElementById('search-input').value.trim()) return;
    intercept(e);
  }, true);

  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.addEventListener('click', intercept, true);
}

function bootDna() {
  renderMoodGrid();

  document.getElementById('dna-trigger').addEventListener('click', openModal);
  document.getElementById('dna-badge').addEventListener('click', openModal);
  document.getElementById('dna-close').addEventListener('click', closeModal);
  document.getElementById('dna-modal').addEventListener('click', (e) => {
    if (e.target.id === 'dna-modal') closeModal();
  });

  document.getElementById('dna-skip').addEventListener('click', closeModal);

  interceptSearchFlow();

  document.getElementById('dna-back').addEventListener('click', () => {
    if (state.step > 1) setStep(state.step - 1);
  });

  document.getElementById('dna-next').addEventListener('click', () => {
    if (state.step < 5) setStep(state.step + 1);
    else finishAndPersist();
  });

  const customInput = document.getElementById('mood-custom-input');
  const customAdd = document.getElementById('mood-custom-add');
  const submitCustom = () => {
    if (addCustomMood(customInput.value)) { customInput.value = ''; customAdd.disabled = true; }
  };
  customInput.addEventListener('input', () => { customAdd.disabled = !customInput.value.trim(); });
  customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitCustom(); } });
  customAdd.addEventListener('click', submitCustom);

  const axisInput = document.getElementById('dna-axis-add-input');
  const axisAdd = document.getElementById('dna-axis-add-btn');
  const submitAxis = () => {
    if (addCustomAxis(axisInput.value)) { axisInput.value = ''; axisAdd.disabled = true; }
  };
  axisInput.addEventListener('input', () => { axisAdd.disabled = !axisInput.value.trim(); });
  axisInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitAxis(); } });
  axisAdd.addEventListener('click', submitAxis);

  document.querySelector('.dna-toast-act.dismiss')?.addEventListener('click', () => {
    document.getElementById('dna-toast').classList.remove('show');
  });

  document.querySelector('.dna-toast-act.primary')?.addEventListener('click', () => {
    document.getElementById('dna-toast').classList.remove('show');
    openModal();
    setStep(4);
  });

  try {
    const saved = JSON.parse(localStorage.getItem(DNA_KEY) || 'null');
    if (saved?.vec) {
      state.vec = saved.vec;
      state.picked = new Set(saved.picks || []);
      state.customMoods = saved.customMoods || [];
      state.totChoices = saved.totChoices || {};
      state.howy = saved.howy || state.howy;
      if (saved.axes && saved.axes.length) state.axes = saved.axes;
      showBadge();
      showPersonalStrip();
      scheduleToasts();
    }
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootDna);
} else {
  bootDna();
}
