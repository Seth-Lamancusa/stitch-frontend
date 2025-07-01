<template>
  <InfoViewLayout
    pageTitle="Nonlinear Group Chats<br>with AI"
    pageSubtitle="Connect, compare, share."
    heroClass="home-hero"
    :showBetaBanner="true"
    betaBannerIcon="🚀"
    betaBannerTitle="Stitch alpha is now live"
    footerTagline="Collaborate with humans, with AI."
  >
    <template #betaBannerText>
      Working with select testers. <router-link to='/requests' class='banner-link'>Join the waitlist</router-link>.
    </template>
    <section class="home-main">
      <div class="container">
        <div class="home-main-content">
          <div class="branching-graph"></div>
          <div class="content-columns">
            <div class="home-main-content-1">
              <h2>Connecting ideas, connecting minds</h2>
              <p>Engage in multi-threaded conversations with bot and human users alike, generating and evaluating ideas, linking them together, and branching them off in new directions.</p>
            </div>
            <div class="home-main-content-2">
              <h2>Compare responses<br>in real time</h2>
              <p>Easily send messages to multiple users at a time or share them publicly, receiving various chatbot and human responses.</p>
            </div>
            <div class="home-main-content-3">
              <h2>Share your conversations with others</h2>
              <p>Each message comes with a URL, allowing you to easily share them with others to respond or spin off in their own directions.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- <section class="coming-soon-section">
      <div class="container">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">🏗️</div>
          <h2>Website Under Construction</h2>
          <p>We're building something amazing. Our full website will be available soon.</p>
          <router-link to="/inbox" class="btn primary-btn">Go to Stitch App</router-link>
        </div>
      </div>
    </section> -->
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

.banner-link {
  color: #b8a5ff;
  text-decoration: none;
  font-weight: 500;
}

.banner-link:hover {
  text-decoration: underline;
  opacity: 0.9;
}

.home-main {
  padding: 0 0;
  background: var(--background-dark);
}

.home-main-content {
  max-width: 1200px;
  margin: 0 0 76px 0;
}

.branching-graph {
  margin-bottom: 4rem;
  display: flex;
  justify-content: center;
}

.content-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  text-align: center;
}

.content-columns h2 {
  font-size: 1.5rem;
  color: var(--color-primary, #4f8cff);
  margin-bottom: 1rem;
}

/* Mobile styles */
@media (max-width: 768px) {
  .home-main {
    padding: 2rem 0;
  }
  
  .content-columns {
    grid-template-columns: 1fr !important;
    gap: 2.5rem;
    padding: 0 1rem;
  }
  
  .content-columns h2 {
    font-size: 1.3rem;
  }
  
  .content-columns p {
    font-size: 0.95rem;
    line-height: 1.5;
  }
  
  .branching-graph {
    margin-bottom: 2.5rem;
  }
}

@media (max-width: 480px) {
  .content-columns {
    grid-template-columns: 1fr !important;
    gap: 2rem;
  }
  
  .content-columns h2 {
    font-size: 1.2rem;
  }
  
  .content-columns p {
    font-size: 0.9rem;
  }
}

</style> 