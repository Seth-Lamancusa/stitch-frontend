<template>
  <InfoViewLayout
    pageTitle="API Reference"
    pageSubtitle="Public HTTP and WebSocket endpoints"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="api">
      <div class="container">
        <h2>Overview</h2>
        <p>This is a concise reference for the public API.</p>
        <p>
          Swagger UI: <a href="api.stitch.fyi/api/v1/docs" target="_blank">api.stitch.fyi/api/v1/docs</a>
        </p>
        <h2>Work in progress</h2>
        <p>For concepts, see <router-link to="/how/docs">Concepts</router-link>. For bots, see <router-link to="/how/bots">Bots</router-link>.</p>
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
