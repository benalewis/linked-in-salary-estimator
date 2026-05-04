/**
 * Normalize `MouseEvent.target` for `Element.closest`.
 * Many browsers use the inner Text node as `target` when clicking button labels.
 */
export function mouseEventTargetElement(ev: MouseEvent): Element | null {
  const t = ev.target;
  if (t instanceof Element) {
    return t;
  }
  if (t instanceof Text) {
    return t.parentElement;
  }
  return null;
}
