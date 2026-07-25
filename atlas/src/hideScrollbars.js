/**
 * Hide scrollbars everywhere (light DOM + open shadow roots).
 * Scroll via touch / trackpad / wheel still works.
 */
const HIDE_SCROLLBAR_CSS = `
* {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
*::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  background: transparent !important;
}
`;

function createHideScrollbarSheet() {
  if (typeof CSSStyleSheet === "undefined") return null;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HIDE_SCROLLBAR_CSS);
    return sheet;
  } catch {
    return null;
  }
}

const hideSheet = createHideScrollbarSheet();

function adoptHideSheet(target) {
  if (!hideSheet || !target) return;
  try {
    const current = target.adoptedStyleSheets || [];
    if (current.includes(hideSheet)) return;
    target.adoptedStyleSheets = [...current, hideSheet];
  } catch {
    /* Older browsers / closed shadow roots */
  }
}

function injectStyleTag(root) {
  if (!root?.appendChild) return;
  try {
    if (root.querySelector?.("style[data-atlas-hide-scrollbars]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-atlas-hide-scrollbars", "");
    style.textContent = HIDE_SCROLLBAR_CSS;
    root.appendChild(style);
  } catch {
    /* ignore */
  }
}

function applyToShadowRoot(root) {
  if (!root) return;
  if (hideSheet) adoptHideSheet(root);
  else injectStyleTag(root);
}

/** Patch future shadow roots (Material Web, etc.). */
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function attachShadowPatched(init) {
  const root = originalAttachShadow.call(this, init);
  applyToShadowRoot(root);
  return root;
};

/** Document + any roots already created. */
adoptHideSheet(document);
injectStyleTag(document.head || document.documentElement);

function scanExistingShadows(node) {
  if (!node) return;
  if (node.shadowRoot) {
    applyToShadowRoot(node.shadowRoot);
    scanExistingShadows(node.shadowRoot);
  }
  const children = node.children || node.childNodes;
  if (!children) return;
  for (const child of children) {
    if (child.nodeType === 1) scanExistingShadows(child);
  }
}

scanExistingShadows(document);

/** Catch late-upgraded custom elements. */
if (typeof MutationObserver !== "undefined") {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) scanExistingShadows(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
