
/* 회차 저장 */
document.addEventListener('click', (e)=>{
  const row = e.target.closest('.sched-row');
  if(row && e.target.classList.contains('save-btn')){
    const loanId=row.getAttribute('data-loan');
    const idx=row.getAttribute('data-idx');
    const l=state.loans.find(x=>x.id===loanId); if(!l) return;
    const it=l.schedule.find(s=>String(s.idx)===String(idx)); if(!it) return;

    const newDate = row.querySelector('.date-input').value;
    const status = row.querySelector('.status').value;
    const partialVal = Number(row.querySelector('.partial-input').value||0);

    if(newDate) it.date = newDate;

    if(status==='완납'){ it.paid=it.amount; it.missed=false; }
    else if(status==='부분입금'){
      if(!(partialVal>0)) return toast('부분입금 금액을 입력하세요.');
      it.paid = Math.min(it.amount, partialVal);
      it.missed=false;
    }else if(status==='미납'){ it.paid=0; it.missed=true; }
    else{ it.paid=0; it.missed=false; }

    refreshKeepDrawer(); // 캘린더/드로워 즉시 동기화
  }
});
