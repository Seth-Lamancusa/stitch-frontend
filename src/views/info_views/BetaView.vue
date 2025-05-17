<template>
  <InfoViewLayout
    pageTitle="Join Stitch Beta"
    pageSubtitle="Help shape the future of decentralized communication for the Web3 ecosystem"
    heroClass="beta-hero"
    :showBetaBanner="true"
    betaBannerIcon="ℹ️"
    betaBannerTitle="Beta Infrastructure: Google Cloud Platform"
    betaBannerText="We're currently deploying on GCP for stability during the beta phase. Post-beta, we'll transition to a fully decentralized infrastructure. Your feedback will help us refine this transition."
    footerTagline="Building the decentralized communication infrastructure for the blockchain era"
  >
    <!-- Beta Sign Up Section -->
    <section class="beta-signup">
      <div class="container">
        <div class="signup-content">
          <div class="signup-text">
            <h2>What You'll Be Testing</h2>
            <div class="beta-features">
              <div class="beta-feature">
                <div class="feature-icon">🔐</div>
                <div class="feature-detail">
                  <h3>Phantom Wallet Authentication</h3>
                  <p>Test Solana blockchain authentication through Phantom wallet integration—no personal data required.</p>
                </div>
              </div>
              <div class="beta-feature">
                <div class="feature-icon">📡</div>
                <div class="feature-detail">
                  <h3>Ephemeral Message Architecture</h3>
                  <p>Experience how messages exist on servers only until retrieved, then persist solely within your client.</p>
                </div>
              </div>
              <div class="beta-feature">
                <div class="feature-icon">💰</div>
                <div class="feature-detail">
                  <h3>Tokenized Monetization</h3>
                  <p>Test the dual fee structure—host fees for message delivery and creator fees for content retrieval.</p>
                </div>
              </div>
              <div class="beta-feature">
                <div class="feature-icon">🤖</div>
                <div class="feature-detail">
                  <h3>Bot API Integration</h3>
                  <p>Interact with and potentially build bots that communicate through the platform using our JavaScript API.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="signup-form-container">
            <div class="form-container">
              <h2>Sign Up for Beta Access</h2>
              <form id="betaSignupForm" class="beta-form" target="hidden-iframe" method="post">
                <input type="hidden" name="action" value="submit-form">
                <div class="form-group">
                  <label for="email">Email Address <span class="optional">(Optional)</span></label>
                  <input type="email" id="email" name="email">
                  <small class="form-hint">Optional, but helpful if you want updates about your application</small>
                </div>
                <div class="form-group">
                  <label for="walletAddress">Solana Wallet Address <span class="required">*</span></label>
                  <input type="text" id="walletAddress" name="walletAddress" placeholder="Enter your Solana wallet address" required>
                  <small class="form-hint">You'll need a Phantom wallet to use the platform</small>
                </div>
                <div class="form-group">
                  <label for="experience">Experience with Crypto/Blockchain <span class="required">*</span></label>
                  <select id="experience" name="experience" required>
                    <option value="">Select your experience level</option>
                    <option value="Beginner">Beginner - New to blockchain</option>
                    <option value="Intermediate">Intermediate - Some experience</option>
                    <option value="Advanced">Advanced - Regular blockchain user</option>
                    <option value="Expert">Expert - Developer or professional</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="technical">Technical Background <span class="required">*</span></label>
                  <select id="technical" name="technical" required>
                    <option value="">Select your background</option>
                    <option value="Developer">Developer</option>
                    <option value="Designer">UI/UX Designer</option>
                    <option value="Crypto Enthusiast">Crypto Enthusiast</option>
                    <option value="Content Creator">Content Creator</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="usage">How do you plan to use The Source? <span class="required">*</span></label>
                  <textarea id="usage" name="usage" rows="4" required placeholder="e.g., building bots, testing the monetization model, creating content..."></textarea>
                </div>
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="updates" name="updates" value="Yes" checked>
                  <label for="updates">Receive updates about The Source</label>
                </div>
                <button type="submit" class="btn primary-btn">Submit Application</button>
              </form>
              <iframe name="hidden-iframe" id="hidden-iframe" style="display:none"></iframe>
              <div id="formStatus" class="form-status"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Technical Resources Section -->
    <section class="technical-resources">
      <div class="container">
        <h2>Technical Resources</h2>
        <p class="section-intro">Interested in the technical aspects of The Source? Explore our dedicated technical pages for detailed information.</p>
        
        <div class="resources-grid">
          <div class="resource-card">
            <h3>Core Technology</h3>
            <p>Learn about the blockchain authentication, ephemeral messaging, tokenized economy, and bot framework powering The Source.</p>
            <router-link to="/roadmap" class="btn secondary-btn">View Technology</router-link>
          </div>
          
          <div class="resource-card">
            <h3>System Architecture</h3>
            <p>Explore our current beta infrastructure and planned post-beta decentralized architecture.</p>
            <router-link to="/roadmap" class="btn secondary-btn">View Architecture</router-link>
          </div>
          
          <div class="resource-card">
            <h3>Development Roadmap</h3>
            <p>See our detailed development timeline from beta through full decentralization.</p>
            <router-link to="/roadmap" class="btn secondary-btn">View Roadmap</router-link>
          </div>
          
          <div class="resource-card">
            <h3>Developer Resources</h3>
            <p>Access API documentation, integration examples, and self-hosting information.</p>
            <router-link to="/roadmap" class="btn secondary-btn">View Technical Details</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Participant Benefits Section -->
    <section class="benefits">
      <div class="container">
        <h2>Beta Tester Benefits</h2>
        <div class="benefits-grid">
          <div class="benefit-card">
            <div class="benefit-icon">🔑</div>
            <h3>Early Access</h3>
            <p>Be among the first to experience and shape the platform before public launch.</p>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">🏆</div>
            <h3>Token Rewards</h3>
            <p>Earn test tokens for active participation and valuable feedback during the beta phase.</p>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">🧠</div>
            <h3>Direct Input</h3>
            <p>Directly influence product development with your suggestions and feedback.</p>
          </div>
          <div class="benefit-card">
            <div class="benefit-icon">💼</div>
            <h3>Network Access</h3>
            <p>Connect with other blockchain enthusiasts and developers in the Web3 space.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="beta-faq">
      <div class="container">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-grid">
          <div class="faq-item">
            <h3>Why are you starting on GCP instead of a decentralized infrastructure?</h3>
            <p>During the beta phase, we're prioritizing stability, scalability, and rapid iteration. GCP provides the reliable foundation we need for thorough testing. Our architecture is specifically designed with decentralization in mind, and we'll transition to a fully decentralized model after validating core functionality.</p>
          </div>
          <div class="faq-item">
            <h3>Do I need a Phantom wallet to participate?</h3>
            <p>Yes, a Phantom wallet is required for authentication. Since our platform uses Solana for validation and payments, every user (including beta testers) must authenticate via Phantom. If you're new to Phantom, we can provide guidance on setting it up.</p>
          </div>
          <div class="faq-item">
            <h3>How technical do I need to be to participate in the beta?</h3>
            <p>We welcome participants with varying technical backgrounds. If you're a blockchain enthusiast who uses wallets and DeFi applications, you'll be able to test the core platform features. For developers interested in building bots or integrating with our API, more technical experience is beneficial.</p>
          </div>
          <div class="faq-item">
            <h3>Will I need to pay fees during the beta?</h3>
            <p>We'll provide test tokens for beta participants to experiment with the monetization features. You won't need to use real funds during testing, though the payment infrastructure will use actual Solana wallets for authentication.</p>
          </div>
          <div class="faq-item">
            <h3>What kind of feedback are you looking for?</h3>
            <p>We're particularly interested in feedback on the user experience, the effectiveness of our ephemeral message architecture, the fairness of the dual fee structure, and suggestions for bot integration capabilities that would be valuable to developers and users.</p>
          </div>
          <div class="faq-item">
            <h3>Can I build bots during the beta?</h3>
            <p>Yes! We encourage developers to experiment with our bot API. We'll provide documentation and examples to help you get started building bots that can interact with users on the platform.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="cta-content">
        <h2>Ready to help build the next generation of decentralized communication?</h2>
        <p>Join our beta program today and be part of the blockchain communication revolution.</p>
        <a href="#betaSignupForm" class="btn primary-btn">Apply Now</a>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
import { onMounted } from 'vue';

onMounted(() => {
  // Beta signup form handling
  const betaForm = document.getElementById('betaSignupForm');
  const formStatus = document.getElementById('formStatus');
  const iframe = document.getElementById('hidden-iframe');
  
  if (betaForm && iframe) {
    // Set the form action to your Google Apps Script URL
    betaForm.action = 'https://script.google.com/macros/s/AKfycbyiX25QksLdH06gsNQ63SSSGggnoHwXLELEp1zZyFOKQjphO4Mm61tw8MnGhHr7IQ8/exec';
    
    // Variable to track if form was submitted
    let formSubmitted = false;
    
    // Listen for iframe load events
    iframe.addEventListener('load', function() {
      // Only show success message if the form was actually submitted
      if (formSubmitted) {
        // Show success message after form submission
        formStatus.innerHTML = '<div class="success-message">Thank you for your interest! We\'ve received your application and will contact you when beta access is available.</div>';
        betaForm.reset();
        
        // Scroll to the status message
        formStatus.scrollIntoView({ behavior: 'smooth' });
        
        // Reset the flag for future submissions
        formSubmitted = false;
      }
    });
    
    // Form submit event
    betaForm.addEventListener('submit', function(e) {
      // Set the flag to indicate form was submitted
      formSubmitted = true;
      
      // Show loading state
      const submitBtn = betaForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      // Add a timeout to reset button if submission takes too long
      setTimeout(function() {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }, 5000);
    });
  }
  
  // Mobile dropdown toggling
  document.addEventListener('DOMContentLoaded', function() {
    // For mobile dropdown toggle
    document.querySelectorAll('.dropdown-btn').forEach(function(dropdown) {
      dropdown.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          this.parentElement.classList.toggle('active');
        }
      });
    });
  });
  
  // Smooth scroll to form when "Apply Now" is clicked
  const applyNowBtn = document.querySelector('.cta .primary-btn');
  if (applyNowBtn) {
    applyNowBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const formElement = document.getElementById('betaSignupForm');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
        // Focus on the first input after scrolling
        setTimeout(() => {
          document.getElementById('email').focus();
        }, 800);
      }
    });
  }
});
</script>

<style>
/* Beta-specific styles */
.beta-signup {
  padding: 5rem 2rem;
  background-color: var(--background-dark);
}

.signup-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 2rem 0;
}

.beta-features {
  margin-top: 2rem;
}

.beta-feature {
  display: flex;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  border: 1px solid var(--card-border);
  box-shadow: var(--box-shadow);
  transition: transform 0.3s ease;
}

.beta-feature:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 2rem;
  margin-right: 1.5rem;
  min-width: 40px;
  text-align: center;
}

.feature-detail h3 {
  margin-bottom: 0.5rem;
  color: var(--primary-color);
}

.form-container {
  background-color: var(--card-background);
  padding: 2rem;
  border-radius: var(--border-radius);
  border: 1px solid var(--card-border);
  box-shadow: var(--box-shadow);
}

.beta-form .form-group {
  margin-bottom: 1.5rem;
}

.beta-form label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.beta-form input[type="text"],
.beta-form input[type="email"],
.beta-form select,
.beta-form textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--input-border);
  border-radius: var(--border-radius);
  background-color: var(--input-background);
  color: var(--text-light);
  font-family: inherit;
}

.beta-form textarea {
  resize: vertical;
}

.form-hint {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.85rem;
  color: var(--text-light);
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-group input {
  margin-right: 0.5rem;
}

.required {
  color: #e53935;
}

.optional {
  color: var(--text-light);
  font-size: 0.9rem;
}

.form-status {
  margin-top: 2rem;
}

.success-message {
  padding: 1rem;
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 4px solid #4CAF50;
  border-radius: 0.25rem;
  color: #2E7D32;
}

/* Technical resources section */
.technical-resources {
  padding: 5rem 2rem;
  background-color: var(--background-dark);
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.resource-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  border: 1px solid var(--card-border);
  padding: 1.5rem;
  box-shadow: var(--box-shadow);
  transition: transform 0.3s ease;
}

.resource-card:hover {
  transform: translateY(-5px);
}

.resource-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.resource-card p {
  margin-bottom: 1.5rem;
  color: var(--text-light);
}

/* Benefits section */
.benefits {
  padding: 5rem 2rem;
  background-color: var(--secondary-background);
}

.benefits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.benefit-card {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  border: 1px solid var(--card-border);
  padding: 1.5rem;
  box-shadow: var(--box-shadow);
  text-align: center;
  transition: transform 0.3s ease;
}

.benefit-card:hover {
  transform: translateY(-5px);
}

.benefit-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.benefit-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

/* FAQ section */
.beta-faq {
  padding: 5rem 2rem;
  background-color: var(--background-dark);
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.faq-item {
  background-color: var(--card-background);
  border-radius: var(--border-radius);
  border: 1px solid var(--card-border);
  padding: 1.5rem;
  box-shadow: var(--box-shadow);
}

.faq-item h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

@media (max-width: 992px) {
  .signup-content {
    grid-template-columns: 1fr;
  }
  
  .faq-grid {
    grid-template-columns: 1fr;
  }
}
</style> 