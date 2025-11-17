
/* ===== 채무자 모달 ===== */
function openDebtorModal(editId){
  document.getElementById('debtorModalTitle').textContent = editId?'채무자 수정':'채무자 추가';
  document.getElementById('saveDebtor').dataset.editId = editId||'';
  const d = editId? state.debtors.find(x=>x.id===editId) : null;
  document.getElementById('debtorName').value = d?.name||'';
  document.getElementById('debtorPhone').value = d?.phone||'';
  document.getElementById('debtorNote').value = d?.note||'';
  openModal('#debtorModal');
}
function saveDebtor(){
  const name=document.getElementById('debtorName').value.trim(); if(!name) return toast('이름을 입력하세요.');
  const phone=document.getElementById('debtorPhone').value.trim();
  const note=document.getElementById('debtorNote').value.trim();
  const editId=document.getElementById('saveDebtor').dataset.editId;
  if(editId){ const d=state.debtors.find(x=>x.id===editId); Object.assign(d,{name,phone,note}); }
  else{ state.debtors.push({id:uid(), name, phone, note}); }
  closeModal('#debtorModal'); refreshKeepDrawer();
}

/* ===== 대출 모달 ===== */
function fillDebtorSelect(fixedId){
  const sel=document.getElementById('loanDebtor'); sel.innerHTML='';
  state.debtors.forEach(d=>{ const o=document.createElement('option'); o.value=d.id; o.textContent=d.name; sel.appendChild(o); });
  if(fixedId) sel.value=fixedId;
}
function openLoanModal(fixedId){
  closeModal('#payModal'); closeModal('#debtorModal'); // 모달 충돌 방지
  fillDebtorSelect(fixedId);
  document.getElementById('loanModalTitle').textContent='대출 등록';
  document.getElementById('loanTotal').value='';
  document.getElementById('loanCount').value=10;
  document.getElementById('loanStart').value=ymd(todayLocal());
  document.getElementById('loanFreq').value='daily';
  document.getElementById('loanDailyInterval').value=7;
  document.getElementById('loanWeekday').value=String(new Date().getDay());
  document.getElementById('optFirstPaid').checked=false;
  document.getElementById('loanRate').value='';
  document.getElementById('saveLoan').dataset.editLoanId='';
  document.getElementById('previewLoan').textContent='';
  toggleFreqRows();
  openModal('#loanModal');
}
['loanTotal','loanCount','loanStart','loanFreq','optFirstPaid','loanDailyInterval','loanWeekday','loanRate'].forEach(id=>{
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('input', ()=>{
    toggleFreqRows();
    const total=Number(document.getElementById('loanTotal').value||0);
    const count=Math.max(1, Number(document.getElementById('loanCount').value||10));
    const start=document.getElementById('loanStart').value;
    const rate=Number(document.getElementById('loanRate').value||0);
    const firstPaid=document.getElementById('optFirstPaid').checked;
    if(total>0 && start){
      const base=Math.round(total/count);
      const freqLabel = ({
        daily:`일간격(${document.getElementById('loanDailyInterval').value||1}일)`,
        weekly:`주간격(요일 ${'일월화수목금토'[Number(document.getElementById('loanWeekday').value||0)]})`,
        month_end:'월말'
      })[document.getElementById('loanFreq').value] || '주기';
      let principal=0;
      if(rate>0){
        const r=rate/100;
        const basePrincipal=Math.round(total/(1+r));
        const interestPart=total-basePrincipal;
        if(firstPaid){
          principal=total-interestPart-base;
        }else{
          principal=basePrincipal;
        }
      }else{
        principal=total;
      }
      const principalLabel = principal>0 ? ` · 실투 <b>${KRW(principal)}</b>` : '';
      const firstPaidLabel = firstPaid ? ' · 1회차 즉시완납' : '';
      document.getElementById('previewLoan').innerHTML =
        `총상환 <b>${KRW(total)}</b> · 회차 <b>${KRW(base)}</b> × ${count} · ${freqLabel}` +
        principalLabel + firstPaidLabel;
    }else{
      document.getElementById('previewLoan').textContent='';
    }
  });
});
function toggleFreqRows(){
  const f=document.getElementById('loanFreq').value;
  document.getElementById('rowDaily').style.display = (f==='daily')?'grid':'none';
  document.getElementById('rowWeekly').style.display = (f==='weekly')?'grid':'none';
}
function saveLoan(){
  const debtorId=document.getElementById('loanDebtor').value;
  const total=Number(document.getElementById('loanTotal').value||0);
  const count=Math.max(1, Number(document.getElementById('loanCount').value||10));
  const start=document.getElementById('loanStart').value;
  const freq=document.getElementById('loanFreq').value;
  const firstPaid=document.getElementById('optFirstPaid').checked;
  const rate=Number(document.getElementById('loanRate').value||0);
  const opts = { dailyInterval: Number(document.getElementById('loanDailyInterval').value||1), weekday: Number(document.getElementById('loanWeekday').value||0) };
  if(!debtorId) return toast('채무자를 선택하세요.');
  if(!(total>0)) return toast('총상환금액을 입력하세요.');
  if(!start) return toast('시작일을 선택하세요.');
  const s=makeSchedule(total,count,start,freq,firstPaid,opts);
  // 실투(실제 지급액) 계산
  let principal=0;
  if(rate>0){
    const r=rate/100;
    const basePrincipal=Math.round(total/(1+r));
    const interestPart=total-basePrincipal;
    const baseInstallment=Math.round(total/count);
    if(firstPaid){
      principal=total-interestPart-baseInstallment;
    }else{
      principal=basePrincipal;
    }
  }else{
    principal=total;
  }
  const editId=document.getElementById('saveLoan').dataset.editLoanId;
  if(editId){
    const l=state.loans.find(x=>x.id===editId);
    Object.assign(l,{debtorId,total,count,installment:s.installment,startDate:start,freq,schedule:s.schedule,rate,principal});
  }else{
    state.loans.unshift({id:uid(), debtorId,total,count,installment:s.installment,startDate:start,freq,schedule:s.schedule,rate,principal});
  }
  closeModal('#loanModal'); refreshKeepDrawer();
}
function editLoan(id){
  const l=state.loans.find(x=>x.id===id); if(!l) return;
  fillDebtorSelect(l.debtorId);
  document.getElementById('loanModalTitle').textContent='대출 수정';
  document.getElementById('loanTotal').value=l.total;
  document.getElementById('loanCount').value=l.count||l.schedule.length||10;
  document.getElementById('loanStart').value=l.startDate;
  // 'monthly' 레거시 대출은 편집 시 'month_end'로 보여줌(선택지에 월단위 없음)
  let freqVal = l.freq || 'daily'; if(freqVal==='monthly') freqVal='month_end';
  document.getElementById('loanFreq').value=freqVal;
  document.getElementById('optFirstPaid').checked = (l.schedule?.[0]?.paid||0) >= (l.schedule?.[0]?.amount||Infinity);
  document.getElementById('loanRate').value = (typeof l.rate==='number' && !isNaN(l.rate)) ? l.rate : '';
  document.getElementById('saveLoan').dataset.editLoanId=l.id;
  toggleFreqRows();
  const principalLabel = l.principal ? ` · 실투 <b>${KRW(l.principal)}</b>` : '';
  document.getElementById('previewLoan').innerHTML=
    `총상환 <b>${KRW(l.total)}</b> · 회차 <b>${KRW(l.installment)}</b> × ${l.count}` +
    principalLabel;
  openModal('#loanModal');
}
function delLoan(id){
  if(!confirm('이 대출을 삭제할까요? 관련 회차도 모두 삭제됩니다.')) return;
  state.loans=state.loans.filter(x=>x.id!==id); refreshKeepDrawer();
}

/* ===== 빠른 처리 모달 ===== */
function openPayModal(loanId, idx){
  closeModal('#loanModal'); closeModal('#debtorModal'); // 충돌 방지
  const l = state.loans.find(x=>x.id===loanId);
  const it = l && l.schedule.find(s=>String(s.idx)===String(idx));
  if(!l || !it) return; // 대출이 아닌(=상환) pill 클릭 시 바로 종료
  const d = state.debtors.find(dd=>dd.id===l.debtorId);
  document.getElementById('payWho').textContent=d?d.name:'-';
  document.getElementById('payWhen').textContent=`${it.idx}회차 · ${it.date}`;
  document.getElementById('payAmt').textContent=KRW(it.amount);
  document.getElementById('payPaid').textContent=KRW(it.paid||0);
  document.getElementById('payAdd').value='';
  document.getElementById('btnMissed').onclick=()=>{ it.paid=0; it.missed=true; closeModal('#payModal'); refreshKeepDrawer(); };
  document.getElementById('btnPartial').onclick=()=>{ const add=Number(document.getElementById('payAdd').value||0); if(add<=0) return toast('부분입금 금액을 입력하세요.'); it.paid=Math.min(it.amount,(it.paid||0)+add); it.missed=false; closeModal('#payModal'); refreshKeepDrawer(); };
  document.getElementById('btnSettle').onclick=()=>{ it.paid=it.amount; it.missed=false; closeModal('#payModal'); refreshKeepDrawer(); };
  openModal('#payModal');
}

function openRepayModal(planId, idx){
  closeModal('#loanModal'); closeModal('#debtorModal'); // 충돌 방지
  var p = (state.repayPlans||[]).find(function(x){ return String(x.id)===String(planId); });
  if(!p) return;
  var it = (p.schedule||[]).find(function(s){ return String(s.idx)===String(idx); });
  if(!it) return;
  var d = (state.debtors||[]).find(function(dd){ return String(dd.id)===String(p.debtorId); });
  var amt = (it.amount===''||it.amount==null) ? 0 : Math.max(0, Number(it.amount)||0);
  var paid = Math.max(0, Number(it.paid||0));
  document.getElementById('payWho').textContent = d ? d.name : '-';
  document.getElementById('payWhen').textContent = (it.idx)+'회차 · '+(it.date||'-');
  document.getElementById('payAmt').textContent = (amt).toLocaleString('ko-KR');
  document.getElementById('payPaid').textContent = (paid).toLocaleString('ko-KR');
  document.getElementById('payAdd').value = '';
  document.getElementById('btnMissed').onclick = function(){ it.missed = true; it.settled = false; closeModal('#payModal'); refreshKeepDrawer(); save(); };
  document.getElementById('btnPartial').onclick = function(){ var add = Math.max(0, Number(document.getElementById('payAdd').value||0)); if(!(add>0)) { toast('부분입금 금액을 입력하세요.'); return; } var basePaid = Math.max(0, Number(it.paid||0)); it.paid = Math.min(amt, basePaid + add); it.missed = false; it.settled = (amt>0 && it.paid>=amt-1e-6); closeModal('#payModal'); refreshKeepDrawer(); save(); };
  document.getElementById('btnSettle').onclick = function(){ if(!(amt>0)){ toast('회차 금액을 먼저 입력하세요.'); return; } it.paid = amt; it.missed = false; it.settled = true; closeModal('#payModal'); refreshKeepDrawer(); save(); };
  openModal('#payModal');
}

/* ===== 캘린더 이동/백업 ===== */
function moveMonth(delta){
  const y=document.getElementById('yearSel'), m=document.getElementById('monthSel');
  let Y=Number(y.value), M=Number(m.value)+delta;
  while(M<0){ M+=12; Y--; } while(M>11){ M-=12; Y++; }
  y.value=Y; m.value=M; state.ui.year=Y; state.ui.month=M; buildCalendar(Y,M); save();
}
function gotoToday(){ const now=new Date(); state.ui.year=now.getFullYear(); state.ui.month=now.getMonth(); document.getElementById('yearSel').value=state.ui.year; document.getElementById('monthSel').value=state.ui.month; buildCalendar(state.ui.year,state.ui.month); save(); }
function exportData(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='loan_book_core_v0_6_5_backup.json'; a.click(); URL.revokeObjectURL(a.href); }

/* ===== 년/월 셀렉터 & 백업 불러오기 이벤트 ===== */
document.getElementById('yearSel').addEventListener('change',e=>{ state.ui.year=Number(e.target.value); buildCalendar(state.ui.year,state.ui.month); save(); });
document.getElementById('monthSel').addEventListener('change',e=>{ state.ui.month=Number(e.target.value); buildCalendar(state.ui.year,state.ui.month); save(); });
document.getElementById('importFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return; const fr=new FileReader();
  fr.onload=()=>{ try{ const data=JSON.parse(fr.result);
      const sane = sanitizeState(data);
      Object.assign(state, sane);
      renderAll(); if(state.ui.selectedDebtorId) openDrawer(state.ui.selectedDebtorId); toast('불러오기 완료'); }catch(err){ toast('불러오기 실패: '+err.message) } };
  fr.readAsText(f);
});

/* ===== 부팅 ===== */
load();
if(!state.ui.year&&state.ui.year!==0 || !state.ui.month&&state.ui.month!==0){ const now=new Date(); state.ui.year=now.getFullYear(); state.ui.month=now.getMonth(); }
renderAll(); if(state.ui.selectedDebtorId) openDrawer(state.ui.selectedDebtorId);

/* ===== Supabase 연동 (Storage 기반 클라우드 백업) ===== */
// 1) 아래 두 값 채우세요. (Supabase 프로젝트 설정 > Project URL, anon 키)
const SUPABASE_URL = 'https://hgtikcwwvxlfiemqchox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndGlrY3d3dnhsZmllbXFjaG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMzU5MTMsImV4cCI6MjA3NjcxMTkxM30.-bJy9m3ndeULvzwbtVXhazlotxGyGyzuxCp2w3Rfm9g';
const SUPABASE_BUCKET = 'loanbook';
// ---- expose constants to window for patches ----
try{
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  window.SUPABASE_BUCKET = SUPABASE_BUCKET;
}catch(_){}
 // 대시보드에서 버킷 생성

// --- config sanity check ---
function isValidJwtLike(s){ try { return typeof s==='string' && s.split('.').length===3 && s.length>40; } catch(e){ return false; } }
function isValidUrlLike(u){ try { return typeof u==='string' && /^https?:\/\//.test(u); } catch(e){ return false; } }
function validateSupabaseConfig(showAlert){
  const ok = isValidUrlLike(SUPABASE_URL) && isValidJwtLike(SUPABASE_ANON_KEY) && !!SUPABASE_BUCKET;
  if(!ok && showAlert){
    toast('Supabase 설정값이 유효하지 않습니다.\n\n- URL\n- anon key(JWT 형식 3구간)\n- Storage 버킷 이름\n\n을 정확히 채워주세요.');
  }
  return ok;
}

let sb = window.sb || null;
try {
  if (typeof supabase !== 'undefined') {
    if (!window.sb) { window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storageKey: 'lb_auth_v1' } }); }
      sb = window.sb;
  }
} catch (e) { console.warn('Supabase 초기화 실패', e); }



function ensureClient(){
  if (sb) return true;
  if (!validateSupabaseConfig(true)) return false;
  try {
    if (typeof supabase !== 'undefined') {
      if (!window.sb) { window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storageKey: 'lb_auth_v1' } }); }
      sb = window.sb;
    }
  } catch (e) {
    console.warn('Supabase 재초기화 실패', e);
  }
  return !!sb;
}

function qs(id){ return document.getElementById(id); }

function setAuthButton(user){
  const btn = qs('btnAuth');
  if(!btn) return;
  if(user){
    const label = user.email ? `로그아웃 (${user.email})` : '로그아웃';
    btn.textContent = label;
    btn.dataset.mode = 'signout';
  }else{
    btn.textContent = '로그인';
    btn.dataset.mode = 'signin';
  }
}

async function getUser(){
  if(!sb) return null;
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

async function ensureAuth(){
  const user = await getUser();
  if(user) return user;
  toast('먼저 로그인 해주세요.');
  return null;
}

// 간단 로그인(이메일/비밀번호) — 필요 시 Auth 설정에서 Email/Password 제공자 활성화
async function signInEmailPassword(){
  if(!sb) return toast('Supabase가 초기화되지 않았습니다.');
  const email = prompt('이메일을 입력하세요:');
  if(!email) return null;
  const password = prompt('비밀번호를 입력하세요:');
  if(!password) return null;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error){ toast('로그인 실패: '+error.message); return null; }
  return data.user;
}

async function signOut(){
  if(!sb) return;
  await sb.auth.signOut();
}

// 파일 경로: 각 사용자 uid 폴더 아래 고정 파일명
async function backupPath(){
  const user = await ensureAuth(); if(!user) return null;
  return `${user.id}/loan_book_core_v0_6_5.json`;
}

async function cloudSave(){
  if(!sb) return toast('Supabase가 초기화되지 않았습니다.');
  const user = await ensureAuth(); if(!user) return;
  const path = await backupPath(); if(!path) return;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  let errMsg = '';
  try{
    const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(path, blob, { upsert:true, contentType:'application/json' });
    if(error) errMsg = error.message || String(error);
  }catch(e){ errMsg = e && e.message ? e.message : String(e); }
  // 호환성 위해 신규 표준 파일명에도 베스트에포트 업서트
  try{
    const alt = user.id + '/loan_book_data.json';
    await sb.storage.from(SUPABASE_BUCKET).upload(alt, blob, { upsert:true, contentType:'application/json' });
  }catch(_e){}
  if(errMsg) toast('클라우드 저장 실패: ' + errMsg, 'error'); else toast('클라우드 저장 완료', 'success');
}


async function resolveUserBackupPath(userId){
  // 후보 파일명(신규 우선, 구버전 호환 포함)
  const candidates = ['loan_book_data.json','loan_book_core_v0_6_5.json','loan_book_core_v0_6_5_backup.json','loan_book_core_v0_6_5.json','loan_book_core_backup.json'];
  try{
    const { data: list, error } = await sb.storage.from(SUPABASE_BUCKET).list(userId, { limit: 100 });
    if(error){ console.warn('[cloud list]', error); }
    const items = Array.isArray(list) ? list : [];
    // 후보 중 존재하는 것만, 가장 최신(updated_at) 선택
    let chosen = null; let latest = 0;
    for(const it of items){
      if(!it || !it.name) continue;
      if(!candidates.includes(it.name)) continue;
      const t = Date.parse(it.updated_at || it.created_at || new Date(0).toISOString());
      if(!isNaN(t) && t >= latest){ latest = t; chosen = userId + '/' + it.name; }
    }
    // 목록에 없으면 기본 경로 반환(신규 표준)
    return chosen || (userId + '/loan_book_core_v0_6_5.json');
  }catch(e){
    console.warn('[resolveUserBackupPath] 실패', e);
    return userId + '/loan_book_core_v0_6_5.json';
  }
}
async function cloudLoad(opts){
  opts = opts || {};
  var silent = !!opts.silent;

  if(!sb) return toast('Supabase가 초기화되지 않았습니다.');
  const user = await ensureAuth(); if(!user) return;
  const path = await resolveUserBackupPath(user.id);
  try{
    const { data, error } = await sb.storage.from(SUPABASE_BUCKET).download(path);
    if(error || !data){
      // 404 혹은 파일 없음 → 좀 더 친절한 메시지
      const msg = (error && (error.message || error.error || error.name)) || '파일 없음 또는 권한 오류';
      toast('클라우드 불러오기 실패: ' + msg + '\\n(계정에 저장된 백업이 없는지 확인하세요)');
      return;
    }
    const txt = await data.text();
    const incoming = JSON.parse(txt);
    const sane = sanitizeState(incoming);
    Object.assign(state, sane);
    renderAll();
    if(state.ui && state.ui.selectedDebtorId) openDrawer(state.ui.selectedDebtorId);
    if(!silent) toast('클라우드 불러오기 완료', 'success');
  }catch(e){
    toast('불러오기 파싱 실패: ' + (e && e.message ? e.message : String(e)));
  }
}

// 버튼 클릭 처리
document.addEventListener('click', async (e)=>{
  const t = e.target;
  if(!t) return;
  if ((t.id==='btnAuth'||t.id==='btnCloudSave'||t.id==='btnCloudLoad') && window.__CLOUD_HANDLERS_BOUND__) return;
  // Lazy init for Supabase when clicking auth/cloud buttons
  if((t.id==='btnAuth'||t.id==='btnCloudSave'||t.id==='btnCloudLoad') && !sb){
    if(!ensureClient()) { toast('Supabase 로드 실패: 네트워크/차단을 확인하세요.'); return; }
  }
  if(t.id === 'btnAuth'){
    if(!sb && !ensureClient()){ toast('Supabase 로드 실패: 네트워크/차단을 확인하세요.'); return; }
    if(t.dataset.mode === 'signout'){
      await signOut();
      setAuthButton(null);
    }else{
      const user = await signInEmailPassword();
      if(user) setAuthButton(user);
    }
    return;
  }
  if(t.id === 'btnCloudSave'){
    if(!sb && !ensureClient()){ toast('Supabase 로드 실패: 네트워크/차단을 확인하세요.'); return; } await cloudSave(); return; }
  if(t.id === 'btnCloudLoad'){
    if(!sb && !ensureClient()){ toast('Supabase 로드 실패: 네트워크/차단을 확인하세요.'); return; } await cloudLoad(); return; }
});

// 부팅 시 세션 반영
if(sb){
  // 초기 세션 반영 + 로그인 상태면 즉시 클라우드 불러오기 (자동 저장 없음)
  sb.auth.getUser().then(function(resp){
    var data = resp && resp.data; var user = data && data.user;
    try{ setAuthButton(user || null); }catch(_){ }
    if(user){ try{ if(!window.__CLOUD_AUTOLOAD_DONE__) cloudLoad({silent:true}).catch(function(e){ console.warn('[autoLoad:init]', e); }); }catch(e){ console.warn('[autoLoad:init]', e); } }
  });
  // 로그인 성공 시에도 1회 자동 불러오기 (중복구독 방지)
  if(!window.__AUTH_LISTENER__){
    sb.auth.onAuthStateChange(function(_event, session){
      var user = session && session.user;
      try{ setAuthButton(user || null); }catch(_){ }
      if(user){ try{ if(!window.__CLOUD_AUTOLOAD_DONE__) cloudLoad({silent:true}).catch(function(e){ console.warn('[autoLoad:auth]', e); }); }catch(e){ console.warn('[autoLoad:auth]', e); } }
    });
    window.__AUTH_LISTENER__ = true;
  }
}
/* ===== /Supabase 연동 ===== */

// ==== compat-ESM exports ====
export {
  openDebtorModal,
  saveDebtor,
  fillDebtorSelect,
  openLoanModal,
  toggleFreqRows,
  saveLoan,
  editLoan,
  delLoan,
  openPayModal,
  openRepayModal,
  moveMonth,
  gotoToday,
  exportData,
  isValidJwtLike,
  isValidUrlLike,
  validateSupabaseConfig,
  ensureClient,
  qs,
  setAuthButton,
  getUser,
  ensureAuth,
  signInEmailPassword,
  signOut,
  backupPath,
  cloudSave,
  resolveUserBackupPath,
  cloudLoad
};

