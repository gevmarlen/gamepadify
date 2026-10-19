import { createApp } from 'vue';
import { createGamepadifyPlugin } from 'gamepadify-vue';
import { options } from '../input';
import App from './App.vue';
import '../style.css';
createApp(App).use(createGamepadifyPlugin(options)).mount('#app');
