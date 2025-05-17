<template>
  <InfoViewLayout
    pageTitle="Join Our Community"
    pageSubtitle="Connect, collaborate, and contribute to the growing ecosystem of Stitch"
    heroClass="community-hero"
    :showBetaBanner="true"
    betaBannerIcon="🚀"
    betaBannerTitle="Beta Phase: Google Cloud Platform Deployment"
    betaBannerText="During our beta phase, we're running on GCP for reliability and rapid iteration. Our architecture is designed for a seamless transition to fully decentralized infrastructure post-beta."
    footerTagline="Building the multiplayer AI chat platform for seamless human-AI collaboration"
  >
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
          <p class="section-intro">Join us for upcoming events, webinars, and meetups related to Stitch and AI collaboration.</p>
          
          <div class="events-grid">
            <div class="event-card">
              <div class="event-date">June 15, 2024</div>
              <h3>Stitch Platform Demo</h3>
              <p>Online webinar showcasing the latest features and capabilities of the Stitch platform.</p>
              <p><strong>Time:</strong> 10:00 AM - 11:30 AM PDT</p>
              <a href="#" class="btn secondary-btn">Register</a>
            </div>
            
            <div class="event-card">
              <div class="event-date">July 8, 2024</div>
              <h3>Developer Workshop</h3>
              <p>Hands-on workshop for developers interested in building on the Stitch platform.</p>
              <p><strong>Time:</strong> 2:00 PM - 4:00 PM PDT</p>
              <a href="#" class="btn secondary-btn">Register</a>
            </div>
            
            <div class="event-card">
              <div class="event-date">August 12, 2024</div>
              <h3>Community Meetup</h3>
              <p>Virtual meetup for the Stitch community to connect, share experiences, and provide feedback.</p>
              <p><strong>Time:</strong> 5:00 PM - 6:30 PM PDT</p>
              <a href="#" class="btn secondary-btn">Register</a>
            </div>
          </div>
        </section>

        <!-- Contribute Section -->
        <section id="contribute" class="community-section" ref="contributeSection">
          <h2>How to Contribute</h2>
          <p class="section-intro">There are many ways to contribute to the Stitch ecosystem, regardless of your technical background.</p>
          
          <div class="contribute-grid">
            <div class="contribute-card">
              <div class="contribute-icon">🧪</div>
              <h3>Beta Testing</h3>
              <p>Join our beta program to test new features, report bugs, and provide feedback on the user experience.</p>
              <router-link to="/beta" class="btn secondary-btn">Join Beta</router-link>
            </div>
            
            <div class="contribute-card">
              <div class="contribute-icon">📣</div>
              <h3>Spread the Word</h3>
              <p>Share your experiences with Stitch on social media, blogs, or with your network to help grow the community.</p>
            </div>
            
            <div class="contribute-card">
              <div class="contribute-icon">🤝</div>
              <h3>Community Support</h3>
              <p>Help answer questions from other users and share your knowledge in our community forums and social channels.</p>
            </div>
            
            <div class="contribute-card">
              <div class="contribute-icon">💡</div>
              <h3>Feature Suggestions</h3>
              <p>Submit your ideas for new features, improvements, or AI capabilities through our feedback channels.</p>
            </div>
            
            <div class="contribute-card">
              <div class="contribute-icon">🔨</div>
              <h3>Developer Contributions</h3>
              <p>Build apps, extensions, or integrations that enhance the Stitch platform and ecosystem.</p>
            </div>
            
            <div class="contribute-card">
              <div class="contribute-icon">🤖</div>
              <h3>AI Agent Creation</h3>
              <p>Design and share custom AI agents that provide unique capabilities or personality traits.</p>
            </div>
          </div>
          
          <div class="cta-card">
            <h3>Join Our Community Today</h3>
            <p>Become part of the Stitch community and help shape the future of multiplayer AI collaboration.</p>
            <div class="cta-buttons">
              <router-link to="/beta" class="btn primary-btn">Join Beta</router-link>
              <a href="#social" @click.prevent="scrollToSection('social')" class="btn secondary-btn">Connect on Social</a>
            </div>
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
/* Community layout styles */
.community-details-layout {
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

/* Community grid styles */
.community-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.community-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.community-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.community-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.community-card p {
  margin-bottom: 1rem;
}

.community-card a {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.community-card .btn {
  margin-top: 1rem;
}

/* Timeline styles */
.timeline {
  margin: 3rem 0;
  padding-left: 2rem;
  position: relative;
}

.timeline:before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 2px;
  background: var(--primary-color);
}

.timeline h3 {
  margin-bottom: 2rem;
}

.timeline-item {
  position: relative;
  margin-bottom: 2rem;
  padding-left: 2rem;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-item:before {
  content: '';
  position: absolute;
  left: -10px;
  top: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--background-dark);
  border: 2px solid var(--primary-color);
  z-index: 1;
}

.timeline-date {
  font-weight: 500;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.timeline-content {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  border: 1px solid var(--card-border);
}

.timeline-content h4 {
  margin-bottom: 0.5rem;
  color: var(--text-light);
}

/* Social links styles */
.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
}

.social-link {
  display: inline-block;
  padding: 0.6rem 1.2rem;
  background-color: var(--input-background);
  border-radius: var(--border-radius);
  text-decoration: none;
  color: var(--text-light);
  transition: background-color 0.3s, transform 0.3s;
}

.social-link:hover {
  background-color: var(--primary-color);
  color: white;
  transform: translateY(-3px);
}

/* Events grid styles */
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.event-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.event-date {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  background-color: var(--primary-color);
  color: white;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.event-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.event-card p {
  margin-bottom: 1rem;
}

.event-card .btn {
  margin-top: 1rem;
}

/* Contribute grid styles */
.contribute-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.contribute-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.contribute-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.contribute-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.contribute-card p {
  margin-bottom: 1rem;
}

.contribute-card .btn {
  margin-top: 1rem;
}

/* CTA card styles */
.cta-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2.5rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--primary-color);
  text-align: center;
  margin-top: 3rem;
}

.cta-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.cta-card p {
  margin-bottom: 1.5rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
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
  
  .cta-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .cta-buttons .btn {
    width: 100%;
    max-width: 300px;
  }
}
</style> 