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



function renderReport(){
  var kpiBox = document.getElementById('reportKpi');
  var statusBox = document.getElementById('reportStatus');
  var summaryBox = document.getElementById('reportSummary');
  if(!kpiBox || !statusBox || !summaryBox) return;

  var loans = (window.state && Array.isArray(state.loans)) ? state.loans : [];
  if(!loans.length){
    kpiBox.innerHTML = '<p style="margin:0;font-size:12px;color:var(--muted)">등록된 대출 데이터가 없습니다.</p>';
    statusBox.innerHTML = '';
    summaryBox.innerHTML = '';
    return;
  }

  var totalNominal = 0;
  var totalPaid = 0;
  var totalRemain = 0;
  var totalCount = loans.length;

  var doneCount = 0;
  var progressCount = 0;
  var overdueCount = 0;

  var doneNominal = 0;
  var progressNominal = 0;
  var overdueNominal = 0;

  loans.forEach(function(l){
    var tot = Math.max(0, Number(l.total)||0);
    var sched = Array.isArray(l.schedule) ? l.schedule : [];
    var paid = sched.reduce(function(s,it){
      if(!it) return s;
      var v = Number(it.paid)||0;
      return s + Math.max(0,v);
    },0);
    var remain = Math.max(0, tot - paid);
    totalNominal += tot;
    totalPaid += paid;
    totalRemain += remain;

    var done = !!l.completed || paid >= tot - 1e-6;
    var hasMissed = sched.some(function(it){ return it && it.missed; });

    if(done){
      doneCount += 1;
      doneNominal += tot;
    }else if(hasMissed){
      overdueCount += 1;
      overdueNominal += tot;
    }else{
      progressCount += 1;
      progressNominal += tot;
    }
  });

  var totalExpected = totalNominal;
  var recoveryRate = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 1000) / 10 : 0;

  // KPI 영역
  var kpiHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">';
  function kpiCard(label, value, sub){
    return '<div style="flex:1 1 160px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;min-width:140px">'
      + '<div style="font-size:11px;color:var(--muted);margin-bottom:2px">'+label+'</div>'
      + '<div style="font-size:16px;font-weight:700">'+value+'</div>'
      + (sub ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">'+sub+'</div>' : '')
      + '</div>';
  }
  kpiHtml += kpiCard('총 상환채무(명목)', (totalExpected||0).toLocaleString('ko-KR') + '원', '대출 총액 기준');
  kpiHtml += kpiCard('기납입 합계', (totalPaid||0).toLocaleString('ko-KR') + '원', '');
  kpiHtml += kpiCard('잔여 예정액', (totalRemain||0).toLocaleString('ko-KR') + '원', '');
  kpiHtml += kpiCard('회수율', (recoveryRate||0) + '%', '기납입 / 총 상환채무');
  kpiHtml += '</div>';
  kpiBox.innerHTML = kpiHtml;

  // 상태 요약
  var statusTotalNominal = doneNominal + progressNominal + overdueNominal;
  function ratio(part){ return statusTotalNominal>0 ? Math.round(part/statusTotalNominal*1000)/10 : 0; }
  var statusHtml = '<div style="margin-bottom:12px">'
    + '<div style="font-size:12px;font-weight:600;margin-bottom:4px">포트폴리오 상태</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<thead><tr>'
      + '<th style="text-align:left;border-bottom:1px solid var(--line);padding:4px 6px">상태</th>'
      + '<th style="text-align:right;border-bottom:1px solid var(--line);padding:4px 6px">건수</th>'
      + '<th style="text-align:right;border-bottom:1px solid var(--line);padding:4px 6px">명목금</th>'
      + '<th style="text-align:right;border-bottom:1px solid var(--line);padding:4px 6px">비율</th>'
    + '</tr></thead><tbody>';
  statusHtml += '<tr>'
    + '<td style="padding:4px 6px">완납</td>'
    + '<td style="padding:4px 6px;text-align:right">'+doneCount.toLocaleString('ko-KR')+'</td>'
    + '<td style="padding:4px 6px;text-align:right">'+doneNominal.toLocaleString('ko-KR')+'원</td>'
    + '<td style="padding:4px 6px;text-align:right">'+ratio(doneNominal)+'%</td>'
    + '</tr>';
  statusHtml += '<tr>'
    + '<td style="padding:4px 6px">진행</td>'
    + '<td style="padding:4px 6px;text-align:right">'+progressCount.toLocaleString('ko-KR')+'</td>'
    + '<td style="padding:4px 6px;text-align:right">'+progressNominal.toLocaleString('ko-KR')+'원</td>'
    + '<td style="padding:4px 6px;text-align:right">'+ratio(progressNominal)+'%</td>'
    + '</tr>';
  statusHtml += '<tr>'
    + '<td style="padding:4px 6px">미납</td>'
    + '<td style="padding:4px 6px;text-align:right">'+overdueCount.toLocaleString('ko-KR')+'</td>'
    + '<td style="padding:4px 6px;text-align:right">'+overdueNominal.toLocaleString('ko-KR')+'원</td>'
    + '<td style="padding:4px 6px;text-align:right">'+ratio(overdueNominal)+'%</td>'
    + '</tr>';
  statusHtml += '</tbody></table></div>';
  statusBox.innerHTML = statusHtml;

  // Summary 표
  var summaryHtml = '<div>'
    + '<div style="font-size:12px;font-weight:600;margin-bottom:4px">요약</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<tbody>';
  function row(label, value){
    return '<tr>'
      + '<td style="padding:4px 6px;border-bottom:1px solid var(--line)">'+label+'</td>'
      + '<td style="padding:4px 6px;border-bottom:1px solid var(--line);text-align:right">'+value+'</td>'
      + '</tr>';
  }
  summaryHtml += row('총 대출(명목)', totalNominal.toLocaleString('ko-KR') + '원');
  summaryHtml += row('기납입 합계', totalPaid.toLocaleString('ko-KR') + '원');
  summaryHtml += row('잔여 예정액', totalRemain.toLocaleString('ko-KR') + '원');
  summaryHtml += row('대출 건수', totalCount.toLocaleString('ko-KR') + '건');
  summaryHtml += row('완납 / 진행 / 미납 건수', doneCount+' / '+progressCount+' / '+overdueCount);
  summaryHtml += row('회수율', (recoveryRate||0) + '%');
  summaryHtml += '</tbody></table></div>';
  summaryBox.innerHTML = summaryHtml;
}

// stats subtab click
document.addEventListener('click', function(e){
  var b = e.target && e.target.closest('.stats-tab'); if(!b) return;
  renderStats(b.dataset.stats);
}, true);
