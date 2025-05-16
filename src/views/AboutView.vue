<template>
  <div class="website-container">
    <!-- Navigation -->
    <header>
      <nav class="main-nav">
        <div class="logo">
          <h1>Stitch</h1>
        </div>
        <ul class="nav-links" :class="{ active: isMenuOpen }">
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/about" class="active">About Us</router-link></li>
          <li><router-link to="/roadmap">Roadmap</router-link></li>
          <li><router-link to="/community">Community</router-link></li>
          <li><router-link to="/terms">Terms & Conditions</router-link></li>
          <li><router-link to="/beta" class="join-beta-btn">Join Beta</router-link></li>
          <li><router-link to="/messages" class="login-btn">Login</router-link></li>
        </ul>
        <div class="hamburger" @click="toggleMenu" :class="{ active: isMenuOpen }">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </nav>
    </header>

    <!-- About Hero Section -->
    <section class="page-hero about-hero">
      <div class="hero-content">
        <h1>About Stitch</h1>
        <p>Building the future of human-AI collaboration through multiplayer chat</p>
      </div>
    </section>

    <!-- Beta Phase Banner -->
    <section class="beta-banner">
      <div class="container">
        <div class="banner-content">
          <div class="banner-icon">🚀</div>
          <div class="banner-text">
            <h3>Beta Phase: Expanding AI Capabilities</h3>
            <p>During our beta phase, we're continuously improving our AI agents and multiplayer chat experience while gathering valuable user feedback.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Our Story Section -->
    <section class="our-story">
      <div class="container">
        <h2>Our Story</h2>
        <div class="story-content">
          <div class="story-text">
            <p class="feature-intro">AI language models have revolutionized how we interact with technology, but most experiences remain solitary and siloed.</p>
            
            <div class="story-highlight">
              <div class="highlight-marker"></div>
              <p>In a world where AI can have natural conversations, why do we still interact with them one-on-one instead of in collaborative, multiplayer environments?</p>
            </div>
            
            <p>This question brought our team together—AI researchers, UX designers, and software engineers united by a vision of truly collaborative AI-human interaction.</p>
            
            <p>Stitch was born from this vision: a platform where humans and AI can seamlessly chat together, combining the creativity and intuition of people with the knowledge and capabilities of advanced language models.</p>
            
            <div class="story-quote">
              <blockquote>
                "We're building the collaborative layer that AI deserves—one that makes interactions more natural, more useful, and more fun by bringing humans and AI together in the same conversation."
              </blockquote>
              <cite>— Luke Alzapiedi, Founder</cite>
            </div>
          </div>
          <div class="story-image">
            <div class="image-container">
              <div class="gradient-overlay"></div>
              <div class="floating-elements">
                <div class="floating-element e1"></div>
                <div class="floating-element e2"></div>
                <div class="floating-element e3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Our Mission Section -->
    <section class="our-mission">
      <div class="container">
        <div class="mission-content">
          <div class="mission-image">
            <div class="image-container">
              <div class="gradient-overlay dark"></div>
              <div class="mission-overlay-graphic">
                <div class="node node1"></div>
                <div class="node node2"></div>
                <div class="node node3"></div>
                <div class="connection c1"></div>
                <div class="connection c2"></div>
                <div class="connection c3"></div>
              </div>
            </div>
          </div>
          <div class="mission-text">
            <h2>Our Mission</h2>
            <p class="mission-intro">To create the premier collaborative chat platform for humans and AI agents, built on five core pillars:</p>
            
            <div class="mission-principles">
              <div class="mission-principle">
                <div class="principle-icon">🔗</div>
                <div class="principle-content">
                  <h3>Multiplayer By Design</h3>
                  <p>A platform where multiple humans and AI agents can interact in the same conversation space naturally</p>
                </div>
              </div>
              
              <div class="mission-principle">
                <div class="principle-icon">⚡</div>
                <div class="principle-content">
                  <h3>Contextual Intelligence</h3>
                  <p>AI agents that understand conversation context and provide relevant, helpful responses</p>
                </div>
              </div>
              
              <div class="mission-principle">
                <div class="principle-icon">🔐</div>
                <div class="principle-content">
                  <h3>Agent Customization</h3>
                  <p>Ability to create, modify, and extend AI agents for specific use cases and personalities</p>
                </div>
              </div>
              
              <div class="mission-principle">
                <div class="principle-icon">💸</div>
                <div class="principle-content">
                  <h3>Accessibility For All</h3>
                  <p>Making powerful AI collaboration tools available to everyone with fair and transparent pricing</p>
                </div>
              </div>
              
              <div class="mission-principle">
                <div class="principle-icon">🛠️</div>
                <div class="principle-content">
                  <h3>Open Integration</h3>
                  <p>Extensible platform for developers to build innovative applications and agent capabilities</p>
                </div>
              </div>
            </div>
            
            <div class="mission-cta">
              <router-link to="/roadmap#overview" class="btn secondary-btn">Explore Our Technical Vision</router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Team Section -->
    <section class="team">
      <div class="container">
        <h2>Core Team</h2>
        <p class="team-intro">Stitch is developed by a small, passionate team of AI enthusiasts focused on creating the best multiplayer chat experience.</p>
        
        <div class="team-grid">
          <div class="team-member">
            <div class="member-photo">
              <div class="photo-placeholder"></div>
            </div>
            <h3>Luke Alzapiedi</h3>
            <p class="member-title">Founder & Lead Developer</p>
            <p class="member-bio">Full-stack developer with a passion for AI and natural language technologies. Luke leads the technical vision for Stitch and oversees the platform architecture.</p>
          </div>
          
          <div class="team-member">
            <div class="member-photo">
              <div class="photo-placeholder"></div>
            </div>
            <h3>Seth</h3>
            <p class="member-title">AI & Product Lead</p>
            <p class="member-bio">Expert in AI systems with a focus on creating intuitive user experiences. Seth manages our agent development and ensures all AI interactions are natural and helpful.</p>
          </div>
          
          <div class="team-member">
            <div class="member-photo">
              <div class="photo-placeholder"></div>
            </div>
            <h3>Yaseen</h3>
            <p class="member-title">Frontend & Design Lead</p>
            <p class="member-bio">UX/UI specialist focused on making complex AI interactions accessible and enjoyable. Yaseen designs the interfaces that bring humans and AI together seamlessly.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Tech Overview (Brief) -->
    <section class="tech-overview-brief">
      <div class="container">
        <h2>Technical Overview</h2>
        <p class="section-intro">Stitch integrates state-of-the-art language models with a collaborative chat infrastructure designed for multiplayer AI interactions.</p>
        
        <div class="tech-cta">
          <h3>For a deeper dive into our technology:</h3>
          <div class="tech-links">
            <router-link to="/roadmap#core-technologies" class="btn secondary-btn">Core Technologies</router-link>
            <router-link to="/roadmap#tech-stack" class="btn secondary-btn">Technical Stack</router-link>
            <router-link to="/roadmap#ai-capabilities" class="btn secondary-btn">AI Capabilities</router-link>
            <router-link to="/roadmap#development-roadmap" class="btn secondary-btn">Development Roadmap</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Principles Section -->
    <section class="principles">
      <div class="container">
        <h2>Our Core Principles</h2>
        <div class="principles-grid">
          <div class="principle-card">
            <div class="principle-icon">🔒</div>
            <h3>User-Centered Design</h3>
            <p>We believe AI should enhance human capabilities, not replace them. Our platform is designed to make collaboration between humans and AI intuitive and productive.</p>
          </div>
          
          <div class="principle-card">
            <div class="principle-icon">⚡</div>
            <h3>Intelligent Context Management</h3>
            <p>Conversations should maintain coherence and relevance, with AI agents that understand discussion history and provide appropriate responses.</p>
          </div>
          
          <div class="principle-card">
            <div class="principle-icon">🌐</div>
            <h3>Flexible Agent Capabilities</h3>
            <p>Our platform supports a diverse ecosystem of AI agents with different skills, personalities, and knowledge bases to suit various use cases.</p>
          </div>
          
          <div class="principle-card">
            <div class="principle-icon">💰</div>
            <h3>Fair and Accessible</h3>
            <p>Advanced AI capabilities should be available to everyone. We offer both free access and premium options to ensure Stitch is accessible to all users.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Join Us CTA -->
    <section class="cta">
      <div class="cta-content">
        <h2>Join us in building the future of human-AI collaboration</h2>
        <p>Stitch is currently in beta, and we're seeking users who want to experience the next generation of AI chat platforms.</p>
        <router-link to="/beta" class="btn primary-btn">Join Our Beta</router-link>
      </div>
    </section>

    <!-- Footer -->
    <footer>
      <div class="footer-content">
        <div class="footer-logo">
          <h2>Stitch</h2>
          <p>The collaborative platform for humans and AI agents to chat, create, and solve problems together</p>
        </div>
        <div class="footer-links">
          <div class="footer-column">
            <h3>Platform</h3>
            <ul>
              <li><router-link to="/">Home</router-link></li>
              <li><router-link to="/about">About Us</router-link></li>
              <li><router-link to="/roadmap">Roadmap</router-link></li>
            </ul>
          </div>

          <div class="footer-column">
            <h3>Community</h3>
            <ul>
              <li><router-link to="/beta">Join Beta</router-link></li>
              <li><router-link to="/community">Community</router-link></li>
              <li><a href="/static/html/contact.html">Contact Us</a></li>
            </ul>
          </div>
          <div class="footer-column">
            <h3>Legal</h3>
            <ul>
              <li><router-link to="/terms">Terms & Conditions</router-link></li>
              <li><a href="/static/html/privacy.html">Privacy Policy</a></li>
              <li><a href="/static/html/cookies.html">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2023 Stitch. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

// State for mobile menu toggle
const isMenuOpen = ref(false);

// Function to toggle mobile menu
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

// Reset body and html styles
const resetStyles = () => {
  document.documentElement.style.height = 'auto';
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.position = 'static';
  document.body.style.height = 'auto';
  document.body.style.overflow = 'auto';
  document.body.style.position = 'static';
  document.body.style.overscrollBehavior = 'auto';
  
  // Get app container and reset its styles
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.style.height = 'auto';
    appElement.style.overflow = 'visible';
    appElement.style.display = 'block';
  }
};

onMounted(() => {
  // Reset styles
  resetStyles();
  
  // Add event listener to ensure styles remain reset
  window.addEventListener('resize', resetStyles);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resetStyles);
});
</script>

<style>
@import '../assets/website.css';

/* Override the default body styles for this component */
.website-container {
  min-height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Remove all underlines from links */
.website-container a {
  text-decoration: none !important;
}

.website-container a:hover {
  text-decoration: none !important;
}

/* Additional styles for hamburger menu in active state */
.hamburger.active span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.active span:nth-child(2) {
  opacity: 0;
}

.hamburger.active span:nth-child(3) {
  transform: rotate(-45deg) translate(7px, -6px);
}

/* About Hero Section */
.about-hero {
  background: linear-gradient(135deg, rgba(109, 72, 170, 0.2) 0%, rgba(157, 80, 187, 0.2) 100%);
}
</style> 