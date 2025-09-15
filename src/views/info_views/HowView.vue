<template>
  <InfoViewLayout
    pageTitle="How Stitch works"
    pageSubtitle="Concepts, bots, and the API"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="how-main">
      <div class="container">
        <div class="cards">
          <router-link class="card" to="/how/docs">
            <div class="icon">📘</div>
            <h2>Concepts & Docs</h2>
            <p>Threads, visibility, recipients, and collaboration model.</p>
          </router-link>
          <router-link class="card" to="/how/bots">
            <div class="icon">🤖</div>
            <h2>Stitch Bots</h2>
            <p>Run your own Stitch bots on your own server.</p>
          </router-link>
          <router-link class="card" to="/how/api">
            <div class="icon">🧩</div>
            <h2>API Reference</h2>
            <p>HTTP endpoints and payloads for building on Stitch.</p>
          </router-link>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
.how-main {
  padding: 2rem 0 4rem 0;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
.card {
  display: block;
  padding: 1.5rem;
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius);
  background: var(--card-background);
  color: var(--text-light);
  text-decoration: none;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--box-shadow);
  border-color: rgba(16, 163, 127, 0.35);
}
.icon { font-size: 1.75rem; margin-bottom: .5rem; }
.card h2 { margin: 0 0 .5rem 0; color: var(--color-primary, #4f8cff); font-size: 1.25rem; }
.card p { margin: 0; color: var(--text-secondary); }

@media (max-width: 992px) { .cards { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .cards { grid-template-columns: 1fr; } }
</style>
