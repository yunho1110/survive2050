/* ═══════════════════════════════════════════════════════════════
   2050 · 멸망 직전 지구에서 살아남기 — main.js
   게임 로직 + 사운드 + 돌발변수 + 업적 + 난이도 + 시나리오 풍경 아트
   + 인스타 스토리 공유용 카드뉴스 엔딩 + 저장 레이어.
   data.js(SDG / START / SCENARIOS) 다음에 로드됩니다.
   ═══════════════════════════════════════════════════════════════ */

/* ── 큐 구성: 그룹별 추출 개수 + 위기 tier. 합계 = 10단계 ── */
const QUEUE_PLAN = [
  { group:'early', pick:2, tier:1 },
  { group:'mid',   pick:3, tier:2 },
  { group:'late',  pick:3, tier:3 },
  { group:'final', pick:2, tier:4 },
];
const TOTAL_STAGES = QUEUE_PLAN.reduce((s,p)=>s+p.pick, 0); // 10
const MAX_SCORE = TOTAL_STAGES * 20;                        // 200 (시나리오당 최고 20점)

/* ═══════════════ 난이도 시스템 (기본 / 도전 A / 하드코어 B) ═══════════════
   hideHints  : 선택지의 정답 힌트 태그 + SDG 뱃지 숨김 + 선택 후 수치 변화 토스트 숨김
   suddenTemp : 이 기온(°C) 이상 도달 시 즉시 붕괴 엔딩
   topCut     : 재생(최상위 S등급) 컷오프 비율
   surviveCut : 생존(B등급) 컷오프 비율
   collapse   : 기온 ≥ suddenTemp 또는 생태계 0%에서 조기 종료(F등급) 적용
*/
const DIFFS = {
  A:      { key:'A',      label:'도전',     emoji:'🔥', hideHints:true,  suddenTemp:3.60, topCut:0.85, surviveCut:0.55, collapse:false, budget:false,
            note:'힌트·뱃지·수치를 모두 가린 진짜 딜레마. 모든 보기가 장점과 숨은 대가를 가집니다.' },
  B:      { key:'B',      label:'하드코어',  emoji:'☠️', hideHints:true, suddenTemp:3.00, topCut:0.90, surviveCut:0.60, collapse:true,  budget:false,
            note:'전 시나리오 딜레마 + 기온 3.0°C·생태계 0% 도달 시 즉시 붕괴(F) + 등급 컷오프 최상.' },
  /* 「예산」 고유: 남긴 예산에 매 턴 복리 이자 → 저축·투자 타이밍 싸움 */
  BUDGET: { key:'BUDGET', label:'예산',     emoji:'💰', hideHints:true, suddenTemp:3.60, topCut:0.85, surviveCut:0.55, collapse:false, budget:true,
            note:'💰 남긴 예산엔 복리 이자(+8%), 단 기온 1.5°C 초과분만큼 재난 복구비가 차압. 100% 초과 비축은 ⚡오버차지. 경제·산업(SDG 8·9·12) 딜레마가 섞여 나옵니다 — 초반 절약 → 후반 몰빵이 승부.' },
  /* 「정치」 고유: 지지율(여론) 2차 자원 + 임기 심사. 자본 테마링 위에 여론 줄타기 추가 */
  POLITICS:{ key:'POLITICS', label:'정치', emoji:'🗳️', hideHints:true, suddenTemp:3.60, topCut:0.85, surviveCut:0.55, collapse:false, budget:true, politics:true,
            note:'🗳️ 강한 규제는 지지율↓·인기영합은 지지율↑. 3·6·9단계 임기 심사(35% 이상) 통과 필수. 초반 정치자본은 빠듯하고, 후반엔 정공법(최선)으로 쌓은 점수만큼 자본이 폭발 회복돼 S티어를 노립니다. 사회·불평등(SDG 1·10·16) 딜레마가 섞여 나옵니다.' },
};
let currentDiff = 'A';   // 기본을 「도전」으로 → 정답이 안 보이는 진짜 딜레마부터 시작
let dailyMode = false;   // 🗓️ 오늘의 지구: 날짜 시드로 모두가 같은 판(친구와 점수 비교)

/* ── 자원 테마(예산/정치자본): 「정치」 모드에서 라벨·단위·이모지만 교체 ── */
function resTheme(){ return diffCfg().politics
  ? { emoji:'🗳️', unit:'pt', name:'정치자본' }
  : { emoji:'💰', unit:'억',  name:'예산' }; }

/* ═══════════════ 시드 RNG(데일리 모드) ═══════════════
   기본은 Math.random. 데일리 모드면 날짜 시드로 결정론적 RNG로 교체. */
let RNG = Math.random;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function todaySeed(){ const d=new Date(); return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); }
function setupRNG(){ RNG = dailyMode ? mulberry32(todaySeed()) : Math.random; }
function toggleDaily(){ dailyMode = !dailyMode; screenIntro(); }

/* ── 「예산」 난이도: 선택지 비용 산출(억원) ──
   친환경·자본집약 정책일수록 비싸고, 후반 메가프로젝트일수록 단가가 오릅니다.
   점수(친환경도) + 단계(tier) + 적극적 기온 감축폭을 비용으로 환산. */
function costOf(choice, tier){
  const s = choice.fx.score;
  // 순비용(net) — 양수=지출, 음수=「자본 확보」(환급).
  //   4지선다를 정확히 2:2로 나눕니다 → 상위 2개(상·중)는 자원을 소비, 하위 2개(균형형·하)는 자원을 돌려받음.
  //   "이번 턴은 친환경에 투자할까, 아니면 환경을 내주고 곳간을 채울까"의 매 턴 저울질.
  //   ★ 수치적 비대칭: 나가는 자원(소비)이 들어오는 자원(환급)의 약 2.8배.
  //     → 환급 보기를 여러 번 골라야 소비 보기 한 번을 지를 수 있는 압박이 생깁니다.
  if(s>=20) return  150 + (tier-1)*30 + Math.round(Math.max(0,-choice.fx.temp)*45); // 상(최선): 대규모 소비
  if(s>=10) return  85  + (tier-1)*18;                                              // 중(절충): 소비
  if(s>=8)  return -(30 + (tier-1)*5);                                              // 균형형: 소폭 자본 확보
  return     -(55 + (tier-1)*9);                                                    // 하(환경 포기): 큰 자본 확보
}
function diffCfg(){ return DIFFS[currentDiff] || DIFFS.NORMAL; }
function selectDiff(key){ if(DIFFS[key]){ currentDiff = key; screenIntro(); } }

/* ═══════════════ 시나리오 풍경 아트 매핑(40+ 시나리오 전체) ═══════════════
   각 항목: { motif(중앙 모티프), floats(좌우 대칭 떠다니는 아이콘),
             top/bot(하늘 그라데이션), ring(중앙 후광색) } */
const SCENE_ART = {
  blackout:    { motif:'🏙️', floats:['💡','⚡','🌃'], top:'#1a1730', bot:'#3a2a4a', ring:'rgba(250,204,21,.5)' },
  drought:     { motif:'🏜️', floats:['☀️','🌾','💨'], top:'#3a2a14', bot:'#6b4a1e', ring:'rgba(251,191,36,.5)' },
  water:       { motif:'🚰', floats:['💧','🌊','🏞️'], top:'#0b3a4a', bot:'#155e6b', ring:'rgba(56,189,248,.5)' },
  smog:        { motif:'🏭', floats:['😷','🌫️','🚗'], top:'#2a2a2a', bot:'#4a443a', ring:'rgba(148,163,184,.45)' },
  waste:       { motif:'🗑️', floats:['♻️','🛢️','🚮'], top:'#2a2418', bot:'#4a3a22', ring:'rgba(191,139,46,.5)' },
  heat:        { motif:'🌡️', floats:['☀️','🥵','🌳'], top:'#3a1414', bot:'#7a2a1e', ring:'rgba(248,113,113,.55)' },
  plastic:     { motif:'🥤', floats:['🐢','🛍️','♻️'], top:'#0b3344', bot:'#155e6b', ring:'rgba(45,212,191,.5)' },
  greenery:    { motif:'🌳', floats:['🦋','🌷','🏙️'], top:'#0e3a2a', bot:'#16633f', ring:'rgba(74,222,128,.55)' },
  ocean:       { motif:'🐟', floats:['🌊','🐚','🎣'], top:'#0b2a4a', bot:'#10456b', ring:'rgba(56,189,248,.5)' },
  awareness:   { motif:'📢', floats:['📚','🌍','✊'], top:'#1a2a4a', bot:'#2a3a6b', ring:'rgba(96,165,250,.5)' },
  food:        { motif:'🌾', floats:['🥕','🚜','🍞'], top:'#3a2e10', bot:'#6b551e', ring:'rgba(221,166,58,.5)' },
  wildfire:    { motif:'🔥', floats:['🌲','🚒','💨'], top:'#3a1408', bot:'#7a2e12', ring:'rgba(251,146,60,.6)' },
  flood:       { motif:'🌧️', floats:['🌊','🏚️','☔'], top:'#0b2a44', bot:'#143f63', ring:'rgba(56,189,248,.55)' },
  grid:        { motif:'⚡', floats:['🔌','🏭','🔋'], top:'#2a2410', bot:'#4a3e1e', ring:'rgba(250,204,21,.55)' },
  refugee:     { motif:'🚶', floats:['🧳','🏕️','🌍'], top:'#2a2418', bot:'#4a3a28', ring:'rgba(253,157,36,.5)' },
  carbon:      { motif:'🏭', floats:['💨','💰','🌫️'], top:'#26262a', bot:'#44403a', ring:'rgba(148,163,184,.45)' },
  coral:       { motif:'🪸', floats:['🐠','🌊','🐢'], top:'#0b2e4a', bot:'#10567a', ring:'rgba(45,212,191,.55)' },
  biodiversity:{ motif:'🦌', floats:['🌲','🦋','🐦'], top:'#0e3326', bot:'#165a3a', ring:'rgba(86,192,43,.55)' },
  acid:        { motif:'🌊', floats:['🐚','🧪','🐟'], top:'#0b2a3a', bot:'#134a55', ring:'rgba(45,212,191,.5)' },
  mineral:     { motif:'⛏️', floats:['🪨','🏔️','💎'], top:'#2a221c', bot:'#4a3a30', ring:'rgba(191,139,46,.5)' },
  glacier:     { motif:'🧊', floats:['🌊','🐧','❄️'], top:'#0b3a4a', bot:'#1a5a7a', ring:'rgba(125,211,252,.55)' },
  storm:       { motif:'🌀', floats:['🌊','⚡','🌬️'], top:'#10203a', bot:'#1e3a5a', ring:'rgba(96,165,250,.55)' },
  permafrost:  { motif:'🧊', floats:['💨','🌍','❄️'], top:'#16303a', bot:'#244a55', ring:'rgba(125,211,252,.5)' },
  geo:         { motif:'🛰️', floats:['☁️','☀️','✈️'], top:'#0a1230', bot:'#2a2a5a', ring:'rgba(167,139,250,.5)' },
  dac:         { motif:'🏭', floats:['🌲','💨','🔬'], top:'#10302a', bot:'#1e5045', ring:'rgba(45,212,191,.5)' },
  floatcity:   { motif:'🏝️', floats:['🌊','🏙️','⛵'], top:'#0b2e4a', bot:'#10507a', ring:'rgba(56,189,248,.55)' },
  rainforest:  { motif:'🌴', floats:['🦜','🌿','🐸'], top:'#0e3a26', bot:'#16633a', ring:'rgba(74,222,128,.6)' },
  fusion:      { motif:'⚛️', floats:['⚡','🔆','🔬'], top:'#1a1040', bot:'#3a2a6a', ring:'rgba(167,139,250,.55)' },
  seed:        { motif:'🌱', floats:['🌾','🧊','🔐'], top:'#10331e', bot:'#1e5a35', ring:'rgba(86,192,43,.55)' },
  desal:       { motif:'🏝️', floats:['🌊','💧','☀️'], top:'#0b3344', bot:'#15607a', ring:'rgba(56,189,248,.5)' },
  circular:    { motif:'♻️', floats:['🔁','🔋','🌍'], top:'#10302a', bot:'#1e5045', ring:'rgba(45,212,191,.5)' },
  treaty:      { motif:'🌍', floats:['🤝','🕊️','📜'], top:'#0e2a4a', bot:'#1a4a7a', ring:'rgba(96,165,250,.55)' },
  /* ─ 경제/산업(예산 모드 테마) ─ */
  steel:       { motif:'🏭', floats:['🔥','🦺','⚙️'], top:'#2a1a14', bot:'#4a2e1e', ring:'rgba(251,146,60,.5)' },
  jobs:        { motif:'🦺', floats:['🏗️','🔧','📉'], top:'#2a2410', bot:'#4a3e1e', ring:'rgba(250,204,21,.5)' },
  tariff:      { motif:'🛃', floats:['💰','📦','🌍'], top:'#1a2a3a', bot:'#2a4055', ring:'rgba(96,165,250,.5)' },
  /* ─ 사회/불평등(정치 모드 테마) ─ */
  fueltax:     { motif:'⛽', floats:['🪧','🚗','💸'], top:'#2a1a1a', bot:'#4a2a2a', ring:'rgba(248,113,113,.5)' },
  housing:     { motif:'🏚️', floats:['🔥','❄️','💡'], top:'#1a2233', bot:'#2e3a52', ring:'rgba(125,211,252,.5)' },
  inflation:   { motif:'🛒', floats:['📈','🍞','💸'], top:'#2a2414', bot:'#4a3e22', ring:'rgba(221,166,58,.5)' },
  justice:     { motif:'⚖️', floats:['🏛️','🕊️','📜'], top:'#1a1f3a', bot:'#2a325a', ring:'rgba(167,139,250,.5)' },
  default:     { motif:'🌍', floats:['🌱','🌊','☁️'], top:'#0b2545', bot:'#1d3461', ring:'rgba(52,211,153,.5)' },
};

/* 시나리오 풍경 아트 HTML — 떠다니는 아이콘을 「좌우 대칭」으로 하늘에 균형 배치
   (중앙 모티프·야경 스카이라인과 겹치지 않도록 상단 코너 영역에 배치) */
function sceneArtHTML(scene){
  const a = SCENE_ART[scene && scene.art] || SCENE_ART.default;
  const POS = [ { t:'12%', x:'7%' }, { t:'34%', x:'15%' }, { t:'14%', x:'31%' } ];
  const icons = (a.floats || []).slice(0, 3);
  let floats = '';
  icons.forEach((ic, i)=>{
    const p = POS[i] || POS[0];
    const dl = (i * 0.55).toFixed(2), dr = (i * 0.55 + 0.3).toFixed(2);
    floats += `<span class="scene-float" style="left:${p.x}; top:${p.t}; animation-delay:${dl}s">${ic}</span>`;
    floats += `<span class="scene-float" style="right:${p.x}; top:${p.t}; animation-delay:${dr}s">${ic}</span>`;
  });
  return `
    <div class="scene-art" style="--art-top:${a.top}; --art-bot:${a.bot}; --art-ring:${a.ring}">
      <div class="scene-glow"></div>
      ${floats}
      <div class="scene-skyline"></div>
      <div class="scene-motif">${a.motif}</div>
    </div>`;
}

/* ── 게임 상태 ── */
let G = {
  currentStep: 0,
  gameQueue: [],
  stats: { temp: START.temp, sea: START.sea, eco: START.eco, score: START.score },
  history: [],
  modifier: null,
  renderingHalted: false,   // 조기 붕괴 시 비동기 렌더 차단 플래그
  rollTimers: [],           // 작동 중 애니메이션 프레임 추적
};
function freshStats(){ return { temp:START.temp, sea:START.sea, eco:START.eco, score:START.score }; }
let LAST_ENDING = null;     // 공유용으로 직전 엔딩 결과 캐시

/* ── 전역 사운드 상태(브라우저 자동재생 정책 대응: 사용자 클릭 후 가동) ── */
let audioCtx = null, bgmInterval = null, currentOscillators = [], soundEnabled = false;

/* ═══════════════ 1. Web Audio 생성형 앰비언트 BGM ═══════════════ */
function initAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
}
function startAmbientBGM(){
  if(!soundEnabled) return;
  initAudio();
  if(bgmInterval) clearInterval(bgmInterval);
  // 생태계(eco) 상태를 주기적으로 스캔해 화음·파형을 동적으로 모핑
  bgmInterval = setInterval(()=>{
    if(!soundEnabled) return;
    const eco = (G && G.stats) ? G.stats.eco : START.eco;
    let freqs=[130.81,164.81,196.00], type='sine', duration=2.8, gainVal=0.04; // C Major(평화)
    if(eco < 30){ freqs=[116.54,138.59,155.56,207.65]; type='sawtooth'; gainVal=0.015; duration=1.2; }   // 멸망: 불협화 톱니파
    else if(eco < 60){ freqs=[110.00,130.81,164.81,220.00]; type='triangle'; duration=2.0; }              // 경고: 어두운 마이너
    playChordSynth(freqs, type, duration, gainVal);
  }, 2500);
}
function playChordSynth(freqs, type, duration, maxGain){
  if(!audioCtx || audioCtx.state === 'suspended') return;
  const now = audioCtx.currentTime;
  const dur = Math.max(0.06, duration);
  const attack = Math.min(0.4, dur * 0.35);                 // 페이드 인
  const release = Math.min(0.5, dur * 0.4);                 // 페이드 아웃
  const sustainEnd = Math.max(now + attack, now + dur - release); // 항상 now+attack 이상(음수/역순 시간 방지)
  freqs.forEach(f=>{
    const osc = audioCtx.createOscillator(), gainNode = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, now);
    gainNode.gain.setValueAtTime(0, now);                                   // 클릭 노이즈 방지 페이드
    gainNode.gain.linearRampToValueAtTime(maxGain, now + attack);
    gainNode.gain.setValueAtTime(maxGain, sustainEnd);
    gainNode.gain.linearRampToValueAtTime(0, now + dur);
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + dur);
    currentOscillators.push(osc);
  });
  if(currentOscillators.length > 20) currentOscillators.splice(0, 5);
}
function toggleSound(){
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundBtn');
  if(soundEnabled){
    btn.innerText = t('sound_on');
    btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500 text-slate-950 active:scale-95 transition shadow-lg';
    initAudio(); startAmbientBGM();
    playChordSynth([523.25,659.25],'sine',0.3,0.05);
  } else {
    btn.innerText = t('sound_off');
    btn.className = 'px-2.5 py-1 text-xs font-bold rounded-lg glass-soft border border-white/10 text-slate-300 active:scale-95 transition';
    if(bgmInterval) clearInterval(bgmInterval);
    currentOscillators.forEach(o=>{ try{ o.stop(); }catch(e){} });
  }
}

/* ═══════════════ 2. 돌발 이벤트(Random Events) ═══════════════
   두 갈래로 게임 템포를 흔든다:
   · multiply형 : G.modifier로 「다음 선택의 효과」를 증폭/완화(기존 메커니즘)
   · apply형    : 발동 즉시 자원(예산)·지지율을 직접 흔드는 충격(자원 모드 전용 향신료)
   필터: modes(난이도 한정) + cond(지표 임계 조건). 둘 다 통과한 것만 후보. */
const EVENTS = [
  /* ── 공통: 다음 선택 효과 증폭/완화(multiply) — 악재는 더 맵게, 호재는 절제 ── */
  { name:'🔥 초대형 아마존 대화재',       desc:'이번 턴 생태계 타격이 1.85배 가속됩니다.', target:'eco',  multiply:1.85, type:'bad' },
  { name:'🌊 슈퍼 엘니뇨 동시 발생',      desc:'이번 턴 기온 상승 타격이 2.0배 증폭됩니다.', target:'temp', multiply:2.0, type:'bad' },
  { name:'🧊 북극 메탄 하이드레이트 대분출', desc:'이번 턴 모든 악영향이 1.8배 폭주합니다.', target:'all',  multiply:1.8, type:'bad' },
  { name:'🌱 글로벌 녹색 보조금 타결',     desc:'이번 턴 생태 복원 효율이 1.3배 향상됩니다.', target:'eco', multiply:1.3, type:'good' },
  { name:'🛰️ 위성 조기경보 적중',         desc:'이번 턴 기온 타격이 0.65배로 완화됩니다.', target:'temp', multiply:0.65, type:'good' },
  { name:'✊ 청년 기후 총파업',            desc:'이번 턴 생태 복원 효율이 1.35배로 오릅니다.', target:'eco', multiply:1.35, type:'good' },
  /* ── 조건부: 지표 임계에서만 발동(긴장 가속/숨통) ── */
  { name:'🌡️ 폭염 도미노', cond:G=>G.stats.temp>=2.0, desc:'임계 근접 — 이번 턴 기온 타격이 2.6배로 폭주합니다.', target:'temp', multiply:2.6, type:'bad' },
  { name:'🕳️ 영구동토 메탄 폭발', cond:G=>G.stats.temp>=1.8, desc:'언 땅이 뒤집혔다 — 이번 턴 기온 타격이 2.8배로 치솟습니다.', target:'temp', multiply:2.8, type:'bad' },
  { name:'🩸 생태 티핑 경보', cond:G=>G.stats.eco<=40, desc:'붕괴 직전 — 이번 턴 생태계 타격이 2.2배로 가속됩니다.', target:'eco', multiply:2.2, type:'bad' },
  { name:'🌪️ 복합재난 동시타격', cond:G=>G.stats.eco>=60 && G.stats.temp<=1.7, desc:'방심한 사이 — 이번 턴 모든 악영향이 1.8배로 덮칩니다.', target:'all', multiply:1.8, type:'bad' },   // 꿀 빠는 유저 뒤통수
  { name:'❄️ 라니냐 한숨 돌리기', cond:G=>G.stats.temp<=1.35, desc:'잠깐의 냉각 — 이번 턴 기온 타격이 0.6배로 줄어듭니다.', target:'temp', multiply:0.6, type:'good' },
  /* ── 💰 예산 모드 전용: 즉시 자원 충격(apply) ── */
  { name:'📈 그린본드 완판', modes:['BUDGET'], type:'good', flavor:'녹색 채권이 흥행하며 곳간이 두둑해졌다.',
    apply:(g)=>{ const v=Math.round(Math.max(35, g.budgetTotal*0.10)); g.budget+=v; return `예산 +${v}억`; } },
  { name:'🏦 긴급 기후기금 배정', modes:['BUDGET'], cond:G=>G.budget < G.budgetTotal*0.25, type:'good', flavor:'파산 직전, 국제 기후기금이 수혈됐다.',
    apply:(g)=>{ const v=Math.round(g.budgetTotal*0.16); g.budget+=v; return `예산 +${v}억`; } },
  { name:'💸 탄소세 소송 패소', modes:['BUDGET'], cond:G=>G.budget>40, type:'bad', flavor:'배상 판결로 곳간이 뜯겼다.',
    apply:(g)=>{ const v=Math.round(g.budget*0.22); g.budget=Math.max(0,g.budget-v); return `예산 -${v}억`; } },
  { name:'📉 그린버블 차익실현', modes:['BUDGET'], cond:G=>G.budget > G.budgetTotal, type:'bad', flavor:'과열된 곳간에 차익실현 매물이 쏟아졌다.',
    apply:(g)=>{ const v=Math.round(g.budget*0.30); g.budget=Math.max(0,g.budget-v); return `예산 -${v}억`; } },   // 곳간 과대축적 뒤통수
  /* ── 🗳️ 정치 모드 전용: 즉시 여론 충격(apply) ── */
  { name:'📺 기후 다큐 신드롬', modes:['POLITICS'], type:'good', flavor:'온 국민이 다큐에 결집했다.',
    apply:(g)=>{ g.approval=clamp((typeof g.approval==='number'?g.approval:60)+8,0,200); return '지지율 +8%'; } },
  { name:'🗞️ 그린워싱 스캔들', modes:['POLITICS'], type:'bad', flavor:'위장 환경정책이 폭로됐다.',
    apply:(g)=>{ g.approval=clamp((typeof g.approval==='number'?g.approval:60)-16,0,200); return '지지율 -16%'; } },
  { name:'🚶 기후 난민 대이동', modes:['POLITICS'], cond:G=>G.stats.eco<55, type:'bad', flavor:'국경에 몰린 난민에 여론이 들끓는다.',
    apply:(g)=>{ g.approval=clamp((typeof g.approval==='number'?g.approval:60)-20,0,200); return '지지율 -20%'; } },
  { name:'🫧 여론 거품 붕괴', modes:['POLITICS'], cond:G=>(G.approval||60)>100, type:'bad', flavor:'고공 지지율에 방심한 순간 역풍이 불었다.',
    apply:(g)=>{ g.approval=clamp((typeof g.approval==='number'?g.approval:60)-22,0,200); return '지지율 -22%'; } },   // 지지율 과신 뒤통수
];
/* 하위호환: 외부에서 MODIFIERS_POOL을 참조하던 코드 대비(별칭) */
const MODIFIERS_POOL = EVENTS;

function triggerRandomEvent(){
  const warn = document.getElementById('warn');
  G.modifier = null;
  if(!(RNG() < 0.40 && G.currentStep > 0 && G.currentStep < TOTAL_STAGES - 1)){ if(warn) warn.className = 'hidden'; return; }
  // 현재 난이도·지표 조건을 통과한 이벤트만 후보로
  const pool = EVENTS.filter(e => (!e.modes || e.modes.includes(currentDiff)) && (!e.cond || e.cond(G)));
  if(!pool.length){ if(warn) warn.className = 'hidden'; return; }
  const ev = pool[Math.floor(RNG()*pool.length)];
  let body;
  if(ev.apply){
    const res = ev.apply(G);                       // 즉시 자원/지지율 충격(게이지는 직후 renderCurrentScenario에서 갱신)
    body = `${ev.flavor||''} <b>${res}</b>`;
  } else {
    G.modifier = ev;                               // 다음 선택 효과 증폭/완화
    body = ev.desc || '';
  }
  if(!warn) return;
  warn.className = ev.type === 'bad'
    ? 'block rounded-xl mb-3 text-center text-xs font-bold p-2.5 bg-red-950/80 border border-red-700 text-red-300 animate-pulse'
    : 'block rounded-xl mb-3 text-center text-xs font-bold p-2.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300';
  warn.innerHTML = `🚨 [돌발 속보] ${ev.name}<br/><span class="font-normal text-[11px]">${body}</span>`;
}

/* ═══════════════ 3. 라이프타임 영구 업적(Achievement) ═══════════════ */
const ACH_META = {
  PARIS: { name:'🕊️ 파리 협정의 전설', desc:'평균 기온 상승을 +1.5°C 이하로 완벽히 방어했습니다.' },
  BOIL:  { name:'🌋 끓어버린 지구',     desc:'기온 폭주로 인류가 강제 조기 종료되었습니다.' },
  EMPTY: { name:'🍂 침묵의 봄',         desc:'생태계 건강도 0% 도달로 먹이사슬이 전멸했습니다.' },
  CYBER: { name:'🤖 프랑켄슈타인 테크',  desc:'위험한 지구공학 카드를 남발하여 생존했습니다.' },
  COLD:  { name:'🥶 냉혈한 최고사령관',  desc:'생태 지표를 25% 미만으로 버려둔 채 문명만 보존했습니다.' },
  PURIST:{ name:'💚 완벽주의 통제관',    desc:'10단계 전부에서 「최선(20점)」 보기만 골라냈습니다.' },
  GAMBLER:{ name:'🎲 운명의 도박사',     desc:'확률형 도박 보기를 3번 이상 성공시켰습니다.' },
};
function getBadges(){ try{ return JSON.parse(localStorage.getItem('survive2050_achievements')||'[]'); }catch(e){ return []; } }
function unlockBadge(id){
  const earned = getBadges();
  if(earned.includes(id)) return;
  earned.push(id);
  try{ localStorage.setItem('survive2050_achievements', JSON.stringify(earned)); }catch(e){}
  const toast = document.createElement('div');
  toast.className = 'fixed safe-toast z-[110] glass-main ring-2 ring-amber-400 p-4 rounded-xl shadow-2xl text-white max-w-xs text-left animate-fade-in';
  toast.innerHTML = `
    <div class="text-xs font-black text-amber-400">🏆 영구 업적 해금!</div>
    <div class="font-bold text-sm mt-0.5">${ACH_META[id].name}</div>
    <div class="text-[11px] text-slate-400 mt-0.5">${ACH_META[id].desc}</div>`;
  document.body.appendChild(toast);
  if(soundEnabled) playChordSynth([440,554.37,659.25,880],'sine',0.6,0.06);
  setTimeout(()=>toast.remove(), 4500);
}

/* ═══════════════ 4. 계기판 롤링 + 비동기 안전 차단(Interrupt) ═══════════════ */
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rollNum(elId, start, end, duration=600, isFloat=false){
  if(G.renderingHalted) return;
  const el = document.getElementById(elId); if(!el) return;
  const startTime = performance.now();
  (function update(now){
    if(G.renderingHalted) return;
    const p = Math.min((now-startTime)/duration, 1), ease = 1 - Math.pow(1-p, 3);
    const cur = start + (end-start)*ease;
    el.innerText = isFloat ? cur.toFixed(2) : Math.round(cur);
    if(p < 1){ G.rollTimers.push(requestAnimationFrame(update)); }
  })(startTime);
}
function clearAllRollTimers(){ G.rollTimers.forEach(id=>cancelAnimationFrame(id)); G.rollTimers = []; }
function updateBars(){
  const s = G.stats;
  const bT=document.getElementById('bTemp'), bS=document.getElementById('bSea'), bE=document.getElementById('bEco');
  if(bT) bT.style.width = clamp((s.temp/4)*100, 4, 100)+'%';
  if(bS) bS.style.width = clamp((s.sea/120)*100, 2, 100)+'%';
  if(bE) bE.style.width = clamp(s.eco, 2, 100)+'%';
}

/* ── 선택 후 수치 변화 토스트(난이도 A·B에서는 숨김 → 정답 역산 방지) ── */
function showStatToast(dT, dS, dE){
  if(diffCfg().hideHints) return;
  const seg = (v, unit, invertGood) => {
    if(Math.abs(v) < 0.005) return `<span class="text-slate-400">±0${unit}</span>`;
    const sign = v > 0 ? '+' : '';
    const good = invertGood ? v < 0 : v > 0;        // eco는 +가 좋음 / temp·sea는 -가 좋음
    const col = good ? '#34d399' : '#f87171';
    const val = unit === '°C' ? v.toFixed(2) : Math.round(v);
    return `<span style="color:${col}">${sign}${val}${unit}</span>`;
  };
  const t = document.createElement('div');
  t.className = 'fixed safe-toast z-[90] glass-main rounded-xl px-4 py-3 text-xs font-extrabold animate-pop shadow-2xl border border-white/10 flex gap-3';
  t.innerHTML = `<span>🌡️ ${seg(dT,'°C',false)}</span><span>🌊 ${seg(dS,'cm',false)}</span><span>🌱 ${seg(dE,'%',true)}</span>`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2200);
}

/* ── 분위기 연출: 배경 입자 + 생태계 반영 하늘색 ── */
function spawnParticles(mode){
  const wrap = document.getElementById('particles'); if(!wrap) return;
  wrap.innerHTML='';
  for(let k=0;k<16;k++){
    const s = 4 + Math.random()*10, p = document.createElement('span');
    p.className = 'particle';
    p.style.left = (Math.random()*100)+'%';
    p.style.width = s+'px'; p.style.height = s+'px';
    p.style.animationDuration = (6+Math.random()*8)+'s';
    p.style.animationDelay = (-Math.random()*8)+'s';
    p.style.background = mode==='smog' ? 'rgba(140,130,120,.30)'
                       : mode==='eco'  ? 'rgba(160,230,200,.30)'
                                       : 'rgba(120,170,220,.28)';
    wrap.appendChild(p);
  }
}
function setSky(top, mid, bot){
  const r = document.documentElement.style;
  r.setProperty('--sky-top', top); r.setProperty('--sky-mid', mid); r.setProperty('--sky-bot', bot);
}
function updateSky(){
  const e = G ? G.stats.eco : START.eco;
  if(e >= 66){ setSky('#0e7490','#0f766e','#14532d'); spawnParticles('eco'); }
  else if(e >= 33){ setSky('#0b2545','#13315c','#1d3461'); spawnParticles('cool'); }
  else { setSky('#3b2f2f','#4a3b2a','#5b3a29'); spawnParticles('smog'); }
}

/* ═══════════════ 5. 큐 생성 + 선택 처리 ═══════════════ */
function sample(arr, n){
  const pool = arr.slice();
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0, Math.min(n, pool.length));
}
function shuffleInPlace(arr){
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}
function buildQueue(){
  const q = [];
  QUEUE_PLAN.forEach(({group,pick,tier})=>{
    // 모드별 내러티브 테마 라우팅(수식·구조 불변, 후보 풀만 필터):
    //   modes 미지정 = 전 모드 공통(생태 중심) · modes:['BUDGET'/'POLITICS'] = 해당 모드에서만 등장.
    //   → 도전/하드코어는 기존 43개 그대로, 예산엔 경제, 정치엔 사회 딜레마가 섞여 들어온다.
    const pool = (SCENARIOS[group] || []).filter(sc => !sc.modes || sc.modes.includes(currentDiff));
    sample(pool, pick).forEach(scene=>{
      // 3개 기본 보기 + 진짜 4번째 보기(EXTRA_CHOICES, 전 모드 공통) 합류
      let base = scene.choices.slice();
      const extra = (window.EXTRA_CHOICES || {})[scene.title];
      if(extra) base.push(extra);
      // 매 판 선택지 순서를 무작위 셔플(정답이 항상 같은 자리에 고정되던 문제 해결)
      const choices = shuffleInPlace(base);
      q.push({ group, tier, scene:{ title:scene.title, text:scene.text, art:scene.art, voice:scene.voice, choices } });
    });
  });
  G.gameQueue = q; // early→mid→late→final 순(점진적 난이도)
}
function weightFor(step){ return 1 + step * 0.1; }   // 1단계 ×1.0 → 10단계 ×1.9

/* ── [시스템] 티핑포인트 비선형 결합: 생태계가 낮을수록 기온 피해 증폭(영구 상태결합) ── */
function ecoTempPenalty(){ const e = G.stats.eco; return e<40 ? 1.4 : e<60 ? 1.15 : 1; }

/* ── [내러티브] 상태 인지형 콜백: 과거 플래그 × 현재 SDG가 맞물리면 한 줄 회상 ── */
function narrativeEcho(c){
  if(!G || !G.flags) return '';
  for(const e of (window.ECHOES||[])) if(G.flags.has(e.needFlag) && c.fx.sdg===e.whenSdg) return e.text;
  return '';
}

/* ── [시스템] 지연 청구서: 이번 단계가 만기인 과거 선택의 효과를 raw로 정산 ── */
function flushDeferredDue(){
  if(!G.pending || !G.pending.length) return '';
  let msg = '';
  G.pending = G.pending.filter(p=>{
    if(p.due === G.currentStep){
      if(p.fx){ G.stats.temp = Math.max(0.80, G.stats.temp + (p.fx.temp||0));
                G.stats.sea  = G.stats.sea + (p.fx.sea||0);
                G.stats.eco  = clamp(G.stats.eco + (p.fx.eco||0), 0, 100); }
      msg = p.msg || '⏰ 과거의 선택이 청구서가 되어 돌아왔다.';
      return false;
    }
    return true;
  });
  return msg;
}

/* ── [UX] 기온 기반 전역 색온도 드리프트(더워질수록 화면이 붉어짐) ── */
function updateHeat(){
  const layer = document.getElementById('heatLayer'); if(!layer) return;
  const t = (G && G.stats) ? G.stats.temp : START.temp;
  layer.style.opacity = clamp((t - 1.1) / 2.4, 0, 0.6).toFixed(3);
}

/* ═══ 🌍 글로벌 자원 압박(Baseline Gravity) ═══
   엔딩의 「문」(v13 도달성)은 그대로 열어두되, 거기로 가는 「길」을 험하게:
   선택과 무관하게 매 턴 기온↑·생태↓가 기본으로 깔린다(후반 가속).
   → 좋은 선택의 +로 상쇄 가능하므로 고수는 통과, 꿀 빠는 플레이어는 서서히 가라앉음. */
const GRAVITY = { temp: 0.03, eco: 1.0, accel: 0.05 };
function applyGravity(){
  if(!G) return;
  const k = 1 + G.currentStep * GRAVITY.accel;   // 후반일수록 가속(1.0 → ~1.45)
  G.stats.temp = G.stats.temp + GRAVITY.temp * k;
  G.stats.eco  = clamp(G.stats.eco - GRAVITY.eco * k, 0, 100);
}

let locking = false;
function choose(choiceIdx){
  if(G.renderingHalted || locking) return;
  clearChoiceTimer();                          // 시간압박 링 타이머 해제
  const item = G.gameQueue[G.currentStep];
  const scene = item.scene;
  const visible = visibleChoices(scene, item.tier);   // 숨은 보기 필터 후의 실제 목록
  const c = visible[choiceIdx];
  if(!c) { return; }

  // 「예산/정치」 자원 게이트: 비용 차감(부족 시엔 가장 싼 보기만 강제 허용)
  if(diffCfg().budget){
    const costs = visible.map(ch=>costOf(ch, item.tier));
    const cheapest = costs.indexOf(Math.min(...costs));
    const cost = costs[choiceIdx];
    if(cost > G.budget && choiceIdx !== cheapest) return;   // 못 사는 보기는 무시
    // 음수 비용(환경 포기)=자금 확보 → 예산 무제한 축적(오버차지). 상한 없음.
    G.budget = Math.max(0, G.budget - cost);
  }

  locking = true;
  const old = { ...G.stats };

  // ── 효과 파이프라인 ─────────────────────────────────────────
  // 1) 지연 청구서 정산(과거 선택이 지금 터진다)
  const billMsg = flushDeferredDue();

  // 2) 확률형 보기(도박) — fx를 복제해 굴린다(점수는 불변)
  let fx = { temp:c.fx.temp, sea:c.fx.sea, eco:c.fx.eco };
  let rolledNote = '';
  if(c.gamble){
    const hit = RNG() < c.gamble.p;
    const g = hit ? c.gamble.win : c.gamble.lose;
    fx.temp += g.temp||0; fx.sea += g.sea||0; fx.eco += g.eco||0;
    rolledNote = (hit?'🎲 성공 — ':'🎲 실패 — ') + (g.note||'');
    if(hit) G.gambleWins = (G.gambleWins||0) + 1;
  }

  // 3) 돌발 기후 변수 가중치
  const stepWeight = weightFor(G.currentStep);
  let modWeight = 1.0;
  if(G.modifier){
    if(G.modifier.target === 'all') modWeight = G.modifier.multiply;
    else if(G.modifier.target === 'temp' && fx.temp > 0) modWeight = G.modifier.multiply;
    else if(G.modifier.target === 'eco'){
      if((G.modifier.type==='bad' && fx.eco < 0) || (G.modifier.type==='good' && fx.eco > 0)) modWeight = G.modifier.multiply;
    }
  }

  // 4) 티핑포인트 결합 + 후반 「그리디 폭주」 + 지표 반영
  //    자원 모드에서 돈/표를 벌려고 환경 포기(하·6점) 보기를 고르면, 후반일수록 기온·생태 타격이 매섭게 가속됩니다.
  let greedyLate = 1;
  if(diffCfg().budget && c.fx.score<=6) greedyLate = 1 + G.currentStep*0.10;   // 1단계 ×1.0 → 9단계 ×1.9
  const tempDelta = (fx.temp>0 ? fx.temp*ecoTempPenalty()*greedyLate : fx.temp) * stepWeight * modWeight;
  let nextTemp = G.stats.temp + tempDelta;
  if(nextTemp < 0.80) nextTemp = 0.80;
  G.stats.temp = nextTemp;
  G.stats.sea  = G.stats.sea + (fx.sea * stepWeight);
  const ecoDelta = (fx.eco<0 ? fx.eco*greedyLate : fx.eco) * stepWeight * modWeight;
  G.stats.eco  = clamp(G.stats.eco + ecoDelta, 0, 100);
  G.stats.score += c.fx.score;
  // [정치] 선택이 지지율(여론)을 흔든다 — 상한 200%까지 오버차지 허용
  if(diffCfg().politics){
    let dApp = approvalDelta(c);
    // 콘크리트 지지층(오버차지 시너지): 지지율 100% 초과 구간에선 소비형 규제의 지지율 페널티 절반
    if(dApp < 0 && (G.approval||60) > 100) dApp = Math.round(dApp * 0.5);
    // 8점 균형안 인공호흡기: 정치 모드에서 균형형은 폭넓은 지지로 지지율 수급 보너스(+4)
    if(c.fx.score>=8 && c.fx.score<10) dApp = 4;
    G.approval = clamp((typeof G.approval==='number'?G.approval:60) + dApp, 0, 200);
  }

  // 5) 회상 계산(플래그 추가 전) → 6) 플래그 적립 → 7) 지연 예약
  c._echo = narrativeEcho(c);
  c._rolled = rolledNote;
  if(c.flag){ G.flags = G.flags || new Set(); G.flags.add(c.flag); }
  if(c.delay){ G.pending = G.pending || []; G.pending.push({ due:G.currentStep + (c.delay.after||1), fx:c.delay.fx, msg:c.delay.msg }); }

  G.history.push({
    step:G.currentStep, tier:item.tier, title:scene.title, choice:c.label, tag:c.tag,
    sdg:c.fx.sdg, baseScore:c.fx.score, feedback:c.feedback, fact:c.fact, flag:c.flag||null,
    gambled: !!c.gamble, won: c.gamble ? rolledNote.includes('성공') : null,
  });

  // 🌍 글로벌 자원 압박: 선택 효과 위에 매 턴 기본 악화를 누적(가는 길을 험하게) → 이번 턴 net에 포함
  applyGravity();

  // 선택의 실제 결과 델타를 기록 → 피드백 화면에서 「이 선택이 좋았나/나빴나」를 명확히 보여줌
  c._delta = { temp:G.stats.temp - old.temp, sea:G.stats.sea - old.sea, eco:G.stats.eco - old.eco };

  // 계기판 반영 + 수치 변화 토스트(난이도 A·B 숨김)
  rollNum('vTemp', old.temp, G.stats.temp, 500, true);
  rollNum('vSea',  old.sea,  G.stats.sea,  500, false);
  rollNum('vEco',  old.eco,  G.stats.eco,  500, false);
  updateBars(); updateHeat();
  showStatToast(G.stats.temp - old.temp, G.stats.sea - old.sea, G.stats.eco - old.eco);
  if(billMsg) deferredToast(billMsg);
  // 오버차지 최초 돌파 알림(사람들이 상한 초과를 놓치지 않도록)
  if(diffCfg().budget && !G.ocAnnounced){
    const res = diffCfg().politics ? (G.approval||60) : G.budget;
    const max = diffCfg().politics ? 100 : G.budgetTotal;
    if(max>0 && res>max){ G.ocAnnounced = true; resToast('⚡ 오버차지 돌파! 상한을 넘겨 무제한 비축을 시작합니다', diffCfg().politics?'sky':'amber'); }
  }
  if(Math.floor(old.eco/33) !== Math.floor(G.stats.eco/33)) updateSky();

  // 임계점 도달 시 화면 붕괴 연출
  const root = document.getElementById('app-root');
  if(G.stats.eco < 35 || G.stats.temp >= 3.40) root.classList.add('earthquake','glitch-red');
  else root.classList.remove('earthquake','glitch-red');

  // 효과음
  if(soundEnabled){
    if(c.fx.score >= 20) playChordSynth([659.25,783.99,987.77],'sine',0.25,0.05);
    else if(c.fx.score <= 6) playChordSynth([220,174.61],'sawtooth',0.3,0.04);
    else playChordSynth([523.25],'triangle',0.18,0.04);
  }

  // 조기 강제 붕괴 검증(난이도별 임계 기온 적용 · B는 3.0°C)
  const d = diffCfg();
  if(G.stats.eco <= 0 || G.stats.temp >= d.suddenTemp){
    if(G.stats.eco <= 0) executeSuddenDeath('EMPTY');
    else executeSuddenDeath('BOIL');
    locking = false;
    return;
  }

  G.currentStep++;
  if(G.currentStep < TOTAL_STAGES) resourceTurnTick();   // 예산 이자 / 정치 자본 충원·임기 심사
  saveGame();

  if(G.currentStep >= TOTAL_STAGES){
    const result = getEnding(G.stats.score / MAX_SCORE);
    clearSave();
    renderEndingCard(result);
  } else {
    renderFeedbackPage(c);
  }
  locking = false;
}

/* ── 지연 청구서 알림(붉은 배너 토스트) ── */
function deferredToast(msg){
  const t = document.createElement('div');
  t.className = 'fixed left-1/2 -translate-x-1/2 z-[95] max-w-xs text-center glass-main rounded-xl px-4 py-2.5 text-[11px] font-bold text-red-200 border border-red-600/50 animate-pop shadow-2xl';
  t.style.top = 'calc(84px + var(--safe-top))';
  t.innerHTML = '⏰ <b>과거의 청구서</b><br/><span class="font-normal text-red-300">'+msg+'</span>';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 3600);
}
/* ── 자원 토스트(이자/충원/불신임 등) ── */
function resToast(msg, tone){
  const map={ amber:'text-amber-200 border-amber-500/50', sky:'text-sky-200 border-sky-500/50', red:'text-red-200 border-red-600/50' };
  const t = document.createElement('div');
  t.className = 'fixed left-1/2 -translate-x-1/2 z-[94] max-w-xs text-center glass-main rounded-xl px-4 py-2 text-[11px] font-bold animate-pop shadow-2xl border '+(map[tone]||map.amber);
  t.style.top = 'calc(128px + var(--safe-top))';
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 3000);
}

/* ── [정치] 선택이 지지율(여론)에 주는 영향 ──
   대담한 친환경 규제일수록 단기 인기가 떨어지고, 인기영합(환경 포기)은 지지율이 오릅니다. */
function approvalDelta(c){
  const s = c.fx.score;
  if(s>=20) return -5;   // 최선(강한 규제) = 단기 인기 하락(−5: 초중반 여론 눈치를 다시 빡세게)
  if(s>=10) return -2;
  if(s>=8)  return +1;   // 균형형 = 소폭 호감
  return +8;             // 환경 포기(인기영합) = 지지율 급등
}

/* ═══════════════ 패닉 버튼(판당 1회) ═══════════════
   예산: 지구 저당 금융(환경 담보 긴급 예산) / 정치: 우민화(지구를 불태워 표 매수) */
function usePanic(){
  if(!G || G.renderingHalted || locking || G.panicUsed) return;
  const d = diffCfg(); if(!d.budget) return;
  G.panicUsed = true;
  const old = { ...G.stats };
  if(d.politics){
    G.stats.temp = G.stats.temp + 0.25;
    G.approval = clamp((typeof G.approval==='number'?G.approval:60) + 15, 0, 200);
    resToast('📢 우민화 정책 — 🌡️+0.25°C 대가로 지지율 +15%', 'red');
  } else {
    G.stats.eco  = clamp(G.stats.eco - 20, 0, 100);
    G.stats.temp = G.stats.temp + 0.15;
    const inject = Math.round(G.budgetTotal * 0.4);
    G.budget = G.budget + inject;
    resToast(`🏦 지구 저당 금융 — 🌱-20%·🌡️+0.15°C 대가로 예산 +${inject}억`, 'red');
  }
  const root = document.getElementById('app-root');
  if(root){ root.classList.add('earthquake','glitch-red'); setTimeout(()=>root.classList.remove('earthquake','glitch-red'), 500); }
  rollNum('vTemp', old.temp, G.stats.temp, 400, true);
  rollNum('vEco',  old.eco,  G.stats.eco,  400, false);
  updateBars(); updateHeat(); updateSky();
  if(soundEnabled) playChordSynth([146.83,110],'sawtooth',0.4,0.05);
  saveGame();
  if(G.stats.eco<=0 || G.stats.temp>=d.suddenTemp){
    if(G.stats.eco<=0) executeSuddenDeath('EMPTY'); else executeSuddenDeath('BOIL');
    return;
  }
  renderCurrentScenario();   // 배너·버튼 갱신(패닉 버튼 소진 반영)
}

/* ═══════════════ 개인화 엔딩 크로니클: G.history로 통치 기록을 한 편의 서사로 ═══════════════ */
function buildChronicle(){
  const h = (G && G.history) || [];
  if(!h.length) return ['조기 종료로 통치 기록이 충분히 남지 않았습니다.'];
  const has = f => h.some(x=>x.flag===f);
  const lines = [];
  const best = h.filter(x=>x.baseScore>=20).length;
  const worst= h.filter(x=>x.baseScore<=6).length;
  if(has('coal_on')) lines.push('초반 재정 위기를 넘기려 <b>[석탄 발전소 재가동]</b>이라는 악마의 계약에 서명했습니다. 곳간은 채웠으나 하늘이 잿빛으로 물들었죠.');
  const wonG  = h.find(x=>x.gambled && x.won===true);
  const lostG = h.find(x=>x.gambled && x.won===false);
  if(wonG)  lines.push(`<b>[${wonG.choice}]</b> 도박은 운 좋게 맞아떨어져 위기를 모면했지만, 다음 도박까지 성공하리란 보장은 없었습니다.`);
  if(lostG) lines.push(`<b>[${lostG.choice}]</b> 도박이 빗나가며 통제 불능의 연쇄 피해가 들이닥쳤습니다.`);
  if(has('denial'))   lines.push('한때 <b>[해안의 위기를 외면]</b>한 대가로, 빙상 붕괴가 끝내 도시 한복판까지 밀려들었습니다.');
  if(has('reckless')) lines.push('검증을 건너뛴 <b>[무모한 강행]</b>이 거듭되며 통제실의 신뢰에 금이 갔습니다.');
  if(G && G.panicUsed) lines.push(diffCfg().politics
    ? '벼랑 끝에서 <b>[우민화 정책]</b>으로 지구를 불태워 표를 사들이며 자리를 보전했습니다.'
    : '파산 직전 <b>[지구 저당 금융]</b>으로 환경을 담보 잡혀 한 턴을 더 버텼습니다.');
  if(has('great_transition')) lines.push('그리고 마지막 순간, 봉인되어 있던 <b>[대전환 선언]</b>에 서명하며 인류세의 폭주를 멈춰 세웠습니다.');
  const last = h[h.length-1];
  if(last && last.baseScore>=20 && !has('great_transition'))
    lines.push(`마지막 단계에서 <b>[${last.choice}]</b>에 전 재산을 쏟아부어, 지구를 극적인 생존의 궤도로 끌어올렸습니다.`);
  // 종합 한 줄
  if(best>=worst+3)      lines.push(`총 ${best}번, 당신은 눈앞의 이익보다 지구를 먼저 택한 통치자였습니다.`);
  else if(worst>=best+3) lines.push(`총 ${worst}번, 당신은 내일의 지구를 오늘의 곳간과 맞바꾼 통치자였습니다.`);
  else                   lines.push('당신의 10번의 결단은 이상과 현실 사이를 끊임없이 저울질한 줄타기였습니다.');
  return lines.slice(0, 6);
}

/* 정치 임기 심사 커트라인: 3·6·9단계 모두 35% 통일 (후반 75% 컷이 과도하다는 피드백 → 일관된 기준선) */
function reviewCut(step){ return (step===3||step===6||step===9) ? 35 : null; }

/* ── 자원 모드 턴 정산: 예산=복리 이자+블랙스완 / 정치=지지율 충원+임기 심사 (상한 없음) ── */
function resourceTurnTick(){
  const d = diffCfg(); if(!d.budget || !G) return;
  if(d.politics){
    const ap = (typeof G.approval==='number') ? G.approval : 60;
    // 정치 자본 충원(줬다 뺏기):
    //  · 초중반(1~6단계): 지지율 비례로 「빠듯하게」 → 여론 눈치 + 곳간 압박(초반부터 배부르지 않게)
    //  · 후반(7~10단계): 「정공법으로 점수를 쌓아온」 고수에게만 자본이 극적으로 복사 — 지지율과 분리
    //    (강한 규제는 어차피 지지율을 깎으므로, 후반 보너스를 지지율에 묶으면 정공법이 자멸 → 점수 페이스로 보상)
    let regen;
    if(G.currentStep >= 6){
      const pace = G.stats.score / Math.max(1, G.currentStep*20);   // 0~1: 지금까지 평균이 최선(20)에 가까운가
      regen = pace>=0.80 ? 220 : pace>=0.60 ? 110 : 40;             // 정공법일수록 폭발적 회복(꿀 빤 유저는 미미 → S티어는 고수만)
    } else {
      regen = Math.round((ap/100) * 45);                            // 초중반은 빠듯하게
    }
    if(regen>0){ G.budget = G.budget + regen; resToast(`🗳️ 정치자본 +${regen}pt 충원 (지지율 ${ap}%)`, 'sky'); }
    const cut = reviewCut(G.currentStep);                     // 동적 커트라인
    if(cut!==null && ap < cut){
      const loss = Math.round(G.budget * 0.35);
      G.budget = Math.max(0, G.budget - loss);
      resToast(`🗳️ ${G.currentStep+1}단계 임기 심사: 지지율 ${ap}% < ${cut}% 불신임 — 정치자본 -${loss}pt`, 'red');
    }
  } else {
    const interest = Math.round(G.budget * 0.08);            // 남긴 예산 복리 이자(상한 없음 → 스노우볼)
    if(interest>0){ G.budget = G.budget + interest; resToast(`💰 예산 이자 +${interest}억 (아낄수록 복리)`, 'amber'); }
    // 🌡️ 기후 재난 복구비: 기준선(1.5°C)을 「넘는 만큼」만 매 턴 보유 예산의 일부를 차압.
    //    → 지구를 시원하게(≤1.5°C) 지키면 복구비 0(이자를 온전히 누림). 방치해 더워질수록 가속 차압.
    //    저축 고인물 견제는 유지하되, 잘 막은 플레이어가 매 턴 「이유 없이」 뜯기는 느낌을 제거.
    const heatOver = Math.max(0, G.stats.temp - 1.5);
    const upkeep = Math.round(G.budget * heatOver * 0.07);
    if(upkeep>0){ G.budget = Math.max(0, G.budget - upkeep); resToast(`🌡️ 기후 재난 복구비 -${upkeep}억 (기온 ${G.stats.temp.toFixed(1)}°C · 1.5°C 초과분)`, 'red'); }
    // 블랙스완: 총예산 초과로 과대 축적할수록 확률적 시장 쇼크로 비축분 증발(고인물 저축 방지)
    if(G.budgetTotal>0 && G.budget > G.budgetTotal){
      const over = G.budget / G.budgetTotal - 1;             // 100% 초과 비율
      const p = clamp(over * 0.28, 0, 0.55);                 // 150%→0.14 · 200%→0.28 · 300%→0.55
      if(RNG() < p){
        const evap = Math.round(G.budget * 0.28);
        G.budget = Math.max(0, G.budget - evap);
        const kind = RNG()<0.5 ? '초인플레이션' : '녹색 거품 붕괴';
        resToast(`💥 시장 쇼크: ${kind} — 비축 예산 -${evap}억 증발`, 'red');
      }
    }
  }
}

/* ═══════════════ 6. 엔딩 등급 매트릭스 + 조기 강제 붕괴 ═══════════════ */
function executeSuddenDeath(reasonType){
  G.renderingHalted = true;
  clearAllRollTimers();
  clearChoiceTimer();
  clearSave();
  unlockBadge(reasonType);
  unlockEnding(reasonType);   // 도감: BOIL / EMPTY 적립
  if(soundEnabled) playChordSynth([146.83,110,82.41],'sawtooth',1.2,0.05);

  let title, desc;
  if(reasonType === 'EMPTY'){
    title = '🪦 배드 엔딩: 텅 빈 세계';
    desc  = '생태계 건강 지표가 결국 0%를 뚫고 파산했습니다. 벌과 미생물이 사라져 수정이 불가능해졌고 모든 식생이 고사했습니다. 인류는 지하 벙커에서 영양 배양액으로 연명하는 혹독한 디스토피아를 마주합니다.';
  } else {
    title = '🪦 배드 엔딩: 끓어버린 지구';
    desc  = `평균 기온 상승이 마지노선인 +${diffCfg().suddenTemp.toFixed(1)}°C를 넘어서며 시베리아 영구동토층이 완전히 뒤집혔습니다. 기후 제어 능력을 상실한 지구는 방호복 없이 한 걸음도 걸을 수 없는 거대한 용광로가 되었습니다.`;
  }
  renderEndingCard({ grade:'F', title, desc, color:'#ef4444', collapse:true });
}

/* ── [라이브옵스] 시너지 콤보 평가: 한 판의 선택 패턴으로 영구 업적 해금 ── */
function evaluateCombos(){
  const h = G.history || [];
  const allTop = h.length===TOTAL_STAGES && h.every(x=>x.baseScore>=20);
  if(allTop) unlockBadge('PURIST');                 // 전 단계 최선(20점)만
  if((G.gambleWins||0) >= 3) unlockBadge('GAMBLER'); // 도박 보기 3회 이상 성공
}

/* 데이터 기반 엔딩(ENDING_RULES) 테이블만 순회 — 분기 로직 0.
   ctx = { s, ratio, top, aCut, survive, cCut, geoCount, flags } */
function getEnding(ratio){
  const s = G.stats, d = diffCfg();
  const flags = G.flags || new Set();
  const geoCount = (G.history.filter(h=> h.flag==='geo').length)
                 + (G.history.filter(h=> h.tag && h.tag.includes('지구공학')).length);
  const ctx = {
    s, ratio, geoCount, flags,
    top:     d.topCut,
    aCut:    Math.max(d.topCut - 0.12, 0.5),
    survive: d.surviveCut,
    // GREY/DARK 경계를 「생존 가능한 최저 점수」 위로 올림 → 균형형(8점)만 반복해 살아남은 판이 DARK로 떨어져 도달 가능
    cCut:    Math.max(d.surviveCut - 0.12, 0.40),
    // WATER(워터월드) 동적 진입 기준: 정치 모드는 자원·지지율 족쇄로 「점수 유지 + 해수면」 조합이 희박 →
    //   해수면 컷을 낮춰 진입 장벽 완화. 그마저도 생태가 양호(eco↑)할수록 더 낮춰 「물만 차오른」 워터월드를 잘 잡아냄.
    seaCut:  (d.politics ? 38 : 50) - (s.eco>=55 ? 4 : 0),
  };
  evaluateCombos();
  const rules = window.ENDING_RULES || [];
  for(const r of rules){
    if(r.when(ctx)){
      if(r.badge) unlockBadge(r.badge);
      const e = r.make(ctx);
      unlockEnding(r.id);
      return e;
    }
  }
  // 안전 폴백(테이블이 비정상일 때)
  unlockEnding('DARK');
  return { grade:'D', color:'#78350f', title:'🌪️ 각자도생의 뉴 다크에이지',
    desc:'국제 공조가 파탄 나고 식량 부족으로 인한 기후 난민이 수억 명에 달합니다.' };
}

/* ── 엔딩 도감 적립(localStorage) ── */
function getEndingDex(){ try{ return JSON.parse(localStorage.getItem('survive2050_endings')||'[]'); }catch(e){ return []; } }
function unlockEnding(id){
  const seen = getEndingDex();
  if(seen.includes(id)) return;
  seen.push(id);
  try{ localStorage.setItem('survive2050_endings', JSON.stringify(seen)); }catch(e){}
}

/* ═══════════════ 7. 화면 렌더 ═══════════════ */
/* 숨은보기 필터: 조건을 충족한 보기만 노출(렌더·선택 인덱스가 항상 동일하도록 공통 사용) */
function visibleChoices(scene){
  return scene.choices.filter(c=>{
    if(c.secret){
      const r = c.req || {};
      if(r.ecoMin!=null && (!G || G.stats.eco < r.ecoMin)) return false;
      if(r.scoreMin!=null && (!G || G.stats.score < r.scoreMin)) return false;
      if(r.flag && !(G && G.flags && G.flags.has(r.flag))) return false;
    }
    return true;
  });
}
function clearChoiceTimer(){ if(G && G.choiceTimer){ clearTimeout(G.choiceTimer); G.choiceTimer=null; } }

/* [UX] 커밋 연출: 누른 보기는 강조, 나머지는 접고 → 잠깐 뒤 choose() */
function pickChoice(btn, idx){
  if(G.renderingHalted || locking) return;
  clearChoiceTimer();
  const wrap = btn && btn.parentElement;
  if(wrap){
    Array.from(wrap.children).forEach(b=>{
      if(b===btn){ b.classList.add('committed'); }
      else { b.style.transition='all .35s ease'; b.style.opacity='0.22'; b.style.transform='scale(0.97)'; b.style.pointerEvents='none'; }
    });
  }
  if(soundEnabled) playChordSynth([392,523.25],'sine',0.12,0.04);
  setTimeout(()=>choose(idx), 360);
}

/* [UX] 타이핑 효과(완료 콜백 지원) */
function typeIn(el, text, speed, done){
  if(!el){ if(done) done(); return; }
  el.textContent=''; let i=0;
  (function t(){
    if(G && G.renderingHalted) return;
    el.textContent = text.slice(0, i++);
    if(i<=text.length){ setTimeout(t, speed); } else if(done){ done(); }
  })();
}
/* [UX] 선택지 스태거 등장(읽기 전 클릭 방지 → 순차 활성화) */
function revealChoices(){
  document.querySelectorAll('.choice-btn').forEach((b,i)=>{
    setTimeout(()=>{ b.style.transition='opacity .4s ease, transform .4s ease';
      b.style.opacity = b.classList.contains('cursor-not-allowed') ? '0.4' : '1'; }, 100 + i*300);
  });
}
/* [UX] 시간압박 카운트다운(하드코어): 0 도달 시 최저점 보기 강제 집행 */
function startChoiceTimer(choices){
  let remain = 10;
  const ring = document.getElementById('choiceRing'), num = document.getElementById('choiceRingNum');
  const tick = ()=>{
    if(G.renderingHalted || locking) return;
    remain--;
    if(num) num.textContent = Math.max(0, remain);
    if(ring){ ring.style.setProperty('--p', ((10-remain)/10*100)+'%'); if(remain<=3) ring.classList.add('danger'); }
    if(remain<=0){
      let worst=0, lo=Infinity;
      choices.forEach((c,i)=>{ if(c.fx.score<lo){ lo=c.fx.score; worst=i; } });
      miniToast('⏱️ 시간 초과 — 최악의 선택이 강제 집행됩니다');
      choose(worst); return;
    }
    G.choiceTimer = setTimeout(tick, 1000);
  };
  G.choiceTimer = setTimeout(tick, 1000);
}

function renderCurrentScenario(){
  if(G.renderingHalted) return;
  clearChoiceTimer();
  const stage = document.getElementById('stage');
  const item = G.gameQueue[G.currentStep];
  const scene = item.scene;
  const hide = diffCfg().hideHints;
  const budgetMode = diffCfg().budget;
  const theme = resTheme();
  const choices = visibleChoices(scene);

  // 자원 모드: 보기별 순비용(net, 음수=환급) + 최저비용(항상 선택 가능) 산출
  const costs = budgetMode ? choices.map(c=>costOf(c, item.tier)) : null;
  const cheapest = budgetMode ? costs.indexOf(Math.min(...costs)) : -1;

  const choicesHTML = choices.map((c, idx)=>{
    const meta = SDG[c.fx.sdg] || { name:'SDGs', color:'#64748b' };
    const L = String.fromCharCode(65+idx);
    const isSecret = !!c.secret;

    // 우측 뱃지: 자원 모드=순비용(환급은 +초록) / 기본(힌트 표시 시)=SDG
    let rightBadge = '';
    if(budgetMode){
      const cost = costs[idx];
      if(cost <= 0){
        rightBadge = `<span class="text-[10px] rounded-full px-1.5 py-0.5 font-bold shrink-0 bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">${theme.emoji} +${Math.abs(cost)}${theme.unit} 회복</span>`;
      } else {
        const afford = cost <= G.budget || idx === cheapest;
        rightBadge = `<span class="text-[10px] rounded-full px-1.5 py-0.5 font-bold shrink-0 ${afford?'bg-amber-400/15 text-amber-300 border border-amber-400/30':'bg-red-500/15 text-red-300 border border-red-500/30'}">${theme.emoji} ${cost}${theme.unit}</span>`;
      }
    } else if(!hide){
      rightBadge = `<span class="text-[10px] rounded-full px-1.5 py-0.5 font-bold shrink-0" style="background:${meta.color}22;color:${meta.color};border:1px solid ${meta.color}55">SDG ${c.fx.sdg}</span>`;
    }

    const headLeft = (hide || budgetMode)
      ? `<div class="font-bold ${isSecret?'text-amber-300':'text-emerald-400'} text-xs">[선택 ${L}]${isSecret?' · 🔒 숨겨진 길':''}</div>`
      : `<div class="font-bold ${isSecret?'text-amber-300':'text-emerald-400'} text-xs">[선택 ${L}] ${c.tag}</div>`;
    const head = `<div class="flex items-center justify-between gap-2 mb-0.5">${headLeft}${rightBadge}</div>`;

    const afford = !budgetMode || costs[idx] <= G.budget || idx === cheapest;
    const baseCls = isSecret
      ? 'w-full text-left p-3.5 rounded-xl bg-amber-400/10 border border-amber-400/50 hover:bg-amber-400/20 text-sm font-medium transition active:scale-[0.99] text-amber-100 shadow-[0_0_18px_-6px_rgba(251,191,36,.7)]'
      : 'w-full text-left p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-400/40 text-sm font-medium transition active:scale-[0.99] text-slate-200';
    const cls = afford ? baseCls
      : 'w-full text-left p-3.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-slate-500 opacity-40 cursor-not-allowed';
    const onclick = afford ? `onclick="pickChoice(this, ${idx})"` : 'disabled';
    return `
      <button ${onclick} class="choice-btn ${cls}" style="opacity:0">
        ${head}
        ${c.label}${afford?'':` <span class="text-[10px] text-red-300">· ${theme.name} 부족</span>`}
      </button>`;
  }).join('');

  // 자원 현황 배너(예산/정치자본)
  let budgetBar = '';
  if(budgetMode){
    const rawPct = Math.round(G.budget / Math.max(1,G.budgetTotal) * 100);
    const over = rawPct > 100;          // 오버차지: 금빛으로 흐르는 「과충전」 연출(좋은 상태)
    if(over){
      const overAmt = G.budget - G.budgetTotal;
      budgetBar = `
      <div class="mb-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-yellow-400/10 border border-amber-300/60 p-2.5 shadow-[0_0_18px_-6px_rgba(251,191,36,.9)]">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[11px] font-bold text-amber-200">${theme.emoji} 남은 ${theme.name}</span>
          <span class="oc-chip text-[10px] rounded-full px-2 py-0.5 font-black bg-amber-300 text-slate-900">⚡ OVERCHARGE ${rawPct}%</span>
        </div>
        <div class="h-2 w-full rounded-full bg-black/30 overflow-hidden"><div class="h-full rounded-full bar-oc" style="width:100%"></div></div>
        <div class="flex justify-between text-[10px] mt-1"><span class="text-amber-100 font-extrabold">${G.budget}${theme.unit}</span><span class="text-amber-300 font-bold">⚡ +${overAmt}${theme.unit} 초과 비축</span></div>
      </div>`;
    } else {
      const low = rawPct <= 25;         // 부족: 붉은 경고(위험)
      budgetBar = `
      <div class="mb-3 rounded-xl bg-amber-500/10 border ${low?'border-red-400/40':'border-amber-500/25'} p-2.5">
        <div class="flex justify-between items-center text-[11px] font-bold text-amber-200 mb-1">
          <span>${theme.emoji} 남은 ${theme.name}</span>
          <span class="${low?'text-red-300':''}">${G.budget}${theme.unit} / ${G.budgetTotal}${theme.unit} <span class="opacity-70">(${rawPct}%)</span></span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-black/30 overflow-hidden"><div class="bar-fill h-full rounded-full ${low?'bg-gradient-to-r from-red-500 to-rose-600':'bg-gradient-to-r from-amber-400 to-orange-500'}" style="width:${clamp(rawPct,2,100)}%"></div></div>
      </div>`;
    }
  }

  // [정치] 지지율(여론) 게이지 — 100% 초과 오버차지(후반 임기 심사 대비 버퍼)
  let approvalBar = '';
  if(diffCfg().politics){
    const a = (typeof G.approval==='number')?G.approval:60;
    const over = a > 100;
    const nextStep = (G.currentStep<3?3:G.currentStep<6?6:G.currentStep<9?9:null);
    const nextCut = nextStep!==null ? reviewCut(nextStep) : null;
    const note = `<div class="text-[9px] text-sky-300/70 mt-1">강한 친환경 규제는 지지율↓ · 인기영합은 지지율↑${nextCut!==null?` · 다음 임기 심사: ${nextStep+1}단계 ${nextCut}% 미만 불신임`:''}</div>`;
    if(over){
      approvalBar = `
      <div class="mb-3 rounded-xl bg-gradient-to-r from-fuchsia-500/15 to-violet-400/10 border border-fuchsia-300/60 p-2.5 shadow-[0_0_18px_-6px_rgba(216,180,254,.9)]">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[11px] font-bold text-fuchsia-100">📊 지지율(여론)</span>
          <span class="oc-chip text-[10px] rounded-full px-2 py-0.5 font-black bg-fuchsia-300 text-slate-900">⚡ OVERCHARGE ${a}%</span>
        </div>
        <div class="h-2 w-full rounded-full bg-black/30 overflow-hidden"><div class="h-full rounded-full bar-oc oc-violet" style="width:100%"></div></div>
        <div class="text-[10px] text-fuchsia-200 font-bold mt-1 text-right">⚡ +${a-100}%p 여론 버퍼 (임기 심사 대비)</div>
        ${note}
      </div>`;
    } else {
      const col = a>=55 ? 'from-sky-400 to-emerald-400' : a>=35 ? 'from-amber-400 to-orange-500' : 'from-red-500 to-rose-600';
      approvalBar = `
      <div class="mb-3 rounded-xl bg-sky-500/10 border ${a<35?'border-red-400/40':'border-sky-500/25'} p-2.5">
        <div class="flex justify-between items-center text-[11px] font-bold text-sky-200 mb-1"><span>📊 지지율(여론)</span><span class="${a<35?'text-red-300':''}">${a}%</span></div>
        <div class="h-1.5 w-full rounded-full bg-black/30 overflow-hidden"><div class="bar-fill h-full rounded-full bg-gradient-to-r ${col}" style="width:${clamp(a,2,100)}%"></div></div>
        ${note}
      </div>`;
    }
  }

  // 비상 패닉 버튼(예산/정치, 판당 1회)
  let panicHTML = '';
  if(budgetMode && !G.panicUsed){
    const lbl = diffCfg().politics
      ? '📢 우민화 정책 — 🌡️+0.25°C로 지지율 +15%'
      : `🏦 지구 저당 금융 — 🌱-20%·🌡️+0.15°C로 예산 +${Math.round(G.budgetTotal*0.4)}억`;
    panicHTML = `<button onclick="usePanic()" class="w-full mb-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-[11px] font-bold py-2.5 active:scale-95 transition hover:bg-red-500/20">⚠️ 비상대책(1회) · ${lbl}</button>`;
  }

  const ringHTML = (currentDiff==='B')
    ? `<div id="choiceRing" class="choice-ring"><span id="choiceRingNum">10</span></div>` : '';
  const voiceHTML = scene.voice
    ? `<p class="text-[11px] italic text-amber-200/80 mb-2 pl-2 border-l-2 border-amber-400/40">${scene.voice}</p>` : '';

  // 진행 세그먼트
  let seg = '';
  for(let k=0;k<TOTAL_STAGES;k++) seg += `<span class="h-1.5 rounded-full ${k<G.currentStep?'bg-emerald-400':(k===G.currentStep?'bg-white/60':'bg-white/15')}" style="width:${100/TOTAL_STAGES-1.5}%"></span>`;

  stage.innerHTML = `
    <div class="glass-main p-5 rounded-2xl shadow-xl animate-fade-in relative">
      ${ringHTML}
      ${sceneArtHTML(scene)}
      <div class="flex items-center gap-1 mb-3">${seg}</div>
      <div class="flex justify-between text-xs text-slate-400 font-bold mb-2">
        <span>📋 통제 단계: ${G.currentStep+1} / ${TOTAL_STAGES}</span>
        <span class="text-red-400">위기 등급: TIER ${item.tier}</span>
      </div>
      <div class="text-[9px] text-amber-300/60 mb-2">🌍 글로벌 자원 압박: 매 턴 기본으로 🌡️ 상승·🌱 감소가 누적됩니다 (후반 가속)</div>
      <h2 class="text-lg font-black text-white mb-2">${scene.title}</h2>
      ${voiceHTML}
      <p id="sceneText" class="text-xs text-slate-300 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 mb-4 min-h-[3.5rem]"></p>
      ${budgetBar}
      ${approvalBar}
      ${panicHTML}
      <div class="space-y-2">${choicesHTML}</div>
    </div>`;

  updateHeat();
  // 타이핑 연출 → 끝나면 선택지 스태거 등장 + (하드코어) 시간압박 가동
  typeIn(document.getElementById('sceneText'), scene.text, 16, ()=>{
    revealChoices();
    if(currentDiff==='B') startChoiceTimer(choices);
  });
}

/* ── 선택 품질 판정: 점수(결정의 질)로 「좋은/나쁜 선택」을 한눈에 ──
   20=최선 / 10=절충 / 8=아쉬운 균형 / 그 외=값비싼 선택 */
function choiceVerdict(score){
  if(score>=20) return { icon:'🟢', label:'최선의 선택', sub:'지구를 최우선에 둔 모범적인 결단이었습니다.', col:'#34d399', cls:'border-emerald-400/50 bg-emerald-500/10' };
  if(score>=10) return { icon:'🟡', label:'절충한 선택', sub:'얻은 만큼 내준, 무난한 타협이었습니다.',       col:'#fbbf24', cls:'border-amber-400/50 bg-amber-500/10' };
  if(score>=8)  return { icon:'🟠', label:'아쉬운 균형', sub:'균형을 노렸지만 효과는 제한적이었습니다.',       col:'#fb923c', cls:'border-orange-400/50 bg-orange-500/10' };
  return            { icon:'🔴', label:'값비싼 선택', sub:'당장은 쉬웠지만, 지구가 그 대가를 치릅니다.',     col:'#f87171', cls:'border-red-500/50 bg-red-500/10' };
}

function renderFeedbackPage(choice){
  const stage = document.getElementById('stage');
  const meta = SDG[choice.fx.sdg] || { name:'지속가능개발목표', color:'#64748b' };

  // ① 결정의 질 판정 배지(점수 기반) — 난이도와 무관하게 항상 표시
  const v = choiceVerdict(choice.fx.score);
  const verdictHTML = `
    <div class="mb-4 rounded-xl border ${v.cls} p-3 flex items-center gap-3 text-left animate-pop">
      <div class="text-3xl leading-none shrink-0">${v.icon}</div>
      <div class="min-w-0 flex-1">
        <div class="font-black text-sm" style="color:${v.col}">${v.label}<span class="ml-1.5 text-[11px] font-bold text-slate-300">· 지속가능성 +${choice.fx.score}점</span></div>
        <div class="text-[11px] text-slate-300 mt-0.5">${v.sub}</div>
      </div>
    </div>`;

  // ② 이번 턴 실제 지표 변화(좋으면 초록·나쁘면 빨강) — 결과를 수치로 명확히
  const dd = choice._delta || { temp:0, sea:0, eco:0 };
  const seg = (val, unit, invertGood) => {
    if(Math.abs(val) < 0.005) return `<span class="text-slate-400">±0${unit}</span>`;
    const sign = val > 0 ? '+' : '';
    const good = invertGood ? val < 0 : val > 0;        // eco는 +가 좋음 / temp·sea는 -가 좋음
    const col = good ? '#34d399' : '#f87171';
    const num = unit === '°C' ? val.toFixed(2) : Math.round(val);
    return `<span style="color:${col}">${sign}${num}${unit}</span>`;
  };
  const deltaHTML = `
    <div class="grid grid-cols-3 gap-2 mb-5 text-xs font-extrabold">
      <span class="rounded-lg bg-black/25 border border-white/5 py-2 text-center">🌡️ ${seg(dd.temp,'°C',false)}</span>
      <span class="rounded-lg bg-black/25 border border-white/5 py-2 text-center">🌊 ${seg(dd.sea,'cm',false)}</span>
      <span class="rounded-lg bg-black/25 border border-white/5 py-2 text-center">🌱 ${seg(dd.eco,'%',true)}</span>
    </div>`;

  const rolledHTML = choice._rolled
    ? `<div class="mb-4 rounded-xl border ${choice._rolled.includes('성공')?'border-emerald-500/40 bg-emerald-500/10 text-emerald-200':'border-red-500/40 bg-red-500/10 text-red-200'} p-2.5 text-xs font-bold">${choice._rolled}</div>` : '';
  const echoHTML = choice._echo
    ? `<div class="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] font-medium text-amber-200 text-left">${choice._echo}</div>` : '';
  stage.innerHTML = `
    <div class="glass-main p-6 rounded-2xl text-center shadow-xl animate-fade-in">
      <div class="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">정책 시행 결과</div>
      <h3 class="text-xl font-black text-white mb-4">"${choice.tag}"</h3>
      ${verdictHTML}
      ${deltaHTML}
      <p class="text-sm text-slate-300 leading-relaxed mb-5">${choice.feedback}</p>
      ${rolledHTML}
      ${echoHTML}
      <a href="${meta.url||'#'}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white mb-4" style="background:${meta.color}">
        🌐 SDG ${choice.fx.sdg}: ${meta.name} ↗
      </a>
      <div class="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 text-left mb-6 text-slate-300 text-[11px] leading-relaxed">
        <strong class="text-amber-400 block mb-0.5">💡 과학적 팩트 체크</strong>
        ${choice.fact}
      </div>
      <button id="nextBtn" class="w-full rounded-full bg-white text-slate-950 font-black py-3 active:scale-95 transition shadow-lg text-sm">
        다음 위기 보고서 접수 ➡️
      </button>
    </div>`;
  document.getElementById('nextBtn').onclick = ()=>{
    if(soundEnabled) playChordSynth([587.33,783.99],'sine',0.15,0.04);
    triggerRandomEvent();
    renderCurrentScenario();
  };
}

/* ═══════════════ 7.5 스포티파이 랩드 감성 「통치 결산 영수증」 ═══════════════ */
/* 한 판의 선택 패턴으로 통치 페르소나(아키타입)를 뽑는다 */
function govPersona(h){
  const best=h.filter(x=>x.baseScore>=20).length, worst=h.filter(x=>x.baseScore<8).length;
  const gam=h.filter(x=>x.gambled).length;
  const has=f=>h.some(x=>x.flag===f);
  if(has('great_transition'))      return { emoji:'🌅', name:'인류세를 끝낸 선구자', tag:'THE GREAT TRANSITION' };
  if(gam>=3)                       return { emoji:'🎲', name:'벼랑 끝의 승부사',     tag:'THE HIGH ROLLER' };
  if(best>=7)                      return { emoji:'🌱', name:'이상주의 통치자',       tag:'THE IDEALIST' };
  if(worst>=5)                     return { emoji:'🏭', name:'냉혹한 실리주의자',     tag:'THE PRAGMATIST' };
  if(has('coal_on')||has('denial'))return { emoji:'🌫️', name:'타협의 생존가',        tag:'THE SURVIVOR' };
  if(best>=worst)                  return { emoji:'⚖️', name:'줄타기의 균형감각',     tag:'THE TIGHTROPE' };
  return                                  { emoji:'🧭', name:'표류하는 관리자',       tag:'THE DRIFTER' };
}
/* 영수증 데이터(HTML·PNG 공용) */
function buildReceipt(){
  const h=(G&&G.history)||[]; const s=(G&&G.stats)||freshStats(); const d=diffCfg();
  const g =h.filter(x=>x.baseScore>=20).length;
  const y =h.filter(x=>x.baseScore>=10&&x.baseScore<20).length;
  const o =h.filter(x=>x.baseScore>=8 &&x.baseScore<10).length;
  const rd=h.filter(x=>x.baseScore<8).length;
  const gam=h.filter(x=>x.gambled).length, gw=h.filter(x=>x.gambled&&x.won===true).length;
  const freq={}; h.forEach(x=>{ if(x.sdg) freq[x.sdg]=(freq[x.sdg]||0)+1; });
  let topSdg=null, mx=0; for(const k in freq){ if(freq[k]>mx){ mx=freq[k]; topSdg=+k; } }
  const flagOrder=['great_transition','geo','coal_on','denial','reckless'];
  let sig=null; for(const f of flagOrder){ const e=h.find(x=>x.flag===f); if(e){ sig=e; break; } }
  if(!sig){ const tops=h.filter(x=>x.baseScore>=20); sig=tops[tops.length-1]||h[h.length-1]; }
  const now=new Date(), pad=n=>String(n).padStart(2,'0');
  const date=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { h, s, d, g, y, o, rd, gam, gw, topSdg, sdgName: topSdg ? (SDG[topSdg]?SDG[topSdg].name:'SDGs') : '—',
    persona: govPersona(h), sigText: sig?sig.choice:'—', date, scorePct: Math.round(s.score/MAX_SCORE*100) };
}
/* 영수증 카드 마크업(크림 영수증 톤) — 결과 카드의 두 번째 면 */
function receiptCardHTML(result){
  const R=buildReceipt(), s=R.s, color=result.color;
  const sgn=v=> (Math.abs(v)<0.005?'±0':(v>0?'+':'')+(Math.abs(v)<1?v.toFixed(2):Math.round(v)));
  const row=(l,v,b)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;${b?'font-weight:700':''}"><span>${l}</span><span style="text-align:right">${v}</span></div>`;
  const dash=`<div style="border-top:1px dashed #c2b9a3;margin:8px 0"></div>`;
  return `
  <div id="receiptCard" class="relative w-full max-w-[400px] my-auto flex-col rounded-[20px] overflow-hidden animate-pop"
       style="display:none; aspect-ratio:9/16; max-height:calc(100dvh - 24px); background:#0b1020; border:1px solid ${color}55; box-shadow:0 30px 80px -20px ${color}66;">
    <div style="flex:1; min-height:0; overflow-y:auto; padding:16px;">
      <div id="receiptPaper" style="color-scheme:light; forced-color-adjust:none; font-family:'Courier New',ui-monospace,monospace; background:#f5f1e6; color:#23201a; border-radius:10px; padding:18px 16px; box-shadow:0 12px 30px -10px rgba(0,0,0,.6);">
        <div style="text-align:center; letter-spacing:.18em; font-weight:700; font-size:15px;">★ SURVIVE 2050 ★</div>
        <div style="text-align:center; font-size:11px; margin-top:2px;">통치 결산 영수증 · GOVERNANCE RECEIPT</div>
        <div style="text-align:center; font-size:10px; color:#6b6453; margin-top:4px;">난이도 ${R.d.emoji} ${R.d.label} · ${R.date}</div>
        ${dash}
        ${row('통치 스타일', R.persona.emoji+' '+R.persona.name, true)}
        <div style="text-align:right; font-size:9px; letter-spacing:.18em; color:#8a8270;">— ${R.persona.tag} —</div>
        ${row('최애 목표', R.topSdg ? ('SDG '+R.topSdg+' '+R.sdgName) : '—')}
        ${dash}
        ${row('🟢 최선의 결단', '× '+R.g)}
        ${row('🟡 절충의 선택', '× '+R.y)}
        ${row('🟠 아쉬운 균형', '× '+R.o)}
        ${row('🔴 값비싼 선택', '× '+R.rd)}
        ${row('🎲 도박 전적', R.gam ? (R.gw+'승 '+(R.gam-R.gw)+'패') : '없음')}
        ${dash}
        ${row('🌡️ 기온', START.temp.toFixed(2)+' → '+s.temp.toFixed(2)+'°C  ('+sgn(s.temp-START.temp)+')')}
        ${row('🌊 해수면', Math.round(START.sea)+' → '+Math.round(s.sea)+'cm  ('+sgn(s.sea-START.sea)+')')}
        ${row('🌱 생태계', Math.round(START.eco)+' → '+Math.round(s.eco)+'%  ('+sgn(s.eco-START.eco)+')')}
        ${dash}
        <div style="font-size:10px; color:#6b6453;">시그니처 정책</div>
        <div style="font-weight:700; font-size:12px; margin-top:2px;">"${R.sigText}"</div>
        ${dash}
        ${row('최종 등급', result.grade, true)}
        ${row('지속가능성', R.scorePct+'% · '+s.score+'점', true)}
        <div style="border-top:2px solid #23201a;margin:9px 0"></div>
        <div style="height:34px;background:repeating-linear-gradient(90deg,#23201a 0 2px,transparent 2px 4px,#23201a 4px 5px,transparent 5px 9px);margin:4px 0;"></div>
        <div style="text-align:center;font-size:10px;letter-spacing:.04em;">#2050지구생존  #순천대  #지구통제실</div>
        <div style="text-align:center;font-size:11px;margin-top:8px;color:#6b6453;">고객님의 지구를 이용해 주셔서<br/>감사합니다 🌍</div>
      </div>
    </div>
    <div class="shrink-0" style="padding:0 14px 16px;">
      <div class="grid grid-cols-2 gap-2">
        <button onclick="shareReceipt()" class="rounded-full py-3 font-black text-xs text-slate-950 active:scale-95 transition shadow-lg" style="background:${color}">📸 영수증 저장</button>
        <button onclick="toggleReceipt(false)" class="rounded-full py-3 font-black text-xs glass-soft border border-white/10 text-slate-200 active:scale-95 transition">← 결과 카드</button>
      </div>
    </div>
  </div>`;
}
function toggleReceipt(show){
  const a=document.getElementById('shareCard'), b=document.getElementById('receiptCard');
  if(!a||!b) return;
  a.style.display = show ? 'none' : 'flex';
  b.style.display = show ? 'flex' : 'none';
  if(soundEnabled) playChordSynth(show?[659.25,880]:[392,523.25],'sine',0.12,0.04);
}
/* 영수증 → 9:16 PNG(크림 종이 + 바코드) 직접 렌더 */
async function buildReceiptBlob(result){
  try{ if(document.fonts && document.fonts.ready) await document.fonts.ready; }catch(e){}
  const R=buildReceipt(), s=R.s;
  const PW=760, M=72, F="'Courier New', monospace";
  const OUT_W=1080, OUT_H=1920, k=OUT_W/PW;            // 정확한 9:16 스토리 규격 → 기종·노치 무관·크롭 0. 캔버스는 픽셀이라 시스템 다크모드 영향 없음
  const cv=document.createElement('canvas'); cv.width=OUT_W; cv.height=OUT_H; const ctx=cv.getContext('2d');
  ctx.fillStyle='#0b1020'; ctx.fillRect(0,0,OUT_W,OUT_H);
  ctx.scale(k,k);                                       // 이하 좌표는 760폭 「종이 공간」 기준
  const W=PW, H=OUT_H/k;                                // W=760, H≈1351 (종이 공간) — 크림 종이를 9:16 정중앙에 배치
  ctx.fillStyle='#f5f1e6'; rrect(ctx,28,28,W-56,H-56,28); ctx.fill();
  let y=118;
  const line=(t,sz,col,al,bold)=>{ ctx.fillStyle=col||'#23201a'; ctx.font=(bold?'700 ':'')+sz+'px '+F; ctx.textAlign=al||'left'; ctx.fillText(t, al==='center'?W/2:(al==='right'?W-M:M), y); };
  const rowC=(l,v,bold)=>{ ctx.fillStyle='#23201a'; ctx.font=(bold?'700 ':'')+30+'px '+F; ctx.textAlign='left'; ctx.fillText(l,M,y); ctx.textAlign='right'; ctx.fillText(v,W-M,y); y+=44; };
  const dash=()=>{ ctx.strokeStyle='#c2b9a3'; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.moveTo(M,y-16); ctx.lineTo(W-M,y-16); ctx.stroke(); ctx.setLineDash([]); y+=12; };
  const sgn=v=>(v>0?'+':'')+(Math.abs(v)<1?v.toFixed(2):Math.round(v));
  line('★ SURVIVE 2050 ★',36,'#23201a','center',true); y+=46;
  line('통치 결산 영수증 · GOVERNANCE RECEIPT',22,'#23201a','center'); y+=36;
  line('난이도 '+R.d.emoji+' '+R.d.label+' · '+R.date,20,'#6b6453','center'); y+=40; dash();
  rowC('통치 스타일', R.persona.emoji+' '+R.persona.name, true);
  line('— '+R.persona.tag+' —',18,'#8a8270','right'); y+=36;
  rowC('최애 목표', R.topSdg?('SDG '+R.topSdg):'—'); dash();
  rowC('🟢 최선의 결단','× '+R.g); rowC('🟡 절충의 선택','× '+R.y); rowC('🟠 아쉬운 균형','× '+R.o); rowC('🔴 값비싼 선택','× '+R.rd);
  rowC('🎲 도박 전적', R.gam?(R.gw+'승 '+(R.gam-R.gw)+'패'):'없음'); dash();
  rowC('🌡️ 기온', START.temp.toFixed(2)+'→'+s.temp.toFixed(2)+'°C ('+sgn(s.temp-START.temp)+')');
  rowC('🌊 해수면', Math.round(START.sea)+'→'+Math.round(s.sea)+' ('+sgn(s.sea-START.sea)+')');
  rowC('🌱 생태계', Math.round(START.eco)+'→'+Math.round(s.eco)+'% ('+sgn(s.eco-START.eco)+')'); dash();
  line('시그니처 정책',20,'#6b6453','left'); y+=36;
  wrapChars(ctx,'"'+R.sigText+'"',W-2*M,2).forEach(t=>{ line(t,28,'#23201a','left',true); y+=38; });
  dash();
  rowC('최종 등급', result.grade, true);
  rowC('지속가능성', R.scorePct+'% · '+s.score+'점', true);
  ctx.strokeStyle='#23201a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(M,y-8); ctx.lineTo(W-M,y-8); ctx.stroke(); y+=18;
  for(let x=M; x<W-M; ){ const w=2+Math.floor(Math.random()*5); ctx.fillStyle='#23201a'; ctx.fillRect(x,y,w,46); x+=w+2+Math.floor(Math.random()*5); } y+=86;
  line('#2050지구생존   #순천대',20,'#23201a','center'); y+=40;
  line('고객님의 지구를 이용해 주셔서',20,'#6b6453','center'); y+=30;
  line('감사합니다 🌍',22,'#6b6453','center');
  return await new Promise(res=>cv.toBlob(res,'image/png',0.95));
}
async function shareReceipt(){
  const result = LAST_ENDING && LAST_ENDING.result; if(!result) return;
  const btn=document.querySelector('#receiptCard button[onclick="shareReceipt()"]'); const o=btn?btn.textContent:'';
  if(btn){ btn.textContent='🧾 생성 중…'; btn.disabled=true; }
  try{
    const blob=await buildReceiptBlob(result);
    if(!blob){ miniToast('이미지 생성 실패 — 스크린샷으로 공유해 주세요 📸'); return; }
    const file=new File([blob],'survive2050_receipt.png',{type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file]}); return; }catch(e){ if(e&&e.name==='AbortError') return; } }
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='survive2050_receipt.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
    miniToast('감성 영수증을 저장했어요! 🧾');
  }catch(e){ miniToast('이미지 생성 실패 — 스크린샷으로 공유해 주세요 📸'); }
  finally{ if(btn){ btn.textContent=o; btn.disabled=false; } }
}

/* ═══════════════ 8. 인스타 스토리 공유용 카드뉴스 엔딩(9:16) ═══════════════ */
function renderEndingCard(result){
  // 엔딩 제목/설명은 함수(ENDING_RULES)에서 나오므로 렌더 시점에 번역(EN, TX_EN에 있을 때)
  if(window.LANG==='en' && window.TX_EN) result = Object.assign({}, result, { title: tx(result.title), desc: tx(result.desc) });
  if(G) G.renderingHalted = result.collapse ? true : G.renderingHalted;
  document.getElementById('warn').className = 'hidden';
  const root = document.getElementById('app-root');
  root.classList.remove('earthquake','glitch-red');
  root.style.display = 'none';   // 게임 화면을 완전히 숨겨 마지막 선택이 비쳐 보이지 않게
  setSky(result.color, result.color+'55', '#05060e');
  spawnParticles((G && G.stats && G.stats.eco < 33) ? 'smog' : 'eco');

  const s = (G && G.stats) ? G.stats : freshStats();
  const hist = (G && G.history) ? G.history : [];
  const scorePct = Math.round((s.score / MAX_SCORE) * 100);
  const d = diffCfg();
  LAST_ENDING = { result, s:{ ...s }, scorePct, history: hist.map(h=>({ sdg:h.sdg, step:h.step, choice:h.choice, baseScore:h.baseScore })) };

  // 📜 개인화 통치 크로니클
  const chron = buildChronicle();
  const chronicleHTML = `
    <div class="text-[11px] font-bold text-amber-300 mb-1.5">📜 당신이 통치한 2050년의 기록</div>
    <div class="space-y-1.5 mb-3">
      ${chron.map(t=>`<div class="text-[11px] leading-relaxed text-slate-200 bg-white/5 border border-white/5 rounded-lg p-2">${t}</div>`).join('')}
    </div>`;

  // SDGs 엔딩 성적표(난이도와 무관하게 항상 SDG 뱃지 노출)
  let report = hist.map(l=>{
    const m = SDG[l.sdg] || { name:'SDGs', color:'#64748b', url:'#' };
    const mark = l.baseScore>=20 ? '🟢' : (l.baseScore>=10 ? '🟡' : '🔴');
    return `
      <div class="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
        <div class="shrink-0 grid place-items-center rounded-md font-black text-white text-[9px]" style="width:30px;height:30px;background:${m.color}">${l.sdg}</div>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-bold truncate text-slate-100">${l.choice}</div>
          <div class="text-[9px] text-slate-400 truncate">${l.step+1}단계 · ${m.name}</div>
        </div>
        <div class="shrink-0 text-sm">${mark}</div>
      </div>`;
  }).join('');
  if(!report) report = '<div class="text-center text-[11px] text-slate-400 py-3">조기 종료로 기록이 부족합니다.</div>';

  const chip = (icon,label,val,col)=>`
    <div class="rounded-xl bg-white/5 border border-white/5 p-2.5 text-left">
      <div class="text-[10px] text-slate-400">${icon} ${label}</div>
      <div class="font-extrabold text-base leading-none mt-0.5" style="color:${col}">${val}</div>
    </div>`;

  const color = result.color;
  const ov = document.getElementById('endingOverlay');
  ov.innerHTML = `
    <div class="w-full h-[100dvh] overflow-y-auto flex justify-center"
         style="background: radial-gradient(120% 80% at 50% 0%, ${color}26, transparent 55%), #05060e; padding: calc(12px + var(--safe-top)) 12px calc(12px + var(--safe-bot));">
      <div id="shareCard" class="relative w-full max-w-[400px] my-auto flex flex-col rounded-[28px] overflow-hidden animate-pop"
           style="aspect-ratio:9/16; max-height: calc(100dvh - 24px); background:linear-gradient(180deg, #0b1020 0%, ${color}1f 52%, #05060e 100%); border:1px solid ${color}55; box-shadow:0 30px 80px -20px ${color}66, inset 0 0 90px -45px ${color};">

        <div class="px-5 pt-5 pb-1 text-center shrink-0">
          <div class="font-tech text-[10px] tracking-[0.32em] text-slate-300">SURVIVE 2050 · FINAL REPORT</div>
          <div class="mt-1 text-[10px] text-slate-400">난이도 ${d.emoji} ${d.label}</div>
        </div>

        <div class="flex flex-col items-center px-5 pt-1 shrink-0">
          <div class="grid place-items-center rounded-full font-tech font-black"
               style="width:92px;height:92px;color:#05060e;background:${color};box-shadow:0 0 42px ${color}aa;font-size:46px;">${result.grade}</div>
          <div class="mt-1.5 text-[11px] font-bold tracking-wider" style="color:${color}">최종 등급</div>
          <h2 class="mt-1.5 text-lg font-black text-white text-center leading-tight px-2">${result.title}</h2>
        </div>

        <div class="px-5 pt-2 shrink-0">
          <p class="text-[11px] leading-relaxed text-slate-300 text-center bg-black/30 rounded-xl p-3 border border-white/5">${result.desc}</p>
        </div>

        <div class="px-5 pt-3 grid grid-cols-2 gap-2 shrink-0">
          ${chip('🌡️','평균 기온', '+'+s.temp.toFixed(2)+'°C', '#f87171')}
          ${chip('🌊','글로벌 해수면', '+'+Math.round(s.sea)+'cm', '#22d3ee')}
          ${chip('🌱','대자연 생태', Math.round(s.eco)+'%', '#34d399')}
          ${chip('🏆','지속가능성', scorePct+'% · '+s.score+'점', '#fbbf24')}
        </div>
        ${(d.budget && G) ? `<div class="px-5 pt-2 shrink-0"><div class="rounded-xl bg-amber-500/10 border border-amber-500/25 p-2.5 text-center text-[11px] font-bold text-amber-200">${resTheme().emoji} 남은 ${resTheme().name} ${G.budget}${resTheme().unit} / ${G.budgetTotal}${resTheme().unit}</div></div>` : ''}

        <div class="px-5 pt-3 pb-1 flex-1 min-h-0 flex flex-col">
          <div class="overflow-y-auto pr-1">
            ${chronicleHTML}
            <div class="text-[11px] font-bold text-slate-300 mb-1.5">🎓 SDGs 엔딩 성적표</div>
            <div class="space-y-1.5">${report}</div>
          </div>
        </div>

        <div class="px-5 pb-5 pt-2 shrink-0">
          <div class="text-center text-[10px] text-slate-400 mb-2">#순천대 #SDGs #지구통제실 #2050지구생존</div>
          <button onclick="toggleReceipt(true)" class="w-full mb-2 rounded-full py-2.5 font-black text-xs bg-amber-50 text-slate-900 active:scale-95 transition shadow-lg">🧾 감성 영수증 보기 (스포티파이 랩드)</button>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="shareResult()" class="rounded-full py-3 font-black text-xs text-slate-950 active:scale-95 transition shadow-lg" style="background:${color}">📸 스토리 카드 공유</button>
            <button onclick="restartGame()" class="rounded-full py-3 font-black text-xs glass-soft border border-white/10 text-slate-200 active:scale-95 transition">🔄 다시 도전</button>
          </div>
        </div>
      </div>
      ${receiptCardHTML(result)}
    </div>`;
  ov.classList.remove('hidden');

  if(soundEnabled){
    if(result.grade === 'F') playChordSynth([146.83,110,82.41],'sawtooth',1.0,0.05);
    else if(result.grade === 'S' || result.grade === 'A') playChordSynth([523.25,659.25,783.99,1046.5],'sine',0.8,0.05);
    else playChordSynth([392,523.25],'triangle',0.6,0.04);
  }
}

function miniToast(msg){
  const t = document.createElement('div');
  t.className = 'fixed left-1/2 -translate-x-1/2 z-[120] glass-main rounded-full px-4 py-2 text-xs font-bold text-white animate-pop shadow-2xl border border-white/10';
  t.style.bottom = 'calc(22px + var(--safe-bot))';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2800);
}
/* ── 색상 유틸(카드 이미지 렌더용) ── */
function hx(h){ h=h.replace('#',''); return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]; }
function hexA(hex,a){ const [r,g,b]=hx(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(h1,h2,t){ const a=hx(h1),b=hx(h2); return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`; }
function lum(hex){ const [r,g,b]=hx(hex); return (0.299*r+0.587*g+0.114*b)/255; }
function rrect(ctx,x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function wrapChars(ctx,text,maxW,maxLines){
  const lines=[]; let line='';
  for(const ch of String(text)){
    const test = line+ch;
    if(ctx.measureText(test).width>maxW && line){ lines.push(line); line=ch; if(maxLines && lines.length>=maxLines) break; }
    else line=test;
  }
  if(line && (!maxLines || lines.length<maxLines)) lines.push(line);
  if(maxLines && lines.length>maxLines) lines.length=maxLines;
  return lines;
}

/* ── 인스타 스토리용 9:16 카드뉴스 이미지(1080×1920 PNG) 직접 렌더 ── */
async function buildShareBlob(){
  if(!LAST_ENDING) return null;
  try{ if(document.fonts && document.fonts.ready) await document.fonts.ready; }catch(e){}
  const { result, s, scorePct, history } = LAST_ENDING;
  const color = result.color, F='"Noto Sans KR", sans-serif';
  const W=1080, H=1920, cx=W/2, padX=72, panelW=W-2*padX;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');

  // 배경(불투명) + 상단 후광 + 테두리
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#0b1020'); bg.addColorStop(0.5,mix(color,'#05060e',0.82)); bg.addColorStop(1,'#05060e');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const rg=ctx.createRadialGradient(cx,-120,40,cx,-120,920);
  rg.addColorStop(0,hexA(color,0.32)); rg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=rg; ctx.fillRect(0,0,W,760);
  ctx.strokeStyle=hexA(color,0.45); ctx.lineWidth=6; rrect(ctx,12,12,W-24,H-24,44); ctx.stroke();

  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  let y=128;
  ctx.fillStyle='#cbd5e1'; ctx.font='700 30px '+F; ctx.fillText('SURVIVE 2050 · FINAL REPORT', cx, y); y+=46;
  ctx.fillStyle='#94a3b8'; ctx.font='600 26px '+F; ctx.fillText('난이도 '+diffCfg().emoji+' '+diffCfg().label, cx, y); y+=64;

  // 등급 원형 배지
  const r=88, ccy=y+r;
  ctx.beginPath(); ctx.arc(cx,ccy,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
  ctx.fillStyle = lum(color)<0.55 ? '#ffffff' : '#05060e';
  ctx.font='900 104px '+F; ctx.textBaseline='middle'; ctx.fillText(result.grade, cx, ccy+6); ctx.textBaseline='alphabetic';
  y=ccy+r+50;
  ctx.fillStyle=color; ctx.font='700 26px '+F; ctx.fillText('최종 등급', cx, y); y+=54;

  // 엔딩 타이틀(최대 2줄)
  ctx.fillStyle='#ffffff'; ctx.font='900 48px '+F;
  wrapChars(ctx, result.title, W-220, 2).forEach(line=>{ ctx.fillText(line, cx, y); y+=60; });
  y+=12;

  // 설명 패널(최대 6줄)
  ctx.font='400 30px '+F;
  const dlines=wrapChars(ctx, result.desc, panelW-72, 6);
  const lineH=42, panelH=dlines.length*lineH+52;
  ctx.fillStyle='rgba(0,0,0,0.30)'; rrect(ctx,padX,y,panelW,panelH,28); ctx.fill();
  ctx.fillStyle='#cbd5e1'; let ty=y+46; dlines.forEach(line=>{ ctx.fillText(line, cx, ty); ty+=lineH; });
  y+=panelH+30;

  // 지표 칩 2×2
  const chips=[ ['🌡️ 평균 기온','+'+s.temp.toFixed(2)+'°C','#f87171'],
               ['🌊 글로벌 해수면','+'+Math.round(s.sea)+'cm','#22d3ee'],
               ['🌱 대자연 생태', Math.round(s.eco)+'%','#34d399'],
               ['🏆 지속가능성', scorePct+'% · '+s.score+'점','#fbbf24'] ];
  const gap=20, cw=(panelW-gap)/2, chH=112;
  ctx.textAlign='left';
  chips.forEach((c,i)=>{
    const x=padX+(i%2)*(cw+gap), yy=y+Math.floor(i/2)*(chH+gap);
    ctx.fillStyle='rgba(255,255,255,0.06)'; rrect(ctx,x,yy,cw,chH,22); ctx.fill();
    ctx.fillStyle='#94a3b8'; ctx.font='600 25px '+F; ctx.fillText(c[0], x+26, yy+44);
    ctx.fillStyle=c[2];     ctx.font='800 42px '+F; ctx.fillText(c[1], x+26, yy+92);
  });
  y+=2*chH+gap+38;

  // SDGs 엔딩 성적표
  ctx.fillStyle='#e2e8f0'; ctx.font='700 28px '+F; ctx.fillText('🎓 SDGs 엔딩 성적표', padX, y); y+=40;
  const rows=(history||[]).slice(0,10), rowH=52;
  rows.forEach(l=>{
    const m=SDG[l.sdg]||{name:'SDGs',color:'#64748b'};
    const mark=l.baseScore>=20?'🟢':(l.baseScore>=10?'🟡':'🔴');
    ctx.fillStyle='rgba(255,255,255,0.05)'; rrect(ctx,padX,y,panelW,rowH-8,16); ctx.fill();
    ctx.fillStyle=m.color; rrect(ctx,padX+12,y+6,32,32,8); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='800 19px '+F; ctx.textAlign='center'; ctx.fillText(String(l.sdg), padX+28, y+28); ctx.textAlign='left';
    ctx.fillStyle='#e2e8f0'; ctx.font='700 25px '+F;
    let full=(l.step+1)+'단계 · '+l.choice, txt=full;
    if(ctx.measureText(txt).width>panelW-150){ while(ctx.measureText(txt+'…').width>panelW-150 && txt.length>4) txt=txt.slice(0,-1); txt+='…'; }
    ctx.fillText(txt, padX+58, y+32);
    ctx.textAlign='right'; ctx.font='26px '+F; ctx.fillStyle='#fff'; ctx.fillText(mark, padX+panelW-16, y+32); ctx.textAlign='left';
    y+=rowH;
  });
  if(!rows.length){ ctx.fillStyle='#94a3b8'; ctx.font='400 26px '+F; ctx.fillText('조기 종료로 기록이 부족합니다.', padX, y+30); }

  // 푸터 해시태그
  ctx.textAlign='center'; ctx.fillStyle=hexA(color,0.92); ctx.font='700 26px '+F;
  ctx.fillText('#순천대  #SDGs  #지구통제실  #2050지구생존', cx, H-70);

  return await new Promise(res=> cv.toBlob(res,'image/png',0.95));
}

/* 공유: 카드뉴스 이미지를 그대로 공유/저장(텍스트 없이 인스타 스토리에 바로 업로드) */
async function shareResult(){
  if(!LAST_ENDING) return;
  const btn = document.querySelector('#shareCard button[onclick="shareResult()"]');
  const origin = btn ? btn.textContent : '';
  if(btn){ btn.textContent='🖼️ 카드 생성 중…'; btn.disabled=true; }
  try{
    const blob = await buildShareBlob();
    if(!blob){ miniToast('이미지 생성에 실패했어요. 스크린샷으로 공유해 주세요 📸'); return; }
    const file = new File([blob], 'survive2050.png', { type:'image/png' });

    // 1순위: 파일 공유(모바일 → 인스타 스토리 등으로 바로 전송)
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      try{ await navigator.share({ files:[file] }); return; }
      catch(e){ if(e && e.name==='AbortError') return; }
    }
    // 폴백: 이미지 다운로드(저장 후 스토리에 업로드)
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='survive2050.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
    miniToast('결과 카드 이미지를 저장했어요! 인스타 스토리에 올려보세요 📸');
  }catch(e){
    miniToast('이미지 생성에 실패했어요. 스크린샷으로 공유해 주세요 📸');
  }finally{
    if(btn){ btn.textContent=origin; btn.disabled=false; }
  }
}

/* ═══════════════ 9. 시네마틱 인트로 + 난이도 + 업적 진열장 ═══════════════ */
function screenIntro(){
  const stage = document.getElementById('stage');
  document.getElementById('app-root').style.display = '';   // 엔딩에서 숨겼던 게임 화면 복원
  document.getElementById('app-root').classList.remove('earthquake','glitch-red');
  const ov = document.getElementById('endingOverlay');
  if(ov){ ov.classList.add('hidden'); ov.innerHTML=''; }

  const earned = getBadges();
  const badgeHTML = Object.keys(ACH_META).map(key=>{
    const ok = earned.includes(key);
    const ic = ACH_META[key].name.split(' ')[0];
    const nm = ACH_META[key].name.split(' ').slice(1).join(' ');
    return `<div class="p-2 rounded-lg text-center ${ok?'bg-amber-500/10 border border-amber-500/30 text-amber-300':'bg-white/5 opacity-30 text-slate-500'} text-[10px]">
        <div class="text-base mb-0.5">${ic}</div><div class="font-bold truncate">${nm}</div></div>`;
  }).join('');

  // 난이도 선택 칩
  const diffHTML = Object.values(DIFFS).map(dd=>{
    const on = dd.key === currentDiff;
    return `<button onclick="selectDiff('${dd.key}')" class="rounded-xl p-2 text-center border transition active:scale-95 ${on?'bg-emerald-500/20 border-emerald-400 text-emerald-100':'bg-white/5 border-white/10 text-slate-400'}">
        <div class="text-base leading-none">${dd.emoji}</div>
        <div class="text-[11px] font-bold mt-1">${t('diff_label_'+dd.key)}</div>
      </button>`;
  }).join('');

  // 🗓️ 데일리 챌린지 토글(날짜 시드 → 모두가 같은 판)
  const dailyHTML = `<button onclick="toggleDaily()" class="w-full rounded-xl p-2 mb-4 text-center border transition active:scale-95 ${dailyMode?'bg-sky-500/20 border-sky-400 text-sky-100':'bg-white/5 border-white/10 text-slate-400'}">
      <span class="text-xs font-bold">${dailyMode?t('daily_on'):t('daily_off')}</span>
      <div class="text-[10px] opacity-80 mt-0.5">${dailyMode?t('daily_desc_on'):t('daily_desc_off')}</div>
    </button>`;

  // 🎬 엔딩 도감(발견/미발견 실루엣)
  const seenEnd = getEndingDex();
  const dexHTML = Object.keys(ENDING_DEX).map(id=>{
    const ok = seenEnd.includes(id), m = ENDING_DEX[id];
    return `<div class="p-1.5 rounded-lg text-center ${ok?'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200':'bg-white/5 opacity-40 text-slate-500'} text-[9px]">
        <div class="text-sm leading-none">${ok?m.emoji:'❔'}</div>
        <div class="font-bold truncate mt-0.5">${ok?m.name:'???'}</div></div>`;
  }).join('');

  // 시네마틱 인트로 잔불(재) 입자
  let embers = '';
  for(let i=0;i<10;i++){
    const l = (Math.random()*100).toFixed(1);
    const dur = (6+Math.random()*6).toFixed(1);
    const dl  = (-Math.random()*8).toFixed(1);
    const sz  = (2+Math.random()*3).toFixed(0);
    embers += `<span class="hero-ember" style="left:${l}%; width:${sz}px; height:${sz}px; animation-duration:${dur}s; animation-delay:${dl}s"></span>`;
  }

  G = null; updateSky(); updateHeat();   // 인트로는 시원한 기본 하늘 + 입자(열기 0)
  // 상단 지표를 시작값으로 리셋(직전 게임 잔상 제거)
  document.getElementById('vTemp').innerText = START.temp.toFixed(2);
  document.getElementById('vSea').innerText  = START.sea;
  document.getElementById('vEco').innerText  = START.eco;
  document.getElementById('bTemp').style.width = clamp((START.temp/4)*100,4,100)+'%';
  document.getElementById('bSea').style.width  = clamp((START.sea/120)*100,2,100)+'%';
  document.getElementById('bEco').style.width  = clamp(START.eco,2,100)+'%';

  const hasSave = !!readSave();
  stage.innerHTML = `
    <div class="animate-fade-in">
      <!-- 시네마틱 히어로 아트(지구·파도·도시·구름·새싹 조합 제거) -->
      <div class="intro-hero mb-4">
        <div class="hero-sun"></div>
        <div class="hero-haze"></div>
        <div class="hero-skyline"></div>
        <div class="hero-grid"></div>
        ${embers}
        <div class="hero-title-wrap">
          <div class="hero-yr">CLIMATE CONTROL · YEAR</div>
          <div class="hero-2050">2050</div>
          <div class="hero-kr">${t('hero_tagline')}</div>
        </div>
      </div>

      <div class="glass-main p-5 rounded-2xl shadow-xl">
        <p class="text-xs text-slate-400 text-center mb-3">${t('intro_sub',{n:TOTAL_STAGES})}</p>

        <!-- 📖 핵심 루프 안내(항상 노출) — 처음 온 사람도 목표를 알게 -->
        <div class="rounded-xl bg-white/5 border border-white/10 p-3 mb-4 text-left">
          <div class="text-[11px] font-bold text-emerald-300 mb-1">${t('howto_title')}</div>
          <p class="text-[10px] text-slate-300 leading-relaxed">${t('howto_body')}</p>
          <div class="grid grid-cols-3 gap-1.5 mt-2 text-[9px] font-bold">
            <div class="rounded-lg bg-black/25 p-1.5 text-center">${t('dir_temp')}<br/><span class="text-emerald-300">${t('dir_low')}</span></div>
            <div class="rounded-lg bg-black/25 p-1.5 text-center">${t('dir_sea')}<br/><span class="text-emerald-300">${t('dir_low')}</span></div>
            <div class="rounded-lg bg-black/25 p-1.5 text-center">${t('dir_eco')}<br/><span class="text-emerald-300">${t('dir_high')}</span></div>
          </div>
          <p class="text-[9px] text-amber-300/80 mt-2">${t('gravity_intro')}</p>
        </div>

        <div class="mb-1.5 text-[11px] font-bold text-slate-300 text-left">${t('diff_select')}</div>
        <div class="grid grid-cols-4 gap-2 mb-1.5">${diffHTML}</div>
        <p class="text-[10px] text-slate-400 leading-relaxed mb-3 min-h-[26px]">${t('note_'+currentDiff)}</p>

        <!-- 🪙 특수 모드 + 오버차지 가이드(접이식, JS 불필요) -->
        <details class="mb-3 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <summary class="cursor-pointer select-none list-none px-3 py-2.5 text-[11px] font-bold text-slate-200 flex items-center justify-between gap-2">
            <span>${t('guide_summary')}</span>
            <span class="text-slate-500 text-[10px] shrink-0">${t('guide_more')} ▾</span>
          </summary>
          <div class="px-3 pb-3 pt-1 space-y-2 text-[10px] leading-relaxed text-slate-300">
            <div><b class="text-amber-300">💰 예산 모드</b> (경제·산업 / SDG 8·9·12) — 매 턴 <b>2개 소비 / 2개 자금 확보(환급)</b>로 갈립니다. 남긴 예산엔 복리 이자(+8%)가 붙지만, <b>기온 1.5°C 초과분</b>만큼 재난 복구비가 차압돼요. 철강·공급망·탄소국경세 같은 <b>일자리 트레이드오프</b> 시나리오가 등장합니다.</div>
            <div><b class="text-sky-300">🗳️ 정치 모드</b> (사회·불평등 / SDG 1·10·16) — 강한 규제는 지지율↓·인기영합은 지지율↑. <b>3·6·9단계 임기 심사(35% 이상)</b> 통과 필수. <b>초반 정치자본은 빠듯</b>하고, 후반엔 <b>정공법(최선 연타)으로 쌓은 점수만큼 자본이 폭발 회복</b>돼요(줬다 뺏기). 유류세·기후난민·에너지빈곤 같은 <b>계층 갈등</b> 시나리오가 나옵니다.</div>
            <div class="rounded-lg bg-gradient-to-r from-amber-500/15 to-fuchsia-500/10 border border-amber-300/40 p-2.5">
              <b class="text-amber-200">⚡ 오버차지 (상한 초과 비축)</b> — 자원 보유 <b>상한이 없습니다</b>. 100%를 넘기면 게이지가 금빛(예산)·보랏빛(정치)으로 흐르는 「과충전」이 돼요. 예산은 <b>후반 몰빵용 실탄</b>, 정치는 <b>임기 심사 버퍼</b>. (부족할 때만 붉은 경고)
            </div>
            <div class="text-slate-500">💡 두 모드 모두 벼랑 끝 탈출용 <b>비상대책(판당 1회)</b>이 숨어 있습니다. · 도전/하드코어는 생태(기온·해수면) 중심입니다.</div>
          </div>
        </details>
        ${dailyHTML}

        <button id="startBtn" class="glow-pulse w-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black py-3.5 text-sm active:scale-95 transition shadow-xl mb-2.5">
          ${t('start_new')}
        </button>
        ${hasSave?`<button id="resumeBtn" class="w-full rounded-full glass-soft border border-white/10 text-slate-200 font-bold py-3 text-sm active:scale-95 transition mb-5">${t('resume')}</button>`:'<div class="mb-5"></div>'}

        <div class="border-t border-white/5 pt-4">
          <div class="text-xs font-bold text-slate-400 text-left mb-2">${t('ach_title')} (${earned.length}/${Object.keys(ACH_META).length})</div>
          <div class="grid grid-cols-5 gap-1.5">${badgeHTML}</div>
        </div>

        <div class="border-t border-white/5 pt-4 mt-4">
          <div class="text-xs font-bold text-slate-400 text-left mb-2">${t('dex_title')} (${seenEnd.length}/${Object.keys(ENDING_DEX).length})</div>
          <div class="grid grid-cols-4 gap-1.5">${dexHTML}</div>
        </div>
      </div>
    </div>`;

  // 사용자 클릭 시점에 오디오 가동(자동재생 정책 대응)
  document.getElementById('startBtn').onclick = ()=>{ if(!soundEnabled) toggleSound(); startGame(); };
  const rb = document.getElementById('resumeBtn');
  if(rb) rb.onclick = ()=>{ if(!soundEnabled) toggleSound(); loadGame(); };
}

function startGame(){
  document.getElementById('app-root').style.display = '';
  setupRNG();   // 데일리 모드면 날짜 시드 RNG로 교체(친구와 같은 판)
  G = { stats: freshStats(), history: [], currentStep: 0, gameQueue: [], modifier: null,
        renderingHalted: false, rollTimers: [], budget: 0, budgetTotal: 0,
        flags: new Set(), pending: [], gambleWins: 0, choiceTimer: null, daily: dailyMode,
        approval: 60, panicUsed: false, ocAnnounced: false };   // [정치] 시작 지지율 60% · 패닉 1회 · 오버차지 최초 알림
  buildQueue();
  if(diffCfg().budget){ G.budgetTotal = computeBudget(); G.budget = G.budgetTotal; }
  document.getElementById('warn').className = 'hidden';
  document.getElementById('endingOverlay').classList.add('hidden');
  syncHUD(); saveGame();
  renderCurrentScenario();
}
/* 「예산/정치」: 전체 큐의 최대 지출 합의 일부만 지급(자금 확보형 환급으로 숨통)
   · 예산 70% / 정치 95% — 정치는 지지율 페널티·임기 심사가 추가 족쇄라 초기 자본을 더 줘
     S·대전환 엔딩까지 「밀어붙일 루트」를 연다(점수 상한 0.83 → 0.85+ 돌파 가능). */
function computeBudget(){
  let maxSpend = 0;
  G.gameQueue.forEach(it=>{ maxSpend += Math.max(...it.scene.choices.map(c=>costOf(c, it.tier))); });
  const mult = 0.7;   // 정치도 예산과 동일하게 빠듯한 출발(0.95→0.7) — 초반부터 배부르지 않게
  return Math.round(maxSpend * mult / 10) * 10;
}
function restartGame(){
  if(G) G.renderingHalted = false;
  const ov = document.getElementById('endingOverlay');
  ov.classList.add('hidden'); ov.innerHTML='';
  clearSave();
  screenIntro();
}

/* ═══════════════ 10. 저장 / 복구 ═══════════════ */
const STORAGE_KEY = 'survive2050_save';
function saveGame(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      currentStep:G.currentStep, gameQueue:G.gameQueue, stats:G.stats, history:G.history,
      diff:currentDiff, budget:G.budget, budgetTotal:G.budgetTotal, savedAt:Date.now(),
      flags:[...(G.flags||[])], pending:G.pending||[], gambleWins:G.gambleWins||0, daily:!!G.daily,
      approval:(typeof G.approval==='number'?G.approval:60), panicUsed:!!G.panicUsed, ocAnnounced:!!G.ocAnnounced,
    }));
  }catch(e){}
}
function readSave(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY); if(!raw) return null;
    const d = JSON.parse(raw);
    const ok = d && typeof d.currentStep==='number' && Array.isArray(d.gameQueue) &&
      d.gameQueue.length===TOTAL_STAGES && d.stats && typeof d.stats.temp==='number' &&
      Array.isArray(d.history) && d.currentStep>=1 && d.currentStep<TOTAL_STAGES;
    if(!ok) return null;
    if(d.gameQueue.some(q=> !q || !q.scene || !Array.isArray(q.scene.choices))) return null;
    return d;
  }catch(e){ return null; }
}
function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }
function loadGame(){
  const saved = readSave(); if(!saved){ startGame(); return; }
  document.getElementById('app-root').style.display = '';
  if(saved.diff && DIFFS[saved.diff]) currentDiff = saved.diff;
  dailyMode = !!saved.daily; setupRNG();
  G = { currentStep: saved.currentStep, gameQueue: saved.gameQueue, stats: saved.stats,
        history: saved.history, modifier: null, renderingHalted: false, rollTimers: [],
        budget: (typeof saved.budget==='number'?saved.budget:0), budgetTotal: (typeof saved.budgetTotal==='number'?saved.budgetTotal:0),
        flags: new Set(Array.isArray(saved.flags)?saved.flags:[]), pending: Array.isArray(saved.pending)?saved.pending:[],
        gambleWins: saved.gambleWins||0, choiceTimer: null, daily: !!saved.daily,
        approval: (typeof saved.approval==='number'?saved.approval:60), panicUsed: !!saved.panicUsed, ocAnnounced: !!saved.ocAnnounced };
  document.getElementById('endingOverlay').classList.add('hidden');
  syncHUD();
  renderCurrentScenario();
}
function syncHUD(){
  document.getElementById('vTemp').innerText = (+G.stats.temp).toFixed(2);
  document.getElementById('vSea').innerText  = Math.round(G.stats.sea);
  document.getElementById('vEco').innerText  = Math.round(G.stats.eco);
  updateBars();
  updateSky();
  updateHeat();
}

/* ═══════════════ 부팅 ═══════════════ */
/* ── 본문(데이터) 번역: 한국어 원문 → 영어. data.en.js + 그룹별 맵을 병합해 치환, 없으면 한국어 유지 ── */
function txMap(){ return window.__TXM || (window.__TXM = Object.assign({},
  window.TX_EN, window.TX_EN_early, window.TX_EN_mid, window.TX_EN_late, window.TX_EN_final)); }
function tx(s){ return (window.LANG==='en') ? (txMap()[s] || s) : s; }
/* data.js의 문자열을 「제자리(in-place)」로 치환 — 숫자·fx·flag·구조는 절대 건드리지 않음. 부팅 시 1회. */
function localizeData(){
  if(window.LANG!=='en') return;
  const M = txMap(), sw = o => k => { if(o[k] && M[o[k]]) o[k] = M[o[k]]; };
  function tc(c){ ['label','tag','feedback','fact'].forEach(sw(c));
    if(c.delay && c.delay.msg && M[c.delay.msg]) c.delay.msg = M[c.delay.msg];
    if(c.gamble){ ['win','lose'].forEach(g=>{ if(c.gamble[g] && c.gamble[g].note && M[c.gamble[g].note]) c.gamble[g].note = M[c.gamble[g].note]; }); } }
  try{
    ['early','mid','late','final'].forEach(g=>(SCENARIOS[g]||[]).forEach(sc=>{ ['title','text','voice'].forEach(sw(sc)); (sc.choices||[]).forEach(tc); }));
    Object.values(EXTRA_CHOICES||{}).forEach(tc);
    (window.ECHOES||[]).forEach(e=>{ if(e.text && M[e.text]) e.text = M[e.text]; });
    Object.values(ENDING_DEX||{}).forEach(d=>{ if(d.name && M[d.name]) d.name = M[d.name]; });
    Object.keys(SDG||{}).forEach(k=>{ if(SDG[k].name && M[SDG[k].name]) SDG[k].name = M[SDG[k].name]; });
  }catch(e){}
}

/* 헤더 등 정적 크롬을 현재 언어로 세팅(인트로/게임 공통) */
function applyChrome(){
  const set=(id,key)=>{ const el=document.getElementById(id); if(el) el.innerText=t(key); };
  set('roomTitle','room_title'); set('lblTemp','stat_temp_label'); set('lblSea','stat_sea_label'); set('lblEco','stat_eco_label');
  const sb=document.getElementById('soundBtn'); if(sb) sb.innerText = soundEnabled ? t('sound_on') : t('sound_off');
  const lb=document.getElementById('langBtn'); if(lb) lb.innerText = t('lang_btn');
}
function boot(){
  localizeData();   // EN이면 data.js 문자열을 제자리 치환(부팅 시 1회) — 이후 모든 렌더가 영어로
  document.getElementById('soundBtn').onclick = toggleSound;
  const lb=document.getElementById('langBtn'); if(lb) lb.onclick = window.cycleLang;
  if(document.documentElement) document.documentElement.lang = window.LANG || 'ko';
  applyChrome();
  syncHUD();
  screenIntro();
}
window.onload = boot;
