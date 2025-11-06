<template>
  <InfoViewLayout
    pageTitle="Features"
    pageSubtitle="Everything you need for collaborative conversations with AI"
    heroClass="featured-hero"
    :showBetaBanner="false"
  >
    <section class="features-main">
      <div class="container">
        <div class="features-grid">

          <!-- AI Integration -->
          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <h3>AI Responses</h3>
            <p>Integrate chatbots into your conversations by mentioning them. They'll automatically respond in the same thread.</p>
            <ul class="feature-list">
              <li>Support for the biggest AI models (ChatGPT, Claude, Grok, and Gemini) with more on the way.</li>
              <li>Prompt multiple bots at a time.</li>
              <li>Prompt bots to reply to each other</li>
            </ul>
          </div>

          <!-- Messaging -->
          <div class="feature-card">
            <div class="feature-icon">💬</div>
            <h3>Group Messaging</h3>
            <p>Organize conversations with branching threads that keep discussions focused and easy to follow. Each message can spawn its own conversation path.</p>
            <ul class="feature-list">
              <li>Branch threads into multiple conversations.</li>
              <li>Get notified of new unread messages in your inbox.</li>
              <li>Control who can see your messages.</li>
            </ul>
          </div>

          <!-- Organization -->
          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>Organization Tools</h3>
            <p>Keep track of conversations, prompts, and responses in the way that works for you. Organization is collaborative — anyone who can see a message can help tag and link it.</p>
            <ul class="feature-list">
              <li>Save messages and prompts you want to remember.</li>
              <li>Tag messages to organize and find them quickly.</li>
              <li>Link messages to other messages you can see.</li>
              <li>Post messages to group channels (coming soon).</li>
            </ul>
          </div>

        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style scoped>
.features-main {
  padding: 4rem 0;
  background: var(--background-dark);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.feature-card {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 2rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(16, 163, 127, 0.15);
  border-color: rgba(16, 163, 127, 0.3);
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--gradient-primary);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.feature-card h3 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.4rem;
  font-weight: 600;
}

.feature-card p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-list li {
  color: var(--text-light);
  padding: 0.5rem 0;
  position: relative;
  padding-left: 1.5rem;
  font-size: 0.9rem;
}

.feature-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-primary);
  font-weight: bold;
}

/* Call to Action Section */
.features-cta {
  text-align: center;
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 3rem 2rem;
  margin-top: 3rem;
}

.features-cta h2 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 2.2rem;
}

.features-cta p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2rem;
  border-radius: var(--border-radius-md);
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  font-size: 1rem;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 163, 127, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 163, 127, 0.4);
}

.btn-secondary {
  background: transparent;
  color: var(--text-light);
  border: 2px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--card-background);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .feature-card {
    padding: 1.5rem;
  }
  
  .features-cta {
    padding: 2rem 1rem;
  }
  
  .features-cta h2 {
    font-size: 1.8rem;
  }
  
  .cta-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .btn {
    width: 100%;
    max-width: 250px;
  }
}

@media (max-width: 480px) {
  .features-main {
    padding: 2rem 0;
  }
  
  .feature-card {
    padding: 1.25rem;
  }
  
  .feature-icon {
    font-size: 2.5rem;
  }
  
  .feature-card h3 {
    font-size: 1.2rem;
  }
  
  .features-cta h2 {
    font-size: 1.6rem;
  }
}
</style> 