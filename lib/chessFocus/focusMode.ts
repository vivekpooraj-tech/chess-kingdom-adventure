type Listener = () => void;

let activeCount = 0;
const listeners = new Set<Listener>();

function syncDom(isActive: boolean) {
  document.documentElement.classList.toggle("chess-focus-active", isActive);
  listeners.forEach((listener) => listener());
}

/** Enter/leave chess focus mode — hides PrimaryNav while a board screen is active. */
export function setChessFocusActive(active: boolean) {
  const next = active ? activeCount + 1 : Math.max(0, activeCount - 1);
  activeCount = next;
  syncDom(next > 0);
}

/** Force-clear focus mode (e.g. Puzzle Trainer keeps the tab bar). */
export function resetChessFocusMode() {
  activeCount = 0;
  syncDom(false);
}

export function isChessFocusActive(): boolean {
  return activeCount > 0;
}

export function subscribeChessFocus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
