import { createSSRApp, h, reactive, ref, resolveDirective, withDirectives, onMounted } from 'vue';
import { createGamepadifyPlugin, useGamepadify } from 'gamepadify-vue';
import type { Binding, Button, GamepadifyOptions } from 'gamepadify';

export function makeApp(options: GamepadifyOptions = {}) {
  const app = createSSRApp({
    setup() {
      const count = ref(0), show = ref(true);
      const revision = ref(0), binding = reactive<Binding>({ button: 'west' });
      const pad = useGamepadify();
      onMounted(() => Object.assign(window, { pad, changeBinding: (button: Button) => { binding.button = button; }, rerender: () => revision.value++, toggle: () => { show.value = !show.value; } }));
      return () => h('div', { 'data-revision': revision.value }, [h('output', { id: 'count' }, String(count.value)), show.value && withDirectives(h('button', { id: 'action', onClick: () => count.value++ }, 'Action'), [[resolveDirective('gamepad')!, binding]])]);
    },
  });
  app.use(createGamepadifyPlugin(options));
  return app;
}
