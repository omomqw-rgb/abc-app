
/* ===== 설정 ===== */
const STORE_KEY='lb_data_v0';
// === Auto-migrate old localStorage keys to STORE_KEY ===
(function migrateOldData(){
  try {
    if (localStorage.getItem(STORE_KEY)) return;
    const keys = Object.keys(localStorage || {});
    const candidates = keys.filter(k => /loan|lb|book|core|data/i.test(k));
    for (const k of candidates) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj && Array.isArray(obj.debtors) && Array.isArray(obj.loans)) {
          localStorage.setItem(STORE_KEY, JSON.stringify(obj));
          console.log('[migrate] moved from', k, 'to', STORE_KEY);
          break;
        }
      } catch(e){}
    }
  } catch(e) { console.warn('[migrate] skip', e); }
})();
const AUTO_COLLAPSE_DONE=true; // 완납 대출 기본 접기

/* ===== 상태 & 저장 ===== */
const state={debtors:[],loans:[],ui:{year:null,month:null,selectedDebtorId:null,collapsed:{},rpCollapsed:{}}};
window.state = state;
const uid=()=>Math.random().toString(36).slice(2,10);
const save=()=>localStorage.setItem(STORE_KEY, JSON.stringify(state));
function load(){
  const raw=localStorage.getItem(STORE_KEY);
  if(!raw) return;
  try{
    const data=JSON.parse(raw);
    state.debtors = Array.isArray(data.debtors)? data.debtors.map(d=>({id:d.id,name:d.name,phone:d.phone,note:d.note})) : [];
    state.loans = Array.isArray(data.loans)? data.loans.map(l=>{
      const total = Number(l.total)||0;
      const count = Array.isArray(l.schedule)? l.schedule.length : (l.count||10);
      const installment = (total && count) ? Math.round(total / count) : (l.installment||0);
      const schedule = Array.isArray(l.schedule) ? l.schedule.map((it,i)=>({idx:(it&&Number(it.idx)>0)?Number(it.idx):(i+1),date:it.date,amount:it.amount||installment,paid:it.paid||0,missed:!!it.missed})) : [];
      return { id:l.id||uid(), debtorId:l.debtorId, total, count, installment, startDate:l.startDate, freq:l.freq||'weekly', schedule, completed: !!l.completed };
    }) : [];

state.repayPlans = Array.isArray(data.repayPlans) ? data.repayPlans.map(function(p){
  var sc = Array.isArray(p.schedule) ? p.schedule.map(function(it,i){
    return { idx: (it && Number(it.idx)>0)? Number(it.idx) : (i+1), date: String(it.date||''), amount: (it.amount===''||it.amount==null)? '' : Math.max(0, Number(it.amount)||0), missed: !!it.missed, settled: !!it.settled };
  }) : [];
  return { id: String(p.id||uid()), debtorId: String(p.debtorId), total: Math.max(0, Number(p.total)||0), count: Number(p.count||sc.length||0), startDate: p.startDate || (sc[0] && sc[0].date) || '', freq: p.freq || 'daily', schedule: sc, completed: !!p.completed };
}) : [];
        const ui=data.ui||{};
    state.ui.year = ui.year ?? state.ui.year;
    state.ui.month = ui.month ?? state.ui.month;
    state.ui.selectedDebtorId = ui.selectedDebtorId ?? null;
    state.ui.collapsed = ui.collapsed || {};
    state.ui.rpCollapsed = ui.rpCollapsed || {}; // repay collapse prefs
  }catch(e){ console.warn('불러오기 오류', e); }
}

/* ===== 유틸 ===== */
const KRW=n=>Number(n).toLocaleString('ko-KR');

/* 로컬 타임존 기준 YYYY-MM-DD (UTC 사용 금지) */
const ymd=(d)=>{
  const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
};
const addDays=(date,days)=>{const x=new Date(date); x.setDate(x.getDate()+days); return x;}
const addMonths=(date,months)=>{const x=new Date(date); x.setMonth(x.getMonth()+months); return x;}
const endOfMonth=(date)=>{const x=new Date(date.getFullYear(), date.getMonth()+1, 0); return x;}
const nextWeekdayOnOrAfter=(date, weekday)=>{ const x=new Date(date); const diff=(7 + weekday - x.getDay())%7; x.setDate(x.getDate()+diff); return x; };
const todayLocal=()=>{const t=new Date(); return new Date(t.getFullYear(),t.getMonth(),t.getDate());}

/* ===== 스케줄 생성 ===== */
function makeSchedule(total, count, startYmd, freq, firstPaid=false, opts={}){
  const start=new Date(startYmd+'T00:00:00'); // 로컬 기준
  const amounts=[]; const base=Math.round(total/count);
  for(let i=0;i<count;i++) amounts.push(base);
  let diff = total - amounts.reduce((s,v)=>s+v,0); amounts[count-1]+=diff;

  const schedule=[];
  for(let i=1;i<=count;i++){
    let d;
    if(freq==='daily'){
      const step=Math.max(1, Number(opts.dailyInterval||1));
      d = addDays(start,(i-1)*step);
    }else if(freq==='weekly'){
      if(typeof opts.weekday==='number'){ const first=nextWeekdayOnOrAfter(start, opts.weekday); d = addDays(first, (i-1)*7); }
      else { d = addDays(start,(i-1)*7); }
    }else if(freq==='month_end'){
      const baseDate = addMonths(start,(i-1)); d = endOfMonth(baseDate);
    }else{ d = addMonths(start,(i-1)); } // 'monthly' 레거시도 여기로 들어옴
    schedule.push({idx:i, date:ymd(d), amount:amounts[i-1], paid:0, missed:false});
  }
  if(firstPaid && schedule[0]){ schedule[0].paid=schedule[0].amount; schedule[0].missed=false; }
  return {installment:base, schedule};
}

/* ===== 상태/색상 ===== */
function pillClass(it, dateObj){
  const paid=it.paid||0, isPaid=paid>=it.amount-1e-6, isPartial=paid>0&&!isPaid;
  const dObj = dateObj || new Date(it.date);
  const overdue = (!isPaid && !isPartial && (it.missed || dObj < todayLocal()));
  if(isPaid) return 'paid';
  if(isPartial) return 'partial';
  if(overdue) return 'overdue';
  return 'upcoming';
}
function pillTag(it){
  const paid=it.paid||0, isPaid=paid>=it.amount-1e-6, isPartial=paid>0&&!isPaid;
  if(isPaid) return '완납';
  if(isPartial) return '부분';
  if(it.missed || new Date(it.date) < todayLocal()) return '미납';
  return '예정';
}
const allPaid = l => l.schedule.every(it => (it.paid||0) >= it.amount-1e-6);

function sanitizeState(raw){
  const out = { debtors:[], loans:[], ui: (raw && raw.ui) || {} };
  const dmap = new Map();
  try{
    (Array.isArray(raw && raw.debtors ? raw.debtors : []) ? raw.debtors : []).forEach(d=>{
      if(d && d.id && d.name){
        const nd = { id:String(d.id), name:String(d.name), phone:d.phone||'', note:d.note||'' };
        dmap.set(nd.id, nd); out.debtors.push(nd);
      }
    });
    
    (Array.isArray(raw && raw.loans ? raw.loans : []) ? raw.loans : []).forEach(l=>{
      if(!l || !dmap.has(String(l.debtorId))) return;
      let schedule = Array.isArray(l.schedule) ? l.schedule.slice() : [];

      // 날짜 필드 호환 처리: date / ymd / dueDate / due_ymd 등을 모두 허용
      schedule = schedule.map((it,i)=>{
        if(!it) return null;
        const rawDate = (it.date || it.ymd || it.dueDate || it.due_ymd || '').toString().trim();
        if(!rawDate) return null;
        return {
          idx: (it && Number(it.idx) > 0) ? Number(it.idx) : (i+1),
          date: rawDate,
          amount: Math.max(0, Number(it.amount)||0),
          paid: Math.max(0, Number(it.paid)||0),
          missed: !!it.missed
        };
      }).filter(Boolean);

      const hasSched = schedule.length > 0;
      const sum = hasSched ? schedule.reduce((s,it)=>s+(it.amount||0),0) : Math.max(0, Number(l.total)||0);
      const count = hasSched ? schedule.length : (Number(l.count)||0) || (sum>0 ? 1 : 0);
      const baseTotal = sum || Math.max(0, Number(l.total)||0);
      const inst = (baseTotal && count) ? Math.round(baseTotal / count) : Math.round(Number(l.installment)||0);

      // 스케줄이 하나도 없더라도 대출 자체는 유지 (헤더/요약은 보이게)
      out.loans.push({
        id: String(l.id||Math.random().toString(36).slice(2,10)),
        debtorId: String(l.debtorId),
        total: baseTotal,
        count,
        installment: inst,
        startDate: hasSched ? schedule[0].date : (l.startDate || ''),
        freq: l.freq || 'daily',
        schedule,
        completed: !!l.completed
      });
    });
}catch(e){ console.warn('[sanitizeState] 실패', e); }
  return out;
}


/* ===== 좌측 채무자 리스트(수정/삭제 포함) ===== */


function renderDebtors(){
  function renderTo(id){
    const box=document.getElementById(id);
    if(!box) return;
    box.innerHTML='';
    (state.debtors||[]).forEach(d=>{
      const el=document.createElement('div'); el.className='debtor'; el.dataset.id=d.id;
      el.innerHTML=`
        <div>
          <div style="font-weight:700">${d.name}</div>
          <div class="meta">${d.phone||'-'}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-edit-debtor="${d.id}">✏️</button>
          <button class="icon-btn" data-del-debtor="${d.id}">🗑</button>
        </div>`;
      el.onclick=()=>openDrawer(d.id);
      el.querySelector('[data-edit-debtor]').onclick=(e)=>{ e.stopPropagation(); openDebtorModal(d.id); };
      el.querySelector('[data-del-debtor]').onclick=(e)=>{ e.stopPropagation(); delDebtor(d.id); };
      box.appendChild(el);
    });
  }
  renderTo('debtorList');
  renderTo('debtorListMobile');
}
function delDebtor
(id){
  const d=state.debtors.find(x=>x.id===id);
  if(!d) return;
  if(!confirm(`채무자 “${d.name}”와 관련 대출을 모두 삭제할까요?`)) return;
  state.debtors = state.debtors.filter(x=>x.id!==id);
  state.loans = state.loans.filter(l=>l.debtorId!==id);
  if(state.ui.selectedDebtorId===id) state.ui.selectedDebtorId=null;
  renderAll();
}

/* ===== 오른쪽 드로워 ===== */
function aggByDebtor(id){
  const loans=state.loans.filter(l=>l.debtorId===id);
  const total=loans.reduce((s,l)=>s+l.total,0);
  const paid=loans.reduce((s,l)=>s+l.schedule.reduce((ss,it)=>ss+(it.paid||0),0),0);
  const remain=Math.max(0,total-paid);
  return {loans,total,paid,remain};
}
function openDrawer(id){
  state.ui.selectedDebtorId=id; save();
  const d=state.debtors.find(x=>x.id===id); if(!d) return;
  const a=aggByDebtor(id);
  document.getElementById('drawerName').textContent=d.name;
  document.getElementById('drawerKpis').innerHTML=`
    <div class="kpi">총상환채무 <b>${KRW(a.total)}</b></div>
    <div class="kpi">기납입 <b>${KRW(a.paid)}</b></div>
    <div class="kpi" style="border-color:#3a4869">잔액 <b style="color:#fff">${KRW(a.remain)}</b></div>
    <div class="kpi">${d.note?('📝 '+d.note):'📝 메모 없음'}</div>`;

  const list=document.getElementById('drawerLoans'); list.innerHTML='';
  if(a.loans.length===0){ list.innerHTML='<div class="note" style="padding:8px">대출이 없습니다.</div>'; return; }

  // 정렬: 미완 먼저, 시작일 최신순
  const loansSorted = a.loans.slice().sort((A,B)=>{
    const aDone = allPaid(A), bDone = allPaid(B);
    if(aDone!==bDone) return aDone - bDone; // 미완(0) 우선
    return (new Date(B.startDate)) - (new Date(A.startDate));
  });

  loansSorted.forEach(l=>{
    const hasPref = Object.prototype.hasOwnProperty.call(state.ui.collapsed, l.id);
    const collapsed = hasPref ? !!state.ui.collapsed[l.id] : (AUTO_COLLAPSE_DONE && allPaid(l));
    const progPaid = l.schedule.reduce((s,it)=>s+(it.paid||0),0);
    const progPct = Math.min(100, Math.round((progPaid / (l.total||1)) * 100));

    const card=document.createElement('div'); card.className='loan-card';
    const headerHtml = `
      <div class="sched-header">
        <h4 style="margin:0">총상환 ${KRW(l.total)}
          <span class="chip">회차 ${KRW(l.installment)} × ${l.count}</span>
          <span class="chip muted">진행 ${progPct}%</span>
        </h4>
        <button class="collapse-btn" data-collapse="${l.id}">${collapsed?'펼치기 ▽':'접기 △'}</button>
      </div>
      <div class="note">시작일 ${l.startDate} · 주기 ${
        l.freq==='month_end'?'월말':
        (l.freq==='daily'?'일간격':'주단위')
      }</div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn" data-complete-loan="${l.id}">${l.completed?'완료 해제':'완료(캘린더 숨김)'}</button>
        <button class="btn" data-edit-loan="${l.id}">대출 수정</button>
        <button class="btn" data-del-loan="${l.id}">삭제</button>
      </div>
    `;

    const schedRows = l.schedule.map(it=>{
      const cls = pillClass(it); // paid/partial/overdue/upcoming
      const paid=it.paid||0, isPaid=paid>=it.amount-1e-6, isPartial=paid>0&&!isPaid;
      let status = '미입금';
      if(isPaid) status='완납';
      else if(isPartial) status='부분입금';
      else if(it.missed) status='미납';

      return `
      <div class="sched-row ${cls}" data-loan="${l.id}" data-idx="${it.idx}">
        <div>${it.idx}회차</div>
        <input class="date-input" type="date" value="${it.date}" />
        <div class="amt ${cls}">${KRW(it.amount)}</div>
        <select class="status">
          <option ${status==='미입금'?'selected':''}>미입금</option>
          <option ${status==='부분입금'?'selected':''}>부분입금</option>
          <option ${status==='완납'?'selected':''}>완납</option>
          <option ${status==='미납'?'selected':''}>미납</option>
        </select>
        <input class="partial-input" type="number" inputmode="numeric" placeholder="부분 금액" style="display:${status==='부분입금'?'block':'none'}" value="${isPartial?Math.max(0, paid):''}" />
        
      </div>`;
    }).join('');

    card.innerHTML = headerHtml + `<div class="sched-wrap" id="sched-${l.id}" style="display:${collapsed?'none':'block'}">${schedRows}</div>`;
    list.appendChild(card);
  });
}

/* ===== 채무자 표 ===== */


function renderDebtorTable(){
  const wrap=document.getElementById('debtorTable');
  if(!wrap){ return; }
  if(state.debtors.length===0){
    wrap.innerHTML='<div class="note">채무자가 없습니다. 좌측에서 추가하세요.</div>';
    return;
  }

  // 기존 건수 로직 유지(완료된 건은 괄호 안)
  function loanCounts(loans){
    let active=0, done=0;
    (loans||[]).forEach(l=>{
      const paid=(l.schedule||[]).reduce((s,it)=>s+(Number(it.paid)||0),0);
      const isDone=!!l.completed || paid >= (Number(l.total)||0) - 1e-6;
      if(isDone) done++; else active++;
    });
    return {active, done};
  }

  // 채무상환(RepayPlan) 납입 합계: settled 된 금액만 누적
  const rpPaidSum = (p)=> (p && Array.isArray(p.schedule))
    ? p.schedule.reduce((s,it)=> s + (it && it.settled ? Math.max(0, Number(it.amount)||0) : 0), 0)
    : 0;

  // 채무자별 행 데이터 계산
  const rows = state.debtors.map(d=>{
    const loans = (state.loans||[]).filter(l=> String(l.debtorId)===String(d.id));
    const plans = (state.repayPlans||[]).filter(p=> String(p.debtorId)===String(d.id));

    const c = loanCounts(loans);

    let tA=0, tD=0, pA=0, pD=0; // (A) 진행중, (D) 완료
    loans.forEach(l=>{
      const tot = Math.max(0, Number(l.total)||0);
      const paid = (l.schedule||[]).reduce((s,it)=> s + Math.max(0, Number(it.paid)||0), 0);
      const done = !!l.completed || paid >= tot - 1e-6;
      if(done){ tD += tot; pD += paid; } else { tA += tot; pA += paid; }
    });
    plans.forEach(pl=>{
      const tot = Math.max(0, Number(pl.total)||0);
      const paid = rpPaidSum(pl);
      const done = !!pl.completed || paid >= tot - 1e-6;
      if(done){ tD += tot; pD += paid; } else { tA += tot; pA += paid; }
    });

    const remain = Math.max(0, (tA + tD) - (pA + pD));

    return {
      id:d.id, name:d.name, phone:d.phone||'-',
      active:c.active, done:c.done,
      tA, tD, pA, pD, remain
    };
  });

  // 합계
  const sA  = rows.reduce((s,r)=>s+r.active,0);
  const sD  = rows.reduce((s,r)=>s+r.done,0);
  const sTA = rows.reduce((s,r)=>s+r.tA,0);
  const sTD = rows.reduce((s,r)=>s+r.tD,0);
  const sPA = rows.reduce((s,r)=>s+r.pA,0);
  const sPD = rows.reduce((s,r)=>s+r.pD,0);
  const sR  = Math.max(0, (sTA+sTD) - (sPA+sPD));

  const grid='display:grid;grid-template-columns:1.2fr .9fr .6fr 1fr 1fr 1fr;gap:6px;padding:8px;border-bottom:1px solid var(--line);';

  const head = `<div style="${grid}color:#c8d0e2;font-weight:700">
    <div>채무자</div><div>연락처</div><div>건수</div><div>총상환채무</div><div>기납입</div><div>잔액</div>
  </div>`;

  const body = rows.map(r=>{
    const countStr = r.done
      ? `${r.active.toLocaleString('ko-KR')}(${r.done.toLocaleString('ko-KR')})`
      : r.active.toLocaleString('ko-KR');
    const totalStr = `${KRW(r.tA)}${r.tD ? '('+KRW(r.tD)+')' : ''}`;
    const paidStr  = `${KRW(r.pA)}${r.pD ? '('+KRW(r.pD)+')' : ''}`;
    return `<div style="${grid}cursor:pointer" data-open="${r.id}">
      <div style="font-weight:700">${r.name}</div>
      <div>${r.phone}</div>
      <div>${countStr}</div>
      <div>${totalStr}</div>
      <div>${paidStr}</div>
      <div style="font-weight:800">${KRW(r.remain)}</div>
    </div>`;
  }).join('');

  const sumRow = `<div class="sum-row" style="${grid}">
    <div>합계</div>
    <div>-</div>
    <div>${sA.toLocaleString('ko-KR')}(${sD.toLocaleString('ko-KR')})</div>
    <div>${KRW(sTA)}${sTD ? '('+KRW(sTD)+')' : ''}</div>
    <div>${KRW(sPA)}${sPD ? '('+KRW(sPD)+')' : ''}</div>
    <div style="font-weight:800">${KRW(sR)}</div>
  </div>`;

  wrap.innerHTML = head + body + sumRow;
  wrap.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openDrawer(el.dataset.open));
}

/* ===== 채무자 관리 > 알림 ===== */



function renderAlerts(){
  const wrap=document.getElementById('alertsWrap'); if(!wrap) return;
  const today=todayLocal();
  const tomorrow=ymd(addDays(today,1));

  const dueTomorrow=[], dueToday=[], overdues=[];

  // LOANS
  (state.loans||[]).forEach(function(l){
    if(l.completed) return;
    const debtor = (state.debtors||[]).find(d=>String(d.id)===String(l.debtorId));
    if(!debtor) return;
    (l.schedule||[]).forEach(function(it){
      const amt = Math.max(0, Number(it.amount||0));
      const paid = Math.max(0, Number(it.paid||0));
      const isPaid = (amt>0 && paid>=amt-1e-6);
      if(isPaid) return;
      const rec = { type:'loan', debtor, loan:l, it };
      if(it.date===tomorrow) dueTomorrow.push(rec);
      if(it.date===ymd(today)) dueToday.push(rec);
      if(new Date(it.date) < today || it.missed) overdues.push(rec);
    });
  });

  // REPAY PLANS
  (state.repayPlans||[]).forEach(function(p){
    if(p.completed) return;
    const debtor = (state.debtors||[]).find(d=>String(d.id)===String(p.debtorId));
    if(!debtor) return;
    (p.schedule||[]).forEach(function(it){
      const amt = (it.amount===''||it.amount==null)?0:Number(it.amount||0);
      const paid = Math.max(0, Number(it.paid||0));
      const isPaid = (amt>0 && paid>=amt-1e-6) || !!it.settled;
      if(isPaid) return;
      const rec = { type:'repay', debtor, plan:p, it };
      if(it.date===tomorrow) dueTomorrow.push(rec);
      if(it.date===ymd(today)) dueToday.push(rec);
      if(new Date(it.date) < today || it.missed) overdues.push(rec);
    });
  });

  dueTomorrow.sort((a,b)=> a.debtor.name.localeCompare(b.debtor.name,'ko') || (a.it.idx - b.it.idx));
  dueToday.sort((a,b)=> a.debtor.name.localeCompare(b.debtor.name,'ko') || (a.it.idx - b.it.idx));
  overdues.sort((a,b)=> new Date(a.it.date) - new Date(b.it.date));

  const KRWfmt = n => Number(n||0).toLocaleString('ko-KR');
  const amtOf = rec => rec.type==='loan'
    ? Math.max(0, (Number(rec.it.amount||0)) - Math.max(0, Number(rec.it.paid||0)))
    : Math.max(0, Number(rec.it.amount||0) - Math.max(0, Number(rec.it.paid||0)));
  const totalD1 = dueTomorrow.reduce((s,r)=>s+amtOf(r),0);
  const totalD0 = dueToday.reduce((s,r)=>s+amtOf(r),0);
  const totalOverdue = overdues.reduce((s,r)=>s+amtOf(r),0);

  const itemHtml = rec => {
    const amt = amtOf(rec);
    const dataAttrs = rec.type==='loan'
      ? `data-loan="${rec.loan.id}" data-idx="${rec.it.idx}"`
      : `data-plan="${rec.plan.id}" data-rpidx="${rec.it.idx}"`;
    const chip = rec.type==='repay' ? '<span class="chip" style="margin-left:6px">상환</span>' : '';
    return `<div class="alert-item" data-open-sched data-debtor="${rec.debtor.id}" ${dataAttrs}>
      <div class="alert-left">
        <div class="name">${rec.debtor.name} ${chip}</div>
        <div class="meta">${rec.it.date} • ${rec.it.idx}회차</div>
      </div>
      <div class="amount-upcoming">₩${KRWfmt(amt)}</div>
    </div>`;
  };

  const listHtml = (arr, overdue)=>{
    if(arr.length===0) return '<div class="empty" style="padding:8px;border:1px dashed var(--line);border-radius:10px">항목 없음</div>';
    return arr.map(itemHtml).join('');
  };

  wrap.innerHTML = `
    <div class="alert-board">
      <div class="alert-section">
        <h4>납기도래 D-1 <span class="chip">${dueTomorrow.length}건 / ₩${KRWfmt(totalD1)}</span></h4>
        ${listHtml(dueTomorrow,false)}
      </div>
      <div class="alert-section">
        <h4>납기도래 D-day <span class="chip">${dueToday.length}건 / ₩${KRWfmt(totalD0)}</span></h4>
        ${listHtml(dueToday,false)}
      </div>
    </div>
    <div class="alert-section" style="margin-top:10px">
      <h4>미납 <span class="chip" style="border-color:#e04545;color:#ffb0b0">${overdues.length}건 / 합계 ₩${KRWfmt(totalOverdue)}</span></h4>
      ${listHtml(overdues,true)}
    </div>`;
}

/* ===== 캘린더 ===== */
function populateYMSelectors(){
  const ySel=document.getElementById('yearSel'), mSel=document.getElementById('monthSel');
  ySel.innerHTML=''; mSel.innerHTML='';
  const yNow=new Date().getFullYear();
  for(let y=yNow-3;y<=yNow+3;y++){ const o=document.createElement('option'); o.value=y; o.textContent=y+'년'; ySel.appendChild(o); }
  for(let m=0;m<12;m++){ const o=document.createElement('option'); o.value=m; o.textContent=(m+1)+'월'; mSel.appendChild(o); }
  if(state.ui.year==null) state.ui.year=yNow;
  if(state.ui.month==null) state.ui.month=new Date().getMonth();
  ySel.value=state.ui.year; mSel.value=state.ui.month;
}
function buildCalendar(year,month){
  const grid=document.getElementById('calGrid'); grid.innerHTML='';
  const first=new Date(year,month,1); const last=new Date(year,month+1,0);
  const startW=first.getDay(); const totalDays=last.getDate(); const today=todayLocal();
  for(let i=0;i<startW;i++){ const cell=document.createElement('div'); cell.className='day'; grid.appendChild(cell); }
  for(let d=1; d<=totalDays; d++){
    const cell=document.createElement('div'); cell.className='day';
    const thisDate=new Date(year,month,d); const isToday=thisDate.getTime()===today.getTime();
    const dateDiv=document.createElement('div'); dateDiv.className='date'+(isToday?' today':''); dateDiv.textContent=d;
    const items=document.createElement('div'); items.className='items';
    const yyyyMmDd=ymd(thisDate);

    const dues=[];
    state.loans.forEach(l=>{ if(l.completed) return; l.schedule.forEach(it=>{ if(it.date===yyyyMmDd){ const debtor=state.debtors.find(dd=>dd.id===l.debtorId); if(debtor) dues.push({loan:l,it,who:debtor.name}); }}); });
    dues.sort((a,b)=>a.who.localeCompare(b.who,'ko'));

    dues.forEach(x=>{
      const cls=pillClass(x.it, thisDate);
      const tag=pillTag(x.it);
      const pill=document.createElement('div'); pill.className='pill '+cls;
      pill.dataset.loanId=x.loan.id; pill.dataset.idx=x.it.idx;
      const remain = Math.max(0, (x.it.amount || 0) - (x.it.paid || 0)); // ← 부분입금 이후 잔액 반영
      pill.title=`할당 ${KRW(x.it.amount)} · 누적입금 ${KRW(x.it.paid||0)} · 잔액 ${KRW(remain)} · ${tag}`;
      pill.innerHTML=`<span class="who">${x.who}</span><span class="amt">${KRW(remain)}</span>`;
      items.appendChild(pill);
    });

    cell.appendChild(dateDiv); cell.appendChild(items); grid.appendChild(cell);
  }
}

/* ===== 공통 리프레시: 캘린더+드로워 동기화 유지 ===== */
function renderAll(){ renderDebtors(); populateYMSelectors(); buildCalendar(state.ui.year,state.ui.month); renderDebtorTable(); renderAlerts(); save(); }
function refreshKeepDrawer(){
  const sel = state.ui.selectedDebtorId;
  renderAll();
  if(sel) openDrawer(sel);
}

/* ===== 모달/폼 & 이벤트 ===== */
function openModal(id){ const el=document.querySelector(id); if(el) el.style.display='flex'; }
function closeModal(id){ const el=document.querySelector(id); if(el) el.style.display='none'; }

document.addEventListener('click',(e)=>{
  const t=e.target;

  /* (1) 모달 닫기 전역 처리 */
  if(t.matches('[data-close]')){ closeModal(t.getAttribute('data-close')); return; }

  // 탭
  if(t.classList.contains('tab')){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
    const tab=t.dataset.tab;
    document.getElementById('view-calendar').style.display=tab==='calendar'?'':'none';
    document.getElementById('view-debtors').style.display=tab==='debtors'?'':'none';
    var vs=document.getElementById('view-stats'); if(vs) vs.style.display=tab==='stats'?'':'none';
    if(tab==='debtors' && typeof renderAlerts==='function') renderAlerts();
    if(tab==='stats' && typeof renderStats==='function') renderStats('sum');
    return;
  }

  // 채무자 추가/수정
  if(t.id==='btnAddDebtor'){ openDebtorModal(); return; }
  if(t.id==='btnEditDebtor'){ const id=state.ui.selectedDebtorId; if(id) openDebtorModal(id); return; }
  if(t.id==='saveDebtor'){ saveDebtor(); return; }

  // 대출 등록·수정
  if(t.id==='btnNewLoan' || t.id==='btnNewLoan2' || t.id==='btnNewLoanDrawer'){ openLoanModal(t.id==='btnNewLoanDrawer'?state.ui.selectedDebtorId:null); return; }
  if(t.id==='saveLoan'){ saveLoan(); return; }
  if(t.dataset.editLoan){ editLoan(t.dataset.editLoan); return; }
  if(t.dataset.delLoan){ delLoan(t.dataset.delLoan); return; }
  // 대출 완료 토글 (캘린더 숨김)
  if(t.dataset.completeLoan){
    const id=t.dataset.completeLoan;
    const l=state.loans.find(x=>x.id===id);
    if(l){ l.completed=!l.completed; refreshKeepDrawer(); save(); }
    return;
  }

  // 회차 pill → 빠른 처리 모달
  const pill = t.closest('.pill');
  if(pill){ openPayModal(pill.dataset.loanId, pill.dataset.idx); return; }

  // 캘린더 이동/오늘
  if(t.id==='prevMonth'){ moveMonth(-1); return; }
  if(t.id==='nextMonth'){ moveMonth(1); return; }
  if(t.id==='todayBtn'){ gotoToday(); return; }

  // 접기/펼치기
  if(t.dataset.collapse){
    const id=t.dataset.collapse;
    state.ui.collapsed[id] = !state.ui.collapsed[id];
    save(); openDrawer(state.ui.selectedDebtorId);
    return;
  }

  // 알림 항목 클릭
  const ai = t.closest('[data-open-sched]');
  if(ai){ openDrawer(ai.dataset.debtor); openPayModal(ai.dataset.loan, ai.dataset.idx); return; }

  // 백업
  if(t.id==='btnExport'){ exportData(); return; }
  if(t.id==='btnImport'){ document.getElementById('importFile').click(); return; }
});

// ==== compat-ESM exports ====
export {
  state,
  uid,
  save,
  load,
  KRW,
  ymd,
  addDays,
  addMonths,
  endOfMonth,
  nextWeekdayOnOrAfter,
  todayLocal,
  makeSchedule,
  pillClass,
  pillTag,
  allPaid,
  sanitizeState,
  renderDebtors,
  delDebtor,
  aggByDebtor,
  openDrawer,
  renderDebtorTable,
  renderAlerts,
  renderAll,
  refreshKeepDrawer,
  openModal,
  closeModal,
  buildCalendar,
  populateYMSelectors
};

/* 상태 변경 시 부분입금 입력 토글 + 색상 미리보기 */
document.addEventListener('input', (e) => {
  const row = e.target.closest('.sched-row');
  if (!row) return;

  // 상태 변경 시: 부분입금 입력칸 토글 + 색상 표시
  if (e.target.classList.contains('status')) {
    const val = e.target.value;
    const partialInput = row.querySelector('.partial-input');
    if (partialInput) partialInput.style.display = (val === '부분입금') ? 'block' : 'none';

    const amt = row.querySelector('.amt');
    const clsMap = { '완납': 'paid', '부분입금': 'partial', '미납': 'overdue', '미입금': 'upcoming' };
    const next = clsMap[val] || 'upcoming';

    // 색상 클래스 정리
    ['paid', 'partial', 'overdue', 'upcoming'].forEach(c => {
      row.classList.remove(c);
      if (amt) amt.classList.remove(c);
    });
    row.classList.add(next);
    if (amt) amt.classList.add(next);
  }

  // 데이터 동기화
  const loanId = row.getAttribute('data-loan');
  const idx = row.getAttribute('data-idx');
  const l = (window.state && Array.isArray(window.state.loans))
    ? window.state.loans.find(x => String(x.id) === String(loanId))
    : null;
  const it = l && Array.isArray(l.schedule)
    ? l.schedule.find(s => String(s.idx) === String(idx))
    : null;
  if (!it) return;

  // 날짜 입력 즉시 반영
  if (e.target.classList.contains('date-input')) {
    if (e.target.value) it.date = e.target.value;
    if (typeof refreshKeepDrawer === 'function') refreshKeepDrawer();
    if (typeof save === 'function') save();
    return;
  }

  // 상태 변경 즉시 반영
  if (e.target.classList.contains('status')) {
    const status = e.target.value;
    const pi = row.querySelector('.partial-input');
    const pv = Number((pi && pi.value) || 0);

    if (status === '완납') { it.paid = it.amount; it.missed = false; }
    else if (status === '미납') { it.paid = 0; it.missed = true; }
    else if (status === '미입금') { it.paid = 0; it.missed = false; }
    else if (status === '부분입금') {
      it.paid = Math.min(it.amount, Math.max(0, pv));
      it.missed = false;
    }

    if (typeof refreshKeepDrawer === 'function') refreshKeepDrawer();
    if (typeof save === 'function') save();
    return;
  }

  // 부분입금 금액 입력 즉시 반영
  if (e.target.classList.contains('partial-input')) {
    const v = Math.max(0, Number(e.target.value || 0));
    it.paid = Math.min(it.amount, v);
    it.missed = false;
    if (typeof refreshKeepDrawer === 'function') refreshKeepDrawer();
    if (typeof save === 'function') save();
    return;
  }
});
