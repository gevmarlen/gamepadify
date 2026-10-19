import type {} from 'jquery';
import type { GamepadifyController, GamepadifyFactory, GamepadifyOptions } from 'gamepadify';

declare global {
  interface JQuery {
    gamepadify(options?: GamepadifyOptions): this;
    gamepadify(command: 'instance'): GamepadifyController | undefined;
    gamepadify(command: 'start' | 'stop' | 'destroy'): this;
    gamepadify(command: 'configure', options: Partial<GamepadifyOptions>): this;
  }
}

const installations = new WeakSet<JQueryStatic>();

export function install($: JQueryStatic, factory: GamepadifyFactory): void {
  if (installations.has($)) return;
  if (Object.prototype.hasOwnProperty.call($.fn, 'gamepadify')) throw new Error('A different gamepadify plugin is already installed.');
  const controllers = new WeakMap<Document | HTMLElement, GamepadifyController>();
  $.fn.gamepadify = function (this: JQuery, input?: GamepadifyOptions | 'instance' | 'start' | 'stop' | 'destroy' | 'configure', options?: Partial<GamepadifyOptions>) {
    if (input === 'instance') return this[0] ? controllers.get(this[0] as HTMLElement) : undefined;
    this.each(function () {
      const root = this as HTMLElement;
      let controller = controllers.get(root);
      if (typeof input === 'string') {
        if (!controller) return;
        if (input === 'configure') controller.configure({ ...options, root });
        else if (input === 'destroy') { try { controller.destroy(); } finally { controllers.delete(root); } }
        else controller[input]();
      } else {
        if (controller) controller.configure({ ...input, root });
        else { controller = factory({ ...input, root }); controllers.set(root, controller); }
        controller.start();
      }
    });
    return this;
  } as JQuery['gamepadify'];
  installations.add($);
}

export type { GamepadifyOptions } from 'gamepadify';
