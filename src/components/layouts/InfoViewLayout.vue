<template>
  <div class="website-container">
    <!-- Navigation -->
    <header>
      <nav class="main-nav">
        <div class="logo">
          <router-link to="/home" class="logo-link">
            <span class="logo-text">Stitch</span>
          </router-link>
        </div>
        <ul class="nav-links" :class="{ active: isMenuOpen }">
          <li><router-link to="/home" :class="{ active: currentRoute === '/home' }">Home</router-link></li>
          <!-- <li><router-link to="/architecture" :class="{ active: currentRoute === '/architecture' }">Architecture</router-link></li> -->
          <li><router-link to="/features" :class="{ active: currentRoute === '/features' }">Features</router-link></li>
          <li><router-link to="/how" :class="{ active: currentRoute.startsWith('/how') }">How it works</router-link></li>
          <li><router-link to="/terms" :class="{ active: currentRoute === '/terms' }">Terms</router-link></li>
          <li><router-link to="/history" class="login-btn">Go to Stitch</router-link></li>
        </ul>
        <div class="hamburger" @click="toggleMenu" :class="{ active: isMenuOpen }">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </nav>
    </header>

    <!-- Global Notifications -->
    <GlobalNotifications />

    <!-- Page Hero Section with dynamic title and subtitle -->
    <section class="page-hero" :class="heroClass">
      <div class="hero-content">
        <h1 v-html="pageTitle"></h1>
        <p>{{ pageSubtitle }}</p>
      </div>
    </section>

    <!-- Beta Phase Banner - Only shown if showBetaBanner is true -->
    <section v-if="showBetaBanner" class="beta-banner">
      <div class="container">
        <div class="banner-content">
          <div v-if="betaBannerIcon" class="banner-icon">{{ betaBannerIcon }}</div>
          <div class="banner-text">
            <h3 v-if="betaBannerTitle">{{ betaBannerTitle }}</h3>
            <p>
              <slot name="betaBannerText">
                {{ betaBannerText || 'We\'re currently in beta, focusing on perfecting the platform experience.' }}
              </slot>
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Main content slot -->
    <slot></slot>

    <!-- Footer -->
    <footer>
      <div class="footer-content">
        <div class="footer-logo">
          <h2>Stitch</h2>
          <p>{{ footerTagline || 'The collaborative platform for humans and AI agents' }}</p>
          <div class="contact-info">
            <p>Contact us at <a href="mailto:seth@stitch.fyi">seth@stitch.fyi</a></p>
            <p><router-link to="/terms">Terms & Conditions</router-link></p>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import GlobalNotifications from '../GlobalNotifications.vue';

// Props for customization
const props = defineProps({
  pageTitle: {
    type: String,
    required: true
  },
  pageSubtitle: {
    type: String,
    default: ''
  },
  heroClass: {
    type: String,
    default: ''
  },
  showBetaBanner: {
    type: Boolean,
    default: true
  },
  betaBannerIcon: {
    type: String,
    default: ''
  },
  betaBannerTitle: {
    type: String,
    default: ''
  },
  betaBannerText: {
    type: String,
    default: 'We\'re currently in beta, focusing on perfecting the platform experience.'
  },
  footerTagline: {
    type: String,
    default: 'The collaborative platform for humans and AI agents'
  }
});

// Current route for active links
const route = useRoute();
const currentRoute = computed(() => route.path);

// State for mobile menu toggle
const isMenuOpen = ref(false);

// Function to toggle mobile menu
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

// Reset body and html styles to prevent issues with fixed app layouts
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
  // Reset styles to ensure proper display
  resetStyles();
  
  // Add event listener to ensure styles remain reset on window resize
  window.addEventListener('resize', resetStyles);
});

onBeforeUnmount(() => {
  // Remove event listeners when component is unmounted
  window.removeEventListener('resize', resetStyles);
});
</script>

<style>
@import '../../assets/website.css';

/* Logo styling to match MessageListView */
.logo-link {
  text-decoration: none;
}

.logo-link:hover .logo-text {
  opacity: 0.9;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-primary, #4f8cff);
  letter-spacing: 1px;
}

/* Contact info styling */
.contact-info {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 1rem;
}

.contact-info a {
  color: var(--color-primary, #4f8cff);
  transition: opacity 0.2s ease;
}

.contact-info a:hover {
  opacity: 0.8;
}

/* Hero paragraph style */
.page-hero .hero-content p {
  margin-bottom: 0;
}

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
</style> 