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
        </div>
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

  let current = null;
  function showResult(d, save) {
    if (save) {
      const list = store.get('bazi.profiles', []).filter(p => !(p.name === d.name && p.date === d.date && p.time === d.time));
      list.unshift(d); store.set('bazi.profiles', list.slice(0, 12));
    }
    current = d;
    const c = B.computeChart(buildInput(d));
    root.innerHTML = renderResult(d, c);
    window.scrollTo(0, 0);
    $('#again').addEventListener('click', () => { state = { step: 0, data: { name: '', gender: '', date: '', time: '', timeUnknown: false, place: null, ziRule: '23' } }; renderWizard(); window.scrollTo(0, 0); });
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

  function renderResult(d, c) {
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
    <nav class="tabs" aria-label="Разделы">
      <a href="#s-pillars" data-t="s-pillars">Столпы</a><a href="#s-dm" data-t="s-dm">Я</a><a href="#s-el" data-t="s-el">Стихии</a>
      <a href="#s-luck" data-t="s-luck">Удача</a><a href="#s-year" data-t="s-year">Год</a><a href="#s-fs" data-t="s-fs">Фэншуй</a>
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

  renderWizard();
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
