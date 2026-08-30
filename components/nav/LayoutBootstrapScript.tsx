/**
 * Runs before React hydrates so the correct is-phone / is-tablet class is on
 * <html> for first paint (avoids a layout flash in the WebView). The rule
 * here MUST stay in sync with resolveLayout() in NativeLayoutProvider.tsx:
 * tablet = short physical edge >= 600 (Android sw600dp), desktop = that plus
 * a viewport >= 1024. No screen-height clause — tall phones are phones.
 */
export function LayoutBootstrapScript() {
  const script = `
(function () {
  var shortEdge = Math.min(window.screen.width, window.screen.height);
  var layout = shortEdge < 600
    ? "phone"
    : (window.innerWidth >= 1024 ? "desktop" : "tablet");
  var root = document.documentElement;
  root.dataset.layout = layout;
  root.classList.toggle("is-phone", layout === "phone");
  root.classList.toggle("is-tablet", layout !== "phone");
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
