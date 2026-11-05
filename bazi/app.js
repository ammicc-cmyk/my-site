(function () {
  'use strict';
  const B = window.BaZi, T = window.BZT;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const EL_CLASS = B.ELEMENT_KEYS;
  const pad = n => String(n).padStart(2, '0');
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const n1 = n % 10; return n > 10 && n < 20 ? c : n1 > 1 && n1 < 5 ? b : n1 === 1 ? a : c; };

  let state = { step: 0, data: { name: '', gender: '', date: '', time: '', timeUnknown: false, place: null, ziRule: '23' } };

  const HOSTED = !/claude\.ai$|claudeusercontent\.com$/.test(location.hostname) && /^https?:$/.test(location.protocol);
  const APP_URL = location.origin + location.pathname;
  let installEvt = null;
  const STEPS = ['welcome', 'person', 'date', 'time', 'place'];
  const root = $('#app');

  // ---------- onboarding ----------
  function renderWizard() {
    const s = STEPS[state.step], d = state.data;
    const progress = state.step > 0 ? `<div class="progress" aria-label="Шаг ${state.step} из 4">${[1,2,3,4].map(i => `<span class="${i <= state.step ? 'on' : ''}"></span>`).join('')}</div>` : '';
    let body = '';
    if (s === 'welcome') {
      const saved = store.get('bazi.profiles', []);
      body = `
        <div class="hero">
          <div class="seal" aria-hidden="true">八字</div>
          <h1>Ба Цзы и фэншуй</h1>
          <p class="lead">Четыре столпа судьбы, баланс пяти стихий, такты удачи и ваши личные направления по фэншуй. Ответьте на четыре вопроса.</p>
        </div>
        <div class="stack">
          <button class="btn primary" id="go">Начать</button>
          <button class="btn ghost" id="demo">Посмотреть пример</button>
          ${HOSTED ? '<button class="btn ghost" id="shareApp">Поделиться приложением</button>' : ''}
        </div>
        ${HOSTED ? `<p class="tiny muted offline-note">${navigator.serviceWorker && navigator.serviceWorker.controller ? 'Сохранено на устройстве: работает без интернета.' : 'После первого открытия приложение будет работать без интернета.'}</p>` : ''}
        ${saved.length ? `<div class="saved"><h3>Сохранённые</h3>${saved.map((p, i) => `
          <div class="saved-row"><button class="link" data-open="${i}">${esc(p.name || 'Без имени')} · ${esc(p.date.split('-').reverse().join('.'))}</button>
          <button class="icon-btn" data-del="${i}" aria-label="Удалить">×</button></div>`).join('')}</div>` : ''}`;
    } else if (s === 'person') {
      body = `
        <h2>Кто вы?</h2>
        <p class="hint">Пол нужен для направления тактов удачи и числа Гуа: в классической системе они считаются по-разному для мужчин и женщин.</p>
        <label class="field"><span>Имя (необязательно)</span><input id="name" type="text" autocomplete="given-name" value="${esc(d.name)}" placeholder="Например, Анна"></label>
        <div class="field"><span>Пол</span>
          <div class="seg" role="radiogroup">
            <button role="radio" aria-checked="${d.gender === 'f'}" data-g="f" class="${d.gender === 'f' ? 'on' : ''}">Женский</button>
            <button role="radio" aria-checked="${d.gender === 'm'}" data-g="m" class="${d.gender === 'm' ? 'on' : ''}">Мужской</button>
          </div></div>`;
    } else if (s === 'date') {
      body = `
        <h2>Дата рождения</h2>
        <p class="hint">По григорианскому календарю, как в паспорте. Китайский год начинается не 1 января и не в Новый год по луне, а в день Личунь (около 4 февраля). Это учтётся автоматически.</p>
        <label class="field"><span>Дата</span><input id="date" type="date" min="1900-01-01" max="2100-12-31" value="${esc(d.date)}"></label>`;
    } else if (s === 'time') {
      body = `
        <h2>Время рождения</h2>
        <p class="hint">Местное время по часам, как в свидетельстве о рождении. Из него строится столп часа. Если время неизвестно, будет три столпа вместо четырёх.</p>
        <label class="field"><span>Время</span><input id="time" type="time" value="${esc(d.time)}" ${d.timeUnknown ? 'disabled' : ''}></label>
        <label class="check"><input id="tu" type="checkbox" ${d.timeUnknown ? 'checked' : ''}> Не знаю время рождения</label>`;
    } else if (s === 'place') {
      const p = d.place;
      body = `
        <h2>Место рождения</h2>
        <p class="hint">Город нужен для часового пояса того времени (включая летнее и декретное время) и долготы. По долготе вычисляется истинное солнечное время: в Ба Цзы час определяется по Солнцу, а не по часам.</p>
        <label class="field"><span>Город</span><input id="city" type="search" autocomplete="off" placeholder="Начните вводить название" value="${p && !p.manual ? esc(p.name) : ''}"></label>
        <div id="results" class="results" role="listbox"></div>
        ${p ? `<div class="picked">Выбрано: <b>${esc(p.name)}</b>${p.country ? ', ' + esc(p.country) : ''} · ${p.lon.toFixed(2)}° в.д. · ${p.tz ? esc(p.tz) : 'UTC' + (p.offset >= 0 ? '+' : '') + p.offset}</div>` : ''}
        <details class="manual" ${p && p.manual ? 'open' : ''}><summary>Указать координаты вручную</summary>
          <div class="grid2">
            <label class="field"><span>Долгота, ° (запад со знаком −)</span><input id="mlon" type="number" step="0.01" inputmode="decimal" value="${p && p.manual ? p.lon : ''}"></label>
            <label class="field"><span>Смещение от UTC, ч</span><input id="moff" type="number" step="0.5" inputmode="decimal" value="${p && p.manual ? p.offset : ''}"></label>
          </div>
          <p class="hint small">Учтите летнее/декретное время, действовавшее в момент рождения. Например, Москва летом 1985 года: UTC+4.</p>
          <button class="btn ghost small" id="mset">Применить</button>
        </details>`;
    }
    const nav = state.step > 0 ? `
      <div class="nav">
        <button class="btn ghost" id="back">Назад</button>
        <button class="btn primary" id="next" ${canNext() ? '' : 'disabled'}>${state.step === 4 ? 'Рассчитать' : 'Далее'}</button>
      </div>` : '';
    root.innerHTML = `<main class="wizard">${progress}<section class="card step">${body}</section>${nav}</main>`;
    bindWizard();
  }

  function canNext() {
    const d = state.data;
    switch (STEPS[state.step]) {
      case 'person': return !!d.gender;
      case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(d.date) && +d.date.slice(0, 4) >= 1900 && +d.date.slice(0, 4) <= 2100;
      case 'time': return d.timeUnknown || /^\d{2}:\d{2}/.test(d.time);
      case 'place': return !!d.place;
    }
    return true;
  }
  const refreshNext = () => { const n = $('#next'); if (n) n.disabled = !canNext(); };

  function bindWizard() {
    const d = state.data;
    const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
    on('#go', 'click', () => { state.step = 1; renderWizard(); });
    on('#shareApp', 'click', renderShareApp);
    on('#demo', 'click', () => showResult({ name: 'Пример', gender: 'f', date: '1990-08-15', time: '09:30', timeUnknown: false, ziRule: '23',
      place: { name: 'Москва', country: 'Россия', lon: 37.6173, lat: 55.7558, tz: 'Europe/Moscow' } }, false));
    root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => showResult(store.get('bazi.profiles', [])[+b.dataset.open], false)));
    root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const list = store.get('bazi.profiles', []); list.splice(+b.dataset.del, 1); store.set('bazi.profiles', list); renderWizard();
    }));
    on('#back', 'click', () => { state.step--; renderWizard(); });
    on('#next', 'click', () => { if (!canNext()) return; if (state.step === 4) showResult({ ...d }, true); else { state.step++; renderWizard(); } });
    on('#name', 'input', e => d.name = e.target.value);
    root.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { d.gender = b.dataset.g; renderWizard(); }));
    on('#date', 'input', e => { d.date = e.target.value; refreshNext(); });
    on('#time', 'input', e => { d.time = e.target.value; refreshNext(); });
    on('#tu', 'change', e => { d.timeUnknown = e.target.checked; renderWizard(); });
    on('#city', 'input', e => searchCity(e.target.value));
    on('#mset', 'click', () => {
      const lon = parseFloat($('#mlon').value), off = parseFloat($('#moff').value);
      if (isNaN(lon) || lon < -180 || lon > 180 || isNaN(off) || off < -12 || off > 14) { $('#mset').textContent = 'Проверьте значения'; return; }
      d.place = { name: 'Свои координаты', lon, offset: off, manual: true }; renderWizard();
    });
    const first = root.querySelector('input:not([type=checkbox]):not([disabled])');
    if (first && state.step > 0 && !first.value) setTimeout(() => first.focus({ preventScroll: true }), 50);
  }

  let searchSeq = 0;
  function searchCity(q) {
    const box = $('#results'); q = q.trim().toLowerCase();
    if (q.length < 2) { box.innerHTML = ''; return; }
    const local = window.BZ_CITIES.filter(c => c[0].toLowerCase().startsWith(q)).slice(0, 6)
      .map(c => ({ name: c[0], country: c[1], lat: c[2], lon: c[3], tz: c[4] }));
    paint(local, true);
    const seq = ++searchSeq;
    clearTimeout(searchCity.t);
    searchCity.t = setTimeout(() => {
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=ru&format=json`)
        .then(r => r.json()).then(j => {
          if (seq !== searchSeq) return;
          const remote = (j.results || []).filter(r => r.timezone).map(r => ({ name: r.name, country: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude, tz: r.timezone }));
          const seen = new Set(local.map(c => c.name + c.tz));
          paint(local.concat(remote.filter(r => !seen.has(r.name + r.tz))), false);
        }).catch(() => { if (seq === searchSeq) paint(local, false, true); });
    }, 300);
    function paint(list, loading, offline) {
      box.innerHTML = list.map((c, i) => `<button role="option" data-i="${i}"><b>${esc(c.name)}</b><span>${esc(c.country || '')}</span></button>`).join('')
        + (loading ? '<div class="muted small">Ищу по всему миру…</div>' : '')
        + (!list.length && !loading ? `<div class="muted small">${offline ? 'Поиск по миру недоступен без сети.' : 'Ничего не найдено.'} Укажите координаты вручную ниже.</div>` : '');
      box.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { state.data.place = list[+b.dataset.i]; renderWizard(); }));
    }
  }

  // ---------- results ----------
  function buildInput(d) {
    const [y, m, dd] = d.date.split('-').map(Number);
    const [hh, mi] = d.timeUnknown ? [12, 0] : d.time.split(':').map(Number);
    const p = d.place;
    return { year: y, month: m, day: dd, hour: hh, minute: mi, timeUnknown: d.timeUnknown, gender: d.gender,
      lon: p.lon, tz: p.tz || null, utcOffsetMin: p.tz ? 0 : Math.round(p.offset * 60), ziRule: d.ziRule || '23' };
  }

  let current = null, lastChart = null;
  function showResult(d, save, shared) {
    if (save) {
      const list = store.get('bazi.profiles', []).filter(p => !(p.name === d.name && p.date === d.date && p.time === d.time));
      list.unshift(d); store.set('bazi.profiles', list.slice(0, 12));
    }
    current = d;
    const c = B.computeChart(buildInput(d));
    root.innerHTML = renderResult(d, c, shared);
    lastChart = c;
    window.scrollTo(0, 0);
    bindShare(d, c);
    $('#again').addEventListener('click', () => { clearHash(); state = { step: 0, data: { name: '', gender: '', date: '', time: '', timeUnknown: false, place: null, ziRule: '23' } }; renderWizard(); window.scrollTo(0, 0); });
    root.querySelectorAll('[data-zi]').forEach(b => b.addEventListener('click', () => { current.ziRule = b.dataset.zi; showResult(current, false); }));
    root.querySelectorAll('.tabs a').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); const t = document.getElementById(a.dataset.t); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    const lp = root.querySelector('.luck .now'); if (lp) lp.parentElement.scrollLeft = lp.offsetLeft - 24;
  }

  const glyphS = (s, big) => `<span class="g el-${EL_CLASS[B.stemEl(s)]}${big ? ' big' : ''}">${B.STEMS[s]}</span>`;
  const glyphB = (b, big) => `<span class="g el-${EL_CLASS[B.BRANCH_EL[b]]}${big ? ' big' : ''}">${B.BRANCHES[b]}</span>`;
  const elName = e => `<span class="chip el-${EL_CLASS[e]}">${B.ELEMENTS[e]}</span>`;
  const stemDesc = s => `${B.isYang(s) ? 'Ян' : 'Инь'}-${B.ELEMENTS[B.stemEl(s)]}`;

  function renderResult(d, c, shared) {
    const dm = c.dm, dmT = T.dayMaster[dm];
    const known = !d.timeUnknown;
    const now = Date.now();
    const birthMs = c.utcMs;
    const ageNow = (now - birthMs) / (365.2425 * 864e5);
    const nowYear = B.currentSolarYear(now);

    // pillars table
    const cols = c.pillars.map(({ key, label, p }) => {
      if (!p) return `<div class="pcol empty"><div class="plabel">${label}</div><div class="pcell">?</div><div class="pcell">?</div><div class="tg">время неизвестно</div></div>`;
      const tgStem = key === 'day' ? 'Господин дня' : T.tenGods[B.tenGod(dm, p.stem)].ru;
      const hidden = B.HIDDEN[p.branch].map(s => `<span class="hs el-${EL_CLASS[B.stemEl(s)]}" title="${stemDesc(s)}">${B.STEMS[s]}<small>${T.tenGods[B.tenGod(dm, s)].ru}</small></span>`).join('');
      return `<div class="pcol${key === 'day' ? ' dm' : ''}">
        <div class="plabel">${label}</div>
        <div class="tg">${tgStem}</div>
        <div class="pcell">${glyphS(p.stem, true)}<small>${B.STEM_RU[p.stem]} · ${stemDesc(p.stem)}</small></div>
        <div class="pcell">${glyphB(p.branch, true)}<small>${B.BRANCH_RU[p.branch]} · ${B.ANIMALS[p.branch]}</small></div>
        <div class="hidden">${hidden}</div>
      </div>`;
    }).join('');

    // elements bars
    const maxS = Math.max(...c.score);
    const totalS = c.score.reduce((a, b) => a + b, 0);
    const bars = c.score.map((v, e) => `
      <div class="bar-row"><span class="bar-name">${B.ELEMENTS[e]}</span>
        <span class="bar"><i class="el-bg-${EL_CLASS[e]}" style="width:${(v / maxS * 100).toFixed(0)}%"></i></span>
        <span class="bar-val">${Math.round(v / totalS * 100)}%</span></div>`).join('');
    const st = T.strength[c.strength];

    // ten gods tally
    const tally = {};
    c.pillars.forEach(({ key, p }) => {
      if (!p) return;
      if (key !== 'day') tally[B.tenGod(dm, p.stem)] = (tally[B.tenGod(dm, p.stem)] || 0) + 1;
      B.HIDDEN[p.branch].forEach((s, i) => { const g = B.tenGod(dm, s); tally[g] = (tally[g] || 0) + (i === 0 ? 1 : 0.4); });
    });
    const tgSorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const monthMainGod = B.tenGod(dm, B.HIDDEN[c.pillars[2].p.branch][0]);
    const groups = {}; tgSorted.forEach(([g, v]) => { const gr = T.tenGods[g].group; groups[gr] = (groups[gr] || 0) + v; });
    const allGroups = ['Опора', 'Ресурс', 'Самовыражение', 'Богатство', 'Власть'];
    const missing = allGroups.filter(g => !groups[g]);

    // luck pillars
    const luck = c.luck.map((l, i) => {
      const isNow = ageNow >= l.age && ageNow < l.age + 10;
      return `<div class="lp${isNow ? ' now' : ''}">
        <div class="lp-age">${Math.floor(l.age)}–${Math.floor(l.age) + 9}</div>
        ${glyphS(l.p.stem)}${glyphB(l.p.branch)}
        <div class="lp-tg">${T.tenGods[B.tenGod(dm, l.p.stem)].ru}</div>
        <div class="lp-year">с ${l.fromYear}</div>
      </div>`;
    }).join('');

    // annual
    const natalB = c.pillars.filter(x => x.p).map(x => ({ label: x.label, b: x.p.branch }));
    const COMBO = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
    const annual = [0, 1, 2].map(k => {
      const y = nowYear + k, p = B.yearPillar(y);
      const g = B.tenGod(dm, p.stem);
      const clashes = natalB.filter(x => (x.b - p.branch + 12) % 12 === 6).map(x => x.label.toLowerCase());
      const combos = natalB.filter(x => COMBO.some(([a, b2]) => (a === x.b && b2 === p.branch) || (b2 === x.b && a === p.branch))).map(x => x.label.toLowerCase());
      const fav = c.favorable.includes(B.stemEl(p.stem)), unfav = c.unfavorable.includes(B.stemEl(p.stem));
      return `<div class="year-card">
        <div class="yc-head"><b>${y}</b> ${glyphS(p.stem)}${glyphB(p.branch)} <span class="muted">${stemDesc(p.stem)} ${B.ANIMALS[p.branch]}</span></div>
        <p><b>${T.tenGods[g].ru}</b> (${T.tenGods[g].han}). ${T.tenGods[g].text}</p>
        <p class="small">${fav ? '<span class="tag good">благоприятная стихия года</span>' : unfav ? '<span class="tag bad">напряжённая стихия года</span>' : '<span class="tag">нейтральная стихия года</span>'}
        ${clashes.length ? `<span class="tag bad">столкновение со столпом: ${clashes.join(', ')}</span>` : ''}
        ${combos.length ? `<span class="tag good">союз со столпом: ${combos.join(', ')}</span>` : ''}</p>
        <p class="tiny muted">Год ${y} начинается в Личунь, около 4 февраля.</p>
      </div>`;
    }).join('');

    // zodiac
    const yb = c.pillars[3].p.branch;
    const trioOf = b => [[8,0,4],[2,6,10],[5,9,1],[11,3,7]].find(t => t.includes(b));
    const COMBO_PARTNER = { 0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6 };
    const allies = trioOf(yb).filter(b => b !== yb).map(b => B.ANIMALS[b]).concat(B.ANIMALS[COMBO_PARTNER[yb]]);
    const clashA = B.ANIMALS[(yb + 6) % 12];

    // feng shui
    const kua = B.kua(c.solarYear, d.gender);
    const dirs = B.KUA_DIRS[kua];
    const east = [1, 3, 4, 9].includes(kua);
    const dirInfo = {}; dirs.forEach((dir, i) => dirInfo[dir] = i);
    const GRID = [['ЮВ','Ю','ЮЗ'],['В','Ц','З'],['СВ','С','СЗ']];
    const DIR_FULL = { 'С':'Север','СВ':'Северо-восток','В':'Восток','ЮВ':'Юго-восток','Ю':'Юг','ЮЗ':'Юго-запад','З':'Запад','СЗ':'Северо-запад','Ц':'Центр' };
    const kuaGrid = GRID.map(row => row.map(dir => {
      if (dir === 'Ц') return `<div class="cell center"><b>${kua}</b><small>Гуа</small></div>`;
      const i = dirInfo[dir], t = T.kuaDirs[i];
      return `<div class="cell ${t.good ? 'good' : 'bad'}"><b>${dir}</b><small>${t.ru}</small><i>${i < 4 ? '+' + (4 - i) : '−' + (i - 3)}</i></div>`;
    }).join('')).join('');
    const kuaList = dirs.map((dir, i) => `<li class="${T.kuaDirs[i].good ? 'good' : 'bad'}"><b>${DIR_FULL[dir]}</b> · ${T.kuaDirs[i].ru} ${T.kuaDirs[i].han}<br><span>${T.kuaDirs[i].text}</span></li>`).join('');
    const fly = B.annualStars(nowYear);
    const flyGrid = GRID.map(row => row.map(dir => {
      const n = fly.map[dir], s = T.stars[n];
      return `<div class="cell ${s.tone}"><b>${n}</b><small>${DIR_FULL[dir]}</small></div>`;
    }).join('')).join('');
    const flyList = ['Ц','С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'].map(dir => {
      const n = fly.map[dir], s = T.stars[n];
      return `<li class="${s.tone}"><b>${DIR_FULL[dir]}: ${n}, ${s.name}.</b> <span>${s.text}</span></li>`;
    }).join('');

    const favEls = c.favorable.map(e => elName(e)).join(' ');
    const favTips = c.favorable.slice(0, 2).map(e => `<li>${elName(e)} Цвета: ${T.elements[e].colors}. Предметы: ${T.elements[e].items}. Сфера: ${T.elements[e].career}.</li>`).join('');

    const stars = c.stars.map(s => `<li class="${s.found.length ? 'has' : ''}"><b>${s.name}</b>: ветвь ${s.branches.map(b => B.BRANCHES[b] + ' (' + B.ANIMALS[b] + ')').join(' или ')}.
      ${s.found.length ? `<span class="tag good">есть в карте: ${s.found.join(', ').toLowerCase()}</span>` : '<span class="tag">в карте нет</span>'}
      <br><span class="muted small">${T.starsSym[s.id]}</span></li>`).join('');
    const inter = c.interactions.length ? c.interactions.map(x => `<li class="${x.type === 'clash' ? 'bad' : 'good'}">${x.text}</li>`).join('') : '<li>Явных союзов и столкновений между ветвями нет.</li>';

    const ts = c.trueSolar;
    const off = c.offsetMin / 60;
    const title = d.name ? esc(d.name) : 'Ваша карта';
    const bdate = d.date.split('-').reverse().join('.');

    return `
    <header class="res-head">
      <div><h1>${title}</h1>
      <p class="muted">${bdate}${known ? ', ' + d.time : ', время неизвестно'} · ${esc(d.place.name)} · ${d.gender === 'f' ? 'жен.' : 'муж.'}</p></div>
      <button class="btn ghost small" id="again">Новый расчёт</button>
    </header>
    ${shared ? `<div class="banner">Эту карту вам отправили по ссылке. <button class="link accent" id="saveShared">Сохранить на этом устройстве</button></div>` : ''}
    <nav class="tabs" aria-label="Разделы">
      <a href="#s-pillars" data-t="s-pillars">Столпы</a><a href="#s-dm" data-t="s-dm">Я</a><a href="#s-el" data-t="s-el">Стихии</a>
      <a href="#s-luck" data-t="s-luck">Удача</a><a href="#s-year" data-t="s-year">Год</a><a href="#s-fs" data-t="s-fs">Фэншуй</a><a href="#s-share" data-t="s-share">Отправить</a>
    </nav>
    <main class="results">
      <section id="s-pillars" class="card">
        <h2>Четыре столпа <span class="han">四柱</span></h2>
        <div class="pillars">${cols}</div>
        <p class="tiny muted">Стебель сверху, ветвь снизу, под ветвью скрытые стебли. Подпись над стеблем: его роль («бог») по отношению к Господину дня.</p>
      </section>

      <section id="s-dm" class="card">
        <h2>Господин дня <span class="han">日主</span></h2>
        <div class="dm-row">${glyphS(dm, true)}<div><b>${B.STEM_RU[dm]}, ${stemDesc(dm)}</b><br><span class="muted">Образ: ${dmT.img}</span></div></div>
        <p>${dmT.text}</p>
        <p><b>Тень:</b> ${dmT.shadow}</p>
        <h3>Структура месяца</h3>
        <p>Главная энергия месяца рождения для вас — <b>${T.tenGods[monthMainGod].ru}</b> (${T.tenGods[monthMainGod].han}). ${T.tenGods[monthMainGod].text}</p>
        <h3>Ведущие энергии карты</h3>
        <ul class="list">${tgSorted.slice(0, 3).map(([g]) => `<li><b>${T.tenGods[g].ru}</b> <span class="han">${T.tenGods[g].han}</span>, группа «${T.tenGods[g].group}». ${T.tenGods[g].text}</li>`).join('')}</ul>
        ${missing.length ? `<p class="small">В карте не выражены группы: <b>${missing.join(', ')}</b>. Эти темы даются через усилие или приходят с тактами удачи.</p>` : ''}
      </section>

      <section id="s-el" class="card">
        <h2>Пять стихий <span class="han">五行</span></h2>
        <div class="bars">${bars}</div>
        <p class="tiny muted">С учётом скрытых стеблей; ветвь месяца весит вдвое больше, как определяющая сезон.</p>
        <h3>${st.title}</h3>
        <p>Поддержка ${Math.round(c.supportRatio * 100)}%${c.inSeason ? ', рождены в свой сезон' : ', рождены не в свой сезон'}. ${st.text}</p>
        <p><b>Полезные стихии:</b> ${favEls}</p>
        <p><b>Лишние стихии:</b> ${c.unfavorable.map(elName).join(' ')}</p>
        <ul class="list">${favTips}</ul>
        <h3>Взаимодействия ветвей</h3>
        <ul class="list">${inter}</ul>
        <h3>Символические звёзды</h3>
        <ul class="list">${stars}</ul>
      </section>

      <section id="s-luck" class="card">
        <h2>Такты удачи <span class="han">大运</span></h2>
        <p>Счёт идёт <b>${c.forward ? 'вперёд' : 'назад'}</b>, первый такт начинается в <b>${c.startY} ${plural(c.startY, 'год', 'года', 'лет')}${c.startM ? ' ' + c.startM + ' мес.' : ''}</b>. Каждый такт длится 10 лет.</p>
        <div class="luck">${luck}</div>
        <p class="tiny muted">Выделен текущий такт. Подпись: роль стебля такта для вас.</p>
      </section>

      <section id="s-year" class="card">
        <h2>Ближайшие годы <span class="han">流年</span></h2>
        <div class="years">${annual}</div>
        <h3>Ваш знак года: ${B.ANIMALS[yb]} (${B.BRANCHES[yb]})</h3>
        <p>Союзники: ${allies.join(', ')}. Противоположный знак: ${clashA}.</p>
      </section>

      <section id="s-fs" class="card">
        <h2>Фэншуй: число Гуа <span class="han">命卦</span></h2>
        <div class="dm-row"><div class="kua">${kua}</div><div><b>Триграмма ${B.KUA_TRIGRAM[kua]}</b>, стихия ${elName(B.KUA_EL[kua])}<br>
          <span class="muted">${east ? 'Восточная группа: подходят дома с фасадом на С, Ю, В, ЮВ' : 'Западная группа: подходят дома с фасадом на З, СЗ, СВ, ЮЗ'}</span></div></div>
        <div class="compass">${kuaGrid}</div>
        <p class="tiny muted">Юг сверху, как на китайских схемах. «+4» лучшее направление, «−4» худшее.</p>
        <ul class="list dirs">${kuaList}</ul>
        <h3>Как применить</h3>
        <ul class="list">
          <li>Сидите за рабочим столом лицом на <b>${DIR_FULL[dirs[0]].toLowerCase()}</b> (Шэн Ци) или <b>${DIR_FULL[dirs[3]].toLowerCase()}</b> (Фу Вэй).</li>
          <li>Спите изголовьем на <b>${DIR_FULL[dirs[1]].toLowerCase()}</b> (Тянь И), паре подходит <b>${DIR_FULL[dirs[2]].toLowerCase()}</b> (Янь Нянь).</li>
          <li>Избегайте изголовья и рабочего места в сторону <b>${DIR_FULL[dirs[7]].toLowerCase()}</b> (Цзюэ Мин).</li>
        </ul>
      </section>

      <section class="card">
        <h2>Летящие звёзды ${nowYear} <span class="han">流年飞星</span></h2>
        <p>Годовая карта для любого дома. В центре звезда ${fly.center}. Наложите на план квартиры по компасу.</p>
        <div class="compass stars">${flyGrid}</div>
        <ul class="list">${flyList}</ul>
      </section>

      <section id="s-share" class="card share">
        <h2>Отправить результат</h2>
        <p class="small muted">Картинка и текст уходят через системное меню «Поделиться»: Telegram, MAX, WhatsApp, почта${HOSTED ? '. В тексте будет ссылка, по которой получатель откроет полную карту' : ''}.</p>
        <div class="share-grid">
          <button class="btn primary" id="shImg">Картинкой</button>
          <button class="btn ghost" id="shText">Текстом</button>
          <a class="btn ghost" id="shTg" href="#" target="_blank" rel="noopener">Telegram</a>
          <button class="btn ghost" id="shCopy">Скопировать</button>
        </div>
        <p class="tiny muted" id="shStatus" role="status"></p>
      </section>

      <section class="card tech">
        <h2>Детали расчёта</h2>
        <dl>
          <dt>Время по часам</dt><dd>${bdate} ${known ? d.time : '—'} (UTC${off >= 0 ? '+' : ''}${off})</dd>
          <dt>Истинное солнечное</dt><dd>${known ? `${pad(ts.d)}.${pad(ts.m)}.${ts.y} ${pad(ts.h)}:${pad(ts.mi)}` : 'не используется'}</dd>
          <dt>Поправки</dt><dd>долгота ${(c.lmtCorr - off * 60 >= 0 ? '+' : '') + Math.round(c.lmtCorr - off * 60)} мин, уравнение времени ${(c.eot >= 0 ? '+' : '') + c.eot.toFixed(1)} мин</dd>
          <dt>Долгота Солнца</dt><dd>${c.sunLon.toFixed(2)}°</dd>
          <dt>Солнечный год</dt><dd>${c.solarYear}</dd>
        </dl>
        ${known ? `<div class="field"><span>Начало дня (час Цзы 23:00–01:00)</span><div class="seg">
          <button data-zi="23" class="${current.ziRule !== '00' ? 'on' : ''}">с 23:00</button>
          <button data-zi="00" class="${current.ziRule === '00' ? 'on' : ''}">с 00:00</button></div></div>
          <p class="tiny muted">Школы расходятся. Влияет только на рождённых между 23:00 и 00:00 по солнечному времени.</p>` : ''}
        <p class="tiny muted">Ба Цзы и фэншуй — традиционные китайские системы, а не наука. Используйте как повод для размышлений, а не для решений о здоровье и деньгах. Сила Господина дня рассчитана упрощённо; мастера учитывают больше факторов.</p>
      </section>
    </main>`;
  }

  const fromHash = decodeChart(location.hash);
  if (fromHash) showResult(fromHash, false, true); else renderWizard();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  window.addEventListener('hashchange', () => { const h = decodeChart(location.hash); if (h) showResult(h, false, true); });
  if ('serviceWorker' in navigator && HOSTED && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }


  // ---------- share links ----------
  function encodeChart(d) {
    const p = d.place;
    const o = { n: d.name || '', g: d.gender, d: d.date, t: d.timeUnknown ? '' : d.time, z: d.ziRule === '00' ? 0 : 1,
      p: p.manual ? [p.name, '', 0, +p.lon.toFixed(3), '', p.offset] : [p.name, p.country || '', +(p.lat || 0).toFixed(3), +p.lon.toFixed(3), p.tz] };
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeChart(hash) {
    const m = /^#c=([A-Za-z0-9_-]+)$/.exec(hash || ''); if (!m) return null;
    try {
      const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.d) || !['m', 'f'].includes(o.g) || !Array.isArray(o.p)) return null;
      const [name, country, lat, lon, tz, offset] = o.p;
      if (typeof lon !== 'number' || Math.abs(lon) > 180) return null;
      const place = tz ? { name: String(name), country: String(country), lat, lon, tz: String(tz) } : { name: String(name), lon, offset: +offset, manual: true };
      if (tz) { try { new Intl.DateTimeFormat('en', { timeZone: place.tz }); } catch (e) { return null; } }
      return { name: String(o.n || '').slice(0, 60), gender: o.g, date: o.d, time: o.t || '', timeUnknown: !o.t, ziRule: o.z === 0 ? '00' : '23', place };
    } catch (e) { return null; }
  }
  function clearHash() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); }
  const chartLink = d => APP_URL + '#c=' + encodeChart(d);

  // ---------- summary ----------
  function summary(d, c) {
    const dm = c.dm, ageNow = (Date.now() - c.utcMs) / (365.2425 * 864e5);
    const pil = c.pillars.slice().reverse().map(x => x.p ? B.STEMS[x.p.stem] + B.BRANCHES[x.p.branch] : '??');
    const cur = c.luck.find(l => ageNow >= l.age && ageNow < l.age + 10);
    const kua = B.kua(c.solarYear, d.gender), dirs = B.KUA_DIRS[kua];
    const DIRF = { 'С':'север','СВ':'северо-восток','В':'восток','ЮВ':'юго-восток','Ю':'юг','ЮЗ':'юго-запад','З':'запад','СЗ':'северо-запад' };
    const nowY = B.currentSolarYear(Date.now()), yp = B.yearPillar(nowY);
    const lines = [
      `Ба Цзы${d.name ? ': ' + d.name : ''}`,
      `${d.date.split('-').reverse().join('.')}${d.timeUnknown ? ', время неизвестно' : ', ' + d.time}, ${d.place.name}`,
      '',
      `Столпы (год · месяц · день · час): ${pil.join(' · ')}`,
      `Господин дня: ${B.STEMS[dm]} ${B.isYang(dm) ? 'Ян' : 'Инь'}-${B.ELEMENTS[B.stemEl(dm)]} (${T.dayMaster[dm].img.toLowerCase()})`,
      `${T.strength[c.strength].title}. Полезные стихии: ${c.favorable.map(e => B.ELEMENTS[e]).join(', ')}`,
      `Знак года: ${B.ANIMALS[c.pillars[3].p.branch]}`,
      cur ? `Текущий такт удачи: ${B.STEMS[cur.p.stem]}${B.BRANCHES[cur.p.branch]}, ${T.tenGods[B.tenGod(dm, cur.p.stem)].ru} (${Math.floor(cur.age)}–${Math.floor(cur.age) + 9} лет)` : '',
      `${nowY} год ${B.STEMS[yp.stem]}${B.BRANCHES[yp.branch]}: ${T.tenGods[B.tenGod(dm, yp.stem)].ru}`,
      '',
      `Фэншуй: число Гуа ${kua}, ${[1,3,4,9].includes(kua) ? 'восточная' : 'западная'} группа`,
      `Лучшие направления: ${dirs.slice(0, 4).map(x => DIRF[x]).join(', ')}`,
      `Худшее: ${DIRF[dirs[7]]}`,
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '');
    return lines.join('\n');
  }

  // ---------- image card ----------
  async function renderCard(d, c) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    try { await Promise.all(['500 80px "Noto Serif SC"', '700 60px Alegreya', '400 30px "Golos Text"', '600 30px "Golos Text"'].map(f => document.fonts.load(f, f.includes('SC') ? '甲子' : 'Аа'))); } catch (e) {}
    const C = { bg: '#eef0ea', card: '#fbfbf8', fg: '#1d2421', muted: '#5f6a64', line: '#d7dbd2', accent: '#a8322a', el: ['#2f7d4f', '#c13a28', '#9a7428', '#6c7480', '#245a8c'] };
    const HAN = '"Noto Serif SC", "Songti SC", "Noto Serif CJK SC", serif', DISP = 'Alegreya, Georgia, serif', BODY = '"Golos Text", -apple-system, Roboto, sans-serif';
    x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
    x.fillStyle = C.accent; x.fillRect(0, 0, W, 14);
    x.fillStyle = C.fg; x.font = `700 64px ${DISP}`; x.textBaseline = 'alphabetic';
    x.fillText(d.name || 'Карта Ба Цзы', 70, 130);
    x.fillStyle = C.muted; x.font = `400 32px ${BODY}`;
    x.fillText(`${d.date.split('-').reverse().join('.')}${d.timeUnknown ? ', время неизвестно' : ', ' + d.time} · ${d.place.name}`, 70, 182);
    // pillars
    const cols = c.pillars, cw = 220, gap = 20, x0 = (W - (cw * 4 + gap * 3)) / 2, y0 = 230;
    cols.forEach(({ key, label, p }, i) => {
      const cx = x0 + i * (cw + gap);
      x.fillStyle = C.card; roundRect(x, cx, y0, cw, 470, 24); x.fill();
      if (key === 'day') { x.strokeStyle = C.accent; x.lineWidth = 5; roundRect(x, cx, y0, cw, 470, 24); x.stroke(); }
      x.textAlign = 'center'; x.fillStyle = C.muted; x.font = `600 26px ${BODY}`;
      x.fillText(label.toUpperCase(), cx + cw / 2, y0 + 50);
      if (!p) { x.fillStyle = C.line; x.font = `400 120px ${DISP}`; x.fillText('?', cx + cw / 2, y0 + 300); return; }
      x.fillStyle = C.fg; x.font = `400 24px ${BODY}`;
      const lab = key === 'day' ? 'Господин дня' : T.tenGods[B.tenGod(c.dm, p.stem)].ru;
      for (let fs = 24; fs > 15 && x.measureText(lab).width > cw - 20; fs--) x.font = `400 ${fs - 1}px ${BODY}`;
      x.fillText(lab, cx + cw / 2, y0 + 92);
      x.font = `500 136px ${HAN}`;
      x.fillStyle = C.el[B.stemEl(p.stem)]; x.fillText(B.STEMS[p.stem], cx + cw / 2, y0 + 245);
      x.fillStyle = C.el[B.BRANCH_EL[p.branch]]; x.fillText(B.BRANCHES[p.branch], cx + cw / 2, y0 + 405);
      x.fillStyle = C.muted; x.font = `400 24px ${BODY}`;
      x.fillText(B.ANIMALS[p.branch], cx + cw / 2, y0 + 448);
    });
    x.textAlign = 'left';
    // day master + elements
    let y = 780; const dm = c.dm;
    x.fillStyle = C.fg; x.font = `700 44px ${DISP}`;
    x.fillText(`${B.isYang(dm) ? 'Ян' : 'Инь'}-${B.ELEMENTS[B.stemEl(dm)]}: ${T.dayMaster[dm].img.toLowerCase()}`, 70, y);
    x.fillStyle = C.muted; x.font = `400 30px ${BODY}`;
    x.fillText(`${T.strength[c.strength].title}. Полезно: ${c.favorable.map(e => B.ELEMENTS[e].toLowerCase()).join(', ')}`, 70, y + 50);
    const tot = c.score.reduce((a, b) => a + b, 0), mx = Math.max(...c.score);
    c.score.forEach((v, e) => {
      const by = 880 + e * 52;
      x.fillStyle = C.fg; x.font = `400 28px ${BODY}`; x.fillText(B.ELEMENTS[e], 70, by + 24);
      x.fillStyle = C.line; roundRect(x, 260, by, 640, 26, 13); x.fill();
      x.fillStyle = C.el[e]; roundRect(x, 260, by, Math.max(26, 640 * v / mx), 26, 13); x.fill();
      x.fillStyle = C.muted; x.textAlign = 'right'; x.fillText(Math.round(v / tot * 100) + '%', 1010, by + 24); x.textAlign = 'left';
    });
    // kua
    const kua = B.kua(c.solarYear, d.gender), dirs = B.KUA_DIRS[kua];
    y = 1180;
    x.fillStyle = C.accent; x.beginPath(); x.arc(115, y, 45, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.font = `700 54px ${DISP}`; x.textAlign = 'center'; x.fillText(String(kua), 115, y + 18); x.textAlign = 'left';
    x.fillStyle = C.fg; x.font = `600 32px ${BODY}`; x.fillText(`Число Гуа ${kua}, ${[1,3,4,9].includes(kua) ? 'восточная' : 'западная'} группа`, 185, y - 8);
    x.fillStyle = C.muted; x.font = `400 28px ${BODY}`; x.fillText(`Лучшие направления: ${dirs.slice(0, 4).join(', ')}`, 185, y + 34);
    x.fillStyle = C.muted; x.font = `400 24px ${BODY}`;
    x.fillText(HOSTED ? APP_URL.replace(/^https?:\/\//, '') : 'Ба Цзы и фэншуй', 70, H - 40);
    return new Promise(r => cv.toBlob(r, 'image/png'));
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  // ---------- share actions ----------
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove(); return ok;
    }
  }
  function bindShare(d, c) {
    const status = $('#shStatus'), say = t => { if (status) status.textContent = t; };
    const link = HOSTED ? chartLink(d) : '';
    const text = summary(d, c);
    const full = link ? text + '\n\nПолная карта: ' + link : text;
    const tg = $('#shTg');
    if (tg) {
      if (link) tg.href = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text);
      else tg.href = 'https://t.me/share/url?url=' + encodeURIComponent('Ба Цзы') + '&text=' + encodeURIComponent(text);
    }
    const saveBtn = $('#saveShared');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const list = store.get('bazi.profiles', []).filter(p => !(p.name === d.name && p.date === d.date && p.time === d.time));
      list.unshift(d); store.set('bazi.profiles', list.slice(0, 12)); saveBtn.parentElement.textContent = 'Сохранено. Карта появится в списке на главном экране.';
    });
    $('#shText').addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share(link ? { title: 'Ба Цзы', text: text + '\n\nПолная карта:', url: link } : { title: 'Ба Цзы', text }); say(''); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      say(await copyText(full) ? 'Текст скопирован. Вставьте его в чат.' : 'Не удалось скопировать.');
    });
    $('#shCopy').addEventListener('click', async () => say(await copyText(full) ? 'Текст и ссылка скопированы. Вставьте в Telegram, MAX или любой чат.' : 'Не удалось скопировать.'));
    $('#shImg').addEventListener('click', async () => {
      say('Готовлю картинку…');
      const blob = await renderCard(d, c);
      if (!blob) { say('Не удалось создать картинку.'); return; }
      const file = new File([blob], `bazi-${d.date}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share(link ? { files: [file], text: 'Моя карта Ба Цзы: ' + link } : { files: [file] }); say(''); return; }
        catch (e) { if (e && e.name === 'AbortError') { say(''); return; } }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      say('Картинка сохранена. Отправьте её из галереи или «Файлов».');
    });
  }

  // ---------- share the app ----------
  function renderShareApp() {
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let qr = '';
    try { const q = qrcode(0, 'M'); q.addData(APP_URL); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    root.innerHTML = `<main class="wizard"><section class="card step">
      <h2>Поделиться приложением</h2>
      <p class="hint">Отправьте ссылку или дайте отсканировать QR-код камерой. Работает на iPhone и Android, устанавливать ничего не нужно.</p>
      <div class="qr" aria-label="QR-код ссылки на приложение">${qr}</div>
      <p class="url">${esc(APP_URL)}</p>
      <div class="share-grid">
        <button class="btn primary" id="saShare">Отправить ссылку</button>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent('Ба Цзы и фэншуй: карта по дате рождения')}">Telegram</a>
        <button class="btn ghost wide" id="saCopy">Скопировать ссылку</button>
      </div>
      <p class="tiny muted" id="saStatus" role="status"></p>
      ${standalone ? '' : `<h3>Добавить на экран «Домой»</h3>
      ${isIOS ? '<p class="small">В Safari нажмите «Поделиться» (квадрат со стрелкой) → «На экран „Домой“». Приложение появится с иконкой и будет работать без интернета.</p>'
        : `<p class="small">В Chrome откройте меню ⋮ → «Установить приложение» или «Добавить на главный экран».</p>${installEvt ? '<button class="btn ghost" id="saInstall">Установить</button>' : ''}`}`}
      </section><div class="nav"><button class="btn ghost" id="back" style="grid-column: 1 / -1">Назад</button></div></main>`;
    const say = t => $('#saStatus').textContent = t;
    $('#back').addEventListener('click', renderWizard);
    $('#saCopy').addEventListener('click', async () => say(await copyText(APP_URL) ? 'Ссылка скопирована.' : 'Не удалось скопировать.'));
    $('#saShare').addEventListener('click', async () => {
      if (navigator.share) { try { await navigator.share({ title: 'Ба Цзы и фэншуй', text: 'Карта Ба Цзы и фэншуй по дате рождения', url: APP_URL }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      say(await copyText(APP_URL) ? 'Ссылка скопирована.' : 'Не удалось скопировать.');
    });
    const ib = $('#saInstall'); if (ib) ib.addEventListener('click', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; ib.remove(); });
    window.scrollTo(0, 0);
  }

})();
