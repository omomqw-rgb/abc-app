// Application bootstrap for compat-ESM version
// This script dynamically imports modules in sequence to ensure that
// dependent modules have their globals available before execution. In
// particular, modules that rely on functions from core/main.js need those
// functions attached to the global object before they execute.

// Wrap everything in an immediately invoked async function to allow
// sequential dynamic imports with await.
(async () => {
  // Load core module first and expose its exports to the global window.
  const core = await import('./core/main.js');
  if (typeof window !== 'undefined') Object.assign(window, core);

  // Next load the modals module which depends on core exports. Expose its
  // exports to the global window as well.
  const modals = await import('./ui/modals.js');
  if (typeof window !== 'undefined') Object.assign(window, modals);

  // Load remaining modules for their side effects. These modules attach
  // themselves to the DOM or global state but do not export functions
  // explicitly used by other modules.
  await import('./ui/toast.js');
  await import('./ui/stats.js');
  await import('./ui/schedules.js');
  await import('./ui/live_update.js');
  await import('./cloud/bind.js');
  await import('./domain/repay.js');
  await import('./domain/meta_edit_patch.js');
  await import('./domain/meta_edit_patch2.js');
  await import('./ui/search_sort.js');
  await import('./cloud/auth_patch.js');
})();