// dispara quando entrar no ClickUp (SPA-aware) se auto_run estiver ativo
function triggerMaybe() {
  chrome.storage.sync.get({ cu_auto_run: true }, (cfg) => {
    if (!cfg.cu_auto_run) return;
    if (location.hostname === "app.clickup.com") {
      chrome.runtime.sendMessage({ type: "RUN_MIGRATION_NOW" }, (resp) => {
        if (resp) console.log("[ClickUp Ext] Migração:", resp);
      });
    }
  });
}

const _ps = history.pushState;
history.pushState = function () {
  const r = _ps.apply(this, arguments);
  window.dispatchEvent(new Event("locationchange"));
  return r;
};
const _rs = history.replaceState;
history.replaceState = function () {
  const r = _rs.apply(this, arguments);
  window.dispatchEvent(new Event("locationchange"));
  return r;
};
window.addEventListener("popstate", () =>
  window.dispatchEvent(new Event("locationchange"))
);

let t;
window.addEventListener("locationchange", () => {
  clearTimeout(t);
  t = setTimeout(triggerMaybe, 700);
});

triggerMaybe();
