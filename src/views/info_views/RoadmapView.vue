<template>
  <InfoViewLayout
    pageTitle="Roadmap"
    pageSubtitle="The technology, architecture, and roadmap behind the Stitch platform"
    heroClass="roadmap-hero"
    :showBetaBanner="true"
    betaBannerIcon="🚀"
    betaBannerTitle="Beta phase coming eventually"
    betaBannerText="We'll open up the platform to outsiders in the order they joined the waitlist."
    footerTagline="Where you're going and where you came from are the same."
  >
    <!-- Coming Soon Section - Will replace with actual content later -->
    <section class="coming-soon-section">
      <div class="container">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">🗺️</div>
          <h2>Roadmap Coming Soon</h2>
          <p>Our detailed product and technology roadmap is being finalized and will be published here soon.</p>
          <router-link to="/feed" class="btn primary-btn">Go to Stitch App</router-link>
        </div>
      </div>
    </section>
    
    <!-- Technical Details Layout -->
    <div class="tech-details-layout" style="display: none;">
      <!-- Navigation Sidebar -->
      <aside class="section-nav">
        <h3>Quick Navigation</h3>
        <ul>
          <li><a href="#overview" @click.prevent="scrollToSection('overview')" :class="{ active: activeSection === 'overview' }">Platform Overview</a></li>
          <li><a href="#core-technologies" @click.prevent="scrollToSection('core-technologies')" :class="{ active: activeSection === 'core-technologies' }">Core Technologies</a></li>
          <li><a href="#tech-stack" @click.prevent="scrollToSection('tech-stack')" :class="{ active: activeSection === 'tech-stack' }">Technical Stack</a></li>
          <li><a href="#current-architecture" @click.prevent="scrollToSection('current-architecture')" :class="{ active: activeSection === 'current-architecture' }">Current Architecture</a></li>
          <li><a href="#ai-capabilities" @click.prevent="scrollToSection('ai-capabilities')" :class="{ active: activeSection === 'ai-capabilities' }">AI Capabilities</a></li>
          <li><a href="#development-roadmap" @click.prevent="scrollToSection('development-roadmap')" :class="{ active: activeSection === 'development-roadmap' }">Development Roadmap</a></li>
          <li><a href="#beta-timeline" @click.prevent="scrollToSection('beta-timeline')" :class="{ active: activeSection === 'beta-timeline' }">Beta Timeline</a></li>
          <li><a href="#post-beta-phases" @click.prevent="scrollToSection('post-beta-phases')" :class="{ active: activeSection === 'post-beta-phases' }">Post-Beta Phases</a></li>
        </ul>
      </aside>

      <!-- Main Content -->
      <main class="tech-content">
        <!-- Overview Section -->
        <section id="overview" class="tech-section" ref="overviewSection">
          <h2>Platform Overview</h2>
          <p class="section-intro">Stitch is a multiplayer AI chat platform that enables seamless interactions between humans and AI agents in collaborative spaces.</p>
          
          <div class="key-principles">
            <h3>Key Technical Principles</h3>
            <ul>
              <li><strong>Multimodal AI Capabilities</strong> - Supporting text, image, and soon audio/video interactions</li>
              <li><strong>Multiplayer by Design</strong> - Real-time collaboration between humans and AI agents</li>
              <li><strong>Privacy-Focused</strong> - Minimal data collection with robust security measures</li>
              <li><strong>Subscription-Based Model</strong> - Free tier access with premium features for subscribers</li>
              <li><strong>Extensible Architecture</strong> - Flexible system designed for future capabilities</li>
            </ul>
          </div>
        </section>

        <!-- Core Technologies Section -->
        <section id="core-technologies" class="tech-section" ref="coreTechnologiesSection">
          <h2>Core Technologies</h2>
          <p class="section-intro">Stitch integrates cutting-edge AI technologies with innovative chat architecture.</p>
          
          <div class="tech-grid">
            <div class="tech-card">
              <div class="tech-icon">🧠</div>
              <h3>Advanced LLM Integration</h3>
              <p>We leverage state-of-the-art language models to power conversations with contextual understanding, knowledge retrieval, and natural interactions.</p>
              <ul class="tech-details">
                <li>Multiple model providers for diverse capabilities and redundancy</li>
                <li>Optimized prompting and response generation</li>
                <li>Context management for extended conversations</li>
              </ul>
            </div>
            
            <div class="tech-card">
              <div class="tech-icon">👥</div>
              <h3>Multiplayer Architecture</h3>
              <p>Our platform enables seamless real-time interactions between multiple humans and AI agents in shared spaces.</p>
              <ul class="tech-details">
                <li>WebSocket-based real-time messaging system</li>
                <li>Presence awareness and typing indicators</li>
                <li>Robust state synchronization across clients</li>
              </ul>
            </div>
            
            <div class="tech-card">
              <div class="tech-icon">🔒</div>
              <h3>Privacy & Security</h3>
              <p>We prioritize user privacy and data security throughout our platform architecture.</p>
              <ul class="tech-details">
                <li>End-to-end encryption for sensitive communications</li>
                <li>Minimal data retention policies</li>
                <li>Granular permission controls for shared spaces</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Technical Stack Section -->
        <section id="tech-stack" class="tech-section" ref="techStackSection">
          <h2>Technical Stack</h2>
          <p class="section-intro">Our technology stack combines modern web technologies with cutting-edge AI integration.</p>
          
          <div class="tech-stack-dark">
            <h3>Frontend Technologies</h3>
            <div class="stack-grid">
              <div class="stack-item">
                <h3>React</h3>
                <p>For building our interactive user interface with component-based architecture</p>
              </div>
              <div class="stack-item">
                <h3>TypeScript</h3>
                <p>Strongly-typed JavaScript for improved code quality and developer experience</p>
              </div>
              <div class="stack-item">
                <h3>WebSocket</h3>
                <p>Real-time bidirectional event-based communication</p>
              </div>
              <div class="stack-item">
                <h3>TailwindCSS</h3>
                <p>Utility-first CSS framework for rapid UI development</p>
              </div>
            </div>
            
            <h3>Backend Technologies</h3>
            <div class="stack-grid">
              <div class="stack-item">
                <h3>FastAPI (Python)</h3>
                <p>High-performance API framework for our server implementation</p>
              </div>
              <div class="stack-item">
                <h3>Redis</h3>
                <p>In-memory data structure store for real-time messaging and caching</p>
              </div>
              <div class="stack-item">
                <h3>PostgreSQL</h3>
                <p>Relational database for persistent data storage</p>
              </div>
              <div class="stack-item">
                <h3>LangChain</h3>
                <p>Framework for developing applications powered by language models</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Current Architecture Section -->
        <section id="current-architecture" class="tech-section" ref="currentArchitectureSection">
          <h2>Current Architecture</h2>
          <p class="section-intro">During our beta phase, we're using a robust cloud-based architecture to facilitate rapid development and testing.</p>
          
          <div class="arch-diagram">
            <div class="diagram-placeholder">
              Architecture Diagram Coming Soon
            </div>
          </div>
          
          <div class="arch-details">
            <div class="arch-component">
              <h3>Backend Services</h3>
              <ul class="component-details">
                <li><span class="component-label">Backend Layer:</span> FastAPI running on Uvicorn ASGI server</li>
                <li><span class="component-label">Authentication Service:</span> JWT-based tokens with secure session management</li>
                <li><span class="component-label">AI Orchestration:</span> Model routing, context management, and response generation</li>
                <li><span class="component-label">Messaging Service:</span> Real-time WebSocket communication with presence tracking</li>
              </ul>
            </div>
            
            <div class="arch-component">
              <h3>Deployment Infrastructure</h3>
              <ul class="component-details">
                <li><span class="component-label">Cloud Provider:</span> Google Cloud Platform for beta phase reliability</li>
                <li><span class="component-label">Compute:</span> Container-based deployment with auto-scaling</li>
                <li><span class="component-label">Database:</span> Managed database services for development simplicity</li>
                <li><span class="component-label">Monitoring:</span> Cloud-native observability stack for performance analysis</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- AI Capabilities Section -->
        <section id="ai-capabilities" class="tech-section" ref="aiCapabilitiesSection">
          <h2>AI Capabilities</h2>
          <p class="section-intro">Stitch leverages advanced AI models to enable rich, engaging interactions.</p>
          
          <div class="arch-details">
            <div class="arch-component">
              <h3>Language Models</h3>
              <ul class="component-details">
                <li><span class="component-label">Text Generation:</span> Support for multiple state-of-the-art LLMs</li>
                <li><span class="component-label">Context Management:</span> Advanced techniques for maintaining conversation flow</li>
                <li><span class="component-label">Persona Creation:</span> Tools for creating consistent AI agents with distinct personalities</li>
                <li><span class="component-label">Knowledge Integration:</span> External knowledge retrieval for grounded responses</li>
              </ul>
            </div>
            
            <div class="arch-component">
              <h3>Multimodal Capabilities</h3>
              <ul class="component-details">
                <li><span class="component-label">Image Understanding:</span> Processing and responding to image inputs</li>
                <li><span class="component-label">Image Generation:</span> Creating visual content based on text prompts</li>
                <li><span class="component-label">Future Audio Support:</span> Speech recognition and synthesis capabilities planned</li>
                <li><span class="component-label">Future Video Support:</span> Video analysis and generation on the roadmap</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Development Roadmap Section -->
        <section id="development-roadmap" class="tech-section" ref="developmentRoadmapSection">
          <h2>Development Roadmap</h2>
          <p class="section-intro">Stitch is being developed in phases, with each phase bringing new capabilities and improvements.</p>
          
          <div class="vision-statement">
            <div class="vision-content">
              <h3>Our Vision</h3>
              <p>We're building a multiplayer AI chat platform where:</p>
              <ul class="vision-points">
                <li>Humans and AI can interact seamlessly in collaborative spaces</li>
                <li>Users can create and customize their own AI agents</li>
                <li>Communications are secure, private, and user-controlled</li>
                <li>Users have access to an intuitive, feature-rich platform</li>
                <li>Advanced AI capabilities are accessible to everyone</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Beta Timeline Section -->
        <section id="beta-timeline" class="tech-section" ref="betaTimelineSection">
          <h2>Beta Timeline</h2>
          <p class="section-intro">Our beta phase is structured to progressively test and enhance platform capabilities.</p>
          
          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-marker current"></div>
              <div class="timeline-content">
                <h3>Closed Beta: Core Functionality</h3>
                <p>Initial release to a limited group of testers to validate core platform functionality.</p>
                <div class="timeline-date">Current Phase</div>
                
                <h4>Key Features:</h4>
                <ul>
                  <li>Basic user authentication</li>
                  <li>One-on-one chat with AI agents</li>
                  <li>Simple multiplayer chat rooms</li>
                  <li>Initial user interface</li>
                </ul>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h3>Expanded Beta: Advanced Features</h3>
                <p>Expanding functionality with more advanced capabilities.</p>
                <div class="timeline-date">Q3 2024</div>
                
                <h4>Key Features:</h4>
                <ul>
                  <li>Customizable AI personas</li>
                  <li>Image understanding and generation</li>
                  <li>Enhanced UI/UX based on initial feedback</li>
                  <li>Initial subscription model implementation</li>
                </ul>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h3>Open Beta: Advanced Features</h3>
                <p>Opening the platform to all interested users with enhanced capabilities.</p>
                <div class="timeline-date">Q4 2024</div>
                
                <h4>Key Features:</h4>
                <ul>
                  <li>Advanced AI interaction patterns</li>
                  <li>Custom AI personality options</li>
                  <li>Enhanced chat space features</li>
                  <li>Knowledge base integration</li>
                  <li>Full subscription tier implementation</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <!-- Post-Beta Phases Section -->
        <section id="post-beta-phases" class="tech-section" ref="postBetaPhasesSection">
          <h2>Post-Beta Development Phases</h2>
          <p class="section-intro">Following the beta, we'll continue enhancing the platform with new features and capabilities.</p>
          
          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h3>Phase 1: Full Launch</h3>
                <p>Official launch with complete core functionality and refined user experience.</p>
                <div class="timeline-date">Q1 2025</div>
                
                <h4>Key Features:</h4>
                <ul>
                  <li>Polished, production-ready platform</li>
                  <li>Mobile applications</li>
                  <li>Enhanced security and privacy controls</li>
                  <li>Expanded AI capabilities</li>
                </ul>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h3>Phase 2: Expanded Modalities</h3>
                <p>Adding support for additional interaction modalities.</p>
                <div class="timeline-date">Q2-Q3 2025</div>
                
                <h4>Key Features:</h4>
                <ul>
                  <li>Voice interaction capabilities</li>
                  <li>Audio content generation</li>
                  <li>Video understanding</li>
                  <li>Enhanced multimodal AI experiences</li>
                </ul>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h3>Phase 3: Advanced Ecosystem</h3>
                <p>Building a rich ecosystem of features, integrations, and capabilities.</p>
                <div class="timeline-date">Q4 2025</div>
                
                <h4>Key Features:</h4>
                <ul>
                  <li>Marketplace for custom AI personas</li>
                  <li>Advanced user customization options</li>
                  <li>Enterprise-grade features and controls</li>
                  <li>Enhanced collaborative capabilities</li>
                  <li>Virtual and augmented reality integration</li>
                </ul>
              </div>
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
const coreTechnologiesSection = ref(null);
const techStackSection = ref(null);
const currentArchitectureSection = ref(null);
const aiCapabilitiesSection = ref(null);
const developmentRoadmapSection = ref(null);
const betaTimelineSection = ref(null);
const postBetaPhasesSection = ref(null);

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
    { ref: coreTechnologiesSection, id: 'core-technologies' },
    { ref: techStackSection, id: 'tech-stack' },
    { ref: currentArchitectureSection, id: 'current-architecture' },
    { ref: aiCapabilitiesSection, id: 'ai-capabilities' },
    { ref: developmentRoadmapSection, id: 'development-roadmap' },
    { ref: betaTimelineSection, id: 'beta-timeline' },
    { ref: postBetaPhasesSection, id: 'post-beta-phases' }
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

/* Technical details layout styles */
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

/* For technical cards and grids */
.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.tech-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.tech-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.tech-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.tech-details {
  margin-top: 1rem;
  padding-left: 1.5rem;
}

.tech-details li {
  margin-bottom: 0.5rem;
}

/* Tech stack styles */
.tech-stack-dark {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.tech-stack-dark h3 {
  margin: 1.5rem 0;
  color: var(--primary-color);
}

.stack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stack-item {
  background-color: rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--card-border);
}

.stack-item h3 {
  font-size: 1.3rem;
  margin: 0 0 0.5rem 0;
  color: var(--text-light);
}

/* Architecture styles */
.arch-diagram {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  margin: 2rem 0;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
  text-align: center;
}

.diagram-placeholder {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: italic;
  color: var(--text-secondary);
  border: 2px dashed var(--card-border);
  border-radius: var(--border-radius);
}

.arch-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.arch-component {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.arch-component h3 {
  color: var(--primary-color);
  margin-bottom: 1.5rem;
}

.component-details {
  list-style: none;
  padding: 0;
}

.component-details li {
  margin-bottom: 1rem;
  line-height: 1.5;
}

.component-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--text-light);
}

/* AI capabilities styles */
.capabilities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.capability-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.capability-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

/* Roadmap timeline styles */
.roadmap-timeline {
  margin: 3rem 0;
  position: relative;
}

.roadmap-timeline::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 20px;
  width: 2px;
  background: var(--primary-color);
}

.timeline-phase {
  position: relative;
  padding-left: 50px;
  margin-bottom: 3rem;
}

.timeline-phase:last-child {
  margin-bottom: 0;
}

.phase-marker {
  position: absolute;
  left: 10px;
  top: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--background-dark);
  border: 2px solid var(--primary-color);
}

.timeline-phase.current .phase-marker {
  background: var(--primary-color);
}

.phase-content {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.timeline-phase.current .phase-content {
  border-color: var(--primary-color);
}

.phase-content h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.phase-features {
  padding-left: 1.5rem;
}

.phase-features li {
  margin-bottom: 0.5rem;
}

/* Beta timeline styles */
.timeline {
  margin: 3rem 0;
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100px;
  width: 2px;
  background: var(--primary-color);
}

.timeline-item {
  position: relative;
  padding-left: 130px;
  margin-bottom: 3rem;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-date {
  position: absolute;
  left: 0;
  top: 0;
  width: 90px;
  text-align: right;
  font-weight: 500;
  color: var(--primary-color);
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: 97px;
  top: 5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--background-dark);
  border: 2px solid var(--primary-color);
}

.timeline-item.current::before {
  background: var(--primary-color);
}

.timeline-content {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.timeline-item.current .timeline-content {
  border-color: var(--primary-color);
}

.timeline-content h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

/* Post-beta styles */
.post-beta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.post-beta-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.post-beta-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.post-beta-card ul {
  padding-left: 1.5rem;
}

.post-beta-card li {
  margin-bottom: 0.5rem;
}

.tech-cta {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  padding: 2rem;
  text-align: center;
  margin: 3rem 0;
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
}

.tech-cta h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.tech-cta p {
  margin-bottom: 1.5rem;
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
  
  .timeline::before {
    left: 80px;
  }
  
  .timeline-item {
    padding-left: 110px;
  }
  
  .timeline-date {
    width: 70px;
  }
  
  .timeline-item::before {
    left: 77px;
  }
}
</style> 