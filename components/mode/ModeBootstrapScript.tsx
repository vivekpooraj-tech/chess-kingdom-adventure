/**
 * Applies the saved presentation mode BEFORE React hydrates, so the first
 * paint is already the right mode and there is no flash of the wrong one.
 *
 * Exact same pattern as ThemeBootstrapScript (and LayoutBootstrapScript /
 * ShellBootstrapScript before it): a tiny inline script that only sets an
 * attribute on <html>, with all the visual work done by CSS off
 * `html[data-mode]`. Nothing is fetched and nothing is awaited.
 *
 * classic-pro (the default) intentionally sets NO attribute — mirroring
 * chess-kingdom's own "no attribute = default" convention in
 * ThemeBootstrapScript — so a visitor with no stored preference renders the
 * app's current, unmodified appearance with zero extra work.
 *
 * The key/id list are duplicated as literals here because this runs as a raw
 * string before hydration and cannot import from lib/mode/modes.ts.
 */
export function ModeBootstrapScript() {
  const script = `
(function () {
  try {
    var m = localStorage.getItem("chessmind-mode");
    var valid = ["kids","adult","classic-pro"];
    if (m && valid.indexOf(m) !== -1 && m !== "classic-pro") {
      document.documentElement.setAttribute("data-mode", m);
    }
  } catch (e) {
    /* storage unavailable — the default (classic-pro) presentation is
       already correct with no attribute needed. */
  }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
