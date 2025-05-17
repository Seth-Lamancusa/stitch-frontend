<template>
  <InfoViewLayout
    pageTitle="About Stitch"
    pageSubtitle="Building the future of human-AI collaboration through multiplayer chat"
    heroClass="about-hero"
    :showBetaBanner="true"
    betaBannerIcon="🚀"
    betaBannerTitle="Beta Phase: Expanding AI Capabilities"
    betaBannerText="During our beta phase, we're continuously improving our AI agents and multiplayer chat experience while gathering valuable user feedback."
    footerTagline="The collaborative platform for humans and AI agents to chat, create, and solve problems together"
  >
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
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
/* About Hero Section */
.about-hero {
  background: linear-gradient(135deg, rgba(109, 72, 170, 0.2) 0%, rgba(157, 80, 187, 0.2) 100%);
}
</style> 