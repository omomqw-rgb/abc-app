
/* ===== 즉시 반영: 상환 상태/부분입금/날짜 변경 시 바로 저장 ===== */
document.addEventListener('change', (e)=>{
  const row = e.target.closest('.sched-row');
  if(!row) return;

  const loanId = row.getAttribute('data-loan');
  const idx = row.getAttribute('data-idx');
  const l = state.loans.find(x=>x.id===loanId);
  const it = l ? l.schedule.find(s=>String(s.idx)===String(idx)) : null;
  if(!l || !it) return;

  // 날짜 변경
  if(e.target.classList.contains('date-input')){
    const newDate = e.target.value;
    if(newDate) it.date = newDate;
    if (typeof refreshKeepDrawer === 'function') refreshKeepDrawer();
    if (typeof save === 'function') save();
    return;
  }

  // 상태 변경 (미입금/부분입금/완납/미납)
  if(e.target.classList.contains('status')){
    const status = e.target.value;
    const partialInput = row.querySelector('.partial-input');
    const partialVal = Number((partialInput && partialInput.value) || 0);

    if(status==='완납'){ it.paid = it.amount; it.missed=false; }
    else if(status==='미납'){ it.paid=0; it.missed=true; }
    else if(status==='미입금'){ it.paid=0; it.missed=false; }
    else if(status==='부분입금'){
      if(partialVal>0){ it.paid = Math.min(it.amount, partialVal); it.missed=false; }
      else { it.paid = 0; it.missed=false; } // 값 입력 전 상태
    }

    if (typeof refreshKeepDrawer === 'function') refreshKeepDrawer();
    if (typeof save === 'function') save();
    return;
  }

  // 부분입금 금액 변경
  if(e.target.classList.contains('partial-input')){
    const v = Math.max(0, Number(e.target.value||0));
    it.paid = Math.min(it.amount, v); it.missed=false;
    if (typeof refreshKeepDrawer === 'function') refreshKeepDrawer();
    if (typeof save === 'function') save();
    return;
  }
});
/* ===== /즉시 반영 ===== */
