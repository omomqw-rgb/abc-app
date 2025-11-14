
// CloudLoad auto-call guard: allow first-visit or manual (__force), block further automatic attempts
(function(){
  try{
    if(!window.__CLOUD_GUARD_INSTALLED__){
      window.__CLOUD_GUARD_INSTALLED__ = true;
      var __REAL_CLOUDLOAD__ = window.cloudLoad;
      window.cloudLoad = async function(opts){
        opts = opts || {};
        // Allow manual button via __force, or allow if not yet autoloaded
        if (opts.__force === true || !window.__CLOUD_AUTOLOAD_DONE__) {
          return __REAL_CLOUDLOAD__(opts);
        }
        // Block silent automatic repeats
        return Promise.resolve();
      };
      // Ensure manual "클라우드 불러오기" always forces
      document.addEventListener('click', function(e){
        var t = e.target && e.target.closest('#btnCloudLoad');
        if(!t) return;
        e.stopPropagation();
        e.preventDefault();
        try{ __REAL_CLOUDLOAD__({ silent:false, __force:true }); }catch(_){}
      }, true);
    }
  }catch(e){ console.warn('[cloud guard install] fail', e); }
})();
