
(function(){
  try{
    if(window.__PATCH4_READY__) return; window.__PATCH4_READY__=true;

    function safeToast(msg, type){
      try{ (window.toast||console.log)(msg, type||''); }catch(_){}
    }

    var authBtn = document.getElementById('btnAuth');
    var saveBtn = document.getElementById('btnCloudSave');
    var loadBtn = document.getElementById('btnCloudLoad');

    function ensureSb(){
      if(window.sb) return window.sb;
      if(typeof window.supabase === 'undefined'){ safeToast('Supabase SDK 로드 실패 (cdn 차단?)'); return null; }
      var url = (typeof window.SUPABASE_URL!=='undefined') ? window.SUPABASE_URL : (typeof SUPABASE_URL!=='undefined'? SUPABASE_URL : '');
      var key = (typeof window.SUPABASE_ANON_KEY!=='undefined') ? window.SUPABASE_ANON_KEY : (typeof SUPABASE_ANON_KEY!=='undefined'? SUPABASE_ANON_KEY : '');
      if(!url || !key){ safeToast('Supabase 설정 누락: URL/anon key'); return null; }
      try{ window.sb = window.supabase.createClient(url, key); }catch(e){ console.warn('[patch4] create fail', e); safeToast('Supabase 클라이언트 생성 실패'); return null; }
      return window.sb;
    }

    function onCapture(el, fn){
      if(!el) return;
      el.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
        (async function(){ try{ await fn(ev); }catch(e){ console.warn('[patch4] handler err', e); safeToast('작업 실패: ' + (e && e.message ? e.message : e)); } })();
      }, { capture:true });
    }

    function openSel(id){ var el=document.querySelector(id); if(el) el.style.display='flex'; }
    function closeSel(id){ var el=document.querySelector(id); if(el) el.style.display='none'; }

    async function signInModal(){
      var sb = ensureSb(); if(!sb) return null;
      var emailEl = document.getElementById('authEmail');
      var pwEl = document.getElementById('authPw');
      var submit = document.getElementById('authSubmit');
      var authModal = document.getElementById('authModal');
      if(!emailEl || !pwEl || !submit){ safeToast('로그인 UI 준비 실패'); return null; }
      openSel('#authModal');
      return new Promise(function(resolve){
        function onSubmit(){
          var email = (emailEl.value||'').trim();
          var pw = pwEl.value||'';
          if(!email){ safeToast('이메일을 입력하세요'); return; }
          if(!pw){ safeToast('비밀번호를 입력하세요'); return; }
          sb.auth.signInWithPassword({ email, password: pw }).then(function(resp){
            if(resp.error){ safeToast('로그인 실패: ' + resp.error.message); return; }
            closeSel('#authModal'); safeToast('로그인 성공', 'success'); resolve(resp.data.user);
            submit.removeEventListener('click', onSubmit);
          }).catch(function(err){ safeToast('로그인 오류: ' + (err && err.message ? err.message : String(err))); });
        }
        submit.addEventListener('click', onSubmit);
      });
    }

    async function doLogout(){ var sb = ensureSb(); if(!sb) return; try{ await sb.auth.signOut(); safeToast('로그아웃 완료'); }catch(e){ safeToast('로그아웃 실패: '+(e && e.message?e.message:e)); } }
    async function doCloudSave(){ try{ await cloudSave(); }catch(e){ console.warn('[patch4/save]', e); safeToast('클라우드 저장 실패: ' + (e && e.message ? e.message : String(e))); } }
    async function doCloudLoad(){ try{ await cloudLoad({silent:false}); }catch(e){ console.warn('[patch4/load]', e); safeToast('클라우드 불러오기 실패: ' + (e && e.message ? e.message : String(e))); } }

    onCapture(authBtn, async function(){
      var sb = ensureSb(); if(!sb) return;
      sb.auth.getUser().then(function(resp){
        var user = resp && resp.data && resp.data.user;
        if(user){ doLogout(); if(authBtn){ authBtn.textContent='로그인'; authBtn.dataset.mode='signin'; } }
        else{
          signInModal().then(function(u){ if(u && authBtn){ authBtn.textContent='로그아웃 ('+(u.email||'')+')'; authBtn.dataset.mode='signout'; } });
        }
      });
    });
    onCapture(saveBtn, doCloudSave);
    onCapture(loadBtn, doCloudLoad);

    // 로그인 상태면 조용히 자동 불러오기 (중복 방지)
    try{
      var sb0 = ensureSb();
      if(sb0){
        sb0.auth.getUser().then(function(resp){
          var user = resp && resp.data && resp.data.user;
          if(user){ try{ if(!window.__CLOUD_AUTOLOAD_DONE__) cloudLoad({silent:true}); }catch(_e){} }
        });
      }
    }catch(_){}
  }catch(err){ console.warn('[patch4] fatal', err); }
})();
