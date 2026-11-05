/* Ba Zi / Feng Shui calculation engine. No dependencies. */
(function (root) {
  'use strict';
  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const STEM_RU = ['Цзя','И','Бин','Дин','У','Цзи','Гэн','Синь','Жэнь','Гуй'];
  const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const BRANCH_RU = ['Цзы','Чоу','Инь','Мао','Чэнь','Сы','У','Вэй','Шэнь','Ю','Сюй','Хай'];
  const ANIMALS = ['Крыса','Бык','Тигр','Кролик','Дракон','Змея','Лошадь','Коза','Обезьяна','Петух','Собака','Свинья'];
  const ELEMENTS = ['Дерево','Огонь','Земля','Металл','Вода'];
  const ELEMENT_KEYS = ['wood','fire','earth','metal','water'];
  const BRANCH_EL = [4,2,0,0,2,1,1,2,3,3,2,4];
  // hidden stems, main qi first
  const HIDDEN = [[9],[5,9,7],[0,2,4],[1],[4,1,9],[2,4,6],[3,5],[5,3,1],[6,8,4],[7],[4,7,3],[8,0]];
  const HIDDEN_W = {1:[1],2:[0.7,0.3],3:[0.6,0.3,0.1]};

  const stemEl = s => Math.floor(s / 2);
  const isYang = s => s % 2 === 0;
  const mod = (a, n) => ((a % n) + n) % n;
  const D2R = Math.PI / 180;

  // ---------- astronomy ----------
  function jdFromUnixMs(ms) { return ms / 86400000 + 2440587.5; }
  function unixMsFromJd(jd) { return (jd - 2440587.5) * 86400000; }
  function deltaTdays(year) { // rough ΔT (TT−UT), seconds → days
    const sec = year < 1950 ? 25 : Math.min(70, 29 + 0.6 * (year - 1950));
    return sec / 86400;
  }
  // Truncated VSOP87D (Earth heliocentric longitude), coefficients ×1e-8 rad, τ in Julian millennia TT
  const VL = [
    [[175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261,12566.1517],[3497,2.7441,5753.3849],
     [3418,2.8289,3.5231],[3136,3.6277,77713.7715],[2676,4.4181,7860.4194],[2343,6.1352,3930.2097],
     [1324,0.7425,11506.7698],[1273,2.0371,529.691],[1199,1.1096,1577.3435],[990,5.233,5884.927],
     [902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],[753,2.533,5507.553],[505,4.583,18849.228],
     [492,4.205,775.523],[357,2.92,0.067],[317,5.849,11790.629],[284,1.899,796.298],[271,0.315,10977.079],
     [243,0.345,5486.778],[206,4.806,2544.314],[205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299],
     [132,3.411,2942.463],[126,1.083,20.775],[115,0.645,0.98],[103,0.636,4694.003],[102,0.976,15720.839],
     [102,4.267,7.114],[99,6.21,2146.17],[98,0.68,155.42],[86,5.98,161000.69],[85,1.3,6275.96],
     [85,3.67,71430.7],[80,1.81,17260.15]],
    [[628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],[425,1.59,3.523],
     [119,5.796,26.298],[109,2.966,1577.344],[93,2.59,18849.23],[72,1.14,529.69],[68,1.87,398.15],
     [67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],[45,0.4,796.3],[36,0.47,775.52],[29,2.65,7.11],
     [21,5.34,0.98],[19,1.85,5486.78],[19,4.97,213.3],[17,2.99,6275.96],[16,0.03,2544.31]],
    [[52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],[27,0.05,3.52],[16,5.19,26.3],[16,3.68,155.42],
     [10,0.76,18849.23],[9,2.06,77713.77],[7,0.83,775.52],[5,4.66,1577.34]],
    [[289,5.844,6283.076],[35,0,0],[17,5.49,12566.15]],
    [[114,3.142,0],[8,4.13,6283.08]],
    [[1,3.14,0]],
  ];
  function sunLongitude(jdUT) { // apparent geocentric ecliptic longitude of the Sun, degrees
    const jde = jdUT + deltaTdays(2000 + (jdUT - 2451545) / 365.25);
    const tau = (jde - 2451545.0) / 365250, T = tau * 10;
    let L = 0, tp = 1;
    for (const series of VL) { let sum = 0; for (const [a, b, c] of series) sum += a * Math.cos(b + c * tau); L += sum * tp; tp *= tau; }
    L = L / 1e8 / D2R + 180;
    const omega = (125.04452 - 1934.136261 * T) * D2R;
    const Ls = (280.4665 + 36000.7698 * T) * D2R, Lm = (218.3165 + 481267.8813 * T) * D2R;
    const dpsi = (-17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * omega)) / 3600;
    return mod(L - 0.09033 / 3600 + dpsi - 20.4898 / 3600, 360);
  }
  // find JD (UT) when sun reaches `target` longitude, searching near jdGuess
  function findSolarTerm(target, jdGuess) {
    let jd = jdGuess;
    for (let i = 0; i < 50; i++) {
      let diff = mod(target - sunLongitude(jd) + 180, 360) - 180;
      jd += diff / 360 * 365.2422;
      if (Math.abs(diff) < 1e-6) break;
    }
    return jd;
  }
  // previous and next "jie" (month-starting term, lon ≡ 15 mod 30) around jd
  function surroundingJie(jd) {
    const lon = sunLongitude(jd);
    const prevTarget = mod(Math.floor((lon - 15) / 30) * 30 + 15, 360);
    const back = mod(lon - prevTarget, 360);
    const prev = findSolarTerm(prevTarget, jd - back / 360 * 365.2422);
    const nextTarget = mod(prevTarget + 30, 360);
    const next = findSolarTerm(nextTarget, prev + 30.4);
    return { prev, next, prevTarget, nextTarget };
  }
  function equationOfTimeMinutes(jd) { // NOAA approximation
    const n = jd - 2451545.0;
    const g = mod(357.528 + 0.9856003 * n, 360) * D2R;
    const q = mod(280.459 + 0.98564736 * n, 360);
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    const e = (23.439 - 0.00000036 * n) * D2R;
    let RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / D2R;
    let eot = (q - mod(RA, 360));
    eot = mod(eot + 180, 360) - 180;
    return eot * 4;
  }

  // ---------- time zones ----------
  function tzOffsetMinutes(tz, ms) {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {}; dtf.formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value);
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
  }
  function wallToUtcMs(y, m, d, h, mi, tz, fixedOffsetMin) {
    const naive = Date.UTC(y, m - 1, d, h, mi);
    if (tz == null) return naive - fixedOffsetMin * 60000;
    let guess = naive - tzOffsetMinutes(tz, naive) * 60000;
    guess = naive - tzOffsetMinutes(tz, guess) * 60000;
    return guess;
  }

  // ---------- calendar ----------
  function jdnFromYMD(y, m, d) {
    const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  const pillar = idx => ({ idx: mod(idx, 60), stem: mod(idx, 10), branch: mod(idx, 12) });
  const pillarFromSB = (s, b) => { for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return pillar(i); };

  function tenGod(dm, s) {
    const a = stemEl(dm), b = stemEl(s), same = isYang(dm) === isYang(s);
    const rel = mod(b - a, 5); // 0 same,1 I produce,2 I control,3 controls me,4 produces me
    return [['Бицзянь','Цзецай'],['Шишэнь','Шангуань'],['Пяньцай','Чжэнцай'],['Циша','Чжэнгуань'],['Пяньинь','Чжэнинь']][rel][same ? 0 : 1];
  }
  const TEN_GOD_KEY = { 'Бицзянь':'bj','Цзецай':'jc','Шишэнь':'ss','Шангуань':'sg','Пяньцай':'pc','Чжэнцай':'zc','Циша':'qs','Чжэнгуань':'zg','Пяньинь':'py','Чжэнинь':'zy' };

  /**
   * input: {year,month,day,hour,minute|null, timeUnknown, gender:'m'|'f', lon, tz | utcOffsetMin, ziRule:'23'|'00'}
   */
  function computeChart(inp) {
    const known = !inp.timeUnknown;
    const h = known ? inp.hour : 12, mi = known ? inp.minute : 0;
    const utcMs = wallToUtcMs(inp.year, inp.month, inp.day, h, mi, inp.tz || null, inp.utcOffsetMin || 0);
    const jd = jdFromUnixMs(utcMs);
    const offsetMin = inp.tz ? tzOffsetMinutes(inp.tz, utcMs) : (inp.utcOffsetMin || 0);
    // true solar time
    const eot = equationOfTimeMinutes(jd);
    const lmtCorr = inp.lon * 4; // minutes from UTC
    const tstMs = utcMs + (lmtCorr + eot) * 60000;
    const tst = new Date(tstMs);
    const tY = tst.getUTCFullYear(), tM = tst.getUTCMonth() + 1, tD = tst.getUTCDate();
    const tH = tst.getUTCHours(), tMi = tst.getUTCMinutes();

    // year & month pillars by solar longitude
    const lon = sunLongitude(jd);
    let solarYear = inp.year;
    // use UTC+8-independent check: month<=2 and sun before 315°
    const gy = new Date(utcMs).getUTCFullYear(), gm = new Date(utcMs).getUTCMonth() + 1;
    solarYear = gy;
    if (gm <= 3 && lon >= 250 && lon < 315) solarYear = gy - 1;
    if (gm === 12 && lon >= 315) solarYear = gy; // never happens, guard
    const yearP = pillar(solarYear - 4);
    const monthIdx = Math.floor(mod(lon - 315, 360) / 30); // 0 = 寅
    const monthBranch = mod(monthIdx + 2, 12);
    const monthStem = mod(yearP.stem * 2 + 2 + monthIdx, 10);
    const monthP = pillarFromSB(monthStem, monthBranch);

    // day pillar (true solar date; zi-hour rule)
    let dayJdn = jdnFromYMD(tY, tM, tD);
    if (known && inp.ziRule !== '00' && tH >= 23) dayJdn += 1;
    const dayP = pillar(dayJdn + 49);
    let hourP = null;
    if (known) {
      const hb = Math.floor((tH + 1) / 2) % 12;
      hourP = pillarFromSB(mod(dayP.stem * 2 + hb, 10), hb);
    }

    const pillars = [
      { key: 'hour', label: 'Час', p: hourP },
      { key: 'day', label: 'День', p: dayP },
      { key: 'month', label: 'Месяц', p: monthP },
      { key: 'year', label: 'Год', p: yearP },
    ];
    const dm = dayP.stem;

    // element balance
    const score = [0,0,0,0,0], count = [0,0,0,0,0];
    pillars.forEach(({ key, p }) => {
      if (!p) return;
      score[stemEl(p.stem)] += 1; count[stemEl(p.stem)]++;
      count[BRANCH_EL[p.branch]]++;
      const hs = HIDDEN[p.branch], w = HIDDEN_W[hs.length], mult = key === 'month' ? 2 : 1;
      hs.forEach((s, i) => score[stemEl(s)] += w[i] * mult);
    });
    const dmEl = stemEl(dm);
    const resEl = mod(dmEl - 1, 5);
    const total = score.reduce((a, b) => a + b, 0) - 1; // exclude DM itself
    const support = score[dmEl] - 1 + score[resEl];
    const supportRatio = support / total;
    // seasonal: is month branch main qi supporting DM?
    const monthMain = stemEl(HIDDEN[monthBranch][0]);
    const inSeason = monthMain === dmEl || monthMain === resEl;
    let strength;
    if (supportRatio >= 0.55 || (supportRatio >= 0.45 && inSeason)) strength = 'strong';
    else if (supportRatio <= 0.32 || (supportRatio < 0.42 && !inSeason)) strength = 'weak';
    else strength = 'balanced';
    const favorable = strength === 'weak' ? [resEl, dmEl] :
      strength === 'strong' ? [mod(dmEl + 1, 5), mod(dmEl + 2, 5), mod(dmEl + 3, 5)] :
      [score.indexOf(Math.min(...score))];
    const unfavorable = strength === 'weak' ? [mod(dmEl + 1, 5), mod(dmEl + 2, 5), mod(dmEl + 3, 5)] :
      strength === 'strong' ? [resEl, dmEl] : [score.indexOf(Math.max(...score))];

    // luck pillars
    const forward = (isYang(yearP.stem) && inp.gender === 'm') || (!isYang(yearP.stem) && inp.gender === 'f');
    const jie = surroundingJie(jd);
    const daysToTerm = forward ? jie.next - jd : jd - jie.prev;
    const startYears = daysToTerm / 3; // 3 days = 1 year
    const startY = Math.floor(startYears), startM = Math.round((startYears - startY) * 12);
    const birthYearDec = inp.year + (inp.month - 1) / 12;
    const luck = [];
    for (let i = 1; i <= 9; i++) {
      const p = pillar(monthP.idx + (forward ? i : -i));
      const age = startYears + (i - 1) * 10;
      luck.push({ p, age, fromYear: Math.floor(birthYearDec + age + 0.0001) });
    }

    // symbolic stars
    const NOBLE = { 0:[1,7],4:[1,7],6:[1,7],1:[0,8],5:[0,8],2:[11,9],3:[11,9],8:[3,5],9:[3,5],7:[2,6] };
    const WENCHANG = [5,6,8,9,8,9,11,0,2,3];
    const trio = b => [8,0,4].includes(b) ? 0 : [2,6,10].includes(b) ? 1 : [5,9,1].includes(b) ? 2 : 3;
    const PEACH = [9,3,6,0], HORSE = [2,8,11,5];
    const branchesIn = pillars.filter(x => x.p).map(x => ({ key: x.key, label: x.label, b: x.p.branch }));
    const findB = targets => branchesIn.filter(x => targets.includes(x.b)).map(x => x.label);
    const stars = [
      { id: 'noble', name: 'Небесный благородный (天乙贵人)', branches: NOBLE[dm], found: findB(NOBLE[dm]) },
      { id: 'wenchang', name: 'Звезда учёности (文昌)', branches: [WENCHANG[dm]], found: findB([WENCHANG[dm]]) },
      { id: 'peach', name: 'Цветок персика (桃花)', branches: [PEACH[trio(dayP.branch)]], found: findB([PEACH[trio(dayP.branch)], PEACH[trio(yearP.branch)]]) },
      { id: 'horse', name: 'Почтовая лошадь (驿马)', branches: [HORSE[trio(dayP.branch)]], found: findB([HORSE[trio(dayP.branch)], HORSE[trio(yearP.branch)]]) },
    ];

    // branch interactions
    const inter = [];
    const COMBO = { '0-1':'Земля','2-11':'Дерево','3-10':'Огонь','4-9':'Металл','5-8':'Вода','6-7':'Огонь/Земля' };
    for (let i = 0; i < branchesIn.length; i++) for (let j = i + 1; j < branchesIn.length; j++) {
      const a = branchesIn[i], b = branchesIn[j];
      if (mod(a.b - b.b, 12) === 6) inter.push({ type: 'clash', text: `${BRANCHES[a.b]}–${BRANCHES[b.b]} столкновение (${a.label} ↔ ${b.label})` });
      const k = [a.b, b.b].sort((x, y) => x - y).join('-');
      if (COMBO[k]) inter.push({ type: 'combo', text: `${BRANCHES[a.b]}–${BRANCHES[b.b]} союз → ${COMBO[k]} (${a.label} + ${b.label})` });
    }
    const TRIOS = [[8,0,4,'Вода'],[2,6,10,'Огонь'],[5,9,1,'Металл'],[11,3,7,'Дерево']];
    const bset = new Set(branchesIn.map(x => x.b));
    TRIOS.forEach(t => {
      const n = t.slice(0, 3).filter(b => bset.has(b)).length;
      if (n === 3) inter.push({ type: 'trio', text: `Полный тройной союз ${t.slice(0,3).map(b=>BRANCHES[b]).join('')} → ${t[3]}` });
      else if (n === 2 && bset.has(t[1])) inter.push({ type: 'trio', text: `Полутройной союз (${t.slice(0,3).filter(b=>bset.has(b)).map(b=>BRANCHES[b]).join('')}) → ${t[3]}` });
    });

    return {
      input: inp, utcMs, offsetMin, eot, lmtCorr, trueSolar: { y: tY, m: tM, d: tD, h: tH, mi: tMi },
      sunLon: lon, solarYear, pillars, dm, dmEl, score, count, supportRatio, inSeason, strength,
      favorable, unfavorable, forward, startYears, startY, startM, luck, stars, interactions: inter,
      jie: { prev: unixMsFromJd(jie.prev), next: unixMsFromJd(jie.next) },
    };
  }

  // annual pillar for a given gregorian year (after Lichun)
  const yearPillar = y => pillar(y - 4);
  function currentSolarYear(ms) {
    const jd = jdFromUnixMs(ms), lon = sunLongitude(jd), d = new Date(ms);
    const gy = d.getUTCFullYear();
    return (d.getUTCMonth() + 1 <= 3 && lon >= 250 && lon < 315) ? gy - 1 : gy;
  }

  // ---------- feng shui ----------
  function reduce9(n) { while (n > 9) n -= 9; return n; }
  function kua(solarYear, gender) {
    const r = mod(solarYear, 9);
    let k = gender === 'm' ? reduce9(11 - r) : reduce9(r + 4);
    if (k === 0) k = 9;
    if (k === 5) k = gender === 'm' ? 2 : 8;
    return k;
  }
  // [ShengQi, TianYi, YanNian, FuWei, HuoHai, WuGui, LiuSha, JueMing]
  const KUA_DIRS = {
    1:['ЮВ','В','Ю','С','З','СВ','СЗ','ЮЗ'], 2:['СВ','З','СЗ','ЮЗ','В','ЮВ','Ю','С'],
    3:['Ю','С','ЮВ','В','ЮЗ','СЗ','СВ','З'], 4:['С','Ю','В','ЮВ','СЗ','ЮЗ','З','СВ'],
    6:['З','СВ','ЮЗ','СЗ','ЮВ','В','С','Ю'], 7:['СЗ','ЮЗ','СВ','З','С','Ю','ЮВ','В'],
    8:['ЮЗ','СЗ','З','СВ','Ю','С','В','ЮВ'], 9:['В','ЮВ','С','Ю','СВ','З','ЮЗ','СЗ'],
  };
  const KUA_EL = { 1:4, 2:2, 3:0, 4:0, 6:3, 7:3, 8:2, 9:1 };
  const KUA_TRIGRAM = { 1:'Кань ☵', 2:'Кунь ☷', 3:'Чжэнь ☳', 4:'Сюнь ☴', 6:'Цянь ☰', 7:'Дуй ☱', 8:'Гэнь ☶', 9:'Ли ☲' };
  function annualStars(solarYear) {
    let c = reduce9(11 - mod(solarYear, 9)); if (c === 0) c = 9;
    // Lo Shu flight path: center, NW, W, NE, S, N, SW, E, SE
    const path = ['Ц','СЗ','З','СВ','Ю','С','ЮЗ','В','ЮВ'];
    const map = {};
    path.forEach((pos, i) => map[pos] = reduce9(c + i) || 9);
    return { center: c, map };
  }

  const api = { STEMS, STEM_RU, BRANCHES, BRANCH_RU, ANIMALS, ELEMENTS, ELEMENT_KEYS, BRANCH_EL, HIDDEN,
    stemEl, isYang, tenGod, TEN_GOD_KEY, computeChart, yearPillar, currentSolarYear, kua, KUA_DIRS, KUA_EL,
    KUA_TRIGRAM, annualStars, sunLongitude, findSolarTerm, jdFromUnixMs, unixMsFromJd, tzOffsetMinutes, pillar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BaZi = api;
})(typeof window !== 'undefined' ? window : this);
