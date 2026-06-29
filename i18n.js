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
      // EN 100% 완성(본문·크롬 전부 번역) → 한국어 외 브라우저는 자동으로 영어로.
      var n = (navigator.language||'ko').slice(0,2).toLowerCase();
      return n==='ko' ? 'ko' : 'en';
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
    /* ── 인게임 크롬 ── */
    res_name_budget:'예산', res_name_pol:'정치자본', res_unit_budget:'억', res_unit_pol:'pt',
    sc_stage:'📋 통제 단계: {s} / {t}', sc_tier:'위기 등급: TIER {n}',
    sc_gravity:'🌍 글로벌 자원 압박: 매 턴 기본으로 🌡️ 상승·🌱 감소가 누적됩니다 (후반 가속)',
    sc_opt:'[선택 {L}]', sc_secret:' · 🔒 숨겨진 길', sc_recover:'회복', sc_left:'남은 {name}',
    sc_over:'⚡ +{v}{u} 초과 비축', sc_short:'{name} 부족',
    ap_label:'📊 지지율(여론)',
    ap_note:'강한 친환경 규제는 지지율↓ · 인기영합은 지지율↑',
    ap_review:' · 다음 임기 심사: {s}단계 {c}% 미만 불신임',
    ap_buffer:'⚡ +{v}%p 여론 버퍼 (임기 심사 대비)',
    panic_btn:'⚠️ 비상대책(1회) · {lbl}',
    panic_pol:'📢 우민화 정책 — 🌡️+0.25°C로 지지율 +15%',
    panic_bud:'🏦 지구 저당 금융 — 🌱-20%·🌡️+0.15°C로 예산 +{v}억',
    fb_result:'정책 시행 결과', fb_sus:'· 지속가능성 +{n}점', fb_fact:'💡 과학적 팩트 체크', fb_next:'다음 위기 보고서 접수 ➡️',
    v_best:'최선의 선택', v_best_sub:'지구를 최우선에 둔 모범적인 결단이었습니다.',
    v_comp:'절충한 선택', v_comp_sub:'얻은 만큼 내준, 무난한 타협이었습니다.',
    v_shaky:'아쉬운 균형', v_shaky_sub:'균형을 노렸지만 효과는 제한적이었습니다.',
    v_costly:'값비싼 선택', v_costly_sub:'당장은 쉬웠지만, 지구가 그 대가를 치릅니다.',
    end_grade:'최종 등급', end_diff:'난이도',
    chip_temp:'평균 기온', chip_sea:'글로벌 해수면', chip_eco:'대자연 생태', chip_sus:'지속가능성',
    end_pts:'{p}% · {s}점', end_left:'남은 {name} {b}{u} / {tt}{u}',
    chron_title:'📜 당신이 통치한 2050년의 기록', report_title:'🎓 SDGs 엔딩 성적표', report_empty:'조기 종료로 기록이 부족합니다.', report_sub:'{s}단계 · {name}',
    btn_receipt:'🧾 감성 영수증 보기 (스포티파이 랩드)', btn_share:'📸 스토리 카드 공유', btn_restart:'🔄 다시 도전',
    hashtags:'#순천대 #SDGs #지구통제실 #2050지구생존',
    /* 크로니클 */
    chron_empty:'조기 종료로 통치 기록이 충분히 남지 않았습니다.',
    chron_coal:'초반 재정 위기를 넘기려 <b>[석탄 발전소 재가동]</b>이라는 악마의 계약에 서명했습니다. 곳간은 채웠으나 하늘이 잿빛으로 물들었죠.',
    chron_wong:'<b>[{c}]</b> 도박은 운 좋게 맞아떨어져 위기를 모면했지만, 다음 도박까지 성공하리란 보장은 없었습니다.',
    chron_lostg:'<b>[{c}]</b> 도박이 빗나가며 통제 불능의 연쇄 피해가 들이닥쳤습니다.',
    chron_denial:'한때 <b>[해안의 위기를 외면]</b>한 대가로, 빙상 붕괴가 끝내 도시 한복판까지 밀려들었습니다.',
    chron_reckless:'검증을 건너뛴 <b>[무모한 강행]</b>이 거듭되며 통제실의 신뢰에 금이 갔습니다.',
    chron_panic_pol:'벼랑 끝에서 <b>[우민화 정책]</b>으로 지구를 불태워 표를 사들이며 자리를 보전했습니다.',
    chron_panic_bud:'파산 직전 <b>[지구 저당 금융]</b>으로 환경을 담보 잡혀 한 턴을 더 버텼습니다.',
    chron_great:'그리고 마지막 순간, 봉인되어 있던 <b>[대전환 선언]</b>에 서명하며 인류세의 폭주를 멈춰 세웠습니다.',
    chron_last:'마지막 단계에서 <b>[{c}]</b>에 전 재산을 쏟아부어, 지구를 극적인 생존의 궤도로 끌어올렸습니다.',
    chron_best:'총 {n}번, 당신은 눈앞의 이익보다 지구를 먼저 택한 통치자였습니다.',
    chron_worst:'총 {n}번, 당신은 내일의 지구를 오늘의 곳간과 맞바꾼 통치자였습니다.',
    chron_mixed:'당신의 10번의 결단은 이상과 현실 사이를 끊임없이 저울질한 줄타기였습니다.',
    /* 토스트 */
    toast_oc:'⚡ 오버차지 돌파! 상한을 넘겨 무제한 비축을 시작합니다',
    toast_bill:'⏰ <b>과거의 청구서</b>',
    toast_panic_pol:'📢 우민화 정책 — 🌡️+0.25°C 대가로 지지율 +15%',
    toast_panic_bud:'🏦 지구 저당 금융 — 🌱-20%·🌡️+0.15°C 대가로 예산 +{v}억',
    toast_regen:'🗳️ 정치자본 +{v}pt 충원 (지지율 {a}%)',
    toast_review:'🗳️ {s}단계 임기 심사: 지지율 {a}% < {c}% 불신임 — 정치자본 -{loss}pt',
    toast_interest:'💰 예산 이자 +{v}억 (아낄수록 복리)',
    toast_upkeep:'🌡️ 기후 재난 복구비 -{v}억 (기온 {t}°C · 1.5°C 초과분)',
    toast_shock:'💥 시장 쇼크: {kind} — 비축 예산 -{v}억 증발',
    shock_infl:'초인플레이션', shock_bubble:'녹색 거품 붕괴',
    toast_timeout:'⏱️ 시간 초과 — 최악의 선택이 강제 집행됩니다',
    gamble_win:'🎲 성공 — ', gamble_lose:'🎲 실패 — ',
    share_making:'🖼️ 카드 생성 중…', share_saved:'결과 카드 이미지를 저장했어요! 인스타 스토리에 올려보세요 📸', share_fail:'이미지 생성에 실패했어요. 스크린샷으로 공유해 주세요 📸',
    receipt_making:'🧾 생성 중…', receipt_saved:'감성 영수증을 저장했어요! 🧾', receipt_fail:'이미지 생성 실패 — 스크린샷으로 공유해 주세요 📸',
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
    "ach_title":"🏆 Achievements","dex_title":"🎬 Ending Dex",
    "res_name_budget":"Budget","res_name_pol":"Political Capital","res_unit_budget":"B","res_unit_pol":"pt",
    "sc_stage":"📋 Stage {s} / {t}","sc_tier":"Crisis TIER {n}",
    "sc_gravity":"🌍 Global Resource Strain: every turn 🌡️↑ · 🌱↓ accumulate by default (accelerating later)",
    "sc_opt":"[Option {L}]","sc_secret":" · 🔒 Hidden Path","sc_recover":"refund","sc_left":"{name} left",
    "sc_over":"⚡ +{v}{u} over-reserve","sc_short":"out of {name}",
    "ap_label":"📊 Approval",
    "ap_note":"Strong regulation lowers Approval · populism raises it",
    "ap_review":" · Next Term Review: stage {s}, below {c}% = no-confidence",
    "ap_buffer":"⚡ +{v}%p opinion buffer (for Term Review)",
    "panic_btn":"⚠️ Emergency (1×) · {lbl}",
    "panic_pol":"📢 Demagoguery — 🌡️+0.25°C for +15% Approval",
    "panic_bud":"🏦 Mortgage the Earth — 🌱-20%·🌡️+0.15°C for +{v}B Budget",
    "fb_result":"Policy Outcome","fb_sus":"· Sustainability +{n}","fb_fact":"💡 Science Fact-Check","fb_next":"Receive Next Crisis Report ➡️",
    "v_best":"Best Call","v_best_sub":"An exemplary decision that put the planet first.",
    "v_comp":"Compromise","v_comp_sub":"A fair trade-off — you gave as much as you got.",
    "v_shaky":"Shaky Balance","v_shaky_sub":"Aimed for balance, but the effect was limited.",
    "v_costly":"Costly Choice","v_costly_sub":"Easy now, but the planet pays for it.",
    "end_grade":"Final Grade","end_diff":"Difficulty",
    "chip_temp":"Avg. Temp.","chip_sea":"Global Sea Level","chip_eco":"Ecosystem","chip_sus":"Sustainability",
    "end_pts":"{p}% · {s} pts","end_left":"{name} left {b}{u} / {tt}{u}",
    "chron_title":"📜 Your Reign Over 2050","report_title":"🎓 SDGs Report Card","report_empty":"Ended early — records incomplete.","report_sub":"Stage {s} · {name}",
    "btn_receipt":"🧾 Wrapped Receipt","btn_share":"📸 Share Story Card","btn_restart":"🔄 Play Again",
    "hashtags":"#SCNU #SDGs #EarthControlRoom #Survive2050",
    "chron_empty":"Ended too early — not enough of a record to tell the tale.",
    "chron_coal":"To weather the early budget crisis, you signed a devil's bargain: <b>[Restart the coal plants]</b>. The coffers filled, but the sky turned gray.",
    "chron_wong":"<b>[{c}]</b> — that gamble paid off and dodged disaster, but there was no guarantee the next one would.",
    "chron_lostg":"<b>[{c}]</b> — the gamble missed, and an uncontrollable chain of damage came crashing down.",
    "chron_denial":"For once <b>[turning away from the coast's crisis]</b>, the ice-sheet collapse finally surged into the heart of the city.",
    "chron_reckless":"Repeated <b>[reckless rollouts]</b> that skipped verification cracked the control room's credibility.",
    "chron_panic_pol":"At the brink, you used <b>[Demagoguery]</b> — burning the planet to buy votes and cling to power.",
    "chron_panic_bud":"On the edge of bankruptcy, you <b>[Mortgaged the Earth]</b>, pledging the environment as collateral to last one more turn.",
    "chron_great":"And at the final moment, you signed the sealed <b>[Great Transition Declaration]</b>, halting the Anthropocene's runaway.",
    "chron_last":"In the final stage you poured everything into <b>[{c}]</b>, dragging Earth onto a dramatic survival trajectory.",
    "chron_best":"{n} times, you were a ruler who put the planet before immediate gain.",
    "chron_worst":"{n} times, you were a ruler who traded tomorrow's Earth for today's coffers.",
    "chron_mixed":"Your 10 decisions were a tightrope walk, forever weighing ideals against reality.",
    "toast_oc":"⚡ Overcharge breakthrough! Past the cap — unlimited stockpiling begins",
    "toast_bill":"⏰ <b>A Bill from the Past</b>",
    "toast_panic_pol":"📢 Demagoguery — 🌡️+0.25°C in exchange for +15% Approval",
    "toast_panic_bud":"🏦 Mortgage the Earth — 🌱-20%·🌡️+0.15°C in exchange for +{v}B Budget",
    "toast_regen":"🗳️ Political Capital +{v}pt (Approval {a}%)",
    "toast_review":"🗳️ Stage {s} Term Review: Approval {a}% < {c}% no-confidence — Political Capital -{loss}pt",
    "toast_interest":"💰 Budget interest +{v}B (the more you save, the more it compounds)",
    "toast_upkeep":"🌡️ Climate disaster upkeep -{v}B (Temp {t}°C · over 1.5°C)",
    "toast_shock":"💥 Market shock: {kind} — {v}B in reserves evaporated",
    "shock_infl":"hyperinflation", "shock_bubble":"green bubble burst",
    "toast_timeout":"⏱️ Time's up — the worst option is forced through",
    "gamble_win":"🎲 Success — ", "gamble_lose":"🎲 Failure — ",
    "share_making":"🖼️ Generating card…", "share_saved":"Saved the result card! Post it to your IG story 📸", "share_fail":"Couldn't generate the image. Please share a screenshot 📸",
    "receipt_making":"🧾 Generating…", "receipt_saved":"Saved your Wrapped receipt! 🧾", "receipt_fail":"Image generation failed — please share a screenshot 📸"
  }
};
