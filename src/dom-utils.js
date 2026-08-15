/** Returns the trimmed, collapsed text content of an element. */
function compactText(element) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Returns true if the element is rendered and not hidden — i.e., it has
 * non-zero layout dimensions and is not `display:none` or `visibility:hidden`.
 * Note: this does NOT check whether the element intersects the visible viewport.
 */
function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

/**
 * Finds the first visible menu-item-like element whose text matches `pattern`.
 * @param {HTMLElement} root
 * @param {RegExp} pattern
 */
function findMenuItem(root, pattern) {
  return Array.from(
    root.querySelectorAll('[role="menuitem"], button, [data-radix-collection-item]'),
  ).find((element) => {
    return element instanceof HTMLElement && isVisible(element) && pattern.test(compactText(element));
  });
}

/**
 * Prevents the hosting menu from capturing events fired on interactive controls
 * (buttons, selects) we inject into Radix menus.
 *
 * @param {HTMLElement} element
 * @param {{ preventClickDefault?: boolean }} [options]
 */
function protectInteractiveControl(element, options = {}) {
  const preventClickDefault = options.preventClickDefault !== false;
  const stop = (event) => {
    event.stopPropagation();
  };
  element.addEventListener("pointerdown", stop, true);
  element.addEventListener("mousedown", stop, true);
  element.addEventListener("mouseup", stop, true);
  element.addEventListener("keydown", stop, true);
  element.addEventListener(
    "click",
    (event) => {
      if (preventClickDefault) event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}

module.exports = { compactText, isVisible, findMenuItem, protectInteractiveControl };
