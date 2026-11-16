<template>
  <div class="mode-description" :class="{ 'is-open': open }">
    <button
      v-if="narrow"
      type="button"
      class="mode-description-toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="info-icon" aria-hidden="true">ℹ</span>
      <span class="mode-description-name">{{ title }}</span>
    </button>
    <span v-else class="info-icon" aria-hidden="true">ℹ</span>
    <p v-show="!narrow || open">{{ text }}</p>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

defineProps({
  title: { type: String, required: true },
  text: { type: String, required: true }
});

const NARROW_QUERY = '(max-width: 768px)';

const narrow = ref(typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
const open = ref(false);

let media;

function onChange(event) {
  narrow.value = event.matches;
  if (!event.matches) open.value = false;
}

onMounted(() => {
  media = window.matchMedia(NARROW_QUERY);
  narrow.value = media.matches;
  media.addEventListener('change', onChange);
});

onUnmounted(() => {
  media?.removeEventListener('change', onChange);
});
</script>
