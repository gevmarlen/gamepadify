<script setup lang="ts">
import { ref } from 'vue';
import { useGamepadify } from 'gamepadify-vue';
const count = ref(0);
useGamepadify();
</script>

<template>
  <h1>Vue</h1>
  <p>Press a controller button to start. West saves; south activates the focused card.</p>
  <button v-gamepad="'west'" @click="count++">Save</button>
  <section>
    <button v-gamepad-focusable @click="count++">First card</button>
    <button v-gamepad-focusable @click="count++">Second card</button>
  </section>
  <output>{{ count }} actions</output>
</template>
