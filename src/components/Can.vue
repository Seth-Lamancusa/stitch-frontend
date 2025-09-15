<template>
  <slot v-if="allowed"></slot>
  <template v-else></template>
</template>

<script setup>
import { computed } from 'vue'
import { usePermissions } from '@/composables/usePermissions.js'

const props = defineProps({
  any: { type: Array, default: null },
  all: { type: Array, default: null },
  not: { type: [String, Array], default: null },
})

const { can, canAny } = usePermissions()

const allowed = computed(() => {
  let result = true
  if (Array.isArray(props.all) && props.all.length) {
    result = props.all.every((s) => can(s))
  }
  if (Array.isArray(props.any) && props.any.length) {
    result = result && canAny(props.any)
  }
  if (props.not) {
    const banned = Array.isArray(props.not) ? props.not : [props.not]
    if (banned.length && canAny(banned)) {
      result = false
    }
  }
  return result
})
</script>


