
// ===== 강제 바인딩: 로그인/클라우드 버튼 직접 핸들러 (위임 클릭 이슈 방지) =====
(function bindCloudButtons(){
  try{
    if(window.__CLOUD_HANDLERS_BOUND__) { console.log('[bindCloudButtons] skip (already bound)'); return; }
    var authBtn = document.getElementById('btnAuth');
    var saveBtn = document.getElementById('btnCloudSave');
    var loadBtn = document.getElementById('btnCloudLoad');
    if(!authBtn || !saveBtn || !loadBtn) return;

    function needClient(){ if(!sb && !ensureClient()){ toast('Supabase 로드 실패: URL/키/네트워크를 확인하세요.'); return true; } return false; }

    authBtn.addEventListener('click', async function(e){
      e.stopPropagation();
      if(needClient()) return;
      if(authBtn.dataset.mode === 'signout'){
        try{ await signOut(); }catch(_){}
        setAuthButton(null);
      }else{
        const user = await signInEmailPassword();
        if(user) setAuthButton(user);
      }
    });

    saveBtn.addEventListener('click', async function(e){
      e.stopPropagation();
      if(needClient()) return;
      await cloudSave();
    });

    loadBtn.addEventListener('click', async function(e){
      e.stopPropagation();
      if(needClient()) return;
      await cloudLoad();
    });
  window.__CLOUD_HANDLERS_BOUND__ = true;
  }catch(err){
    console.warn('[bindCloudButtons] 실패', err);
  }
})();
