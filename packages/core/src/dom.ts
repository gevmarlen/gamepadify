export function inRoot(root: Document | HTMLElement, element: HTMLElement): boolean {
  return root === element || root.contains(element);
}

export function elements(root: Document | HTMLElement, selector: string): HTMLElement[] {
  const result = [...root.querySelectorAll<HTMLElement>(selector)].filter(element => typeof element.focus === 'function');
  if (root.nodeType === 1 && (root as HTMLElement).matches(selector)) result.unshift(root as HTMLElement);
  return result;
}

// Discard after each frame, focus/scroll change or application callback.
export class Measurements {
  private values = new Map<Element, { style?: CSSStyleDeclaration; rect?: DOMRect; hidden?: boolean; screen?: boolean }>();

  private get(element: Element) {
    let value = this.values.get(element);
    if (!value) { value = {}; this.values.set(element, value); }
    return value;
  }

  rect(element: Element): DOMRect {
    return this.get(element).rect ??= element.getBoundingClientRect();
  }

  style(element: Element): CSSStyleDeclaration {
    return this.get(element).style ??= element.ownerDocument.defaultView!.getComputedStyle(element);
  }

  private isHidden(element: HTMLElement): boolean {
    const value = this.get(element), cached = value.hidden;
    if (cached !== undefined) return cached;
    const style = this.style(element);
    const hidden = element.matches('[inert], [hidden], [aria-disabled="true"]') || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0' || style.contentVisibility === 'hidden' || !!element.parentElement && this.isHidden(element.parentElement);
    value.hidden = hidden;
    return hidden;
  }

  available(element: HTMLElement): boolean {
    if (!element.isConnected || !element.ownerDocument.defaultView || element.matches(':disabled') || this.isHidden(element)) return false;
    const rect = this.rect(element);
    return rect.width > 0 && rect.height > 0;
  }

  onScreen(element: HTMLElement): boolean {
    return this.get(element).screen ??= this.visible(element);
  }

  private visible(element: HTMLElement): boolean {
    if (!this.available(element)) return false;
    const view = element.ownerDocument.defaultView!;
    const rect = this.rect(element);
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(view.innerWidth, rect.right), bottom = Math.min(view.innerHeight, rect.bottom);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = this.style(parent);
      const clipX = /(auto|scroll|hidden|clip)/.test(style.overflowX), clipY = /(auto|scroll|hidden|clip)/.test(style.overflowY);
      if (clipX || clipY) {
        const box = this.rect(parent);
        if (clipX) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
        if (clipY) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
      }
    }
    if (right <= left || bottom <= top || this.style(element).pointerEvents === 'none') return false;
    const hit = element.ownerDocument.elementFromPoint?.((left + right) / 2, (top + bottom) / 2);
    return !hit || hit === element || element.contains(hit);
  }
}

export const available = (element: HTMLElement): boolean => new Measurements().available(element);
export const onScreen = (element: HTMLElement): boolean => new Measurements().onScreen(element);

const classOwners = new WeakMap<HTMLElement, Map<string, { count: number; original: boolean }>>();

export function claimClass(element: HTMLElement, token: string): () => void {
  let owned = classOwners.get(element);
  if (!owned) { owned = new Map(); classOwners.set(element, owned); }
  let entry = owned.get(token);
  if (!entry) { entry = { count: 0, original: element.classList.contains(token) }; owned.set(token, entry); }
  entry.count++;
  if (!element.classList.contains(token)) element.classList.add(token);
  const claim = entry, tokens = owned;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--claim.count === 0) {
      if (!claim.original) element.classList.remove(token);
      tokens.delete(token);
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
