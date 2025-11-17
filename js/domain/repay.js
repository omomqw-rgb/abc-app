
/* ===== RepayPlan(채무상환) — 독립 확장 ===== */
// 채무상환 접기/펼치기 토글 + 상태 저장
document.addEventListener('click', function(e){
  var btn = e.target && e.target.closest('[data-rp-collapse]');
  if(!btn) return;
  var id = btn.getAttribute('data-rp-collapse');
  var wrap = document.getElementById('rp-sched-'+id);
  if(!wrap) return;
  var willCollapse = wrap.style.display !== 'none'; // 보이는 중이면 접기
  wrap.style.display = willCollapse ? 'none' : 'block';
  btn.textContent = willCollapse ? '펼치기 ▽' : '접기 △';
  state.ui = state.ui || {};
  state.ui.rpCollapsed = state.ui.rpCollapsed || {};
  state.ui.rpCollapsed[id] = willCollapse;
  save();
}, true);

// 채무상환 완료 토글 / 삭제
document.addEventListener('click', function(e){
  var t=e.target;
  if(t && t.dataset && t.dataset.completeRepay){
    var p = (state.repayPlans||[]).find(function(x){ return String(x.id)===String(t.dataset.completeRepay); });
    if(p){ p.completed = !p.completed; refreshKeepDrawer(); save(); }
    return;
  }
  if(t && t.dataset && t.dataset.delRepay){
    if(!confirm('이 채무상환 계획을 삭제할까요?')) return;
    state.repayPlans = (state.repayPlans||[]).filter(function(x){ return String(x.id)!==String(t.dataset.delRepay); });
    refreshKeepDrawer(); save();
    return;
  }
}, true);

(function(){
  try{
    if(!window.state) window.state = { debtors:[], loans:[], ui:{} };
    if(!Array.isArray(state.repayPlans)) state.repayPlans = [];

    function RP_KRW(n){ try{return Number(n).toLocaleString('ko-KR');}catch(_){ return n; } }
    function RP_today(){ var t=new Date(); return new Date(t.getFullYear(),t.getMonth(),t.getDate()); }
    function RP_ymd(d){ var y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), dd=('0'+d.getDate()).slice(-2); return y+'-'+m+'-'+dd; }
    function RP_addDays(date,days){ var x=new Date(date); x.setDate(x.getDate()+days); return x; }
    function RP_addMonths(date,months){ var x=new Date(date); x.setMonth(x.getMonth()+months); return x; }
    function RP_endOfMonth(date){ return new Date(date.getFullYear(), date.getMonth()+1, 0); }
    function RP_nextWeekdayOnOrAfter(date, weekday){ var x=new Date(date); var diff=(7 + weekday - x.getDay())%7; x.setDate(x.getDate()+diff); return x; }
    function RP_paidSum(p){
      return (p.schedule||[]).reduce(function(s,it){
        var amt = (it.amount===''||it.amount==null)?0:Number(it.amount||0);
        return s + (it.settled ? amt : 0);
      },0);
    }
    function RP_renderPct(p){ var paid=RP_paidSum(p), tot=Math.max(1, Number(p.total)||1); return Math.min(100, Math.round(paid/tot*100)); }

    // extend sanitizeState if exists
    if(typeof window.sanitizeState==='function'){
      var __sanitize = window.sanitizeState;
      window.sanitizeState = function(raw){
        var out = __sanitize(raw);

        try{
          if (Array.isArray(raw && raw.repayPlans)) {
            out.repayPlans = raw.repayPlans.map(function(p){
              var sc = Array.isArray(p.schedule)? p.schedule.map(function(it,i){
                return {
                  idx: (it && Number(it.idx)>0)? Number(it.idx) : (i+1),
                  date: String((it && (it.date || it.ymd || it.dueDate || it.due_ymd)) || '').trim(),
                  amount: Math.max(0, Number(it && it.amount || 0)),
                  missed: !!(it && it.missed),
                  settled: !!(it && it.settled)
                };
              }).filter(function(it){ return it && it.date; }) : [];
              return {
                id: String(p.id||Math.random().toString(36).slice(2,10)),
                debtorId: String(p.debtorId),
                total: Math.max(0, Number(p.total||0)),
                count: Number(p.count||sc.length||0),
                startDate: p.startDate || (sc[0] && sc[0].date) || '',
                freq: p.freq || 'daily',
                schedule: sc,
                completed: !!p.completed
              };
            });

            // 고아 plan 자동삭제: sanitize 시점에서도 debtor가 없는 항목 제거
            var validIds = new Set((out.debtors || []).map(function(d){ return String(d.id); }));
            out.repayPlans = out.repayPlans.filter(function(p){ return validIds.has(String(p.debtorId)); });
          } else {
            out.repayPlans = [];
          }
        }catch(e){ console.warn('[sanitize repays]', e); }
        return out;
      };
    }

    // extend aggByDebtor
    if(typeof window.aggByDebtor==='function'){
      var __agg = window.aggByDebtor;
      window.aggByDebtor = function(id){
        var base = __agg(id) || { loans:[], total:0, paid:0, remain:0 };
        var plans = (state.repayPlans||[]).filter(function(p){ return String(p.debtorId)===String(id); });
        var totalPlans = plans.reduce(function(s,p){ return s + (Number(p.total)||0); }, 0);
        var paidPlans  = plans.reduce(function(s,p){ return s + RP_paidSum(p); }, 0);
        var total = (base.total||0) + totalPlans;
        var paid  = (base.paid||0) + paidPlans;
        var remain = Math.max(0, total - paid);
        return { loans: base.loans||[], repayPlans: plans, total: total, paid: paid, remain: remain };
      };
    }

    function injectRepayButtons(){
      try{
        var loanBtn = document.getElementById('btnNewLoan');
        if(loanBtn && !document.getElementById('btnNewRepay')){
          loanBtn.insertAdjacentHTML('afterend','<button class="btn" id="btnNewRepay">+ 채무상환</button>');
        }
        var drawerLoanBtn = document.getElementById('btnNewLoanDrawer');
        if(drawerLoanBtn && !document.getElementById('btnNewRepayDrawer')){
          drawerLoanBtn.insertAdjacentHTML('afterend','<button class="btn" id="btnNewRepayDrawer">+ 채무상환</button>');
        }
      }catch(_){}
    }

    function rpGenerate(count, start, freq, opts){
      var schedule=[], startDate=new Date(start+'T00:00:00');
      for(var i=1;i<=count;i++){
        var dd;
        if(freq==='daily'){ var step=Math.max(1, Number(opts.dailyInterval||1)); dd = RP_addDays(startDate,(i-1)*step); }
        else if(freq==='weekly'){ var first=RP_nextWeekdayOnOrAfter(startDate, Number(opts.weekday||0)); dd = RP_addDays(first,(i-1)*7); }
        else if(freq==='month_end'){ var base=RP_addMonths(startDate,(i-1)); dd = RP_endOfMonth(base); }
        else { dd = RP_addMonths(startDate,(i-1)); }
        schedule.push({ idx:i, date:RP_ymd(dd), amount:'', missed:false, settled:false });
      }
      return schedule;
    }

    function rpFillDebtorSelect(sel, fixedId){
      sel.innerHTML='';
      (state.debtors||[]).forEach(function(d){ var o=document.createElement('option'); o.value=d.id; o.textContent=d.name; sel.appendChild(o); });
      if(fixedId) sel.value=fixedId;
    }
    function openRepayAddModal(fixedId){
      var sel=document.getElementById('rpDebtor'); if(!sel) return;
      rpFillDebtorSelect(sel, fixedId || (state.ui && state.ui.selectedDebtorId));
      var today=new Date(); var y=today.getFullYear(), m=('0'+(today.getMonth()+1)).slice(-2), d=('0'+today.getDate()).slice(-2);
      document.getElementById('rpTotal').value='';
      document.getElementById('rpCount').value=10;
      document.getElementById('rpStart').value=y+'-'+m+'-'+d;
      document.getElementById('rpFreq').value='daily';
      document.getElementById('rpDaily').value=10;
      document.getElementById('rpWeekday').value=String(new Date().getDay());
      document.getElementById('rpRowDaily').style.display='grid';
      document.getElementById('rpRowWeekly').style.display='none';
      document.getElementById('rpPreview').textContent='';
      openModal('#repayAddModal');
    }
    document.addEventListener('click', function(e){
      var t=e.target;
      if(t && (t.id==='btnNewRepay' || t.id==='btnNewRepayDrawer')){
        openRepayAddModal(state.ui && state.ui.selectedDebtorId);
        return;
      }
    });

    ['rpTotal','rpCount','rpStart','rpFreq','rpDaily','rpWeekday'].forEach(function(id){
      document.addEventListener('input', function(e){
        if(!e.target || e.target.id!==id) return;
        var total=Number(document.getElementById('rpTotal').value||0);
        var count=Math.max(1, Number(document.getElementById('rpCount').value||10));
        var start=document.getElementById('rpStart').value;
        var f=document.getElementById('rpFreq').value;
        document.getElementById('rpRowDaily').style.display=(f==='daily')?'grid':'none';
        document.getElementById('rpRowWeekly').style.display=(f==='weekly')?'grid':'none';
        var label=(f==='daily')?('일간격('+(document.getElementById('rpDaily').value||1)+'일)')
          :(f==='weekly'?('주간격(요일 '+'일월화수목금토'[Number(document.getElementById('rpWeekday').value||0)]+')'):'월말');
        document.getElementById('rpPreview').innerHTML = (total>0 && start)
          ? ('총상환채무 <b>'+RP_KRW(total)+'</b> · 회차 '+count+' · '+label+'<br><span style="opacity:.8">* 회차별 금액은 공란으로 생성됩니다.</span>')
          : '';
      });
    });

    document.addEventListener('click', function(e){
      if(!e.target || e.target.id!=='rpSave') return;
      try{
        var debtorId=document.getElementById('rpDebtor').value;
        var total=Number(document.getElementById('rpTotal').value||0);
        var count=Math.max(1, Number(document.getElementById('rpCount').value||10));
        var start=document.getElementById('rpStart').value;
        var freq=document.getElementById('rpFreq').value;
        var opts={ dailyInterval:Number(document.getElementById('rpDaily').value||1), weekday:Number(document.getElementById('rpWeekday').value||0) };
        if(!debtorId) return toast('채무자를 선택하세요.');
        if(!(total>0)) return toast('총상환채무를 입력하세요.');
        if(!start) return toast('시작일을 선택하세요.');
        var schedule = rpGenerate(count,start,freq,opts);
        // simple dup guard
        var key = debtorId+'|'+total+'|'+count+'|'+start+'|'+freq+'|'+opts.dailyInterval+'|'+opts.weekday;
        var now=Date.now(); window.__rp_last = window.__rp_last || {};
        if(window.__rp_last[key] && now-window.__rp_last[key]<2000){ closeModal('#repayAddModal'); toast('이미 저장됨'); return; }
        window.__rp_last[key]=now;

        state.repayPlans.unshift({ id: Math.random().toString(36).slice(2,10), debtorId, total, count, startDate: schedule[0].date, freq, schedule, completed:false });
        closeModal('#repayAddModal'); refreshKeepDrawer(); save();
      }catch(err){ toast('저장 실패: '+(err && err.message ? err.message : String(err))); }
    });

    function renderRepayCards(did){
  try{
    var list = document.getElementById('drawerLoans'); if(!list) return;
    var wrap = document.getElementById('rpCards');
    if(!wrap){ wrap=document.createElement('div'); wrap.id='rpCards'; list.appendChild(wrap); }
    wrap.innerHTML='';

    var plans=(state.repayPlans||[]).filter(function(p){ return String(p.debtorId)===String(did); });
    plans.sort(function(A,B){
      if(!!A.completed !== !!B.completed) return (A.completed?1:0) - (B.completed?1:0);
      var aDate = new Date(A.startDate || (A.schedule && A.schedule[0] && A.schedule[0].date) || 0);
      var bDate = new Date(B.startDate || (B.schedule && B.schedule[0] && B.schedule[0].date) || 0);
      return bDate - aDate;
    });
    if(plans.length===0){ return; }

    plans.forEach(function(p){
      var pct = RP_renderPct(p);
      var allSettled = (p.schedule||[]).length>0 && (p.schedule||[]).every(function(it){ return !!it.settled; });
      var hasPref = state.ui && state.ui.rpCollapsed && Object.prototype.hasOwnProperty.call(state.ui.rpCollapsed, p.id);
      var collapsed = hasPref ? !!state.ui.rpCollapsed[p.id] : (AUTO_COLLAPSE_DONE && allSettled);

      var card=document.createElement('div'); card.className='loan-card';
      var header = ''
        + '<div class="sched-header">'
        +   '<h4 style="margin:0">[채무상환] 총상환채무 '+RP_KRW(p.total)
        +     '<span class="chip">회차 '+(p.count || (p.schedule||[]).length)+'</span>'
        +     '<span class="chip muted">진행 '+pct+'%</span>'
        +   '</h4>'
        +   '<button class="collapse-btn" data-rp-collapse="'+p.id+'">'+(collapsed?'펼치기 ▽':'접기 △')+'</button>'
        + '</div>'
        + '<div class="note">시작일 '+(p.startDate || (p.schedule && p.schedule[0] && p.schedule[0].date) || '-')+' · 주기 '+(p.freq==='month_end'?'월말':(p.freq==='daily'?'일간격':'주단위'))+'</div>'
        + '<div style="margin-top:8px;display:flex;gap:6px">'
        +   '<button class="btn" data-complete-repay="'+p.id+'">'+(p.completed?'완료 해제':'완료(캘린더 숨김)')+'</button>'
        +   '<button class="btn" data-del-repay="'+p.id+'">삭제</button>'
        + '</div>';

      var rows = (p.schedule||[]).map(function(it){
        var status = it.settled ? '완납' : (it.missed ? '미납' : '미입금');
        var cls = it.settled ? 'paid' : ((it.missed || (new Date(it.date) < RP_today())) ? 'overdue' : 'upcoming');
        return ''
          + '<div class="sched-row rp-row '+cls+'" data-plan="'+p.id+'" data-idx="'+it.idx+'">'
          +   '<div>'+it.idx+'회차</div>'
          +   '<input class="rp-date" type="date" value="'+(it.date||'')+'"/>'
          +   '<input class="rp-amount" type="number" inputmode="numeric" value="'+(it.amount!==''?it.amount:'')+'" placeholder="회차금액" />'
          +   '<select class="rp-status">'
          +     '<option '+(status==='미입금'?'selected':'')+'>미입금</option>'
          +     '<option '+(status==='미납'?'selected':'')+'>미납</option>'
          +     '<option '+(status==='완납'?'selected':'')+'>완납</option>'
          +   '</select>'
          + '</div>';
      }).join('');

      card.innerHTML = header + '<div class="sched-wrap" id="rp-sched-'+p.id+'" style="display:'+(collapsed?'none':'block')+';">'+rows+'</div>';
      wrap.appendChild(card);
    });
  }catch(e){ console.warn('[renderRepayCards] skip', e); }
}

    if(typeof window.openDrawer==='function'){
      var __openDrawer = window.openDrawer;
      window.openDrawer = function(id){
        __openDrawer(id);
        try{
          var k=document.getElementById('drawerKpis'); if(k) k.innerHTML = k.innerHTML.replace('총상환 합계','총상환채무');
        }catch(_){}
        renderRepayCards(id);
      };
    }

    document.addEventListener('focusout', function(e){
      var row=e.target && e.target.closest('.rp-row'); if(!row) return;
      var pid=row.dataset.plan, idx=row.dataset.idx;
      var p=(state.repayPlans||[]).find(function(x){ return String(x.id)===String(pid); }); if(!p) return;
      var it=(p.schedule||[]).find(function(s){ return String(s.idx)===String(idx); }); if(!it) return;
      if(e.target.classList.contains('rp-date')){ if(e.target.value){ it.date = e.target.value; } }
      if(e.target.classList.contains('rp-amount')){
        var v=e.target.value;
        it.amount = (v===''? '': Math.max(0, Number(v||0)));
        if(!(Number(it.amount)>0)){ it.settled=false; it.missed=false; var sel=row.querySelector('.rp-status'); if(sel) sel.value='미입금'; }
      }
      save();
    }, true);

    document.addEventListener('change', function(e){
      var row=e.target && e.target.closest('.rp-row'); if(!row) return;
      var pid=row.dataset.plan, idx=row.dataset.idx;
      var p=(state.repayPlans||[]).find(function(x){ return String(x.id)===String(pid); }); if(!p) return;
      var it=(p.schedule||[]).find(function(s){ return String(s.idx)===String(idx); }); if(!it) return;

      if(e.target.classList.contains('rp-status')){
        var val=e.target.value;
        if(val==='완납'){
          var n = (it.amount===''?0:Number(it.amount||0));
          if(!(n>0)){ try{ toast('회차금액을 먼저 입력하세요.'); }catch(_){}
            e.target.value='미입금'; it.settled=false; it.missed=false;
          }else{ it.settled=true; it.missed=false; }
        }else if(val==='미납'){ it.settled=false; it.missed=true; }
        else{ it.settled=false; it.missed=false; }
        // update color
        var cls = it.settled ? 'paid' : ((it.missed || (new Date(it.date) < RP_today())) ? 'overdue' : 'upcoming');
        ['paid','overdue','upcoming','partial'].forEach(function(c){ row.classList.remove(c); });
        row.classList.add(cls);
        save(); refreshKeepDrawer();
        return;
      }
    });

    // calendar overlay for repay pills + click open
    if(typeof window.buildCalendar==='function'){
      var __build = window.buildCalendar;
      window.buildCalendar = function(year, month){
        __build(year, month);
        try{
          var grid=document.getElementById('calGrid'); if(!grid) return;
          var today=RP_today();
          var cells = Array.prototype.slice.call(grid.querySelectorAll('.day'));
          var y=Number(document.getElementById('yearSel').value);
          var m=Number(document.getElementById('monthSel').value);
          function cellFor(ymd){
            var dt=new Date(ymd+'T00:00:00'); if(dt.getFullYear()!==y || dt.getMonth()!==m) return null;
            var d=dt.getDate();
            for(var i=0;i<cells.length;i++){ var lab=cells[i].querySelector('.date'); if(!lab) continue; if(String(lab.textContent).trim()===String(d)) return cells[i]; }
            return null;
          }
          (state.repayPlans||[]).forEach(function(p){
            if(p.completed) return;
            (p.schedule||[]).forEach(function(it){
              var cell=cellFor(it.date); if(!cell) return;
              var items=cell.querySelector('.items'); if(!items) return;
              var debtor=(state.debtors||[]).find(function(d){ return String(d.id)===String(p.debtorId); });
              var who=debtor ? debtor.name : '채무자';
              var amt = (it.amount===''||it.amount==null)?0:Number(it.amount||0);
              var settled = !!it.settled;
              var overdue = (!settled && (it.missed || (new Date(it.date) < today)));
              var cls = settled ? 'paid' : (overdue ? 'overdue' : 'upcoming');
              var toRecv = settled ? 0 : amt;
              var pill=document.createElement('div'); pill.className='pill '+cls;
              pill.dataset.planId=p.id; pill.dataset.rpIdx=it.idx;
              pill.title='[상환] 회차금액 '+RP_KRW(amt)+' · 상태 '+(settled?'완납':(overdue?'미납':'미입금'));
              pill.innerHTML='<span class="who">'+who+'</span><span class="amt">'+RP_KRW(toRecv)+'</span>';
              items.appendChild(pill);
            });
          });
        }catch(e){ console.warn('[rp calendar]', e); }
      };

      document.addEventListener('click', function(e){
  var pill = e.target && e.target.closest('.pill[data-plan-id]'); if(!pill) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  var pid = pill.dataset.planId;
  var plan=(state.repayPlans||[]).find(function(x){ return String(x.id)===String(pid); });
  if(!plan) return;
  openRepayModal(plan.id, pill.dataset.rpIdx);
}, true);
    }


    // removed override of renderAlerts to preserve D-1/D-day + overdue layout
// alert click handler enhancement
    document.addEventListener('click', function(e){
  var ai = e.target && e.target.closest('[data-open-sched]'); if(!ai) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  if(ai.dataset.loan){ openPayModal(ai.dataset.loan, ai.dataset.idx); }
  else if(ai.dataset.plan){ openRepayModal(ai.dataset.plan, (ai.dataset.rpidx||ai.dataset.idx)); }
}, true);

    document.addEventListener('DOMContentLoaded', function(){
      injectRepayButtons();
      if(state.ui && state.ui.selectedDebtorId) openDrawer(state.ui.selectedDebtorId);
    });

  }catch(err){ console.warn('[RepayPlan init] fatal', err); }
})();
