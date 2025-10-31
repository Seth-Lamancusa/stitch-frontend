<template>
  <InfoViewLayout
    pageTitle="Stitch Chats"
    pageSubtitle="Interact with podcasts by joining the conversation yourself"
    heroClass="chats-hero"
    :showBetaBanner="false"
  >
    <!-- Coming Soon Section -->
    <section class="coming-soon-section">
      <div class="container">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">🎙️</div>
          <h2>Coming Soon</h2>
          <p>
            Podcast transcripts are uploaded to Stitch, where you can reply to anything a speaker said yourself. They can write back in the same Stitch thread.
          </p>
        </div>
      </div>
    </section>

  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style scoped>
.coming-soon-section {
  padding: 5rem 2rem;
  text-align: center;
  background-color: var(--background-dark);
}

.coming-soon-content {
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--card-background);
  border-radius: var(--border-radius-lg);
  padding: 3rem 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.coming-soon-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.coming-soon-content h2 {
  color: var(--color-primary);
  margin-bottom: 1.5rem;
  font-size: 2.5rem;
}

.coming-soon-content p {
  color: var(--text-secondary);
  margin-bottom: 0;
  font-size: 1.2rem;
  line-height: 1.6;
}

.preview-section {
  padding: 4rem 2rem;
  background: var(--background-dark);
}

.preview-section h2 {
  text-align: center;
  color: var(--color-primary);
  font-size: 2rem;
  margin-bottom: 3rem;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.preview-card {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 2rem;
  text-align: center;
  transition: all 0.3s ease;
}

.preview-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(16, 163, 127, 0.15);
  border-color: rgba(16, 163, 127, 0.3);
}

.preview-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.preview-card h3 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.4rem;
  font-weight: 600;
}

.preview-card p {
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .coming-soon-section {
    padding: 3rem 1rem;
  }
  
  .coming-soon-content {
    padding: 2rem 1.5rem;
  }
  
  .coming-soon-icon {
    font-size: 3rem;
  }
  
  .coming-soon-content h2 {
    font-size: 2rem;
  }
  
  .coming-soon-content p {
    font-size: 1rem;
  }
  
  .preview-section {
    padding: 3rem 1rem;
  }
  
  .preview-section h2 {
    font-size: 1.6rem;
    margin-bottom: 2rem;
  }
  
  .preview-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

@media (max-width: 480px) {
  .coming-soon-content {
    padding: 1.5rem 1rem;
  }
  
  .coming-soon-icon {
    font-size: 2.5rem;
  }
  
  .coming-soon-content h2 {
    font-size: 1.6rem;
  }
  
  .preview-card {
    padding: 1.5rem;
  }
}
</style>


