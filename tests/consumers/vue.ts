import { createSSRApp, h, ref, resolveDirective, withDirectives, onMounted } from 'vue';
import { createGamepadifyPlugin, useGamepadify } from 'gamepadify-vue';
import type { GamepadifyOptions } from 'gamepadify';

export function makeApp(options: GamepadifyOptions = {}) {
  const app = createSSRApp({
    setup() {
      const count = ref(0), show = ref(true);
      const pad = useGamepadify();
      onMounted(() => Object.assign(window, { pad, toggle: () => { show.value = !show.value; } }));
      return () => h('div', [h('output', { id: 'count' }, String(count.value)), show.value && withDirectives(h('button', { id: 'action', onClick: () => count.value++ }, 'Action'), [[resolveDirective('gamepad')!, 'west']])]);
    },
  });
  app.use(createGamepadifyPlugin(options));
  return app;
}
