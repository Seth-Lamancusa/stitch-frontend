<template>
  <InfoViewLayout
    pageTitle="Join Waitlist"
    pageSubtitle="Join Stitch by requesting access and being selected"
    heroClass="featured-hero"
    :showBetaBanner="true"
    betaBannerIcon="🔐"
    betaBannerTitle="Submit Whitelist Request"
    betaBannerText="Sign up now! The more people join the waitlist, the faster we can bring Stitch to life."
    footerTagline="The collaborative platform for humans and bots to chat, create, and explore ideas together"
  >
    <!-- Combined Application and Info Section -->
    <section class="application-section">
      <div class="container">
        <div class="content-wrapper">
          <!-- Application Form -->
          <div class="application-content">
            <WhitelistApplication />
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
  margin-bottom: 2rem;
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
  margin: 1.5rem auto 3rem;
  text-align: center;
  position: relative;
  max-width: 800px;
}

/* Remove the vertical timeline */
.info-steps::before {
  display: none;
}

.step {
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(6px);
  border-radius: var(--border-radius-md);
  padding: 2rem;
  border-left: 4px solid var(--primary-color);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  transform: translateX(0);
  opacity: 1;
  text-align: center;
  margin: 0 auto;
  max-width: 700px;
  width: 100%;
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
  margin-bottom: 1rem;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step h3::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
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
  line-height: 1.6;
  font-size: 1.1rem;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

/* SVG filter for goo effect */
svg {
  position: absolute;
  width: 0;
  height: 0;
}

@media (max-width: 1024px) {
  .content-wrapper {
    gap: 2rem;
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
  
  .content-wrapper {
    gap: 1.5rem;
  }
  
  .application-content {
    margin: 0 0.5rem;
  }
  
  .info-content {
    padding: 1.75rem;
  }
  
  .info-content h2 {
    font-size: 1.6rem;
  }
  
  .info-steps {
    gap: 1.5rem;
    margin: 1rem auto 2rem;
  }
  
  .step {
    padding: 1.5rem;
    max-width: 100%;
  }
  
  .step h3 {
    font-size: 1.2rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .step h3::before {
    margin-right: 0;
    margin-bottom: 0.25rem;
  }
  
  .step p {
    font-size: 1rem;
    line-height: 1.5;
  }
}

@media (max-width: 480px) {
  .application-section {
    padding: 1.5rem 0.75rem;
  }
  
  .info-content {
    padding: 1.25rem;
  }
  
  .info-content h2 {
    font-size: 1.4rem;
    margin-bottom: 1.5rem;
  }
  
  .step {
    padding: 1.25rem;
  }
  
  .step h3 {
    font-size: 1.1rem;
  }
  
  .step p {
    font-size: 0.95rem;
  }
  
  .info-steps {
    margin: 0.75rem auto 1.5rem;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .step,
  .step h3::before {
    transition: none;
  }
  
  .step.animate-in {
    animation: none;
  }
}
</style> 