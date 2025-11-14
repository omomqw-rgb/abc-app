
/* ===== Meta-only Edit Patch =====
   - RepayPlan: add [채무상환 수정] button (same row as 완료/삭제) and edit meta only
   - Loan: when editing, keep existing schedule; update only meta (debtor/total/count/start/freq/installment)
   Implementation avoids code conflicts:
   * Uses CAPTURE PHASE listeners to intercept only when 'edit' flag is present.
   * Does not modify existing save handlers for "등록" (new).
*/
(function(){
  /* ---------- 0) Utilities ---------- */
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function ymd(d){ var y=d.getFullYear(),m=('0'+(d.getMonth()+1)).slice(-2),da=('0'+d.getDate()).slice(-2); return y+'-'+m+'-'+da; }
  function inferDailyInterval(sc){
    try{
      if(!Array.isArray(sc)||sc.length<2) return 1;
      var t0=new Date(sc[0].date+'T00:00:00'), t1=new Date(sc[1].date+'T00:00:00');
      var diff=Math.round((t1-t0)/(1000*60*60*24));
      return (isNaN(diff)||diff<=0)?1:diff;
    }catch(_){ return 1; }
  }

  /* ---------- 1) [채무상환] 카드에 "채무상환 수정" 버튼 주입 ---------- */
  function injectRepayEditButtons(){
    qsa('.loan-card').forEach(function(card){
      var h4 = card.querySelector('h4');
      if(!h4) return;
      if(h4.textContent.indexOf('[채무상환]') === -1) return;
      var btnRow = Array.prototype.find.call(card.querySelectorAll('div'), function(el){
        return el && el.querySelector && (el.querySelector('[data-complete-repay]') || el.querySelector('[data-del-repay]'));
      });
      if(!btnRow) return;
      if(btnRow.querySelector('[data-edit-repay]')) return;

      var marker = btnRow.querySelector('[data-complete-repay], [data-del-repay]');
      var pid = marker ? (marker.dataset.completeRepay || marker.dataset.delRepay) : '';
      if(!pid) return;

      var editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.textContent = '채무상환 수정';
      editBtn.setAttribute('data-edit-repay', pid);

      var delBtn = btnRow.querySelector('[data-del-repay]');
      if(delBtn) btnRow.insertBefore(editBtn, delBtn);
      else btnRow.appendChild(editBtn);
    });
  }
  var mo = new MutationObserver(injectRepayEditButtons);
  mo.observe(document.body, { childList:true, subtree:true });
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', injectRepayEditButtons); } else { injectRepayEditButtons(); }

  /* ---------- 2) 채무상환 수정 모달 열기 (등록 모달 재사용, 메타만) ---------- */
  window.LB_openRepayEditMeta = function(planId){
    try{
      var p = (state.repayPlans||[]).find(function(x){ return String(x.id)===String(planId); });
      if(!p) { toast('대상 상환계획을 찾을 수 없습니다.'); return; }

      // 채무자 목록 채우기
      var sel = qs('#rpDebtor'); if(!sel) return;
      sel.innerHTML = '';
      (state.debtors||[]).forEach(function(d){
        var o=document.createElement('option'); o.value=d.id; o.textContent=d.name; sel.appendChild(o);
      });
      sel.value = String(p.debtorId||'');

      // 값 채우기 (메타만)
      var firstDate = p.startDate || (p.schedule && p.schedule[0] && p.schedule[0].date) || '';
      if(qs('#rpTotal')) qs('#rpTotal').value = Number(p.total||0);
      if(qs('#rpCount')) qs('#rpCount').value = Number(p.count || (p.schedule||[]).length || 10);
      if(qs('#rpStart')) qs('#rpStart').value = firstDate;
      var f = p.freq || 'daily'; if(f==='monthly') f='month_end';
      if(qs('#rpFreq')) qs('#rpFreq').value = f;

      // 보조 필드(표시용) 세팅
      if(qs('#rpDaily')) qs('#rpDaily').value = inferDailyInterval(p.schedule||[]);
      if(qs('#rpWeekday')) qs('#rpWeekday').value = firstDate ? String(new Date(firstDate+'T00:00:00').getDay()) : '0';
      qs('#rpRowDaily').style.display = (f==='daily') ? 'grid' : 'none';
      qs('#rpRowWeekly').style.display = (f==='weekly') ? 'grid' : 'none';

      // 저장 버튼에 edit 플래그
      var saveBtn = qs('#rpSave'); if(saveBtn) saveBtn.dataset.editPlanId = String(p.id);

      // 제목/미리보기
      var title = qs('#repayAddModal h3'); if(title) title.textContent = '채무상환 수정 (메타만)';
      var label = (f==='daily')
        ? ('일간격('+(qs('#rpDaily')?qs('#rpDaily').value:1)+'일)')
        : (f==='weekly' ? ('주간격(요일 '+'일월화수목금토'[Number(qs('#rpWeekday')?qs('#rpWeekday').value:0)]+')') : '월말');
      var prev = qs('#rpPreview');
      if(prev) prev.innerHTML = '총상환채무 <b>'+Number(p.total||0).toLocaleString('ko-KR')+'</b> · 회차 '+(qs('#rpCount')?qs('#rpCount').value:'')
        +' · '+label+'<br><span style="opacity:.8">* 회차 데이터(날짜/금액/상태)는 그대로 유지됩니다.</span>';

      openModal('#repayAddModal');
    }catch(e){ console.warn('[LB_openRepayEditMeta] fail', e); }
  };

  // 버튼 클릭 → 수정 모달
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest('[data-edit-repay]');
    if(!t) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    LB_openRepayEditMeta(t.getAttribute('data-edit-repay'));
  }, true);

  /* ---------- 3) rpSave 캡처: 수정 모드면 메타만 저장 ---------- */
  document.addEventListener('click', function(e){
    if(!(e.target && e.target.id==='rpSave')) return;
    var btn = e.target;
    var editId = btn && btn.dataset && btn.dataset.editPlanId;
    if(!editId) return; // 신규 등록 시 기존 핸들러 진행
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    try{
      var debtorId = qs('#rpDebtor').value;
      var total    = Number(qs('#rpTotal').value||0);
      var count    = Math.max(1, Number(qs('#rpCount').value||1));
      var start    = qs('#rpStart').value;
      var freq     = qs('#rpFreq').value || 'daily';
      if(!debtorId) return toast('채무자를 선택하세요.');
      if(!(total>0)) return toast('총상환채무를 입력하세요.');
      if(!start) return toast('시작일을 선택하세요.');

      var p = (state.repayPlans||[]).find(function(x){ return String(x.id)===String(editId); });
      if(!p) return toast('대상 상환계획을 찾을 수 없습니다.');

      // === META ONLY ===
      p.debtorId = debtorId;
      p.total    = total;
      p.count    = count;          // 표시용 회차수 (기존 schedule은 그대로)
      p.startDate= start;          // 헤더 표기용 시작일 (행 날짜는 유지)
      p.freq     = freq;           // 헤더 표기용 주기
      // p.schedule 그대로 유지

      btn.dataset.editPlanId = '';
      closeModal('#repayAddModal');
      if(typeof refreshKeepDrawer==='function') refreshKeepDrawer();
      if(typeof save==='function') save();
      toast('채무상환 수정 완료 (기존 회차 유지)', 'success');
    }catch(err){
      toast('수정 실패: ' + (err && err.message ? err.message : String(err)));
    }
  }, true);

  /* ---------- 4) saveLoan 캡처: 대출 수정도 메타만 저장 ---------- */
  document.addEventListener('click', function(e){
    if(!(e.target && e.target.id==='saveLoan')) return;
    var btn = e.target;
    var editId = btn && btn.dataset && btn.dataset.editLoanId;
    if(!editId) return; // 신규 등록은 원래 saveLoan()에 맡김
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    try{
      var debtorId = qs('#loanDebtor').value;
      var total    = Number(qs('#loanTotal').value||0);
      var count    = Math.max(1, Number(qs('#loanCount').value||1));
      var start    = qs('#loanStart').value;
      var freq     = qs('#loanFreq').value || 'daily';
      if(!debtorId) return toast('채무자를 선택하세요.');
      if(!(total>0)) return toast('총상환금액을 입력하세요.');
      if(!start) return toast('시작일을 선택하세요.');
      var l = (state.loans||[]).find(function(x){ return String(x.id)===String(editId); });
      if(!l) return toast('대상 대출을 찾을 수 없습니다.');

      // === META ONLY ===
      l.debtorId   = debtorId;
      l.total      = total;
      l.count      = count;                        // 표시용 회차수 (행은 유지)
      l.startDate  = start;                        // 헤더 표기용 시작일
      l.freq       = freq;
      l.installment= Math.round(total / Math.max(1, count));  // 표기용 회차금액
      // l.schedule 그대로 유지

      btn.dataset.editLoanId = '';
      closeModal('#loanModal');
      if(typeof refreshKeepDrawer==='function') refreshKeepDrawer();
      if(typeof save==='function') save();
      toast('대출 수정 완료 (기존 회차 유지)', 'success');
    }catch(err){
      toast('수정 실패: ' + (err && err.message ? err.message : String(err)));
    }
  }, true);

  /* ---------- 5) 새 등록 열 때 edit 플래그 해제 ---------- */
  document.addEventListener('click', function(e){
    var t = e.target;
    if(t && (t.id==='btnNewRepay' || t.id==='btnNewRepayDrawer')){
      var rpSave = qs('#rpSave'); if(rpSave) rpSave.dataset.editPlanId='';
      var title = qs('#repayAddModal h3'); if(title) title.textContent='채무상환 등록';
    }
    if(t && (t.id==='btnNewLoan' || t.id==='btnNewLoanDrawer' || t.id==='btnNewLoan2')){
      var lnSave = qs('#saveLoan'); if(lnSave) lnSave.dataset.editLoanId='';
      var ttl = qs('#loanModalTitle'); if(ttl) ttl.textContent='대출 등록';
    }
  }, true);
})();
