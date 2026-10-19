export function inRoot(root: Document | HTMLElement, element: HTMLElement): boolean {
  return root === element || root.contains(element);
}

export function elements(root: Document | HTMLElement, selector: string): HTMLElement[] {
  const result = [...root.querySelectorAll<HTMLElement>(selector)].filter(element => typeof element.focus === 'function');
  if (root.nodeType === 1 && (root as HTMLElement).matches(selector)) result.unshift(root as HTMLElement);
  return result;
}

export function available(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[inert], [hidden], [aria-disabled="true"]') || element.matches(':disabled')) return false;
  const view = element.ownerDocument.defaultView;
  if (!view || !element.getClientRects().length) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0' || style.contentVisibility === 'hidden') return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function onScreen(element: HTMLElement): boolean {
  if (!available(element)) return false;
  const view = element.ownerDocument.defaultView!;
  const rect = element.getBoundingClientRect();
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  let right = Math.min(view.innerWidth, rect.right), bottom = Math.min(view.innerHeight, rect.bottom);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = view.getComputedStyle(parent);
    const box = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
  }
  if (right <= left || bottom <= top) return false;
  if (view.getComputedStyle(element).pointerEvents === 'none') return false;
  const hitTest = element.ownerDocument.elementFromPoint;
  if (hitTest) {
    const hit = hitTest.call(element.ownerDocument, (left + right) / 2, (top + bottom) / 2);
    if (hit && hit !== element && !element.contains(hit)) return false;
  }
  return true;
}

const classOwners = new WeakMap<HTMLElement, Map<string, { count: number; original: boolean }>>();

export function claimClass(element: HTMLElement, token: string): () => void {
  let owned = classOwners.get(element);
  if (!owned) { owned = new Map(); classOwners.set(element, owned); }
  let entry = owned.get(token);
  if (!entry) { entry = { count: 0, original: element.classList.contains(token) }; owned.set(token, entry); }
  entry.count++;
  if (!element.classList.contains(token)) element.classList.add(token);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry!.count === 0) {
      if (!entry!.original) element.classList.remove(token);
      owned!.delete(token);
    }
  };
}

export class ClassClaims {
  private claims = new Map<HTMLElement, Map<string, () => void>>();

  sync(wanted: ReadonlyMap<HTMLElement, ReadonlySet<string>>): void {
    for (const [element, tokens] of this.claims) {
      for (const [token, release] of tokens) if (!wanted.get(element)?.has(token)) { release(); tokens.delete(token); }
      if (!tokens.size) this.claims.delete(element);
    }
    for (const [element, tokens] of wanted) {
      let current = this.claims.get(element);
      if (!current) { current = new Map(); this.claims.set(element, current); }
      for (const token of tokens) if (!current.has(token)) current.set(token, claimClass(element, token));
    }
  }

  clear(): void { this.sync(new Map()); }
}

export const classTokens = (value: string | undefined): string[] => value?.trim().split(/\s+/).filter(Boolean) ?? [];
