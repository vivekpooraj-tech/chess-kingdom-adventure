/**
 * Runs before React hydrates (same pattern as LayoutBootstrapScript) so the
 * desktop sidebar's collapsed/expanded state — and therefore the content
 * column's left inset (`--app-sidenav-w`) — is correct on the very first
 * paint, with no width snap after hydration. Only sets an attribute; the
 * width var + label visibility are driven from CSS off `html[data-sidenav]`.
 */
export function ShellBootstrapScript() {
  const script = `
(function () {
  try {
    var v = localStorage.getItem("chessmind-sidenav-collapsed");
    if (v === "1") document.documentElement.dataset.sidenav = "collapsed";
    else document.documentElement.dataset.sidenav = "expanded";
  } catch (e) {
    document.documentElement.dataset.sidenav = "expanded";
  }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
