// Lightweight router stub (not used in multi-page mode) — exported for future SPA upgrades.
export function navigateTo(path) {
  history.pushState(null, '', path);
  // In an SPA we'd load content here. For now keep pages separate.
}

window.addEventListener('popstate', () => {
  // noop for now
});