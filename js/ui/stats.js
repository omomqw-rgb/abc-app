
function renderStats(kind){
  kind = kind || 'sum';
  // activate subtab
  document.querySelectorAll('.stats-tab').forEach(btn=>{
    if(btn.dataset.stats===kind) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  const body = document.getElementById('statsBody');
  if(!body) return;
  const dlist = state.debtors||[];
  const loans = state.loans||[];
  const plans = state.repayPlans||[];

  function sumsByDebtor(){
    const map = {};
    dlist.forEach(d=>{ map[d.id]={name:d.name, phone:(d.phone||'-'), loan:{t:0,p:0}, claim:{t:0,p:0}}; });
    loans.forEach(l=>{
      const m = map[l.debtorId]; if(!m) return;
      const tot = Math.max(0, Number(l.total)||0);
      const paid = (l.schedule||[]).reduce((s,it)=> s + Math.max(0, Number(it.paid)||0),0);
      m.loan.t += tot; m.loan.p += paid;
    });
    plans.forEach(p=>{
      const m = map[p.debtorId]; if(!m) return;
      const tot = Math.max(0, Number(p.total)||0);
      const paid = (p.schedule||[]).reduce((s,it)=> s + ( (it && it.settled) ? Math.max(0, Number(it.amount)||0) : Math.max(0, Number(it.paid||0)) ),0);
      m.claim.t += tot; m.claim.p += paid;
    });
    return map;
  }
  const mp = sumsByDebtor();
  const rows = Object.keys(mp).map(id=>{
    const m = mp[id];
    const tLoan = m.loan.t, pLoan = m.loan.p;
    const tClm  = m.claim.t, pClm  = m.claim.p;
    const tSum  = tLoan + tClm;
    const pSum  = pLoan + pClm;
    const remain= Math.max(0, tSum - pSum);
    const roi   = tSum>0 ? Math.round((pSum/tSum)*1000)/10 : 0;
    return {name:m.name, phone:m.phone, tLoan, pLoan, tClm, pClm, tSum, pSum, remain, roi};
  });

  function grid(rows, pick){
    const head = `<div class="grid-head">
      <div>채무자</div><div>연락처</div><div>건수</div><div>총상환채무</div><div>기납입</div><div>잔액</div>
    </div>`;
    const bodyHtml = rows.map(r=>{
      const total = pick.total(r);
      const paid  = pick.paid(r);
      const remain= Math.max(0, total - paid);
      return `<div class="grid-row">
        <div style="font-weight:700">${r.name}</div>
        <div>${r.phone}</div>
        <div>-</div>
        <div>${KRW(total)}</div>
        <div>${KRW(paid)}</div>
        <div style="font-weight:800">${KRW(remain)}</div>
      </div>`;
    }).join('');
    const sT = rows.reduce((s,r)=> s + pick.total(r),0);
    const sP = rows.reduce((s,r)=> s + pick.paid(r),0);
    const sR = Math.max(0, sT - sP);
    const sum = `<div class="grid-sum">
      <div>합계</div><div>-</div><div>-</div><div>${KRW(sT)}</div><div>${KRW(sP)}</div><div style="font-weight:800">${KRW(sR)}</div>
    </div>`;
    return head + bodyHtml + sum;
  }

  let html='';
  if(kind==='loan'){
    html = grid(rows, { total:r=>r.tLoan, paid:r=>r.pLoan });
  } else if(kind==='claim'){
    html = grid(rows, { total:r=>r.tClm,  paid:r=>r.pClm });
  } else if(kind==='sum'){
    html = grid(rows, { total:r=>r.tSum,  paid:r=>r.pSum });
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
    html = head + bodyHtml + sum;
  }
  body.innerHTML = html;
}

// stats subtab click
document.addEventListener('click', function(e){
  var b = e.target && e.target.closest('.stats-tab'); if(!b) return;
  renderStats(b.dataset.stats);
}, true);
