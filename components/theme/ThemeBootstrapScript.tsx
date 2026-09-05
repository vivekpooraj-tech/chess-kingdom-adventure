/**
 * Applies the saved theme BEFORE React hydrates, so the first paint is already
 * the right theme and there is no flash of the default one.
 *
 * Same pattern as LayoutBootstrapScript / ShellBootstrapScript: a tiny inline
 * script that only sets an attribute on <html>, with all the visual work done
 * by CSS off `html[data-theme]`. Nothing is fetched and nothing is awaited, so
 * this adds no latency to any route.
 *
 * Persistence is localStorage rather than a user row on purpose. A theme is a
 * per-device display preference, and reading it from the database would mean
 * either an extra query on every page (the exact per-navigation cost recent
 * performance work removed) or a hydration flash while it loads. The key is
 * duplicated as a literal here because this runs as a raw string and cannot
 * import from lib/theme/themes.ts.
 */
export function ThemeBootstrapScript() {
  const script = `
(function () {
  try {
    var t = localStorage.getItem("chessmind-theme");
    var valid = ["chess-kingdom","midnight-grandmaster","royal-classic","future-arena"];
    if (t && valid.indexOf(t) !== -1 && t !== "chess-kingdom") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {
    /* storage unavailable — the default theme is already correct */
  }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
