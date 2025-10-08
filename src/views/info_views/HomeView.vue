<template>
  <InfoViewLayout
    pageTitle="Welcome to Stitch"
    pageSubtitle="Communication at the speed of thought."
    heroClass="home-hero"
    :showBetaBanner="true"
    betaBannerIcon=""
    betaBannerTitle=""
  >
    <template #betaBannerText>
      <div class="banner-group">
        <router-link to="/history" class="banner-cta">
          <span class="btn-icon">💬</span>
          <span class="cta-text">Try it now!</span>
        </router-link>
      </div>
    </template>
    <section class="home-main">
      <div class="container">
        <div class="home-main-content">
          <div class="home-intro"><i>
            Connect with diverse intelligence and tranform your ideas into reality in real time. Stitch is for conversation and collaboration. For teaching and learning. For research, development, refinement, and critique. Most of all, it's for connection.</i>
          </div>
          <div class="content-columns">
            <div class="home-main-content-1">
              <div class="content-icon">🧠</div>
              <h2>Connecting ideas, connecting minds</h2>
              <p>Engage in group conversations with AI and human users alike. Easily track conversations, replies, and threads.</p>
            </div>
            <div class="home-main-content-2">
              <div class="content-icon">⚡</div>
              <h2>Compare responses</h2>
              <p>Send messages to multiple users at a time. Chatbots will automatically reply when mentioned and humans will receive a notification.</p>
            </div>
            <div class="home-main-content-3">
              <div class="content-icon">🔗</div>
              <h2>Share your conversations</h2>
              <p>Add and remove users from conversations and make them public or private, controlling who can see and participate.</p>
            </div>
          </div>
          <div class="home-body">

          </div>
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

.banner-link {
  color: #b8a5ff;
  text-decoration: none;
  font-weight: 500;
}

.banner-link:hover {
  text-decoration: underline;
  opacity: 0.9;
}

/* Banner buttons styling */
.banner-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  margin: 0 auto;
}

.banner-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(16, 163, 127, 0.15) 0%, rgba(31, 197, 157, 0.1) 100%);
  border: 1px solid rgba(16, 163, 127, 0.3);
  border-radius: 10px;
  color: var(--text-light);
  text-decoration: none;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  min-width: 140px;
  height: 70px;
  position: relative;
  overflow: hidden;
}

.banner-btn:hover {
  background: linear-gradient(135deg, rgba(16, 163, 127, 0.25) 0%, rgba(31, 197, 157, 0.2) 100%);
  border-color: rgba(16, 163, 127, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(16, 163, 127, 0.2);
  color: var(--text-light);
}

.banner-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}

.banner-btn:hover::before {
  left: 100%;
}

.banner-group {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin: 0 auto;
}

.banner-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background: linear-gradient(135deg, rgba(16, 163, 127, 0.35) 0%, rgba(31, 197, 157, 0.25) 100%);
  border: 1px solid rgba(16, 163, 127, 0.6);
  border-radius: 12px;
  color: var(--text-light);
  text-decoration: none;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  height: 72px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 22px rgba(16, 163, 127, 0.25);
  white-space: nowrap;
}

.banner-cta:hover {
  background: linear-gradient(135deg, rgba(16, 163, 127, 0.45) 0%, rgba(31, 197, 157, 0.35) 100%);
  border-color: rgba(16, 163, 127, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(16, 163, 127, 0.3);
}

.banner-cta::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
  transition: left 0.6s ease;
}

.banner-cta:hover::before {
  left: 100%;
}

.banner-cta .cta-text {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--color-primary, #4f8cff);
  line-height: 1;
}

.btn-text-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.btn-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.btn-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-primary, #4f8cff);
  line-height: 1.2;
  margin: 0;
}

.btn-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.8;
  line-height: 1.3;
  margin: 0;
}

.home-main {
  padding: 0 0;
  background: var(--background-dark);
}

.home-main-content {
  max-width: 1200px;
  margin: 0 0 2rem 0;
}

.home-intro {
  width: 70%;
  max-width: 900px;
  margin: 50px auto 60px auto;
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 1.05rem;
  text-align: center;
}

@media (max-width: 1100px) {
  .home-intro {
    width: 90%;
    font-size: 1rem;
    margin: 40px auto 60px auto;
  }
}

@media (max-width: 768px) {
  .home-intro {
    width: 90%;
    font-size: 0.8rem;
    padding: 0 1rem;
    margin: 0 auto 40px auto;
  }
}

.content-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2.5rem;
  text-align: center;
  margin-top: 1rem;
}

.content-columns > div {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 2.5rem 2rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.content-columns > div:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 30px rgba(16, 163, 127, 0.15);
  border-color: rgba(16, 163, 127, 0.3);
}

.content-columns > div::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--gradient-primary);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.content-columns > div:hover::before {
  opacity: 1;
}

.content-columns h2 {
  font-size: 1.6rem;
  color: var(--color-primary, #4f8cff);
  margin-bottom: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
}

.content-columns p {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 1rem;
  margin-bottom: 0;
}

.content-icon {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  display: block;
  opacity: 0.9;
  transition: transform 0.3s ease;
}

.content-columns > div:hover .content-icon {
  transform: scale(1.1);
}

/* Medium screen typography adjustments */
@media (max-width: 1100px) {
  .content-columns h2 {
    font-size: 1.4rem;
  }
  .content-columns p {
    font-size: 0.85rem;
  }
}

@media (max-width: 992px) {
  .content-columns {
    gap: 2rem;
  }
  .content-columns > div {
    padding: 2rem 1.75rem;
  }
  .content-columns h2 {
    font-size: 1.25rem;
  }
  .content-columns p {
    font-size: 0.8rem;
  }
}

  /* Mobile styles */
  @media (max-width: 768px) {
    .home-main {
      padding: 2rem 0;
    }
    
    .content-columns {
      grid-template-columns: 1fr !important;
      gap: 2rem;
      padding: 0 1rem;
    }
    
    .content-columns > div {
      padding: 2rem 1.5rem;
    }
    
    .content-columns h2 {
      font-size: 1.4rem;
    }
    
    .content-columns p {
      font-size: 0.95rem;
      line-height: 1.5;
    }
    
    .content-icon {
      font-size: 2.5rem;
      margin-bottom: 1.25rem;
    }
    



  .btn-text-content {
    justify-content: center;
  }

  .btn-title {
    font-size: 0.9rem;
  }

  .btn-subtitle {
    display: none;
  }
  }


@media (max-width: 480px) {
  .content-columns {
    grid-template-columns: 1fr !important;
    gap: 1.5rem;
  }
  
  .content-columns > div {
    padding: 1.5rem 1.25rem;
  }
  
  .content-columns h2 {
    font-size: 1.3rem;
  }
  
  .content-columns p {
    font-size: 0.9rem;
  }

  .content-icon {
    font-size: 2.25rem;
    margin-bottom: 1rem;
  }

  /* Banner buttons small mobile styles */
  .banner-buttons {
    gap: 0.25rem;
    max-width: 500px;
  }

  .banner-btn {
    flex: 1 1 calc(50% - 0.125rem);
    padding: 0.5rem 0.625rem;
    height: 50px;
    gap: 0.375rem;
  }

  .btn-text-content {
    justify-content: center;
  }

  .btn-icon {
    font-size: 1.1rem;
  }

  .btn-title {
    font-size: 0.8rem;
  }

  .btn-subtitle {
    display: none;
  }
}

</style> 