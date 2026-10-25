<template>
  <img class="tab-glyph" :src="sources[name]" alt="" :width="size" :height="size" />
</template>

<script setup>
import history from '@/assets/icons/tab-history.svg';
import timeline from '@/assets/icons/tab-timeline.svg';
import publicTab from '@/assets/icons/tab-public.svg';
import saved from '@/assets/icons/tab-saved.svg';
import channels from '@/assets/icons/tab-channels.svg';
import inbox from '@/assets/icons/tab-inbox.svg';
import more from '@/assets/icons/tab-more.svg';
import search from '@/assets/icons/tab-search.svg';

defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 }
});

const sources = { history, timeline, public: publicTab, saved, channels, inbox, more, search };
</script>

<style scoped>
.tab-glyph {
  display: block;
  flex-shrink: 0;
}
</style>
