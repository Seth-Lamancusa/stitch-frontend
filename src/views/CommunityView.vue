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
          <li><router-link to="/about">About Us</router-link></li>
          <li><router-link to="/roadmap">Roadmap</router-link></li>
          <li><router-link to="/community" class="active">Community</router-link></li>
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

    <!-- Community Hero Section -->
    <section class="page-hero community-hero">
      <div class="hero-content">
        <h1>Join Our Community</h1>
        <p>Connect, collaborate, and contribute to the growing ecosystem of Stitch</p>
      </div>
    </section>

    <!-- Beta Phase Banner -->
    <section class="beta-banner">
      <div class="container">
        <div class="banner-content">
          <div class="banner-icon">🚀</div>
          <div class="banner-text">
            <h3>Beta Phase: Google Cloud Platform Deployment</h3>
            <p>During our beta phase, we're running on GCP for reliability and rapid iteration. Our architecture is designed for a seamless transition to fully decentralized infrastructure post-beta.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Community Details Layout -->
    <div class="community-details-layout">
      <!-- Navigation Sidebar -->
      <aside class="section-nav">
        <h3>Quick Navigation</h3>
        <ul>
          <li><a href="#overview" @click.prevent="scrollToSection('overview')" :class="{ active: activeSection === 'overview' }">Community Overview</a></li>
          <li><a href="#beta-program" @click.prevent="scrollToSection('beta-program')" :class="{ active: activeSection === 'beta-program' }">Beta Program</a></li>
          <li><a href="#contact" @click.prevent="scrollToSection('contact')" :class="{ active: activeSection === 'contact' }">Contact Us</a></li>
          <li><a href="#social" @click.prevent="scrollToSection('social')" :class="{ active: activeSection === 'social' }">Social Channels</a></li>
          <li><a href="#events" @click.prevent="scrollToSection('events')" :class="{ active: activeSection === 'events' }">Upcoming Events</a></li>
          <li><a href="#contribute" @click.prevent="scrollToSection('contribute')" :class="{ active: activeSection === 'contribute' }">How to Contribute</a></li>
        </ul>
      </aside>

      <!-- Main Content -->
      <main class="community-content">
        <!-- Overview Section -->
        <section id="overview" class="community-section" ref="overviewSection">
          <h2>Community Overview</h2>
          <p class="section-intro">Stitch is building a vibrant community of users, developers, and AI enthusiasts who share our vision of multiplayer AI collaboration.</p>
          
          <div class="community-grid">
            <div class="community-card">
              <div class="community-icon">👥</div>
              <h3>Users</h3>
              <p>Join thousands of early adopters using Stitch for collaborative AI chat experiences with advanced language models.</p>
              <router-link to="/beta" class="btn secondary-btn">Join Beta</router-link>
            </div>
            
            <div class="community-card">
              <div class="community-icon">👩‍💻</div>
              <h3>Developers</h3>
              <p>Build applications, bots, and integrations on the Stitch platform using our comprehensive API and tools.</p>
              <router-link to="/roadmap" class="btn secondary-btn">Technical Details</router-link>
            </div>
            
            <div class="community-card">
              <div class="community-icon">🧠</div>
              <h3>AI Enthusiasts</h3>
              <p>Explore the future of human-AI collaboration and help shape the next generation of AI interaction patterns.</p>
              <router-link to="/about" class="btn secondary-btn">Learn More</router-link>
            </div>
          </div>
        </section>

        <!-- Beta Program Section -->
        <section id="beta-program" class="community-section" ref="betaProgramSection">
          <h2>Beta Program</h2>
          <p class="section-intro">Join our beta program to get early access to the Stitch platform and help shape its development.</p>
          
          <div class="community-card">
            <h3>What to Expect as a Beta Tester</h3>
            <ul>
              <li>Early access to all platform features</li>
              <li>Opportunity to provide direct feedback to the development team</li>
              <li>Special status and recognition in the community</li>
              <li>Priority support and assistance</li>
              <li>Access to beta-only events and discussions</li>
            </ul>
            <p>Our beta program is currently accepting new participants across all user categories.</p>
            <router-link to="/beta" class="btn primary-btn">Join Beta Program</router-link>
          </div>
          
          <div class="timeline">
            <h3>Beta Timeline</h3>
            <div class="timeline-item">
              <div class="timeline-date">Q1 2024</div>
              <div class="timeline-content">
                <h4>Closed Alpha</h4>
                <p>Initial testing with a small group of select users and developers.</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-date">Q2 2024</div>
              <div class="timeline-content">
                <h4>Open Beta</h4>
                <p>Expanded access to the platform for a wider group of users.</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-date">Q3-Q4 2024</div>
              <div class="timeline-content">
                <h4>Feature Complete Beta</h4>
                <p>All planned features implemented and available for testing.</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-date">Q1 2025</div>
              <div class="timeline-content">
                <h4>Full Launch</h4>
                <p>Official launch with complete feature set and scalable infrastructure.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Contact Section -->
        <section id="contact" class="community-section" ref="contactSection">
          <h2>Contact Us</h2>
          <p class="section-intro">Have questions or feedback? We'd love to hear from you.</p>
          
          <div class="community-grid">
            <div class="community-card">
              <div class="community-icon">📧</div>
              <h3>Email Support</h3>
              <p>For general inquiries:</p>
              <a href="mailto:info@stitch.ai">info@stitch.ai</a>
              <p>For technical support:</p>
              <a href="mailto:support@stitch.ai">support@stitch.ai</a>
            </div>
            
            <div class="community-card">
              <div class="community-icon">🛠️</div>
              <h3>Developer Assistance</h3>
              <p>For API and developer questions:</p>
              <a href="mailto:dev@stitch.ai">dev@stitch.ai</a>
              <p>For partnership inquiries:</p>
              <a href="mailto:partners@stitch.ai">partners@stitch.ai</a>
            </div>
            
            <div class="community-card">
              <div class="community-icon">📅</div>
              <h3>Office Hours</h3>
              <p>Our team is available:</p>
              <p>Monday - Friday: 9am - 6pm UTC</p>
              <p>We typically respond within 24 hours on business days.</p>
            </div>
          </div>
          
          <a href="/static/html/contact.html" class="btn secondary-btn">Contact Form</a>
        </section>

        <!-- Social Channels Section -->
        <section id="social" class="community-section" ref="socialSection">
          <h2>Social Channels</h2>
          <p class="section-intro">Connect with the Stitch team and community across various platforms.</p>
          
          <div class="community-card">
            <h3>Join the Conversation</h3>
            <p>Follow us and participate in discussions about Stitch and the future of AI collaboration.</p>
            <div class="social-links">
              <a href="#" class="social-link">Twitter</a>
              <a href="#" class="social-link">Discord</a>
              <a href="#" class="social-link">Reddit</a>
              <a href="#" class="social-link">Telegram</a>
              <a href="#" class="social-link">GitHub</a>
              <a href="#" class="social-link">LinkedIn</a>
            </div>
          </div>
        </section>

        <!-- Events Section -->
        <section id="events" class="community-section" ref="eventsSection">
          <h2>Upcoming Events</h2>
          <p class="section-intro">Join us at these upcoming events to learn more about Stitch.</p>
          
          <div class="community-card">
            <h3>Community Webinar: Introduction to Stitch</h3>
            <p><strong>Date:</strong> April 15, 2024</p>
            <p><strong>Time:</strong> 11:00 AM - 12:00 PM UTC</p>
            <p><strong>Description:</strong> An introduction to the Stitch platform, its features, and our vision for multiplayer AI chat.</p>
            <a href="#" class="btn secondary-btn">Register</a>
          </div>
          
          <div class="community-card">
            <h3>Developer Workshop: Building with the Stitch API</h3>
            <p><strong>Date:</strong> May 2, 2024</p>
            <p><strong>Time:</strong> 3:00 PM - 5:00 PM UTC</p>
            <p><strong>Description:</strong> A hands-on workshop for developers interested in building applications and integrations using the Stitch API.</p>
            <a href="#" class="btn secondary-btn">Register</a>
          </div>
          
          <div class="community-card">
            <h3>AI Roundtable: The Future of Collaborative AI</h3>
            <p><strong>Date:</strong> May 20, 2024</p>
            <p><strong>Time:</strong> 2:00 PM - 3:00 PM UTC</p>
            <p><strong>Description:</strong> Join a discussion with AI researchers and industry experts on the future of collaborative AI systems.</p>
            <a href="#" class="btn secondary-btn">Register</a>
          </div>
        </section>

        <!-- How to Contribute Section -->
        <section id="contribute" class="community-section" ref="contributeSection">
          <h2>How to Contribute</h2>
          <p class="section-intro">There are many ways to contribute to the Stitch ecosystem.</p>
          
          <div class="community-grid">
            <div class="community-card">
              <h3>Testing & Feedback</h3>
              <p>Join our beta program and provide feedback on features, usability, and AI performance.</p>
              <router-link to="/beta" class="btn secondary-btn">Join Beta</router-link>
            </div>
            
            <div class="community-card">
              <h3>Development</h3>
              <p>Contribute code, report bugs, or suggest improvements to our open-source components.</p>
              <a href="#" class="btn secondary-btn">GitHub</a>
            </div>
            
            <div class="community-card">
              <h3>Documentation</h3>
              <p>Help improve our documentation, write tutorials, or create educational content.</p>
              <router-link to="/roadmap" class="btn secondary-btn">Technical Details</router-link>
            </div>
            
            <div class="community-card">
              <h3>Community Building</h3>
              <p>Spread the word, moderate community channels, or organize local meetups.</p>
              <a href="#social" @click.prevent="scrollToSection('social')" class="btn secondary-btn">Join Social Channels</a>
            </div>
          </div>
        </section>
      </main>
    </div>

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

// Track active section for navigation highlighting
const activeSection = ref('overview');

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

// Define section refs
const overviewSection = ref(null);
const betaProgramSection = ref(null);
const contactSection = ref(null);
const socialSection = ref(null);
const eventsSection = ref(null);
const contributeSection = ref(null);

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
    { ref: betaProgramSection, id: 'beta-program' },
    { ref: contactSection, id: 'contact' },
    { ref: socialSection, id: 'social' },
    { ref: eventsSection, id: 'events' },
    { ref: contributeSection, id: 'contribute' }
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
  // Reset styles
  resetStyles();
  
  // Add event listeners
  window.addEventListener('resize', resetStyles);
  window.addEventListener('scroll', handleScroll);
  
  // Initial scroll check
  handleScroll();
});

onBeforeUnmount(() => {
  // Remove event listeners
  window.removeEventListener('resize', resetStyles);
  window.removeEventListener('scroll', handleScroll);
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

/* Community-specific styles */
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

.community-details-layout {
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.community-content {
  min-height: 100vh;
}

.community-section {
  margin-bottom: 4rem;
  scroll-margin-top: 100px;
}

.community-section:last-child {
  margin-bottom: 6rem;
}

.community-section h2 {
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--card-border);
}

.community-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
  padding: 2rem;
  margin-bottom: 2rem;
  transition: transform 0.3s ease;
}

.community-card:hover {
  transform: translateY(-5px);
}

.community-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.community-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.community-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
}

.social-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: var(--input-background);
  color: var(--text-light);
  text-decoration: none;
  border-radius: 20px;
  transition: all 0.3s ease;
  border: 1px solid var(--card-border);
}

.social-link:hover {
  background-color: var(--primary-color);
  color: white;
}

.timeline {
  position: relative;
  margin: 2rem 0;
  padding-left: 2rem;
}

.timeline:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 2px;
}

.timeline-item {
  position: relative;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-item:before {
  content: '';
  position: absolute;
  top: 0;
  left: -2.3rem;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--primary-color);
  border: 3px solid var(--background-dark);
}

.timeline-date {
  font-weight: bold;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

@media (max-width: 992px) {
  .community-details-layout {
    grid-template-columns: 1fr;
  }
  
  .section-nav {
    position: relative;
    top: 0;
    margin-bottom: 2rem;
    margin-right: 0;
  }
  
  .community-grid {
    grid-template-columns: 1fr;
  }
}
</style> 