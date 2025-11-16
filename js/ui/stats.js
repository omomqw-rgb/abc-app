function renderStats(kind){
  kind = kind || 'sum';
  // activate subtab
  document.querySelectorAll('.stats-tab').forEach(btn=>{
    if(btn.dataset.stats===kind) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  const body = document.getElementById('statsBody');
  if(!body) return;
  const dlist = state.debtors || [];
  const loans = state.loans || [];
  const plans = state.repayPlans || [];

  // 채무상환(RepayPlan) 납입 합계: settled 된 금액만 누적 (main.js와 동일)
  const rpPaidSum = (p)=> (p && Array.isArray(p.schedule))
    ? p.schedule.reduce((s,it)=> s + (it && it.settled ? Math.max(0, Number(it.amount)||0) : 0), 0)
    : 0;

  function sumsByDebtor(){
    const map = {};
    // 기본 틀 세팅
    dlist.forEach(d=>{
      map[d.id] = {
        name: d.name,
        phone: d.phone || '-',
        loan:  { cA:0, cD:0, tA:0, tD:0, pA:0, pD:0 }, // 대출 (A:진행, D:완료)
        claim: { cA:0, cD:0, tA:0, tD:0, pA:0, pD:0 }  // 채권
      };
    });

    // 대출 집계
    loans.forEach(l=>{
      const m = map[l.debtorId]; if(!m) return;
      const tot  = Math.max(0, Number(l.total)||0);
      const paid = (l.schedule||[]).reduce((s,it)=> s + Math.max(0, Number(it.paid)||0), 0);
      const done = !!l.completed || paid >= tot - 1e-6;

      const box = m.loan;
      if(done){
        box.cD += 1;
        box.tD += tot;
        box.pD += paid;
      }else{
        box.cA += 1;
        box.tA += tot;
        box.pA += paid;
      }
    });

    // 채권(RepayPlan) 집계
    plans.forEach(p=>{
      const m = map[p.debtorId]; if(!m) return;
      const tot  = Math.max(0, Number(p.total)||0);
      const paid = rpPaidSum(p);
      const done = !!p.completed || paid >= tot - 1e-6;

      const box = m.claim;
      if(done){
        box.cD += 1;
        box.tD += tot;
        box.pD += paid;
      }else{
        box.cA += 1;
        box.tA += tot;
        box.pA += paid;
      }
    });

    return map;
  }

  const mp = sumsByDebtor();

  const rows = Object.keys(mp).map(id=>{
    const m = mp[id];
    const L = m.loan;
    const C = m.claim;

    // 합계(대출 + 채권)
    const sum = {
      cA: L.cA + C.cA,
      cD: L.cD + C.cD,
      tA: L.tA + C.tA,
      tD: L.tD + C.tD,
      pA: L.pA + C.pA,
      pD: L.pD + C.pD
    };

    const loanRemain  = Math.max(0, (L.tA + L.tD) - (L.pA + L.pD));
    const claimRemain = Math.max(0, (C.tA + C.tD) - (C.pA + C.pD));
    const sumRemain   = Math.max(0, (sum.tA + sum.tD) - (sum.pA + sum.pD));

    // ROI 탭용 기존 필드(총합 기준)
    const tLoan = L.tA + L.tD;
    const pLoan = L.pA + L.pD;
    const tClm  = C.tA + C.tD;
    const pClm  = C.pA + C.pD;
    const tSum  = tLoan + tClm;
    const pSum  = pLoan + pClm;
    const remain = Math.max(0, tSum - pSum);
    const roi   = tSum > 0 ? Math.round((pSum / tSum) * 1000) / 10 : 0;

    return {
      name: m.name,
      phone: m.phone,
      loan: {
        cA:L.cA, cD:L.cD,
        tA:L.tA, tD:L.tD,
        pA:L.pA, pD:L.pD,
        remain: loanRemain
      },
      claim: {
        cA:C.cA, cD:C.cD,
        tA:C.tA, tD:C.tD,
        pA:C.pA, pD:C.pD,
        remain: claimRemain
      },
      sum: {
        cA:sum.cA, cD:sum.cD,
        tA:sum.tA, tD:sum.tD,
        pA:sum.pA, pD:sum.pD,
        remain: sumRemain
      },
      // ROI 탭용 필드
      tLoan, pLoan, tClm, pClm, tSum, pSum, remain, roi
    };
  });

  function formatCount(cA, cD){
    if(!cA && !cD) return '-';
    if(cD) return `${cA.toLocaleString('ko-KR')}(${cD.toLocaleString('ko-KR')})`;
    return cA.toLocaleString('ko-KR');
  }

  function formatPair(aActive, aDone){
    const base = KRW(aActive || 0);
    return aDone ? `${base}(${KRW(aDone)})` : base;
  }

  function grid(rows, key){
    const head = `<div class="grid-head">
      <div>채무자</div><div>연락처</div><div>건수</div><div>총상환채무</div><div>기납입</div><div>잔액</div>
    </div>`;

    const bodyHtml = rows.map(r=>{
      const d = r[key] || {};
      const tA = d.tA || 0, tD = d.tD || 0;
      const pA = d.pA || 0, pD = d.pD || 0;
      const total = tA + tD;
      const paid  = pA + pD;
      const remain = Math.max(0, total - paid);

      const countStr = formatCount(d.cA||0, d.cD||0);
      const totalStr = formatPair(tA, tD);
      const paidStr  = formatPair(pA, pD);

      return `<div class="grid-row">
        <div style="font-weight:700">${r.name}</div>
        <div>${r.phone}</div>
        <div>${countStr}</div>
        <div>${totalStr}</div>
        <div>${paidStr}</div>
        <div style="font-weight:800">${KRW(remain)}</div>
      </div>`;
    }).join('');

    const sumAcc = rows.reduce((acc,r)=>{
      const d = r[key] || {};
      acc.cA += d.cA||0;
      acc.cD += d.cD||0;
      acc.tA += d.tA||0;
      acc.tD += d.tD||0;
      acc.pA += d.pA||0;
      acc.pD += d.pD||0;
      return acc;
    }, {cA:0,cD:0,tA:0,tD:0,pA:0,pD:0});

    const sTotal = sumAcc.tA + sumAcc.tD;
    const sPaid  = sumAcc.pA + sumAcc.pD;
    const sRemain = Math.max(0, sTotal - sPaid);

    const sum = `<div class="grid-sum">
      <div>합계</div>
      <div>-</div>
      <div>${formatCount(sumAcc.cA, sumAcc.cD)}</div>
      <div>${formatPair(sumAcc.tA, sumAcc.tD)}</div>
      <div>${formatPair(sumAcc.pA, sumAcc.pD)}</div>
      <div style="font-weight:800">${KRW(sRemain)}</div>
    </div>`;

    return head + bodyHtml + sum;
  }

  let html = '';
  if(kind === 'loan'){
    html = grid(rows, 'loan');
  } else if(kind === 'claim'){
    html = grid(rows, 'claim');
  } else if(kind === 'sum'){
    html = grid(rows, 'sum');
  } else if(kind === 'roi'){
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
    const avg = rows.length
      ? Math.round(rows.reduce((s,r)=> s + (r.tSum>0 ? (r.pSum/r.tSum) : 0),0) / rows.length * 1000) / 10
      : 0;
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
