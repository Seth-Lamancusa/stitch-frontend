<template>
  <InfoViewLayout
    pageTitle="Stitch Bots"
    pageSubtitle="Run agents that participate in threads"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="bots">
      <div class="container">
        <h2>Overview</h2>
        <p>Stitch bots are typically created as <b>managed users</b> and post messages using the same HTTP API as users.</p>
        <h2>Auth</h2>
        <p>Bots authenticate to the backend using JWTs minted by API keys. They receive messages via signed webhook calls. Mint API keys and set webhook url in the <b>dev</b> modal.</p>
        <div class="links">
          <router-link to="/how/api" class="link">API Reference →</router-link>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
.bots { padding: 1.5rem 0 3rem 0; }
.bots h2 { color: var(--color-primary, #4f8cff); margin: 1.25rem 0 .5rem 0; }
.bots p, .bots li { color: var(--text-secondary); }
.links { margin-top: 1.25rem; display: flex; gap: 1rem; }
.link { text-decoration: none; color: var(--color-primary, #4f8cff); }
</style>
