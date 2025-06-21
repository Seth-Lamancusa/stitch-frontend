<template>
  <InfoViewLayout
    pageTitle="Architecture, source code, and documentation"
    pageSubtitle="How does it work, under the hood?"
    heroClass="architecture-hero"
    :showBetaBanner="true"
    betaBannerIcon="🏗️"
    betaBannerTitle="Recursive conversational backbone"
    betaBannerText="The app functions as a window into a simple mathematical structure."
    footerTagline="Built on a priciple of openness"
  >
    <section class="architecture-main">
      <div class="container">
        <div class="architecture-main-content">
          <div class="architecture-columns">
            <div class="architecture-1">
              <h1>The structure</h1>
              <p>Each message starts as a node in a tree, with >=0 children, and >=0<=1 parent. Additionally, each message can be linked to >=0 other messages after being posted. The entire Stitch database is a set of these digraphs.</p>
            </div>
            <div class="architecture-2">
              <h1>The app</h1>
              <p>The app is a simple web interface that allows you to create, delete, and link messages. You can specify if you'd like the message to be public and a number of direct recipients to recieve the message in their inbox.</p>
            </div>
            <div class="architecture-3">
              <h1>The source</h1>
              <p>We will eventually open source the frontend, as well as publish API docs for programmatically interacting with the backend, so that developers can build their own apps on top of Stitch or their own chatbots to interact with it.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Coming Soon Section - Will replace with actual content later
    <section class="coming-soon-section">
      <div class="container">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">📐</div>
          <h2>Architecture Documentation Coming Soon</h2>
          <p>Our detailed technical architecture documentation is being prepared and will be available soon.</p>
          <router-link to="/inbox" class="btn primary-btn">Go to Stitch App</router-link>
        </div>
      </div>
    </section> -->
    
    <!-- Technical Details Layout - Hidden until content is ready -->
    <div class="tech-details-layout" style="display: none;">
      <!-- Navigation Sidebar -->
      <aside class="section-nav">
        <h3>Quick Navigation</h3>
        <ul>
          <li><a href="#overview" @click.prevent="scrollToSection('overview')" :class="{ active: activeSection === 'overview' }">Overview</a></li>
          <li><a href="#frontend" @click.prevent="scrollToSection('frontend')" :class="{ active: activeSection === 'frontend' }">Frontend</a></li>
          <li><a href="#backend" @click.prevent="scrollToSection('backend')" :class="{ active: activeSection === 'backend' }">Backend</a></li>
          <li><a href="#ai-integration" @click.prevent="scrollToSection('ai-integration')" :class="{ active: activeSection === 'ai-integration' }">AI Integration</a></li>
          <li><a href="#data-storage" @click.prevent="scrollToSection('data-storage')" :class="{ active: activeSection === 'data-storage' }">Data Storage</a></li>
          <li><a href="#security" @click.prevent="scrollToSection('security')" :class="{ active: activeSection === 'security' }">Security</a></li>
        </ul>
      </aside>

      <!-- Main Content -->
      <main class="tech-content">
        <!-- Overview Section -->
        <section id="overview" class="tech-section" ref="overviewSection">
          <h2>Platform Overview</h2>
          <p class="section-intro">Stitch is a multiplayer AI chat platform built on a modern tech stack designed for performance, scalability, and rich user experiences.</p>
          
          <div class="tech-card">
            <h3>Key Architecture Principles</h3>
            <ul>
              <li><strong>Real-time Communication</strong> - WebSocket-based messaging system for instant updates</li>
              <li><strong>Stateful AI Interactions</strong> - Advanced context management for coherent AI conversations</li>
              <li><strong>Microservices Architecture</strong> - Modular services for flexibility and maintainability</li>
              <li><strong>Data Privacy</strong> - Designed with security and privacy as core principles</li>
            </ul>
          </div>
        </section>

        <!-- Frontend Section -->
        <section id="frontend" class="tech-section" ref="frontendSection">
          <h2>Frontend Architecture</h2>
          <p class="section-intro">Our frontend is built with modern web technologies focused on responsiveness and user experience.</p>
          
          <div class="tech-card">
            <h3>Core Technologies</h3>
            <p>Coming soon...</p>
          </div>
        </section>

        <!-- Backend Section -->
        <section id="backend" class="tech-section" ref="backendSection">
          <h2>Backend Services</h2>
          <p class="section-intro">The backend is built on a scalable microservices architecture designed for reliability and performance.</p>
          
          <div class="tech-card">
            <h3>Service Structure</h3>
            <p>Coming soon...</p>
          </div>
        </section>

        <!-- AI Integration Section -->
        <section id="ai-integration" class="tech-section" ref="aiIntegrationSection">
          <h2>AI Integration</h2>
          <p class="section-intro">Stitch integrates multiple AI models to provide rich, context-aware interactions.</p>
          
          <div class="tech-card">
            <h3>Model Orchestration</h3>
            <p>Coming soon...</p>
          </div>
        </section>

        <!-- Data Storage Section -->
        <section id="data-storage" class="tech-section" ref="dataStorageSection">
          <h2>Data Storage</h2>
          <p class="section-intro">Our data architecture balances performance needs with privacy considerations.</p>
          
          <div class="tech-card">
            <h3>Database Technologies</h3>
            <p>Coming soon...</p>
          </div>
        </section>

        <!-- Security Section -->
        <section id="security" class="tech-section" ref="securitySection">
          <h2>Security Architecture</h2>
          <p class="section-intro">Security is a foundational principle in Stitch's design.</p>
          
          <div class="tech-card">
            <h3>Security Measures</h3>
            <p>Coming soon...</p>
          </div>
        </section>
      </main>
    </div>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
import { ref, onMounted, onBeforeUnmount } from 'vue';

// Track active section for navigation highlighting
const activeSection = ref('overview');

// Define section refs
const overviewSection = ref(null);
const frontendSection = ref(null);
const backendSection = ref(null);
const aiIntegrationSection = ref(null);
const dataStorageSection = ref(null);
const securitySection = ref(null);

// Function to scroll to section
const scrollToSection = (sectionId) => {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
    activeSection.value = sectionId;
  }
};

// Track active section based on scroll position
const handleScroll = () => {
  const sections = [
    { ref: overviewSection, id: 'overview' },
    { ref: frontendSection, id: 'frontend' },
    { ref: backendSection, id: 'backend' },
    { ref: aiIntegrationSection, id: 'ai-integration' },
    { ref: dataStorageSection, id: 'data-storage' },
    { ref: securitySection, id: 'security' }
  ];

  for (const section of sections) {
    if (!section.ref.value) continue;
    
    const rect = section.ref.value.getBoundingClientRect();
    if (rect.top <= 150 && rect.bottom >= 150) {
      activeSection.value = section.id;
      break;
    }
  }
};

onMounted(() => {
  // Add scroll event listener
  window.addEventListener('scroll', handleScroll);
  
  // Initial scroll check
  handleScroll();
});

onBeforeUnmount(() => {
  // Remove scroll event listener
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style>
/* Architecture-specific styles */
.architecture-hero {
  background: var(--architecture-hero-bg);
}

.architecture-main {
  padding: 0 0;
  background: var(--background-dark);
}

.architecture-main-content {
  max-width: 1200px;
  margin: 82px 0 76px 0;
}

.architecture-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  text-align: center;
}



/* Coming Soon Styles */
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

/* Tech details layout styles */
.tech-details-layout {
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.section-nav {
  position: sticky;
  top: 100px;
  padding: 2rem;
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
  margin-right: 2rem;
}

.section-nav h3 {
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--card-border);
}

.section-nav ul {
  list-style: none;
  padding: 0;
}

.section-nav ul li {
  margin-bottom: 1rem;
}

.section-nav ul li a {
  color: var(--text-light);
  text-decoration: none;
  display: block;
  padding: 0.5rem 0;
  transition: var(--transition);
}

.section-nav ul li a:hover {
  color: var(--primary-color);
  transform: translateX(5px);
}

.section-nav ul li a.active {
  color: var(--primary-color);
  font-weight: 500;
}

.tech-content {
  min-height: 100vh;
}

.tech-section {
  margin-bottom: 4rem;
  scroll-margin-top: 100px;
}

.tech-section:last-child {
  margin-bottom: 6rem;
}

.tech-section h2 {
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--card-border);
}

.tech-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
  margin-bottom: 2rem;
}

.tech-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

@media (max-width: 992px) {
  .tech-details-layout {
    grid-template-columns: 1fr;
  }
  
  .section-nav {
    position: relative;
    top: 0;
    margin-bottom: 2rem;
    margin-right: 0;
  }
}

@media (max-width: 768px) {
  .architecture-main {
    padding: 2rem 0;
  }
  
  .architecture-columns {
    grid-template-columns: 1fr !important;
    gap: 2rem;
    padding: 0 1rem;
  }
  
  .architecture-columns h1 {
    font-size: 1.3rem;
  }
  
  .architecture-columns p {
    font-size: 0.95rem;
    line-height: 1.5;
  }
  
  .coming-soon-section {
    padding: 3rem 1rem;
  }
  
  .coming-soon-content {
    padding: 2rem 1.5rem;
  }
  
  .tech-details-layout {
    padding: 0 1rem;
  }
  
  .section-nav {
    padding: 1.5rem;
  }
  
  .tech-card {
    padding: 1.5rem;
  }
}

@media (max-width: 480px) {
  .architecture-columns {
    grid-template-columns: 1fr !important;
  }
  
  .architecture-columns h1 {
    font-size: 1.2rem;
  }
  
  .architecture-columns p {
    font-size: 0.9rem;
  }
  
  .coming-soon-content h2 {
    font-size: 1.8rem;
  }
  
  .coming-soon-icon {
    font-size: 3rem;
  }
}
</style> 