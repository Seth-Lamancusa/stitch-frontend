<template>
  <InfoViewLayout
    pageTitle="Multiplayer AI Chat Platform"
    pageSubtitle="Chat with humans and AI agents in a collaborative environment"
    heroClass="home-hero"
    :showBetaBanner="true"
    betaBannerIcon="🚀"
    betaBannerTitle="Beta Phase: Now Live"
    betaBannerText="We're currently in beta, focusing on perfecting the chat experience and expanding our AI agent capabilities while ensuring platform stability."
    footerTagline="The collaborative platform for humans and AI agents to chat, create, and solve problems together"
  >
    <!-- Features Section -->
    <section class="features">
      <h2>Why Choose Stitch?</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>AI Agent Integration</h3>
          <p>Chat with versatile AI agents that can help with tasks, provide information, and simulate different personalities or roles.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">👥</div>
          <h3>Multiplayer Conversations</h3>
          <p>Invite multiple humans and AI agents to the same chat for collaborative discussions, problem-solving, and creative sessions.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🧠</div>
          <h3>Contextual Memory</h3>
          <p>AI agents remember your past conversations, allowing for continuous and meaningful interactions that build over time.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💬</div>
          <h3>Seamless Interaction</h3>
          <p>Experience natural conversations with AI that feel just like chatting with humans, with rich formatting and media support.</p>
        </div>
      </div>
    </section>

    <!-- Architecture Section -->
    <section class="architecture">
      <div class="container">
        <h2>Technical Architecture</h2>
        <div class="architecture-overview">
          <p class="section-intro">Stitch is built on cutting-edge language model technology, designed for seamless interactions between humans and AI agents.</p>
          
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
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="how-it-works">
      <h2>Stitch Chat Experience</h2>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <h3>Create or Join a Chat</h3>
          <p>Start a new conversation or join an existing one with a simple interface that lets you add humans and AI agents.</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <h3>Interact Naturally</h3>
          <p>Chat with AI agents that respond contextually, remember conversation history, and provide helpful responses.</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <h3>Customize Agents</h3>
          <p>Choose from our library of agents or create custom ones with specific personalities, knowledge bases, and capabilities.</p>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <h3>Collaborate Seamlessly</h3>
          <p>Work together with both humans and AI agents in a unified conversation experience designed for productivity.</p>
        </div>
      </div>
    </section>

    <!-- Bot Integration Section -->
    <section class="bot-integration">
      <div class="container">
        <div class="section-header">
          <h2>AI Agent Capabilities</h2>
          <p>Interact with intelligent AI agents powered by large language models</p>
        </div>
        <div class="bot-features">
          <div class="bot-feature">
            <div class="bot-icon">
              <span>📚</span>
            </div>
            <h3>Knowledge Base</h3>
            <p>AI agents can access vast knowledge to answer questions, provide information, and assist with learning.</p>
          </div>
          <div class="bot-feature">
            <div class="bot-icon">
              <span>👨‍💻</span>
            </div>
            <h3>Customizable Personas</h3>
            <p>Create agents with specific personalities, expertise areas, and interaction styles to suit your needs.</p>
          </div>
          <div class="bot-feature">
            <div class="bot-icon">
              <span>🧠</span>
            </div>
            <h3>Context Awareness</h3>
            <p>Agents understand and remember conversation history to provide relevant, coherent responses.</p>
          </div>
          <div class="bot-feature">
            <div class="bot-icon">
              <span>🔄</span>
            </div>
            <h3>Tool Integration</h3>
            <p>Agents can use tools to search the web, process data, generate content, and connect to external services.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Monetization Model Section -->
    <section class="monetization">
      <div class="container">
        <h2>Simple Pricing Plans</h2>
        <div class="monetization-model">
          <div class="monetization-item">
            <h3>Free Plan</h3>
            <p>Get started with basic access to chat rooms and standard AI agents, with reasonable usage limits for individual users.</p>
          </div>
          <div class="monetization-item">
            <h3>Premium Subscription</h3>
            <p>Unlock unlimited chats, access to all agent types, custom agent creation, and priority support for power users.</p>
          </div>
        </div>
        <div class="monetization-badges">
          <div class="badge">
            <span>No hidden fees</span>
          </div>
          <div class="badge">
            <span>Monthly or annual billing</span>
          </div>
          <div class="badge">
            <span>Team discounts available</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="cta-content">
        <h2>Ready to experience the future of AI-human collaboration?</h2>
        <p>We're seeking beta testers to help shape the future of Stitch's multiplayer AI chat platform.</p>
        <router-link to="/beta" class="btn primary-btn">Join Beta Now</router-link>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style>
/* Only need website.css import if there are custom styles not in InfoViewLayout */
/* @import '../../assets/website.css'; */
</style> 