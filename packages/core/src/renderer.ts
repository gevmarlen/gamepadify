import { buttonLabel } from './buttons.js';
import type { Family, HintOptions, PhysicalButton } from './types.js';

export interface HintTarget { element: HTMLElement; buttons: readonly PhysicalButton[]; options?: HintOptions }

export class Renderer {
  readonly host: HTMLDivElement;
  private ring: HTMLDivElement;
  private hints = new Map<HTMLElement, { node: HTMLDivElement; key: string }>();

  constructor(private document: Document) {
    this.host = document.createElement('div');
    this.host.className = 'gamepadify-layer';
    this.host.setAttribute('aria-hidden', 'true');
    this.ring = document.createElement('div');
    this.ring.className = 'gamepadify-focus';
    this.host.append(this.ring);
  }

  render(targets: readonly HintTarget[], focus: HTMLElement | null, scope: Document | HTMLElement, family: Family, defaults: HintOptions, showHints: boolean): void {
    const dialog = scope.nodeType === 1 ? (scope as HTMLElement).closest('dialog[open]') : null;
    const parent = dialog ?? this.document.body;
    if (this.host.parentElement !== parent) parent.append(this.host);
    this.host.hidden = false;
    if (focus) {
      const rect = focus.getBoundingClientRect();
      this.ring.hidden = false;
      this.place(this.ring, rect.left - 3, rect.top - 3, rect.width + 6, rect.height + 6);
    } else this.ring.hidden = true;

    const wanted = new Set<HTMLElement>();
    const cssSize = Number.parseFloat(this.document.defaultView!.getComputedStyle(this.host).getPropertyValue('--gamepadify-size')) || 24;
    if (showHints) for (const target of targets) {
      wanted.add(target.element);
      const options = { size: cssSize, placement: 'top-end' as const, offset: 6, offsetX: 0, offsetY: 0, ...defaults, ...target.options };
      const skin = options.skin ?? 'auto';
      const selectedFamily = typeof skin === 'string' && skin !== 'auto' ? skin : family;
      const key = JSON.stringify([target.buttons, selectedFamily, skin, options.size]);
      let hint = this.hints.get(target.element);
      if (!hint) {
        const node = this.document.createElement('div');
        node.className = 'gamepadify-hint';
        this.host.append(node);
        hint = { node, key: '' };
        this.hints.set(target.element, hint);
      }
      if (hint.key !== key) {
        hint.node.replaceChildren();
        hint.node.style.setProperty('--gamepadify-size', `${options.size}px`);
        target.buttons.forEach((button, index) => {
          if (index) {
            const separator = this.document.createElement('span');
            separator.className = 'gamepadify-plus';
            separator.textContent = '+';
            hint!.node.append(separator);
          }
          const glyph = this.document.createElement('span');
          glyph.className = 'gamepadify-glyph';
          glyph.dataset.button = button;
          glyph.dataset.family = selectedFamily;
          hint!.node.append(glyph);
          const custom = typeof skin === 'object' ? skin.glyphs[button] : undefined;
          const label = typeof custom === 'object' ? custom.label : undefined;
          const fallback = this.document.createElement('span');
          fallback.textContent = label ?? buttonLabel(button, selectedFamily);
          glyph.append(fallback);
          if (custom) {
            const source = typeof custom === 'string' ? { url: custom } : custom;
            glyph.dataset.family = 'custom';
            const img = this.document.createElement('img');
            img.alt = '';
            img.src = source.url;
            img.addEventListener('load', () => {
              if (source.atlas) {
                const a = source.atlas;
                glyph.style.backgroundImage = `url(${JSON.stringify(source.url)})`;
                glyph.style.backgroundSize = `${a.sheetWidth / a.width * options.size}px ${a.sheetHeight / a.height * options.size}px`;
                glyph.style.backgroundPosition = `${-a.x / a.width * options.size}px ${-a.y / a.height * options.size}px`;
                img.hidden = true;
              }
              fallback.hidden = true;
            });
            img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
            glyph.append(img);
          } else if (selectedFamily !== 'generic') {
            const url = this.document.defaultView!.getComputedStyle(glyph).backgroundImage;
            if (url && url !== 'none') {
              const img = this.document.createElement('img');
              img.alt = '';
              img.src = url.replace(/^url\(["']?|["']?\)$/g, '');
              img.addEventListener('load', () => { fallback.hidden = true; });
              img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
              glyph.append(img);
            }
          }
        });
        hint.key = key;
      }
      const rect = target.element.getBoundingClientRect();
      const width = target.buttons.length * options.size + Math.max(0, target.buttons.length - 1) * 14;
      const height = options.size;
      const placement = options.placement;
      let x = placement.endsWith('start') ? rect.left : placement.endsWith('end') ? rect.right - width : rect.left + (rect.width - width) / 2;
      let y = placement.startsWith('bottom') ? rect.bottom + options.offset : rect.top - height - options.offset;
      if (placement === 'left' || placement === 'right') { x = placement === 'left' ? rect.left - width - options.offset : rect.right + options.offset; y = rect.top + (rect.height - height) / 2; }
      x += options.offsetX; y += options.offsetY;
      const view = this.document.defaultView!;
      this.place(hint.node, Math.max(2, Math.min(x, view.innerWidth - width - 2)), Math.max(2, Math.min(y, view.innerHeight - height - 2)), width, height);
    }
    for (const [element, hint] of this.hints) if (!wanted.has(element)) { hint.node.remove(); this.hints.delete(element); }
  }

  private place(node: HTMLElement, x: number, y: number, width: number, height: number): void {
    const origin = this.host.getBoundingClientRect();
    const values = { left: `${x - origin.left}px`, top: `${y - origin.top}px`, width: `${width}px`, height: `${height}px` };
    for (const [key, value] of Object.entries(values)) if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  }

  hide(): void { this.host.remove(); }
  destroy(): void { this.host.remove(); this.hints.clear(); }
}
