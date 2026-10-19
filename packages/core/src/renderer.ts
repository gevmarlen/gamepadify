import { buttonLabel } from './buttons.js';
import { FocusRenderer } from './focus-renderer.js';
import type { RenderState } from './features.js';
import type { Glyph, HintOptions, PhysicalButton } from './types.js';

export interface HintTarget { element: HTMLElement; buttons: readonly PhysicalButton[]; options?: HintOptions }

export class Renderer extends FocusRenderer {
  private hints = new Map<HTMLElement, { node: HTMLDivElement; key: string }>();

  override measure<T>(read: () => T): T {
    if (this.hints.size < 100 || !this.host.isConnected) return read();
    // Hit-testing still traverses pointer-transparent descendants in Chromium.
    const property = 'contentVisibility' in this.host.style ? 'contentVisibility' : 'visibility';
    const previous = this.host.style[property];
    this.host.style[property] = 'hidden';
    try { return read(); } finally { this.host.style[property] = previous; }
  }

  override render(state: RenderState): void {
    super.render(state);
    const { visible, focused, confirm, entries, family, measurements } = state;
    const defaults = state.options.hints ?? {};
    const showHints = state.options.showHints !== false;
    const targets: HintTarget[] = showHints ? visible.filter(entry => entry.element.isConnected).map(entry => ({ element: entry.element, buttons: entry.buttons, options: entry.binding.hint })) : [];
    if (showHints && focused && confirm && measurements.onScreen(focused)) {
      const index = targets.findIndex(hint => hint.element === focused);
      const hint = { element: focused, buttons: [confirm], options: entries.find(entry => entry.element === focused)?.binding.hint };
      if (index < 0) targets.push(hint); else targets[index] = hint;
    }
    const wanted = new Set<HTMLElement>();
    const cssSize = targets.length ? Number.parseFloat(measurements.style(this.host).getPropertyValue('--gamepadify-size')) || 24 : 24;
    const base = { size: cssSize, placement: 'top-end' as const, offset: 6, offsetX: 0, offsetY: 0, ...defaults };
    const images: { glyph: HTMLElement; fallback: HTMLElement; source?: Glyph; size: number }[] = [];
    if (showHints) for (const target of targets) {
      wanted.add(target.element);
      const options = target.options ? { ...base, ...target.options } : base;
      const skin = options.skin ?? 'auto';
      const selectedFamily = typeof skin === 'string' && skin !== 'auto' ? skin : family;
      const skinKey = typeof skin === 'object' ? JSON.stringify(target.buttons.map(button => skin.glyphs[button])) : '';
      const key = `${target.buttons.join('+')}:${selectedFamily}:${skinKey}:${options.size}`;
      let hint = this.hints.get(target.element);
      if (!hint) {
        const node = this.document.createElement('div');
        node.className = 'gamepadify-hint';
        this.host.append(node);
        hint = { node, key: '' };
        this.hints.set(target.element, hint);
      }
      if (hint.key !== key) {
        const node = hint.node;
        node.replaceChildren();
        node.style.setProperty('--gamepadify-size', `${options.size}px`);
        target.buttons.forEach((button, index) => {
          if (index) {
            const separator = this.document.createElement('span');
            separator.className = 'gamepadify-plus';
            separator.textContent = '+';
            node.append(separator);
          }
          const glyph = this.document.createElement('span');
          glyph.className = 'gamepadify-glyph';
          glyph.dataset.button = button;
          glyph.dataset.family = selectedFamily;
          node.append(glyph);
          const custom = typeof skin === 'object' ? skin.glyphs[button] : undefined;
          const label = typeof custom === 'object' ? custom.label : undefined;
          const fallback = this.document.createElement('span');
          fallback.textContent = label ?? buttonLabel(button, selectedFamily);
          glyph.append(fallback);
          if (custom) glyph.dataset.family = 'custom';
          if (custom || selectedFamily !== 'generic') images.push({ glyph, fallback, source: typeof custom === 'string' ? { url: custom } : custom, size: options.size });
        });
        hint.key = key;
      }
      const rect = measurements.rect(target.element);
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
    const sources = images.map(({ glyph, source }) => {
      const url = source ? '' : measurements.style(glyph).backgroundImage;
      return source ?? (url && url !== 'none' ? { url: url.replace(/^url\(["']?|["']?\)$/g, '') } : undefined);
    });
    images.forEach(({ glyph, fallback, size }, index) => {
      const source = sources[index];
      if (!source) return;
      const img = this.document.createElement('img');
      img.alt = '';
      img.addEventListener('load', () => {
        if (source.atlas) {
          const a = source.atlas;
          glyph.style.backgroundImage = `url(${JSON.stringify(source.url)})`;
          glyph.style.backgroundSize = `${a.sheetWidth / a.width * size}px ${a.sheetHeight / a.height * size}px`;
          glyph.style.backgroundPosition = `${-a.x / a.width * size}px ${-a.y / a.height * size}px`;
          img.hidden = true;
        }
        fallback.hidden = true;
      });
      img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
      img.src = source.url;
      glyph.append(img);
    });
  }

  override destroy(): void { super.destroy(); this.hints.clear(); }
}
