<template>
  <svg
    class="default-outgoing-star"
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M8 1.1 9.72 5.62 14.7 5.82 10.78 8.86 12.14 13.7 8 10.96 3.86 13.7 5.22 8.86 1.3 5.82 6.28 5.62 8 1.1Z"
    />
  </svg>
</template>

<script>
export default {
  name: 'DefaultOutgoingStar',
  props: {
    size: {
      type: [Number, String],
      default: 12
    }
  }
};
</script>

<style scoped>
.default-outgoing-star {
  display: block;
  flex-shrink: 0;
}
</style>
