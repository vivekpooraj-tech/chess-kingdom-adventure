/** Runs before React hydrates so tablet layout applies on first paint in WebView. */
export function LayoutBootstrapScript() {
  const script = `
(function () {
  var w = window.innerWidth;
  var h = window.innerHeight;
  var shortEdge = Math.min(w, h);
  var longEdge = Math.max(w, h);
  var layout = (shortEdge >= 600 || longEdge >= 900)
    ? (w >= 1024 ? "desktop" : "tablet")
    : "phone";
  var root = document.documentElement;
  root.dataset.layout = layout;
  root.classList.toggle("is-phone", layout === "phone");
  root.classList.toggle("is-tablet", layout !== "phone");
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
