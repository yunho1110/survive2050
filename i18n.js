/* ═══════════════════════════════════════════════════════════════
   i18n.js — 다국어 프레임 (data.js·main.js 보다 먼저 로드)
   · LANG 결정: ?lang= → localStorage → navigator → 'ko'
   · t(key): 현재 언어 → 없으면 한국어 폴백 → 없으면 key (그래서 EN 미완성이어도 게임 정상)
   · cycleLang(): 언어 토글 + 저장 + 새로고침
   ※ 1단계(파일럿) 범위: 인트로/헤더/네비 프레임만. 시나리오·엔딩 본문은 추후 data.<lang>.js 단계.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  var SUPPORTED = ['ko','en'];
  function pick(){
    try{
      var u = new URLSearchParams(location.search).get('lang');
      if(u && SUPPORTED.indexOf(u)>=0){ localStorage.setItem('s2050_lang', u); return u; }
      var s = localStorage.getItem('s2050_lang');
      if(s && SUPPORTED.indexOf(s)>=0) return s;
      // 현재 EN은 「프레임(인트로)만」 번역됨 → 외국 브라우저 자동전환은 보류(기본 ko).
      // 시나리오·엔딩까지 번역 완료되면 아래를 navigator 기반 자동감지로 교체.
      return 'ko';
    }catch(e){ return 'ko'; }
  }
  window.LANG = pick();
  window.cycleLang = function(){
    var next = window.LANG==='ko' ? 'en' : 'ko';
    try{ localStorage.setItem('s2050_lang', next); }catch(e){}
    var url = new URL(location.href); url.searchParams.delete('lang'); location.href = url.toString();
  };
  window.t = function(key, vars){
    var d = (window.I18N && window.I18N[window.LANG]) || {};
    var ko = (window.I18N && window.I18N.ko) || {};
    var s = (key in d) ? d[key] : (key in ko ? ko[key] : key);
    if(vars) for(var k in vars){ s = s.split('{'+k+'}').join(vars[k]); }
    return s;
  };
})();

/* ── 프레임 사전: ko 원문 채움 / en 은 Sonnet 번역으로 채움(미채움 키는 자동 한국어 폴백) ── */
window.I18N = {
  ko: {
    /* 헤더 */
    room_title:'지구 통제실',
    sound_off:'🔇 소리 꺼짐', sound_on:'🔊 소리 켜짐',
    stat_temp_label:'🌡️ 기온 상승', stat_sea_label:'🌊 해수면', stat_eco_label:'🌱 생태계 건강',
    lang_btn:'🌐 EN',
    /* 인트로 */
    hero_tagline:'멸망 직전 지구에서 살아남기',
    intro_sub:'UN SDGs 기반 기후 통제 시뮬레이션 · 총 {n}단계의 결단',
    howto_title:'📖 어떻게 작동하나',
    howto_body:'매 턴 기후 위기를 읽고 <b>4개 정책 중 하나</b>를 고릅니다. 아래 <b>세 지표</b>를 관리해 <b>10단계</b> 뒤 <b>12개 엔딩</b> 중 하나에 도달해요. 선택 직후 결과 화면이 🟢최선~🔴값비싼 <b>판정과 수치 변화</b>를 바로 알려줍니다.',
    dir_temp:'🌡️ 기온', dir_sea:'🌊 해수면', dir_eco:'🌱 생태계',
    dir_low:'낮을수록 좋음', dir_high:'높을수록 좋음',
    gravity_intro:'🌍 <b>글로벌 자원 압박</b>: 매 턴 기본으로 기온↑·생태↓가 누적됩니다(후반 가속). 좋은 선택으로 <b>적극 상쇄</b>해야 살아남아요.',
    diff_select:'⚙️ 난이도 선택',
    diff_label_A:'도전', diff_label_B:'하드코어', diff_label_BUDGET:'예산', diff_label_POLITICS:'정치',
    note_A:'힌트·뱃지·수치를 모두 가린 진짜 딜레마. 모든 보기가 장점과 숨은 대가를 가집니다.',
    note_B:'전 시나리오 딜레마 + 기온 3.0°C·생태계 0% 도달 시 즉시 붕괴(F) + 등급 컷오프 최상.',
    note_BUDGET:'💰 남긴 예산엔 복리 이자(+8%), 단 기온 1.5°C 초과분만큼 재난 복구비가 차압. 100% 초과 비축은 ⚡오버차지. 경제·산업(SDG 8·9·12) 딜레마가 섞여 나옵니다 — 초반 절약 → 후반 몰빵이 승부.',
    note_POLITICS:'🗳️ 강한 규제는 지지율↓·인기영합은 지지율↑. 3·6·9단계 임기 심사(35% 이상) 통과 필수. 초반 정치자본은 빠듯하고, 후반엔 정공법(최선)으로 쌓은 점수만큼 자본이 폭발 회복돼 S티어를 노립니다. 사회·불평등(SDG 1·10·16) 딜레마가 섞여 나옵니다.',
    guide_summary:'🪙 예산·정치 모드 가이드', guide_more:'자세히',
    guide_budget:'<b>💰 예산 모드</b> (경제·산업 / SDG 8·9·12) — 매 턴 <b>2개 소비 / 2개 자금 확보(환급)</b>로 갈립니다. 남긴 예산엔 복리 이자(+8%)가 붙지만, <b>기온 1.5°C 초과분</b>만큼 재난 복구비가 차압돼요. 철강·공급망·탄소국경세 같은 <b>일자리 트레이드오프</b> 시나리오가 등장합니다.',
    guide_politics:'<b>🗳️ 정치 모드</b> (사회·불평등 / SDG 1·10·16) — 강한 규제는 지지율↓·인기영합은 지지율↑. <b>3·6·9단계 임기 심사(35% 이상)</b> 통과 필수. <b>초반 정치자본은 빠듯</b>하고, 후반엔 <b>정공법(최선 연타)으로 쌓은 점수만큼 자본이 폭발 회복</b>돼요(줬다 뺏기). 유류세·기후난민·에너지빈곤 같은 <b>계층 갈등</b> 시나리오가 나옵니다.',
    guide_overcharge:'<b>⚡ 오버차지 (상한 초과 비축)</b> — 자원 보유 <b>상한이 없습니다</b>. 100%를 넘기면 게이지가 금빛(예산)·보랏빛(정치)으로 흐르는 「과충전」이 돼요. 예산은 <b>후반 몰빵용 실탄</b>, 정치는 <b>임기 심사 버퍼</b>. (부족할 때만 붉은 경고)',
    guide_panic:'💡 두 모드 모두 벼랑 끝 탈출용 <b>비상대책(판당 1회)</b>이 숨어 있습니다. · 도전/하드코어는 생태(기온·해수면) 중심입니다.',
    daily_on:'🗓️ 오늘의 지구 (데일리 챌린지) · ON', daily_off:'🗓️ 오늘의 지구 (데일리 챌린지) · OFF',
    daily_desc_on:'오늘 날짜로 고정된 같은 판 — 친구와 점수를 겨뤄보세요', daily_desc_off:'켜면 전 세계가 같은 시나리오로 경쟁합니다',
    start_new:'▶ 통제실 입장 (새 게임)', resume:'💾 이어하기',
    ach_title:'🏆 영구 업적 진열장', dex_title:'🎬 엔딩 도감',
  },
  en: {
    /* Sonnet 벌크 번역 → Opus 검수(용어집 일관성·HTML/이모지/플레이스홀더 보존) 통과 */
    "room_title":"Earth Control Room",
    "sound_off":"🔇 Sound Off","sound_on":"🔊 Sound On",
    "stat_temp_label":"🌡️ Temp. Rise","stat_sea_label":"🌊 Sea Level","stat_eco_label":"🌱 Ecosystem Health",
    "lang_btn":"🌐 한국어",
    "hero_tagline":"Survive the Dying Earth",
    "intro_sub":"A UN SDGs-based climate control simulation · {n} stages of decisions",
    "howto_title":"📖 How It Works",
    "howto_body":"Each turn, read the climate crisis and pick <b>one of 4 policies</b>. Manage the <b>three stats</b> below to reach one of <b>12 endings</b> after <b>10 stages</b>. Right after you choose, the result screen instantly shows your <b>verdict and stat changes</b>, from 🟢best to 🔴costliest.",
    "dir_temp":"🌡️ Temp.","dir_sea":"🌊 Sea Level","dir_eco":"🌱 Ecosystem",
    "dir_low":"lower is better","dir_high":"higher is better",
    "gravity_intro":"🌍 <b>Global Resource Strain</b>: Every turn, Temp.↑ and Ecosystem↓ accumulate by default (accelerating later on). You must <b>actively offset</b> this with good choices to survive.",
    "diff_select":"⚙️ Select Difficulty",
    "diff_label_A":"Challenge","diff_label_B":"Hardcore","diff_label_BUDGET":"Budget","diff_label_POLITICS":"Politics",
    "note_A":"Real dilemmas with no hints, badges, or numbers shown. Every option has an upside and a hidden cost.",
    "note_B":"All scenario dilemmas + instant collapse (F) at Temp. 3.0°C or Ecosystem 0% + the strictest grade cutoffs.",
    "note_BUDGET":"💰 Leftover budget earns compound interest (+8%), but disaster recovery costs seize funds equal to any Temp. over 1.5°C. Reserves stocked past 100% become ⚡Overcharge. Economic/industrial (SDG 8·9·12) dilemmas are mixed in — saving early, going all-in late wins it.",
    "note_POLITICS":"🗳️ Strong regulation drops Approval↓, populism raises it↑. You must pass Term Review (35%+) at stages 3, 6, and 9. Political Capital is tight early on, but late-game, playing it straight (best choices) lets capital surge back in proportion to your score — chasing an S-tier. Social/inequality (SDG 1·10·16) dilemmas are mixed in.",
    "guide_summary":"🪙 Budget & Politics Mode Guide","guide_more":"Details",
    "guide_budget":"<b class=\"text-amber-300\">💰 Budget Mode</b> (Economy & Industry / SDG 8·9·12) — Each turn splits into <b>2 spending / 2 funding (refund)</b> options. Leftover budget earns compound interest (+8%), but disaster recovery costs seize funds equal to any <b>Temp. over 1.5°C</b>. <b>Job trade-off</b> scenarios appear, like steel, supply chains, and carbon border tax (CBAM).",
    "guide_politics":"<b>🗳️ Politics Mode</b> (Society & Inequality / SDG 1·10·16) — Strong regulation drops Approval↓, populism raises it↑. You must pass <b>Term Review</b> (35%+) <b>at stages 3, 6, and 9</b>. <b>Political Capital is tight early on</b>, but late-game, <b>playing it straight (chaining best choices) surges capital back</b> in proportion to your score (give-and-take). <b>Class conflict</b> scenarios appear, like fuel tax, climate refugees, and energy poverty.",
    "guide_overcharge":"<b>⚡ Overcharge (stockpiling past the cap)</b> — There's <b>no cap</b> on resource holdings. Push past 100% and the gauge flows gold (Budget) or purple (Politics) — \"Overcharged.\" Budget becomes <b>ammo for a late-game all-in</b>; Politics becomes a <b>Term Review buffer</b>. (Red warning only shows when you're running short.)",
    "guide_panic":"💡 Both modes hide a <b>one-time emergency measure per run</b> for last-ditch escapes. · Challenge/Hardcore focus on ecology (Temp. & Sea Level).",
    "daily_on":"🗓️ Earth Today (Daily Challenge) · ON","daily_off":"🗓️ Earth Today (Daily Challenge) · OFF",
    "daily_desc_on":"The same run, locked to today's date — compete for score with friends","daily_desc_off":"Turn on to compete worldwide on the same scenario",
    "start_new":"▶ Enter Control Room (New Game)","resume":"💾 Resume",
    "ach_title":"🏆 Achievements","dex_title":"🎬 Ending Dex"
  }
};
