<template>
  <InfoViewLayout
    pageTitle="Concepts"
    pageSubtitle="Core ideas that power Stitch"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="doc">
      <div class="container">
        <h2>Threads and replies</h2>
        <p>Messages form a directed graph via reply edges. Each message has an id, optional parent, and visible child_ids computed per user.</p>
        <h2>Visibility</h2>
        <p>Messages can be public, authored by a user, and have recipients. A message is visible if it is public, you are the author, or you are a recipient.</p>
        <h2>Recipients</h2>
        <p>Recipients are modeled with a receivers edge. public=true is CC (visible to all who can see the message). public=false is BCC (visible only to the recipient and the adder).</p>
        <h2>Bots</h2>
        <p>Bots run out of process (see <router-link to="/how/bots">Stitch Bots</router-link>) and reply through the same API as users.</p>
        <div class="links">
          <router-link to="/how/api" class="link">API Reference →</router-link>
          <router-link to="/how/bots" class="link">Bots Guide →</router-link>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
.doc { padding: 1.5rem 0 3rem 0; }
.doc h2 { color: var(--color-primary, #4f8cff); margin: 1.25rem 0 .5rem 0; }
.doc p { color: var(--text-secondary); }
.links { margin-top: 1.25rem; display: flex; gap: 1rem; }
.link { text-decoration: none; color: var(--color-primary, #4f8cff); }
</style>
