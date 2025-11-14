
window.toast = window.toast || function(msg, type){
  try{
    var box = document.getElementById('patchToast');
    if(box){
      var d=document.createElement('div');
      d.textContent=msg;
      d.style.cssText='background:#111a2b;border:1px solid #243049;padding:10px 12px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.35);max-width:360px;opacity:0;transform:translateY(-4px);transition:all .18s ease;';
      box.appendChild(d);
      requestAnimationFrame(function(){ d.style.opacity='1'; d.style.transform='translateY(0)'; });
      setTimeout(function(){ d.style.opacity='0'; d.style.transform='translateY(-6px)'; setTimeout(function(){ if(d && d.parentNode) d.parentNode.removeChild(d); }, 230); }, 2000);
    } else {
      console.log('[toast]', msg);
    }
  }catch(e){ try{ console.log('[toast]', msg); }catch(_){} }
};
