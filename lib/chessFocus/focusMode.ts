type Listener = () => void;

let activeCount = 0;
const listeners = new Set<Listener>();

/** Enter/leave chess focus mode — hides PrimaryNav while a board screen is active. */
export function setChessFocusActive(active: boolean) {
  const next = active ? activeCount + 1 : Math.max(0, activeCount - 1);
  activeCount = next;
  const isActive = next > 0;
  document.documentElement.classList.toggle("chess-focus-active", isActive);
  listeners.forEach((listener) => listener());
}

export function isChessFocusActive(): boolean {
  return activeCount > 0;
}

export function subscribeChessFocus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
