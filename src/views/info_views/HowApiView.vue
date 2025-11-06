<template>
  <InfoViewLayout
    pageTitle="API Reference"
    pageSubtitle="Public HTTP and WebSocket endpoints"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="api">
      <div class="container">
        <h2>Available for select partners<h2>
        <p>
          Swagger UI: <a href="api.stitch.fyi/api/v1/docs" target="_blank">api.stitch.fyi/api/v1/docs</a>
        </p>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
.api { padding: 1.5rem 0 3rem 0; }
.api h2 { color: var(--color-primary, #4f8cff); margin: 1.25rem 0 .5rem 0; }
.api p, .api li { color: var(--text-secondary); }
</style>
