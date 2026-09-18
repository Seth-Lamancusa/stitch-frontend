<template>
  <div class="compact-author-actions" @click.stop>
    <CompactActionButton :action="recipientsAction" />
    <CompactActionButton
      v-for="action in headerActions"
      :key="action.id"
      :action="action"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import CompactActionButton from './CompactActionButton.vue'

const props = defineProps({
  headerActions: { type: Array, default: () => [] },
  recipientCount: { type: Number, default: 0 },
  onRecipients: { type: Function, required: true }
})

const recipientsAction = computed(() => ({
  id: 'recipients',
  emoji: '👥',
  text: `Recipients (${props.recipientCount})`,
  handler: props.onRecipients
}))
</script>

<style scoped>
.compact-author-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
</style>
