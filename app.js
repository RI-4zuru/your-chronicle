(() => {
  'use strict';

  const STORAGE_KEY = 'yourChronicleProgressArchive.v1';

  const defaultState = {
    version: 1,
    ui: { jealousyStep: 100 },
    resources: {
      inspiration: { current: 40000, target: 10000000, basis: '10', manualAverage: 0 },
      sin: { current: 1500, target: 10000, defaultGain: 42 },
      dissatisfaction: { current: 10200, basis: '10', manualAverage: 0 }
    },
    runs: [],
    jealousy: [
      { group: '身体', name: '経験値獲得量', current: 100, target: 100 },
      { group: '身体', name: '最大HP', current: 100, target: 100 },
      { group: '身体', name: '物理攻撃力', current: 100, target: 100 },
      { group: '身体', name: '物理防御力', current: 100, target: 100 },
      { group: '身体', name: '魔法攻撃力', current: 200, target: 200 },
      { group: '身体', name: '魔法防御力', current: 100, target: 100 },
      { group: '身体', name: 'ダンジョン関連', current: 100, target: 100 },

      { group: '創造性', name: 'インスタント関連', current: 400, target: 400 },
      { group: '創造性', name: 'ループアクション関連', current: 500, target: 500 },
      { group: '創造性', name: 'ダンジョン報酬', current: 500, target: 500 },
      { group: '創造性', name: '聖なる儀式', current: 200, target: 200 },
      { group: '創造性', name: '闇の儀式', current: 200, target: 200 },
      { group: '創造性', name: '習慣効率', current: 200, target: 200 },
      { group: '創造性', name: 'クリスタル関連', current: 200, target: 200 },

      { group: 'カリスマ', name: 'リサーチドロップ', current: 400, target: 400 },
      { group: 'カリスマ', name: '種ドロップ', current: 300, target: 300 },
      { group: 'カリスマ', name: 'リソースドロップ', current: 200, target: 200 },
      { group: 'カリスマ', name: '意志', current: 200, target: 200 },
      { group: 'カリスマ', name: '使い魔召喚関連', current: 200, target: 200 },
      { group: 'カリスマ', name: '満腹度', current: 500, target: 500 },
      { group: 'カリスマ', name: 'クエスト関連', current: 200, target: 200 }
    ]
  };

  let state = loadState();
  let activeResource = null;
  let runFilter = 'all';
  let editingRunIndex = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function mergeState(raw){
    const base = clone(defaultState);
    if (!raw || typeof raw !== 'object') return base;
    if (raw.ui && typeof raw.ui === 'object') base.ui = { ...base.ui, ...raw.ui };
    if (![1,100,1000].includes(Number(base.ui.jealousyStep))) base.ui.jealousyStep = 100;
    if (raw.resources) {
      for (const key of Object.keys(base.resources)) base.resources[key] = { ...base.resources[key], ...(raw.resources[key] || {}) };
    }
    if (Array.isArray(raw.runs)) base.runs = raw.runs;
    if (Array.isArray(raw.jealousy) && raw.jealousy.length) base.jealousy = raw.jealousy.map((x,i) => ({...base.jealousy[i % base.jealousy.length], ...x}));
    return base;
  }

  function loadState(){
    try { return mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return clone(defaultState); }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function parseNumber(value){
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value == null) return null;
    let s = String(value).trim().replace(/,/g,'').replace(/＋/g,'+').toUpperCase();
    if (!s) return null;
    const map = {K:1e3,M:1e6,B:1e9,T:1e12,Q:1e15};
    const m = s.match(/^([+-]?\d*\.?\d+)\s*([KMBTQ])?$/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n * (map[m[2]] || 1) : null;
  }

  function parseDuration(value){
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 60) return null;
    return minutes * 60;
  }

  function formatRunMinutes(seconds){
    const minutes = Math.round(Number(seconds) / 60);
    if (!Number.isFinite(minutes) || minutes <= 0) return '—';
    return `${minutes}分`;
  }

  function validDurations(){
    return state.runs.map(r => Number(r.durationSeconds)).filter(n => Number.isFinite(n) && n > 0);
  }

  function averageDuration(){ return average(validDurations()); }

  function formatDuration(seconds){
    return formatRunMinutes(seconds);
  }

  function formatEstimatedTime(seconds){
    const totalMinutes = Math.round(Number(seconds) / 60);
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '—';
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days}日`);
    if (hours) parts.push(`${hours}時間`);
    if (minutes || parts.length === 0) parts.push(`${minutes}分`);
    return parts.join(' ');
  }

  function toLocalDateTimeValue(value){
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseLocalDateTime(value){
    const raw = String(value||'').trim();
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function formatNumber(value, digits = 2){
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    const units = [
      [1e15,'Qa'],[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']
    ];
    for (const [v,u] of units) {
      if (abs >= v) {
        const x = n / v;
        const d = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : digits;
        return `${x.toFixed(d).replace(/\.0+$|(?<=\.[0-9])0+$/,'')}${u}`;
      }
    }
    if (Number.isInteger(n)) return n.toLocaleString('ja-JP');
    return n.toLocaleString('ja-JP',{maximumFractionDigits:digits});
  }

  function roundUp(value){ return Number.isFinite(value) && value > 0 ? Math.ceil(value) : value <= 0 ? 0 : null; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function pct(current,target){ return target > 0 ? clamp(current/target*100,0,100) : 0; }

  function validGains(key){
    return state.runs.map(r => Number(r[key])).filter(n => Number.isFinite(n) && n >= 0);
  }

  function average(list){ return list.length ? list.reduce((a,b)=>a+b,0)/list.length : 0; }
  function averageByBasis(key, basis, manual){
    if (basis === 'manual') return Number(manual) || 0;
    const list = validGains(key);
    if (!list.length) return 0;
    if (basis === 'all') return average(list);
    const n = Math.max(1, Number(basis)||10);
    return average(list.slice(-n));
  }

  // 通常の嫉妬項目:
  // Lv0→1 = 10 不満
  // Lv1→2 = 1.0, Lv2→3 = 1.1, ...
  function jealousyCostToLevel(level){
    const L = Math.max(0, Math.floor(Number(level)||0));
    if (L <= 0) return 0;
    if (L === 1) return 10;
    // 10 + sum_{current=1}^{L-1} (0.9 + 0.1*current)
    const n = L - 1;
    const sumCurrent = n * (n + 1) / 2;
    return 10 + 0.9 * n + 0.1 * sumCurrent;
  }

  function jealousyNeed(current,target){
    const c = Math.max(0, Math.floor(Number(current)||0));
    const t = Math.max(0, Math.floor(Number(target)||0));
    return Math.max(0, jealousyCostToLevel(t) - jealousyCostToLevel(c));
  }

  function getPlan(){
    const need = state.jealousy.reduce((s,x)=>s+jealousyNeed(x.current,x.target),0);
    const owned = Math.max(0, Number(state.resources.dissatisfaction.current)||0);
    const shortfall = Math.max(0, need - owned);
    const avg = averageByBasis('dissatisfaction', state.resources.dissatisfaction.basis, state.resources.dissatisfaction.manualAverage);
    const runs = avg > 0 ? roundUp(shortfall/avg) : null;
    const currentTotal = state.jealousy.reduce((s,x)=>s+(Number(x.current)||0),0);
    const targetTotal = state.jealousy.reduce((s,x)=>s+(Number(x.target)||0),0);
    return {need,owned,shortfall,avg,runs,currentTotal,targetTotal};
  }

  function basisLabel(basis){
    if (basis === 'all') return '全履歴';
    if (basis === 'manual') return '手入力';
    return `直近${basis}周`;
  }

  function renderAll(){
    renderHeader();
    renderDashboard();
    renderRuns();
    renderJealousy();
    renderSettings();
  }

  function renderHeader(){
    $('#headerRuns').textContent = state.runs.length.toLocaleString('ja-JP');
    const last = state.runs.at(-1);
    $('#headerLastRun').textContent = last ? new Date(last.at).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'}) : '—';
  }

  function setBar(id, value){ $(id).style.width = `${clamp(value,0,100)}%`; }

  function renderDashboard(){
    const insp = state.resources.inspiration;
    const sin = state.resources.sin;
    const diss = state.resources.dissatisfaction;
    const inspAvg = averageByBasis('inspiration', insp.basis, insp.manualAverage);
    const avgTime = averageDuration();
    const inspRemain = Math.max(0,insp.target-insp.current);
    const inspRuns = inspAvg>0 ? roundUp(inspRemain/inspAvg) : null;

    $('#inspirationCurrent').textContent=formatNumber(insp.current);
    $('#inspirationTarget').textContent=formatNumber(insp.target);
    $('#inspirationPercent').textContent=`${pct(insp.current,insp.target).toFixed(2)}%`;
    $('#inspirationRemaining').textContent=formatNumber(inspRemain);
    $('#inspirationAverage').textContent=inspAvg>0?formatNumber(inspAvg):'未記録';
    $('#inspirationRuns').textContent=inspRuns==null?'—':`${formatNumber(inspRuns,0)}周`;
    $('#inspirationBasis').textContent=basisLabel(insp.basis);
    $('#inspirationTime').textContent=(inspRuns!=null && avgTime>0)?formatEstimatedTime(inspRuns*avgTime):'—';
    setBar('#inspirationBar',pct(insp.current,insp.target));

    const sinRemain=Math.max(0,sin.target-sin.current);
    const sinGain=Math.max(0,Number(sin.defaultGain)||0);
    const sinRuns=sinGain>0?roundUp(sinRemain/sinGain):null;
    $('#sinCurrent').textContent=formatNumber(sin.current);
    $('#sinTarget').textContent=formatNumber(sin.target);
    $('#sinPercent').textContent=`${pct(sin.current,sin.target).toFixed(2)}%`;
    $('#sinRemaining').textContent=formatNumber(sinRemain);
    $('#sinAverage').textContent=sinGain?formatNumber(sinGain):'—';
    $('#sinRuns').textContent=sinRuns==null?'—':`${formatNumber(sinRuns,0)}周`;
    $('#sinDefault').textContent=formatNumber(sinGain);
    $('#sinTime').textContent=(sinRuns!=null && avgTime>0)?formatEstimatedTime(sinRuns*avgTime):'—';
    setBar('#sinBar',pct(sin.current,sin.target));

    const plan=getPlan();
    const planProgress = plan.need>0 ? clamp(plan.owned/plan.need*100,0,100) : 0;
    $('#dissCurrent').textContent=formatNumber(diss.current);
    $('#dissPlanPercent').textContent=plan.need>0?`${planProgress.toFixed(1)}% 確保`:'計画なし';
    $('#dissNeeded').textContent=plan.need>0?formatNumber(plan.need):'—';
    $('#dissAverage').textContent=plan.avg>0?formatNumber(plan.avg):'未記録';
    $('#dissRuns').textContent=plan.runs==null?'—':`${formatNumber(plan.runs,0)}周`;
    $('#jealousyTargetTotal').textContent=formatNumber(plan.targetTotal,0);
    $('#dissTime').textContent=(plan.runs!=null && avgTime>0)?formatEstimatedTime(plan.runs*avgTime):'—';
    setBar('#dissBar',planProgress);

    renderRecentRuns();
    renderMilestones();
  }

  function renderRecentRuns(){
    const root=$('#recentRuns'); root.innerHTML='';
    const list=state.runs.slice(-5).reverse();
    if(!list.length){root.innerHTML='<div class="empty-state">まだ周回記録がありません。「今回の周回を記録」から最初の1周を残してみましょう。</div>';return;}
    list.forEach((r,idx)=>{
      const actualIndex=state.runs.length-idx;
      const div=document.createElement('div'); div.className='recent-run';
      div.innerHTML=`<span class="run-index">#${actualIndex}</span><span class="gain-pill">✦ ${r.inspiration==null?'—':formatNumber(r.inspiration)}</span><span class="gain-pill">◇ ${r.sin==null?'—':formatNumber(r.sin)}</span><span class="gain-pill">◆ ${r.dissatisfaction==null?'—':formatNumber(r.dissatisfaction)}</span><span class="gain-pill time-pill">◷ ${r.durationSeconds?formatDuration(r.durationSeconds):'—'}</span>`;
      root.appendChild(div);
    });
  }

  function renderMilestones(){
    const root=$('#milestones');root.innerHTML='';
    const items=[
      {name:'ひらめき',current:state.resources.inspiration.current,target:state.resources.inspiration.target,accent:'var(--gold)'},
      {name:'Sin',current:state.resources.sin.current,target:state.resources.sin.target,accent:'var(--violet)'}
    ];
    const plan=getPlan();
    if(plan.need>0)items.push({name:'嫉妬用の不満',current:plan.owned,target:plan.need,accent:'var(--rose)'});
    items.forEach(item=>{
      const overallP=pct(item.current,item.target);
      const checkpoints=[10,25,50,75,90,100];
      const next=checkpoints.find(x=>x>overallP)??100;
      const amount=item.target*next/100;
      const milestoneProgress=amount>0 ? clamp(item.current/amount*100,0,100) : 0;
      const div=document.createElement('div'); div.className='milestone';
      div.innerHTML=`<div class="milestone-top"><span>${item.name} · 次は${next}%</span><span>${formatNumber(amount)}</span></div><div class="progress" style="--accent:${item.accent}"><i style="width:${milestoneProgress}%;background:var(--accent)"></i></div>`;
      root.appendChild(div);
    });
  }

  function renderRuns(){
    $('#runCount').textContent=state.runs.length.toLocaleString('ja-JP');
    const ia=average(validGains('inspiration'));
    const da=average(validGains('dissatisfaction'));
    const recent=average(validGains('inspiration').slice(-10));
    const durations=validDurations();
    const avgTime=average(durations);
    $('#runTimeAvg').textContent=avgTime?formatDuration(avgTime):'—';
    $('#runTimeCount').textContent=`時間記録 ${durations.length}件`;
    $('#runInspAvg').textContent=ia?formatNumber(ia):'—';
    $('#runDissAvg').textContent=da?formatNumber(da):'—';
    $('#runRecentAvg').textContent=recent?`✦ ${formatNumber(recent)}`:'—';

    const tbody=$('#runTableBody');tbody.innerHTML='';
    let indexed=state.runs.map((r,i)=>({r,i}));
    if(runFilter!=='all')indexed=indexed.slice(-Number(runFilter));
    indexed.reverse();
    if(!indexed.length){tbody.innerHTML='<tr><td colspan="8" style="color:#8e91a5;text-align:center;padding:32px">まだ記録がありません。</td></tr>';return;}
    indexed.forEach(({r,i})=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>#${i+1}</td><td>${new Date(r.at).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td>${r.durationSeconds?formatDuration(r.durationSeconds):'—'}</td><td>${r.inspiration==null?'—':formatNumber(r.inspiration)}</td><td>${r.sin==null?'—':formatNumber(r.sin)}</td><td>${r.dissatisfaction==null?'—':formatNumber(r.dissatisfaction)}</td><td class="memo">${escapeHtml(r.memo||'')}</td><td><div class="row-actions"><button class="edit-row" data-edit-run="${i}" title="編集">編集</button><button class="delete-row" data-delete-run="${i}" title="削除">×</button></div></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderJealousy(){
    const plan=getPlan();
    $('#planNeedTotal').textContent=formatNumber(plan.need);
    $('#planCurrentDiss').textContent=formatNumber(plan.owned);
    $('#planShortfall').textContent=formatNumber(plan.shortfall);
    $('#planRuns').textContent=plan.runs==null?'—':`${formatNumber(plan.runs,0)}周`;
    const avgTime=averageDuration();
    $('#planTime').textContent=(plan.runs!=null && avgTime>0)?formatEstimatedTime(plan.runs*avgTime):'—';

    const root=$('#jealousyGroups');root.innerHTML='';
    const groups=[...new Set(state.jealousy.map(x=>x.group))];
    groups.forEach(group=>{
      const indices=state.jealousy.map((x,i)=>x.group===group?i:-1).filter(i=>i>=0);
      const section=document.createElement('section');section.className='panel jealousy-group';
      const groupNeed=indices.reduce((s,i)=>s+jealousyNeed(state.jealousy[i].current,state.jealousy[i].target),0);
      section.innerHTML=`<div class="jealousy-group-head"><div><div class="eyebrow">${group.toUpperCase()}</div><h3>${group}</h3></div><span>必要不満 ${formatNumber(groupNeed)}</span></div>`;
      indices.forEach(i=>{
        const item=state.jealousy[i];
        const need=jealousyNeed(item.current,item.target);
        const row=document.createElement('div');row.className='jealousy-row';
        const levelStep=[1,100,1000].includes(Number(state.ui?.jealousyStep))?Number(state.ui.jealousyStep):100;
        row.innerHTML=`<div class="jealousy-name"><input data-j-name="${i}" value="${escapeAttr(item.name)}" aria-label="項目名"></div><input data-j-current="${i}" type="number" min="0" step="${levelStep}" value="${Math.floor(item.current)}" aria-label="現在の嫉妬レベル"><span class="arrow">→</span><input data-j-target="${i}" type="number" min="0" step="${levelStep}" value="${Math.floor(item.target)}" aria-label="目標の嫉妬レベル"><div class="need-cell">${formatNumber(need)}<small>不満</small></div>`;
        section.appendChild(row);
      });
      root.appendChild(section);
    });
    syncJealousyStepControl();
  }

  function syncJealousyStepControl(){
    const step=[1,100,1000].includes(Number(state.ui?.jealousyStep))?Number(state.ui.jealousyStep):100;
    $$('#jealousyStepControl [data-step]').forEach(btn=>btn.classList.toggle('is-active',Number(btn.dataset.step)===step));
    $$('#jealousyGroups [data-j-current], #jealousyGroups [data-j-target]').forEach(input=>{ input.step=String(step); });
  }

  function setJealousyStep(step){
    const n=Number(step);
    if(![1,100,1000].includes(n))return;
    state.ui=state.ui||{};
    state.ui.jealousyStep=n;
    // 入力中の未保存値を消さないため、全体再描画はせず step 属性だけ切り替える。
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncJealousyStepControl();
    toast(`各項目の↑↓変更幅を ${n===1000?'1K':n.toLocaleString('ja-JP')} Lv にしました`);
  }

  function collectJealousyInputs(){
    const draft=state.jealousy.map(x=>({...x}));
    let invalid=false;

    $$('#jealousyGroups [data-j-name]').forEach(input=>{
      const i=Number(input.dataset.jName);
      if(!draft[i])return;
      draft[i].name=input.value.trim()||'名称未設定';
    });
    $$('#jealousyGroups [data-j-current]').forEach(input=>{
      const i=Number(input.dataset.jCurrent);
      const raw=String(input.value).trim();
      const n=Number(raw);
      if(!draft[i] || raw==='' || !Number.isFinite(n) || n<0 || !Number.isInteger(n)){invalid=true;return;}
      draft[i].current=n;
    });
    $$('#jealousyGroups [data-j-target]').forEach(input=>{
      const i=Number(input.dataset.jTarget);
      const raw=String(input.value).trim();
      const n=Number(raw);
      if(!draft[i] || raw==='' || !Number.isFinite(n) || n<0 || !Number.isInteger(n)){invalid=true;return;}
      draft[i].target=n;
    });

    if(invalid){toast('嫉妬レベルは0以上の整数で入力してください');return null;}
    return draft;
  }

  function saveJealousyFromScreen(message='嫉妬の変更を保存しました'){
    const draft=collectJealousyInputs();
    if(!draft)return false;
    state.jealousy=draft;
    saveState();
    if(message)toast(message);
    return true;
  }

  function buildJealousyCostTable(){
    const input=$('#jealousyCostMaxLevel');
    let max=Math.floor(Number(input.value)||10000);
    max=Math.max(1000,Math.min(1000000,max));
    // 1000を超えた部分は1000刻みにそろえる
    if(max>1000)max=Math.ceil(max/1000)*1000;
    input.value=String(max);

    const levels=[];
    for(let lv=100;lv<=Math.min(1000,max);lv+=100)levels.push(lv);
    for(let lv=2000;lv<=max;lv+=1000)levels.push(lv);

    const tbody=$('#jealousyCostTableBody');
    tbody.innerHTML='';
    let prev=0;
    levels.forEach(lv=>{
      const cumulative=jealousyCostToLevel(lv);
      const interval=cumulative-jealousyCostToLevel(prev);
      const tr=document.createElement('tr');
      if(lv%1000===0)tr.classList.add('cost-major');
      tr.innerHTML=`<td>Lv ${lv.toLocaleString('ja-JP')}</td><td>${formatNumber(interval)}</td><td>${formatNumber(cumulative)}</td>`;
      tbody.appendChild(tr);
      prev=lv;
    });
  }

  function renderSettings(){
    const insp=state.resources.inspiration,sin=state.resources.sin,diss=state.resources.dissatisfaction;
    $('#setInspCurrent').value=formatPlain(insp.current); $('#setInspTarget').value=formatPlain(insp.target); $('#setInspBasis').value=insp.basis; $('#setInspManual').value=formatPlain(insp.manualAverage||0);
    $('#setSinCurrent').value=formatPlain(sin.current); $('#setSinTarget').value=formatPlain(sin.target); $('#setSinDefault').value=formatPlain(sin.defaultGain);
    $('#setDissCurrent').value=formatPlain(diss.current); $('#setDissBasis').value=diss.basis; $('#setDissManual').value=formatPlain(diss.manualAverage||0);
    $('#inspManualWrap').style.display=insp.basis==='manual'?'block':'none';
    $('#dissManualWrap').style.display=diss.basis==='manual'?'block':'none';
  }

  function formatPlain(n){return Number(n)||0}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  function escapeAttr(s){return escapeHtml(s).replace(/`/g,'&#096;')}

  function showPage(name){
    $$('.page').forEach(x=>x.classList.toggle('is-active',x.id===`page-${name}`));
    $$('.tab').forEach(x=>x.classList.toggle('is-active',x.dataset.page===name));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function toast(msg){
    const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200);
  }

  function setRunDialogMode(index=null){
    editingRunIndex = Number.isInteger(index) ? index : null;
    const editing = editingRunIndex !== null;
    $('#runDialogEyebrow').textContent = editing ? 'EDIT RUN' : 'NEW RUN';
    $('#runDialogTitle').textContent = editing ? `周回記録 #${editingRunIndex+1} を編集` : '今回の周回を記録';
    $('#saveRun').textContent = editing ? '変更を保存' : '年代記に記録';
    $('#runDialogHelp').textContent = editing
      ? '日時・1周の時間・獲得量・メモを修正できます。ひらめきは1周の中で複数回入力でき、その合計をこの周回の獲得量として扱います。時間が空欄の記録は平均時間から除外します。'
      : 'ひらめきは1周の中で何度でも追加できます。入力したひらめきの合計が、その周回の獲得量になります。1周の時間は1〜60分の整数で任意です。';
  }

  function getInspirationEntryData(){
    const inputs=$$('#inspirationEntries [data-inspiration-entry]');
    const values=[];
    let invalid=false;
    for(const input of inputs){
      const raw=String(input.value||'').trim();
      if(!raw)continue;
      const n=parseNumber(raw);
      if(n==null || n<0){invalid=true;continue;}
      values.push(n);
    }
    return {values,total:values.length?values.reduce((a,b)=>a+b,0):null,invalid};
  }

  function updateInspirationTotal(){
    const data=getInspirationEntryData();
    const wrap=$('.inspiration-total');
    wrap.classList.toggle('is-invalid',data.invalid);
    $('#runInspirationTotal').textContent=data.invalid?'入力確認':(data.total==null?'—':formatNumber(data.total));
  }

  function addInspirationEntry(value=''){
    const root=$('#inspirationEntries');
    const row=document.createElement('div');
    row.className='inspiration-entry-row';
    row.innerHTML=`<input type="text" inputmode="decimal" data-inspiration-entry placeholder="例: 2.48K"><button type="button" class="inspiration-entry-remove" title="削除" aria-label="ひらめき入力を削除">×</button>`;
    row.querySelector('input').value=value==null?'':String(value);
    root.appendChild(row);
    updateInspirationTotal();
    return row.querySelector('input');
  }

  function setInspirationEntries(values){
    const root=$('#inspirationEntries');
    root.innerHTML='';
    const list=Array.isArray(values)&&values.length?values:[''];
    list.forEach(v=>addInspirationEntry(v));
    updateInspirationTotal();
  }

  function focusFirstInspiration(){
    setTimeout(()=>$('#inspirationEntries [data-inspiration-entry]')?.focus(),40);
  }

  function openRunDialog(){
    setRunDialogMode(null);
    $('#runAt').value=toLocalDateTimeValue();
    $('#runDuration').value='';
    setInspirationEntries(['']);
    $('#runSin').value=state.resources.sin.defaultGain?formatPlain(state.resources.sin.defaultGain):'';
    $('#runDissatisfaction').value='';
    $('#runMemo').value='';
    $('#runDialog').showModal();
    focusFirstInspiration();
  }

  function openEditRunDialog(index){
    const run=state.runs[index];
    if(!run)return;
    setRunDialogMode(index);
    $('#runAt').value=toLocalDateTimeValue(run.at);
    $('#runDuration').value=run.durationSeconds?String(Math.round(Number(run.durationSeconds)/60)):'';
    const entries=Array.isArray(run.inspirationEntries) && run.inspirationEntries.length
      ? run.inspirationEntries
      : (run.inspiration==null?['']:[run.inspiration]);
    setInspirationEntries(entries.map(formatPlain));
    $('#runSin').value=run.sin==null?'':formatPlain(run.sin);
    $('#runDissatisfaction').value=run.dissatisfaction==null?'':formatPlain(run.dissatisfaction);
    $('#runMemo').value=run.memo||'';
    $('#runDialog').showModal();
    focusFirstInspiration();
  }

  function saveRun(){
    const inspData=getInspirationEntryData();
    const insp=inspData.total;
    const sin=parseNumber($('#runSin').value), diss=parseNumber($('#runDissatisfaction').value);
    const at=parseLocalDateTime($('#runAt').value);
    const durationRaw=$('#runDuration').value;
    const durationSeconds=parseDuration(durationRaw);
    if(!at){toast('日時を確認してください');return;}
    if(String(durationRaw).trim() && (!durationSeconds || durationSeconds<=0)){toast('1周の時間は1〜60分の整数で入力してください');return;}
    if(inspData.invalid){toast('ひらめきの入力を確認してください');return;}
    const supplied=inspData.values.length>0 || [$('#runSin').value,$('#runDissatisfaction').value].some(x=>String(x).trim());
    if(!supplied){toast('少なくとも1つ獲得量を入力してください');return;}
    if([['Sin',$('#runSin').value,sin],['不満',$('#runDissatisfaction').value,diss]].some(([,raw,n])=>String(raw).trim() && (n==null || n<0))){toast('獲得量の入力を確認してください');return;}

    if(editingRunIndex!==null){
      const old=state.runs[editingRunIndex];
      if(!old){toast('編集する記録が見つかりません');return;}
      const next={...old,at,durationSeconds:durationSeconds||null,inspirationEntries:inspData.values,inspiration:insp,sin,dissatisfaction:diss,memo:$('#runMemo').value.trim()};
      const delta=(a,b)=>(Number(b)||0)-(Number(a)||0);
      state.resources.inspiration.current=Math.max(0,(Number(state.resources.inspiration.current)||0)+delta(old.inspiration,next.inspiration));
      state.resources.sin.current=Math.max(0,(Number(state.resources.sin.current)||0)+delta(old.sin,next.sin));
      state.resources.dissatisfaction.current=Math.max(0,(Number(state.resources.dissatisfaction.current)||0)+delta(old.dissatisfaction,next.dissatisfaction));
      state.runs[editingRunIndex]=next;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
      $('#runDialog').close();
      editingRunIndex=null;
      renderAll();
      toast('周回記録を更新しました');
      return;
    }

    const run={at,durationSeconds:durationSeconds||null,inspirationEntries:inspData.values,inspiration:insp,sin,dissatisfaction:diss,memo:$('#runMemo').value.trim()};
    state.runs.push(run);
    if(insp!=null)state.resources.inspiration.current+=insp;
    if(sin!=null)state.resources.sin.current+=sin;
    if(diss!=null)state.resources.dissatisfaction.current+=diss;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    $('#runDialog').close();renderAll();toast('CHRONICLE UPDATED · 周回を記録しました');
  }

  function bind(){
    $$('.tab').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
    $$('[data-page-link]').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.pageLink)));
    $('#homeButton').addEventListener('click',()=>showPage('dashboard'));
    $$('[data-open-run]').forEach(btn=>btn.addEventListener('click',openRunDialog));
    $('#saveRun').addEventListener('click',saveRun);
    $('#addInspirationEntry').addEventListener('click',()=>{const input=addInspirationEntry('');input.focus();});
    $('#inspirationEntries').addEventListener('input',updateInspirationTotal);
    $('#inspirationEntries').addEventListener('click',e=>{
      const b=e.target.closest('.inspiration-entry-remove');
      if(!b)return;
      const row=b.closest('.inspiration-entry-row');
      const rows=$$('.inspiration-entry-row',$('#inspirationEntries'));
      if(rows.length<=1){row.querySelector('input').value='';updateInspirationTotal();row.querySelector('input').focus();return;}
      row.remove();updateInspirationTotal();
    });

    $$('[data-edit-resource]').forEach(btn=>btn.addEventListener('click',()=>{
      activeResource=btn.dataset.editResource;const r=state.resources[activeResource];
      $('#resourceDialogTitle').textContent=activeResource==='inspiration'?'ひらめきを編集':'Sinを編集';
      $('#resourceCurrentInput').value=formatPlain(r.current);$('#resourceTargetInput').value=formatPlain(r.target);$('#resourceDialog').showModal();
    }));
    $('#saveResource').addEventListener('click',()=>{
      if(!activeResource)return;const c=parseNumber($('#resourceCurrentInput').value),t=parseNumber($('#resourceTargetInput').value);if(c==null||t==null||c<0||t<0){toast('数値を確認してください');return;}
      state.resources[activeResource].current=c;state.resources[activeResource].target=t;$('#resourceDialog').close();saveState();toast('目標を更新しました');
    });

    $('#runFilter').addEventListener('click',e=>{const b=e.target.closest('button[data-filter]');if(!b)return;runFilter=b.dataset.filter;$$('#runFilter button').forEach(x=>x.classList.toggle('is-active',x===b));renderRuns();});
    $('#runTableBody').addEventListener('click',e=>{
      const edit=e.target.closest('[data-edit-run]');
      if(edit){openEditRunDialog(Number(edit.dataset.editRun));return;}
      const b=e.target.closest('[data-delete-run]');
      if(!b)return;
      const i=Number(b.dataset.deleteRun);
      if(!confirm(`#${i+1} の記録を削除しますか？\n※現在値は自動では巻き戻しません。`))return;
      state.runs.splice(i,1);saveState();toast('記録を削除しました');
    });
    $('#clearRuns').addEventListener('click',()=>{if(!confirm('周回履歴をすべて削除しますか？\n現在のリソース値は残ります。'))return;state.runs=[];saveState();});

    $('#jealousyStepControl').addEventListener('click',e=>{
      const btn=e.target.closest('button[data-step]');
      if(!btn)return;
      setJealousyStep(btn.dataset.step);
    });
    $('#saveJealousyChanges').addEventListener('click',()=>saveJealousyFromScreen());
    $('#applyBulk').addEventListener('click',()=>{
      const draft=collectJealousyInputs();if(!draft)return;
      const raw=String($('#bulkTarget').value).trim(),n=Number(raw);
      if(raw===''||!Number.isFinite(n)||n<0||!Number.isInteger(n)){toast('設定する嫉妬Lvを0以上の整数で入力してください');return;}
      draft.forEach(x=>x.target=n);
      state.jealousy=draft;saveState();toast(`全項目の目標を Lv${n.toLocaleString('ja-JP')} にしました`);
    });
    $('#applyPlus').addEventListener('click',()=>{
      const draft=collectJealousyInputs();if(!draft)return;
      const raw=String($('#bulkPlus').value).trim(),n=Number(raw);
      if(raw===''||!Number.isFinite(n)||n<0||!Number.isInteger(n)){toast('プラスする嫉妬Lvを0以上の整数で入力してください');return;}
      draft.forEach(x=>x.target=(Number(x.current)||0)+n);
      state.jealousy=draft;saveState();toast(`全項目を現在Lvから +${n.toLocaleString('ja-JP')} Lv にしました`);
    });
    $('#resetTargets').addEventListener('click',()=>{
      const draft=collectJealousyInputs();if(!draft)return;
      draft.forEach(x=>x.target=x.current);
      state.jealousy=draft;saveState();toast('全項目の目標Lvを現在Lvに戻しました');
    });
    const jealousyCostModal=$('#jealousyCostDialog');
    const openJealousyCostModal=()=>{
      buildJealousyCostTable();
      jealousyCostModal.hidden=false;
      jealousyCostModal.setAttribute('aria-hidden','false');
      document.body.classList.add('modal-open');
      requestAnimationFrame(()=>jealousyCostModal.classList.add('is-open'));
    };
    const closeJealousyCostModal=()=>{
      jealousyCostModal.classList.remove('is-open');
      jealousyCostModal.setAttribute('aria-hidden','true');
      document.body.classList.remove('modal-open');
      window.setTimeout(()=>{if(!jealousyCostModal.classList.contains('is-open'))jealousyCostModal.hidden=true;},170);
    };
    $('#openJealousyCostTable').addEventListener('click',openJealousyCostModal);
    $('#refreshJealousyCostTable').addEventListener('click',buildJealousyCostTable);
    $$('[data-close-jealousy-cost]').forEach(btn=>btn.addEventListener('click',closeJealousyCostModal));
    jealousyCostModal.addEventListener('click',e=>{if(e.target===jealousyCostModal)closeJealousyCostModal();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!jealousyCostModal.hidden)closeJealousyCostModal();});

    const settingMap=[
      ['setInspCurrent','inspiration','current'],['setInspTarget','inspiration','target'],['setInspManual','inspiration','manualAverage'],
      ['setSinCurrent','sin','current'],['setSinTarget','sin','target'],['setSinDefault','sin','defaultGain'],
      ['setDissCurrent','dissatisfaction','current'],['setDissManual','dissatisfaction','manualAverage']
    ];
    settingMap.forEach(([id,res,key])=>$('#'+id).addEventListener('change',e=>{const n=parseNumber(e.target.value);if(n==null||n<0){renderSettings();toast('数値を確認してください');return;}state.resources[res][key]=n;saveState();}));
    $('#setInspBasis').addEventListener('change',e=>{state.resources.inspiration.basis=e.target.value;saveState();});
    $('#setDissBasis').addEventListener('change',e=>{state.resources.dissatisfaction.basis=e.target.value;saveState();});

    $('#exportData').addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`your-chronicle-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('バックアップを書き出しました');
    });
    $('#importData').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const raw=JSON.parse(await file.text());state=mergeState(raw);saveState();toast('バックアップを読み込みました');}catch{toast('JSONを読み込めませんでした');}finally{e.target.value='';}});
    $('#resetAll').addEventListener('click',()=>{if(!confirm('すべての設定・履歴を初期状態に戻します。よろしいですか？'))return;state=clone(defaultState);saveState();toast('初期状態に戻しました');});
  }

  bind();
  renderAll();
})();
