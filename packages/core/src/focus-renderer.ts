import type { Presentation, RenderState } from './features.js';

export class FocusRenderer implements Presentation {
  readonly host: HTMLDivElement;
  private ring: HTMLDivElement;
  private origin = { left: 0, top: 0 };

  constructor(protected document: Document) {
    this.host = document.createElement('div');
    this.host.className = 'gamepadify-layer';
    this.host.setAttribute('aria-hidden', 'true');
    this.ring = document.createElement('div');
    this.ring.className = 'gamepadify-focus';
    this.host.append(this.ring);
  }

  measure<T>(read: () => T): T { return read(); }

  render({ entries, scope, measurements }: RenderState): void {
    const dialog = scope.nodeType === 1 ? (scope as HTMLElement).closest('dialog[open]') : null;
    const parent = dialog ?? this.document.body;
    if (this.host.parentElement !== parent) parent.append(this.host);
    const active = this.document.activeElement as HTMLElement | null;
    const focus = active && entries.some(entry => entry.element === active) && measurements.onScreen(active) ? active : null;
    this.origin = measurements.rect(this.host);
    if (focus) {
      const rect = measurements.rect(focus);
      if (this.ring.hidden) this.ring.hidden = false;
      this.place(this.ring, rect.left - 3, rect.top - 3, rect.width + 6, rect.height + 6);
    } else if (!this.ring.hidden) this.ring.hidden = true;
  }

  protected place(node: HTMLElement, x: number, y: number, width: number, height: number): void {
    const origin = this.origin;
    const values = { left: `${x - origin.left}px`, top: `${y - origin.top}px`, width: `${width}px`, height: `${height}px` };
    for (const [key, value] of Object.entries(values)) if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  }

  hide(): void { this.host.remove(); }
  destroy(): void { this.hide(); }
}
