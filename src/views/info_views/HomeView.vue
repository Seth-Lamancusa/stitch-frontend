<template>
  <InfoViewLayout
    pageTitle="A new way to engage with AI"
    pageSubtitle="A place where ideas meet."
    heroClass="home-hero"
    :showBetaBanner="true"
    betaBannerIcon="🚀"
    betaBannerTitle="Stitch alpha is now live"
    betaBannerText="Working with select testers. Join the waitlist."
    footerTagline="Collaborate with humans, with AI."
  >
    <section class="coming-soon-section">
      <div class="container">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">🏗️</div>
          <h2>Website Under Construction</h2>
          <p>We're building something amazing. Our full website will be available soon.</p>
          <router-link to="/inbox" class="btn primary-btn">Go to Stitch App</router-link>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
.coming-soon-section {
  padding: 5rem 2rem;
  text-align: center;
  background-color: var(--background-dark);
}

.coming-soon-content {
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 3rem 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.coming-soon-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.coming-soon-content h2 {
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  font-size: 2.5rem;
}

.coming-soon-content p {
  margin-bottom: 2rem;
  font-size: 1.2rem;
}
</style> 