/** Runs before React hydrates so tablet layout applies on first paint in WebView. */
export function LayoutBootstrapScript() {
  const script = `
(function () {
  var sw = window.screen.width;
  var sh = window.screen.height;
  var shortEdge = Math.min(sw, sh);
  var longEdge = Math.max(sw, sh);
  var vw = window.innerWidth;
  var layout = (shortEdge >= 600 || longEdge >= 900)
    ? (vw >= 1024 ? "desktop" : "tablet")
    : "phone";
  var root = document.documentElement;
  root.dataset.layout = layout;
  root.classList.toggle("is-phone", layout === "phone");
  root.classList.toggle("is-tablet", layout !== "phone");
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
