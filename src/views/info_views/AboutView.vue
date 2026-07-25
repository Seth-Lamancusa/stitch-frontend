<template>
  <InfoViewLayout
    pageTitle="About"
    pageSubtitle="Stitch is forward-thinking and optimistic."
    heroClass="about-hero"
    :showBetaBanner="false"
  >
    <section class="about-main">
      <div class="container">
        <div class="about-content">
          <!-- Table of Contents -->
          <div class="table-of-contents">
            <h2>Contents</h2>
            <ul>
              <li><a href="#problem">The Problem</a></li>
              <li><a href="#philosophy">Philosophy</a></li>
              <li><a href="#automation">Autonomy and Automation</a></li>
              <li><a href="#data">Data</a></li>
            </ul>
          </div>

          <!-- Problem Section -->
          <div id="problem" class="about-section">
            <h2>The Problem</h2>
            <div class="section-content">
              <ol>
                <li>Communications are siloed. Slack doesn't talk to emails, which don't talk to text messages, which don't talk to ChatGPT or Cursor.</li>
                <li>Orgs lose value every time an employee uses a chatbot or AI agent that is not integrated into the organization's workflow and data.</li>
                <li>It's impossible today to collaborate with and leverage AI in group or team contexts.</li>
                <li>At the same time, the prevalence of digital, text communications in our work and lives has only increased in frequency, making the possible sources of data begetting analysis wealthy with opportunity.</li>
              </ol>
              <h3>The Solution: a highly functional, unopinionated, API-accessible communications layer</h3>
              <ol>
                <li>Stitch is designed to be open. It is a thin, lightweight application that gives the user direct, programmatic access to its functionality</li>
                <li>This makes it easy to automate data processing and retrieval tasks in an organizational context</li>
                <li>Stitch bots belong to your organization, not the platform, making behavior auditability and resource access control easy</li>
                <li>We emphasize communications, between humans and chatbots, as valuable training data and context</li>
              </ol>
            </div>
          </div>

          <!-- Philosophy Section -->
          <div id="philosophy" class="about-section">
            <h2>Philosophy</h2>
            <div class="section-content">
              <h3>Technical</h3>
              <ol>
                <li>Stitch is designed for a future where humans and AI agents collaborate over long time horizons on real work</li>
                <li>In general, the future of the AI industry is distributed, open, accessible, and diverse with respect to model and application choice</li>
                <li>AI coding agents will become sufficiently autonomous in the future to operate on multi-day, then multi-week time horizons</li>
                <li>The field of AI applications will also continue to become increasingly diverse, multimodal, and flexible</li>
                <li>We believe the field of AI researchers will continue to innovate, with a gradual turn away from LLMs alone and back toward RL, recurrent, or even symbolic systems, and toward natively multimodal ones.</li>
              </ol>
              <h3>Felt</h3>
              <ol>
                <li>Your data is downloadable and accessible first, and size limits on multimodel attachment data are modern</li>
                <li>We want your inbox to feel more like your mailbox than your feed (people you know, work with, etc), while still enabling public search, sharing, and discovery</li>
                <li>We want working with diverse, open source, multimodal models and datasets to be easy</li>
              </ol>
            </div>
          </div>

          <!-- Autonomy and Automation Section -->
          <div id="automation" class="about-section">
            <h2>Autonomy and Automation</h2>
            <div class="section-content">
              <h4>Manage autonomous workflows between siloed AI agents working in different parts of an organization on different data sets</h4>
              <p>Stitch makes it clear and auditable who does what, who has access to what data, and how decisions are made in agent-in-the-loop contexts. As the level of tasks achievable by and in collaboration with AI models increases in complexity and duration, the level of auditability elevates from log-level to commmunications and access-level, just as it already is with human organizations. This makes provenence clear for decisions and execution.</p>
            </div>
          </div>

          <!-- Data Section -->
          <div id="data" class="about-section">
            <h2>Data</h2>
            <div class="section-content">
              <p>We believe in a future where data is valuable and you have a right to own and sell your own by default. Multimodal team communications and AI conversations represent high-frequency, high-signal, unleveraged data streams.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style scoped>
.about-main {
  padding: 4rem 0;
  background: var(--background-dark);
}

.about-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Table of Contents */
.table-of-contents {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 2rem;
  margin-bottom: 3rem;
}

.table-of-contents h2 {
  color: var(--color-primary, #4f8cff);
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.table-of-contents ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.table-of-contents li {
  margin-bottom: 0.75rem;
}

.table-of-contents a {
  color: var(--text-light);
  text-decoration: none;
  font-size: 1rem;
  transition: color 0.2s ease;
}

.table-of-contents a:hover {
  color: var(--color-primary, #4f8cff);
}

/* About Sections */
.about-section {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 2.5rem;
  margin-bottom: 2.5rem;
  scroll-margin-top: 2rem;
}

.about-section h2 {
  color: var(--color-primary, #4f8cff);
  margin-bottom: 1.5rem;
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.3;
}

.section-content {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 1rem;
}

.section-content h3 {
  color: var(--text-light);
  margin: 2rem 0 1rem 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.section-content h3:first-child {
  margin-top: 0;
}

.section-content ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

.section-content li {
  margin: 0.5rem 0;
}

.section-content a {
  color: var(--color-primary, #4f8cff);
  text-decoration: underline;
}

.section-content a:hover {
  opacity: 0.8;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .about-main {
    padding: 2rem 0;
  }

  .about-content {
    padding: 0 1rem;
  }

  .table-of-contents {
    padding: 1.5rem;
  }

  .table-of-contents h2 {
    font-size: 1.3rem;
  }

  .about-section {
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .about-section h2 {
    font-size: 1.6rem;
  }

  .section-content {
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .table-of-contents {
    padding: 1.25rem;
  }

  .about-section {
    padding: 1.25rem;
  }

  .about-section h2 {
    font-size: 1.4rem;
  }

  .section-content {
    font-size: 0.9rem;
  }
}
</style>

