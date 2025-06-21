<template>
  <InfoViewLayout
    pageTitle="Terms & Conditions"
    pageSubtitle="Legal notes regarding our use of crossposting between platforms, webscraping, intellectual property, and terms of use."
    heroClass="legal-hero"
    :showBetaBanner="true"
    betaBannerIcon="📝"
    betaBannerTitle="A Legal Landscape"
    betaBannerText="Our legal system finds itself at the intersection of a sudden political upheaval and a technological revolution."
    footerTagline="Building the multiplayer AI chat platform for seamless human-AI collaboration"
  >
    <!-- Coming Soon Section - Will replace with actual content later -->
    <section class="coming-soon-section">
      <div class="container">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">📄</div>
          <h2>Terms & Conditions Coming Soon</h2>
          <p>Our legal team is finalizing our terms and conditions. The complete document will be available here soon.</p>
          <router-link to="/inbox" class="btn primary-btn">Go to Stitch App</router-link>
        </div>
      </div>
    </section>
    
    <!-- Legal Details Layout - Hidden until content is ready -->
    <div class="legal-details-layout" style="display: none;">
      <!-- Navigation Sidebar -->
      <aside class="section-nav">
        <h3>Quick Navigation</h3>
        <ul>
          <li><a href="#overview" @click.prevent="scrollToSection('overview')" :class="{ active: activeSection === 'overview' }">Overview</a></li>
          <li><a href="#account-terms" @click.prevent="scrollToSection('account-terms')" :class="{ active: activeSection === 'account-terms' }">Account Terms</a></li>
          <li><a href="#acceptable-use" @click.prevent="scrollToSection('acceptable-use')" :class="{ active: activeSection === 'acceptable-use' }">Acceptable Use</a></li>
          <li><a href="#ai-interactions" @click.prevent="scrollToSection('ai-interactions')" :class="{ active: activeSection === 'ai-interactions' }">AI Interactions</a></li>
          <li><a href="#content-rights" @click.prevent="scrollToSection('content-rights')" :class="{ active: activeSection === 'content-rights' }">Content Rights</a></li>
          <li><a href="#privacy" @click.prevent="scrollToSection('privacy')" :class="{ active: activeSection === 'privacy' }">Privacy Policy</a></li>
          <li><a href="#subscription" @click.prevent="scrollToSection('subscription')" :class="{ active: activeSection === 'subscription' }">Subscription Terms</a></li>
          <li><a href="#liability" @click.prevent="scrollToSection('liability')" :class="{ active: activeSection === 'liability' }">Liability</a></li>
          <li><a href="#termination" @click.prevent="scrollToSection('termination')" :class="{ active: activeSection === 'termination' }">Termination</a></li>
          <li><a href="#changes" @click.prevent="scrollToSection('changes')" :class="{ active: activeSection === 'changes' }">Changes to Terms</a></li>
        </ul>
      </aside>

      <!-- Main Content -->
      <main class="legal-content">
        <!-- Overview Section -->
        <section id="overview" class="legal-section" ref="overviewSection">
          <h2>Terms Overview</h2>
          <p class="terms-effective">Effective Date: June 1, 2024</p>
          
          <div class="legal-card">
            <h3>Welcome to Stitch</h3>
            <p>These Terms and Conditions ("Terms") govern your use of the Stitch multiplayer AI chat platform (the "Service"), operated by Stitch AI Inc. By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service.</p>
            
            <div class="terms-highlight">
              <p><strong>Important:</strong> Stitch is an AI-powered chat platform. While we strive for high-quality, helpful, and safe AI interactions, please remember that AI responses:</p>
              <ul>
                <li>May occasionally contain inaccuracies or misunderstandings</li>
                <li>Should not be relied upon for critical decisions without verification</li>
                <li>Do not represent legal, medical, financial, or professional advice</li>
                <li>Are generated based on their training data and may reflect biases present in that data</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Account Terms Section -->
        <section id="account-terms" class="legal-section" ref="accountTermsSection">
          <h2>Account Terms</h2>
          
          <div class="legal-card">
            <h3>Creating and Maintaining Your Account</h3>
            <p>To access certain features of our Service, you must register for an account. When creating your account, you agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            
            <p>You must be at least 16 years old to create an account. If you are under 18, you represent that you have your parent's or legal guardian's permission to use the Service.</p>
          </div>
        </section>

        <!-- Acceptable Use Section -->
        <section id="acceptable-use" class="legal-section" ref="acceptableUseSection">
          <h2>Acceptable Use Policy</h2>
          
          <div class="legal-card">
            <h3>Using Stitch Responsibly</h3>
            <p>When using our Service, you agree not to:</p>
            <ul>
              <li>Use the Service to violate any law or regulation</li>
              <li>Harass, abuse, or harm another person or group</li>
              <li>Impersonate another user or person</li>
              <li>Post content that is hateful, threatening, pornographic, or incites violence</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Use the Service to generate, access, or distribute harmful or illegal content</li>
              <li>Use the Service in any way that could disable, overburden, or impair the Service</li>
              <li>Attempt to reverse-engineer the AI models or platform technology</li>
              <li>Use the Service for automated scraping or data collection</li>
            </ul>
            
            <p>We reserve the right to terminate or suspend access to our Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users of the Service, us, or third parties, or for any other reason at our discretion.</p>
          </div>
        </section>

        <!-- AI Interactions Section -->
        <section id="ai-interactions" class="legal-section" ref="aiInteractionsSection">
          <h2>AI Interactions</h2>
          
          <div class="legal-card">
            <h3>Understanding AI Capabilities and Limitations</h3>
            <p>Stitch provides access to AI agents powered by large language models (LLMs). When interacting with these AI agents, please understand:</p>
            
            <ul>
              <li><strong>AI Responses:</strong> AI responses are generated based on patterns in training data and may not always be accurate, appropriate, or reflect the latest information.</li>
              <li><strong>Not Professional Advice:</strong> AI responses should never be considered professional advice in fields such as medicine, law, finance, or other specialized domains.</li>
              <li><strong>Content Moderation:</strong> We employ safety measures and content filters, but inappropriate content may occasionally be generated. Please report any concerning interactions.</li>
              <li><strong>AI Personalities:</strong> AI agents with different personalities are simulations designed for engaging interactions. They do not represent real individuals or entities.</li>
              <li><strong>Human/AI Distinction:</strong> The platform clearly labels which participants are AI and which are human. Impersonating an AI or misrepresenting AI-generated content as human-written is prohibited.</li>
            </ul>
          </div>
        </section>

        <!-- Content Rights Section -->
        <section id="content-rights" class="legal-section" ref="contentRightsSection">
          <h2>Content Rights</h2>
          
          <div class="legal-card">
            <h3>Your Content</h3>
            <p>You retain all rights to the content you create, upload, or share through the Service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish, translate, and distribute your User Content in connection with providing and improving the Service.</p>
            
            <h3>AI-Generated Content</h3>
            <p>Content generated by AI through the Service ("AI-Generated Content") is subject to the following terms:</p>
            <ul>
              <li>You may use AI-Generated Content for personal and commercial purposes, subject to the limitations below</li>
              <li>You may not claim copyright or intellectual property rights to raw AI-Generated Content</li>
              <li>If you substantially modify or transform AI-Generated Content, you may have rights to your modifications</li>
              <li>You may not use AI-Generated Content to train competing AI systems</li>
              <li>You are responsible for how you use AI-Generated Content</li>
            </ul>
          </div>
        </section>

        <!-- Privacy Section -->
        <section id="privacy" class="legal-section" ref="privacySection">
          <h2>Privacy Policy</h2>
          
          <div class="legal-card">
            <h3>How We Use Your Data</h3>
            <p>We care about your privacy and are committed to protecting your personal data. Our privacy practices are detailed in our <a href="/static/html/privacy.html">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>
            
            <h3>Key Privacy Points</h3>
            <p>Important aspects of our privacy practices include:</p>
            <ul>
              <li><strong>Data Collection:</strong> We collect information necessary to provide and improve the Service, including account information, chat content, and usage data.</li>
              <li><strong>Service Improvement:</strong> Unless you opt out, we may use anonymized conversation data to improve our AI models and service quality.</li>
              <li><strong>Data Sharing:</strong> We do not sell your personal data. We may share data with service providers who help us operate the platform.</li>
              <li><strong>Security:</strong> We implement appropriate security measures to protect your data.</li>
              <li><strong>Data Rights:</strong> Depending on your location, you may have rights to access, correct, or delete your personal data.</li>
            </ul>
          </div>
        </section>

        <!-- Subscription Terms Section -->
        <section id="subscription" class="legal-section" ref="subscriptionSection">
          <h2>Subscription Terms</h2>
          
          <div class="legal-card">
            <h3>Free and Premium Services</h3>
            <p>Stitch offers both free and premium subscription tiers:</p>
            
            <ul>
              <li><strong>Free Tier:</strong> Provides basic access to the platform with limitations on usage, AI model selection, and features.</li>
              <li><strong>Premium Tiers:</strong> Offer enhanced features, higher usage limits, priority access, and advanced AI capabilities for a recurring fee.</li>
            </ul>
            
            <h3>Billing and Cancellation</h3>
            <p>For premium subscriptions:</p>
            <ul>
              <li>Subscription fees are billed in advance on a monthly or annual basis</li>
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>You may cancel your subscription at any time through your account settings</li>
              <li>We do not provide refunds for partial subscription periods</li>
              <li>Promotional or discounted subscriptions may have additional terms</li>
            </ul>
            
            <p>We reserve the right to change subscription pricing with 30 days' notice to existing subscribers.</p>
          </div>
        </section>

        <!-- Liability Section -->
        <section id="liability" class="legal-section" ref="liabilitySection">
          <h2>Limitation of Liability</h2>
          
          <div class="legal-card">
            <h3>Disclaimer of Warranties</h3>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.</p>
            
            <h3>Limitation of Liability</h3>
            <p>IN NO EVENT SHALL STITCH, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES, BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:</p>
            <ul>
              <li>YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE;</li>
              <li>ANY CONDUCT OR CONTENT OF ANY THIRD PARTY OR AI ON THE SERVICE;</li>
              <li>ANY CONTENT OBTAINED FROM THE SERVICE; AND</li>
              <li>UNAUTHORIZED ACCESS, USE OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.</li>
            </ul>
          </div>
        </section>

        <!-- Termination Section -->
        <section id="termination" class="legal-section" ref="terminationSection">
          <h2>Termination</h2>
          
          <div class="legal-card">
            <h3>Account Termination</h3>
            <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.</p>
            
            <p>You may also terminate your account at any time by contacting us or using the account deletion option in your account settings.</p>
            
            <h3>Effect of Termination</h3>
            <p>Upon termination:</p>
            <ul>
              <li>Your access to the Service will be revoked</li>
              <li>We may delete your account data according to our data retention policies</li>
              <li>Certain provisions of the Terms will continue to apply even after termination</li>
            </ul>
          </div>
        </section>

        <!-- Changes to Terms Section -->
        <section id="changes" class="legal-section" ref="changesSection">
          <h2>Changes to Terms</h2>
          
          <div class="legal-card">
            <h3>Updates to These Terms</h3>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any significant changes by posting the new Terms on this page and updating the "Effective Date" at the top.</p>
            
            <p>By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised Terms. If you do not agree to the new Terms, please stop using the Service.</p>
            
            <h3>Contact Us</h3>
            <p>If you have any questions about these Terms, please contact us at:</p>
            <p><strong>Email:</strong> terms@stitchchat.ai</p>
            <p>We strive to respond to all inquiries within 3 business days.</p>
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
const accountTermsSection = ref(null);
const acceptableUseSection = ref(null);
const aiInteractionsSection = ref(null);
const contentRightsSection = ref(null);
const privacySection = ref(null);
const subscriptionSection = ref(null);
const liabilitySection = ref(null);
const terminationSection = ref(null);
const changesSection = ref(null);

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
    { ref: accountTermsSection, id: 'account-terms' },
    { ref: acceptableUseSection, id: 'acceptable-use' },
    { ref: aiInteractionsSection, id: 'ai-interactions' },
    { ref: contentRightsSection, id: 'content-rights' },
    { ref: privacySection, id: 'privacy' },
    { ref: subscriptionSection, id: 'subscription' },
    { ref: liabilitySection, id: 'liability' },
    { ref: terminationSection, id: 'termination' },
    { ref: changesSection, id: 'changes' }
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

/* Legal-specific styles */
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

.legal-details-layout {
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.legal-content {
  min-height: 100vh;
}

.legal-section {
  margin-bottom: 4rem;
  scroll-margin-top: 100px;
}

.legal-section:last-child {
  margin-bottom: 6rem;
}

.legal-section h2 {
  margin-bottom: 2rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--card-border);
}

.legal-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  border: 1px solid var(--card-border);
  padding: 2.5rem;
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
}

.legal-card:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  background: var(--gradient-primary);
}

.legal-card h3 {
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  font-size: 1.6rem;
}

.terms-effective {
  font-style: italic;
  margin-bottom: 2rem;
  color: var(--text-light);
}

.terms-highlight {
  background-color: rgba(98, 0, 234, 0.1);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  margin: 2rem 0;
}

@media (max-width: 992px) {
  .legal-details-layout {
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
  .coming-soon-section {
    padding: 3rem 1rem;
  }
  
  .coming-soon-content {
    padding: 2rem 1.5rem;
  }
  
  .coming-soon-content h2 {
    font-size: 2rem;
  }
  
  .coming-soon-icon {
    font-size: 3rem;
  }
  
  .legal-details-layout {
    padding: 0 1rem;
  }
  
  .section-nav {
    padding: 1.5rem;
  }
  
  .section-nav h3 {
    font-size: 1.1rem;
  }
  
  .legal-card {
    padding: 1.5rem;
  }
  
  .legal-card h3 {
    font-size: 1.4rem;
  }
  
  .legal-section h2 {
    font-size: 1.5rem;
  }
  
  .terms-highlight {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .coming-soon-content h2 {
    font-size: 1.8rem;
  }
  
  .coming-soon-content p {
    font-size: 1rem;
  }
  
  .legal-card {
    padding: 1rem;
  }
  
  .legal-card h3 {
    font-size: 1.2rem;
  }
  
  .legal-section h2 {
    font-size: 1.3rem;
  }
  
  .section-nav {
    padding: 1rem;
  }
  
  .section-nav ul li a {
    font-size: 0.9rem;
  }
}
</style> 