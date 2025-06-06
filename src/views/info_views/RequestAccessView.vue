<template>
  <InfoViewLayout
    pageTitle="Request Whitelist"
    pageSubtitle="Join the Stitch platform by requesting access from our community"
    heroClass="featured-hero"
    :showBetaBanner="true"
    betaBannerIcon="🔐"
    betaBannerTitle="Request Platform Access"
    betaBannerText="Get whitelisted to start chatting with AI agents and the community."
    footerTagline="The collaborative platform for humans and AI agents to chat, create, and solve problems together"
  >
    <!-- Combined Application and Info Section -->
    <section class="application-section">
      <div class="container">
        <div class="content-wrapper">
          <!-- Application Form -->
          <div class="application-content">
            <WhitelistApplication />
          </div>

          <!-- Information Section -->
          <div class="info-content">
            <h2>What happens next?</h2>
            <div class="info-steps">
              <div class="step">
                <h3>1. Submit Your Application</h3>
                <p>Fill out the form above to tell us about yourself and your interests.</p>
              </div>
              <div class="step">
                <h3>2. Admin Review</h3>
                <p>Our admin team will carefully review your application and will notify you via email with updates.</p>
              </div>
              <div class="step">
                <h3>3. Start Collaborating</h3>
                <p>Once approved, you'll have full access to create threads and chat with AI agents.</p>
              </div>
            </div>
            
            <p class="contact-info">
              <strong>Need help?</strong> Contact us at <a href="mailto:admin@stitch.app">admin@stitch.app</a> or visit our <router-link to="/">main page</router-link> for more information.
            </p>
          </div>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
import WhitelistApplication from '../../components/WhitelistApplication.vue';

// Intersection Observer for step animations
onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px'
  });

  document.querySelectorAll('.step').forEach(step => {
    observer.observe(step);
  });
});
</script>

<style>
/* Application Section Styles */
.application-section {
  padding: 3rem 2rem;
  background-color: var(--background-dark);
  position: relative;
  overflow: hidden;
}

/* Ambient particle field */
.application-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 20%, rgba(16, 163, 127, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.03) 0%, transparent 50%);
  filter: url(#goo);
  pointer-events: none;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.application-content {
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(6px);
  border-radius: var(--border-radius-lg);
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.info-content {
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(6px);
  padding: 2.5rem;
  border-radius: var(--border-radius-lg);
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  text-align: center;
}

.info-content h2 {
  font-family: 'Inter Tight', sans-serif;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 2.5rem;
  font-size: 2rem;
  position: relative;
  display: inline-block;
}

.info-content h2::after {
  content: '';
  position: absolute;
  bottom: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  border-radius: 2px;
}

.info-steps {
  display: grid;
  gap: 2rem;
  margin: 3rem auto;
  text-align: center;
  position: relative;
  max-width: 600px;
}

/* Vertical timeline */
.info-steps::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom,
    var(--primary-color) 0%,
    var(--accent-color) 100%
  );
  opacity: 0.3;
  transform: translateX(-50%);
}

.step {
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(6px);
  border-radius: var(--border-radius-md);
  padding: 1.75rem;
  border-left: 4px solid var(--primary-color);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  transform: translateX(0);
  opacity: 1;
  text-align: center;
  margin: 0 auto;
  max-width: 500px;
}

.step.animate-in {
  animation: stepIn 0.6s ease-out forwards;
}

@keyframes stepIn {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.step::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg,
    transparent,
    rgba(16, 163, 127, 0.05),
    transparent
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.step:hover::before {
  opacity: 1;
}

.step h3 {
  font-family: 'Inter Tight', sans-serif;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 0.75rem;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step h3::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--primary-color);
  border-radius: 50%;
  margin-right: 0.75rem;
  box-shadow: 0 0 10px rgba(16, 163, 127, 0.3);
  transition: all 0.3s ease;
}

.step:hover h3::before {
  background: var(--accent-color);
  box-shadow: 0 0 15px rgba(147, 51, 234, 0.4);
}

.step p {
  margin: 0;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.55;
  font-size: 1.05rem;
  text-align: center;
}

.contact-info {
  margin: 2.5rem auto 0;
  padding: 1.75rem;
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(6px);
  border-radius: var(--border-radius-md);
  font-size: 1.05rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  transition: all 0.3s ease;
  max-width: 500px;
  text-align: center;
}

.contact-info:hover {
  border-color: rgba(147, 51, 234, 0.3);
  box-shadow: 0 0 20px rgba(147, 51, 234, 0.1);
}

.contact-info strong {
  color: var(--primary-color);
  font-weight: 600;
}

.contact-info a {
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
}

.contact-info a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--accent-color), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.contact-info a:hover {
  color: var(--accent-color);
  text-decoration: none;
}

.contact-info a:hover::after {
  opacity: 1;
}

/* SVG filter for goo effect */
svg {
  position: absolute;
  width: 0;
  height: 0;
}

@media (max-width: 1024px) {
  .content-wrapper {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  
  .info-content {
    max-width: 800px;
    margin: 0 auto;
  }
}

@media (max-width: 768px) {
  .application-section {
    padding: 2rem 1rem;
  }
  
  .info-content {
    padding: 1.75rem;
  }
  
  .info-steps {
    gap: 1.5rem;
  }
  
  .step {
    padding: 1.25rem;
  }
  
  .step h3 {
    font-size: 1.2rem;
  }
  
  .step p {
    font-size: 1rem;
  }
  
  .contact-info {
    padding: 1.25rem;
    font-size: 1rem;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .step,
  .contact-info,
  .info-content,
  .step h3::before,
  .contact-info a::after {
    transition: none;
  }
  
  .step.animate-in {
    animation: none;
  }
}
</style> 