
/* ==== V3 Inline Patch: ① 통계 괄호표기, ② 사이드바 정렬/검색 (IME-safe) ==== */
(function(){
  // ---- Global sort/search state ----
  window.__debtorSortMode = window.__debtorSortMode || 'date'; // 'date' keeps original order, 'name' sorts by name
  window.__debtorSearch = window.__debtorSearch || '';

  // ---- Override renderDebtors to support sort + data attributes ----
  const KRW = window.KRW || (n=>Number(n).toLocaleString('ko-KR'));

  window.renderDebtors = function renderDebtors(){
    function renderTo(id){
      const box=document.getElementById(id);
      if(!box) return;
      box.innerHTML='';

      // base array
      let arr = Array.isArray(state.debtors) ? state.debtors.slice() : [];

      // sort
      if(window.__debtorSortMode === 'name'){
        arr.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||''), 'ko-KR'));
      }else{
        // 'date' ⇒ keep insertion order (array order)
      }

      // build DOM
      arr.forEach((d, idx)=>{
        const el=document.createElement('div'); el.className='debtor'; el.dataset.id=d.id;
        el.dataset.name = d.name || '';
        el.dataset.note = d.note || '';
        el.dataset.index = String(idx);
        el.innerHTML=`
          <div>
            <div style="font-weight:700">${d.name||''}</div>
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

      // apply search filter without re-render (avoid focus-out)
      applyDebtorFilter();
    }
    renderTo('debtorList');
    renderTo('debtorListMobile');
  };

  // ---- Search filter (IME-safe) ----
  function applyDebtorFilter(){
    const q = (window.__debtorSearch || '').trim().toLowerCase();
    const lists = [document.getElementById('debtorList'), document.getElementById('debtorListMobile')].filter(Boolean);
    lists.forEach(list=>{
      Array.prototype.forEach.call(list.children, el=>{
        const hay = ((el.dataset.name||'') + ' ' + (el.dataset.note||'')).toLowerCase();
        el.style.display = (q==='' || hay.includes(q)) ? '' : 'none';
      });
    });
  }

  // ---- Bind control bar events ----
  function bindDebtorCtrl(){
    const bn = document.getElementById('btnSortName');
    const bd = document.getElementById('btnSortDate');
    const si = document.getElementById('debtorSearch');
    if(bn && !bn.__bound){
      bn.__bound = true;
      bn.addEventListener('click', ()=>{ window.__debtorSortMode='name'; renderDebtors(); });
    }
    if(bd && !bd.__bound){
      bd.__bound = true;
      bd.addEventListener('click', ()=>{ window.__debtorSortMode='date'; renderDebtors(); });
    }
    if(si && !si.__bound){
      si.__bound = true;
      let composing = false;
      si.addEventListener('compositionstart', ()=> composing = true);
      si.addEventListener('compositionend', ()=>{ composing = false; window.__debtorSearch = si.value; applyDebtorFilter(); });
      si.addEventListener('input', ()=>{ if(!composing){ window.__debtorSearch = si.value; applyDebtorFilter(); } });
    }
  }

  // ---- Override renderStats with progress(done) counts ----
  window.renderStats = function renderStats(kind){
    kind = kind || 'sum';
    document.querySelectorAll('.stats-tab').forEach(btn=>{
      if(btn.dataset.stats===kind) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    const body = document.getElementById('statsBody');
    if(!body) return;
    const dlist = state.debtors||[];
    const loans = state.loans||[];
    const plans = state.repayPlans||[];

    function isLoanDone(l){
      const paid = (l.schedule||[]).reduce((s,it)=> s + Math.max(0, Number(it.paid)||0), 0);
      const tot  = Math.max(0, Number(l.total)||0);
      return !!l.completed || paid >= tot - 1e-6;
    }
    function isPlanDone(p){
      const tot = Math.max(0, Number(p.total)||0);
      const paid = (p.schedule||[]).reduce((s,it)=> s + (it && it.settled ? Math.max(0, Number(it.amount)||0) : Math.max(0, Number(it.paid||0)) ), 0);
      return !!p.completed || paid >= tot - 1e-6;
    }

    // Aggregate per debtor with active/done split
    const map = {};
    dlist.forEach(d=>{ map[d.id]={
      name:d.name, phone:(d.phone||'-'),
      loan:{t:0,p:0, active:0, done:0},
      claim:{t:0,p:0, active:0, done:0}
    }; });
    loans.forEach(l=>{
      const m = map[l.debtorId]; if(!m) return;
      const tot = Math.max(0, Number(l.total)||0);
      const paid = (l.schedule||[]).reduce((s,it)=> s + Math.max(0, Number(it.paid)||0),0);
      const done = isLoanDone(l);
      m.loan.t += tot; m.loan.p += paid;
      if(done) m.loan.done++; else m.loan.active++;
    });
    plans.forEach(p=>{
      const m = map[p.debtorId]; if(!m) return;
      const tot = Math.max(0, Number(p.total)||0);
      const paid = (p.schedule||[]).reduce((s,it)=> s + (it && it.settled ? Math.max(0, Number(it.amount)||0) : Math.max(0, Number(it.paid||0)) ),0);
      const done = isPlanDone(p);
      m.claim.t += tot; m.claim.p += paid;
      if(done) m.claim.done++; else m.claim.active++;
    });

    const rows = Object.keys(map).map(id=>{
      const m = map[id];
      const tLoan = m.loan.t, pLoan = m.loan.p;
      const tClm  = m.claim.t, pClm  = m.claim.p;
      const tSum  = tLoan + tClm;
      const pSum  = pLoan + pClm;
      const remain= Math.max(0, tSum - pSum);
      const roi   = tSum>0 ? Math.round((pSum/tSum)*1000)/10 : 0;
      return {
        name:m.name, phone:m.phone,
        loan:m.loan, claim:m.claim,
        tLoan, pLoan, tClm, pClm, tSum, pSum, remain, roi
      };
    });

    function grid(rows, pick){
      const head = `<div class="grid-head">
        <div>채무자</div><div>연락처</div><div>건수</div><div>총상환채무</div><div>기납입</div><div>잔액</div>
      </div>`;
      const bodyHtml = rows.map(r=>{
        const total = pick.total(r);
        const paid  = pick.paid(r);
        const remain= Math.max(0, total - paid);
        const cnt   = pick.count(r); // "진행(완료)"
        return `<div class="grid-row">
          <div style="font-weight:700">${r.name}</div>
          <div>${r.phone}</div>
          <div>${cnt}</div>
          <div>${KRW(total)}</div>
          <div>${KRW(paid)}</div>
          <div style="font-weight:800">${KRW(remain)}</div>
        </div>`;
      }).join('');
      const sT = rows.reduce((s,r)=> s + pick.total(r),0);
      const sP = rows.reduce((s,r)=> s + pick.paid(r),0);
      const sR = Math.max(0, sT - sP);
      const sC = (function(){
        const a = rows.reduce((s,r)=> s + pick.active(r),0);
        const d = rows.reduce((s,r)=> s + pick.done(r),0);
        return `${a.toLocaleString('ko-KR')}(${d.toLocaleString('ko-KR')})`;
      })();
      const sum = `<div class="grid-sum">
        <div>합계</div><div>-</div><div>${sC}</div><div>${KRW(sT)}</div><div>${KRW(sP)}</div><div style="font-weight:800">${KRW(sR)}</div>
      </div>`;
      return head + bodyHtml + sum;
    }

    let html='';
    if(kind==='loan'){
      html = grid(rows, {
        total:r=>r.tLoan, paid:r=>r.pLoan,
        active:r=>r.loan.active, done:r=>r.loan.done,
        count:r=>`${r.loan.active.toLocaleString('ko-KR')}(${r.loan.done.toLocaleString('ko-KR')})`
      });
    } else if(kind==='claim'){
      html = grid(rows, {
        total:r=>r.tClm,  paid:r=>r.pClm,
        active:r=>r.claim.active, done:r=>r.claim.done,
        count:r=>`${r.claim.active.toLocaleString('ko-KR')}(${r.claim.done.toLocaleString('ko-KR')})`
      });
    } else if(kind==='sum'){
      html = grid(rows, {
        total:r=>r.tSum,  paid:r=>r.pSum,
        active:r=>r.loan.active + r.claim.active,
        done:r=>r.loan.done + r.claim.done,
        count:r=>{
          const a = r.loan.active + r.claim.active;
          const d = r.loan.done + r.claim.done;
          return `${a.toLocaleString('ko-KR')}(${d.toLocaleString('ko-KR')})`;
        }
      });
    } else if(kind==='roi'){
      const head = `<div class="grid-head">
        <div>채무자</div><div>연락처</div><div>수익률</div><div>총상환채무</div><div>기납입</div><div>잔액</div>
      </div>`;
      const bodyHtml = rows.map(r=>{
        return `<div class="grid-row">
          <div style="font-weight:700">${r.name}</div>
          <div>${r.phone}</div>
          <div>${r.roi}%</div>
          <div>${KRW(r.tSum)}</div>
          <div>${KRW(r.pSum)}</div>
          <div style="font-weight:800">${KRW(r.remain)}</div>
        </div>`;
      }).join('');
      const sT = rows.reduce((s,r)=> s + r.tSum,0);
      const sP = rows.reduce((s,r)=> s + r.pSum,0);
      const sR = Math.max(0, sT - sP);
      const avg = rows.length? Math.round(rows.reduce((s,r)=>s + (r.tSum>0? (r.pSum/r.tSum):0),0)/rows.length*1000)/10 : 0;
      const sum = `<div class="grid-sum">
        <div>평균</div><div>-</div><div>${avg}%</div><div>${KRW(sT)}</div><div>${KRW(sP)}</div><div style="font-weight:800">${KRW(sR)}</div>
      </div>`;
      body.innerHTML = head + bodyHtml + sum;
      return;
    }
    body.innerHTML = html;
  };

  // ---- Init after DOM ready ----
  function initV3(){
    bindDebtorCtrl();
    // Re-render once to ensure new logic applied
    try{ renderDebtors(); }catch(_){}
    // If stats tab is active, refresh it
    try{
      var activeTab = document.querySelector('.tab.active');
      if(activeTab && activeTab.dataset.tab==='stats') renderStats('sum');
    }catch(_){}
  }

  if(document.readyState !== 'loading'){ initV3(); }
  else { document.addEventListener('DOMContentLoaded', initV3, { once:true }); }
})();
