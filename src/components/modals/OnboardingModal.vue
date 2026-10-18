<template>
  <transition name="onboarding-fade">
    <div
      v-if="onboardingOpen"
      class="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      @pointerdown="onOverlayPointerDown"
      @click.self="onOverlayClick"
    >
      <div
        class="onboarding-modal"
        :class="{ 'is-tour': currentModal === 2 }"
        @click.stop
        @pointerdown="onContainerPointerDown"
      >
        <button
          type="button"
          class="close-button"
          title="Close (Esc)"
          aria-label="Close onboarding"
          @click="dismissOnboarding"
        >
          ×
        </button>

        <!-- ==================== MODAL 1: THEME PICKER ==================== -->
        <div v-if="currentModal === 1" class="onboarding-body simple-step">
          <h2 id="onboarding-title">Choose a theme</h2>

          <button
            type="button"
            class="theme-card"
            @click="selectTheme('pine-ink')"
          >
            <div class="theme-swatches">
              <span class="swatch" style="background: #121110"></span>
              <span class="swatch" style="background: #1c1e1c"></span>
              <span class="swatch" style="background: #598958"></span>
              <span class="swatch" style="background: #f3ecdc"></span>
            </div>
            <span class="theme-name">Pine &amp; Ink</span>
            <span class="theme-tag">Default</span>
          </button>
        </div>

        <!-- ==================== MODAL 2: ACTUAL MESSAGE NODE TOUR ==================== -->
        <div v-else-if="currentModal === 2" class="onboarding-body tour-step">
          <div
            class="real-node-stage"
            :class="`phase-${currentPhase.id}`"
            @click.capture="onNodeStageClick"
          >
            <div v-if="parentMessage" class="mock-parent">
              <div class="mock-parent-header">
                <span class="mock-parent-name">{{ parentMessage.author?.display_name }}</span>
                <span class="mock-parent-tag">@{{ parentMessage.author?.user_tag }}</span>
              </div>
              <p class="mock-parent-body">{{ parentMessage.content }}</p>
            </div>

            <MessageNode
              v-if="activeChildMessage"
              :key="activeChildMessage.id"
              :message="activeChildMessage"
              :active-parent-id="DEMO_REPLY_PARENT_ID"
              display-mode="full"
              :compact="false"
              :selectable="true"
              :selected="false"
              :in-list-view="false"
              reveal-toolbar
              :reveal-menu="currentPhase.id === 'menu'"
            />
          </div>

          <!-- Simple Phase Description -->
          <div class="phase-info">
            <div class="phase-counter-row">
              <button
                type="button"
                class="phase-chevron"
                aria-label="Previous step"
                :disabled="currentPhaseIndex === 0"
                @click="setPhase(currentPhaseIndex - 1)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3.5 L5 8 L10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <span class="phase-counter">
                {{ currentPhaseIndex + 1 }} / {{ phases.length }}
              </span>
              <button
                type="button"
                class="phase-chevron"
                aria-label="Next step"
                :disabled="currentPhaseIndex >= phases.length - 1"
                @click="setPhase(currentPhaseIndex + 1)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5 L11 8 L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
            <h2 id="onboarding-title">{{ currentPhase.title }}</h2>
            <p class="phase-description">{{ currentPhase.description }}</p>
          </div>
        </div>

        <!-- ==================== MODAL 3: INTRO THREAD LINK ==================== -->
        <div v-else-if="currentModal === 3" class="onboarding-body simple-step">
          <h2 id="onboarding-title">Introduction thread</h2>
          <p class="simple-sub">
            Say hello or test out branching in the community introduction thread.
          </p>

          <a
            :href="appUrl(introThreadRoute)"
            class="message-link"
            @click="dismissOnboarding"
          >
            {{ appUrl(introThreadRoute) }} →
          </a>
        </div>

        <!-- ==================== FOOTER ==================== -->
        <div class="onboarding-footer">
          <button
            v-if="currentModal === 1"
            type="button"
            class="btn-text"
            @click="dismissOnboarding"
          >
            Skip
          </button>
          <button
            v-else
            type="button"
            class="btn-secondary"
            @click="handleBack"
          >
            ← Back
          </button>

          <button
            v-if="currentModal < 3"
            type="button"
            class="btn-primary"
            @click="handleNext"
          >
            Next →
          </button>
          <button
            v-else
            type="button"
            class="btn-primary"
            @click="dismissOnboarding"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import MessageNode from '../MessageNode.vue';
import { appUrl } from '../../config/appConfig.js';

const ONBOARDING_STORAGE_KEY = 'stitch_onboarding_completed_v1';
const THEME_STORAGE_KEY = 'stitch_theme';
const INTRO_THREAD_MESSAGE_ID = '579d38c3';

// Two sibling replies under one parent. Sibling rails switch between them.
const DEMO_NODE_1 = 'onboarding_demo_node_1';
const DEMO_NODE_2 = 'onboarding_demo_node_2';
const DEMO_REPLY_PARENT_ID = 'onboarding_demo_reply_parent';

const store = useStore();
const route = useRoute();

const user = computed(() => store.getters['auth/user']);
const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);
const authReady = computed(() => store.getters['auth/authReady']);
const onboardingOpen = computed(() => store.getters['ui/onboardingOpen']);

const currentModal = ref(1);
const currentPhaseIndex = ref(0);

const PARENT_COPY = 'I think Stitch is a really cool platform!';
const REPLY_ONE_COPY = 'I agree! It\'s a great place for multiple people to weigh in with different responses.';
const REPLY_TWO_COPY = 'No it\'s not, Stitch sucks!';

const activeChildId = ref(DEMO_NODE_1);
const activeChildMessage = computed(() => store.getters['messages/getMessage'](activeChildId.value));
const parentMessage = computed(() => store.getters['messages/getMessage'](DEMO_REPLY_PARENT_ID));

const introThreadRoute = `/messages/${INTRO_THREAD_MESSAGE_ID}`;

const phases = [
  {
    id: 'recipients',
    title: 'Recipients & Read Status',
    description:
      'Use the Recipients badge to view or add people and bots (with CC/BCC controls), and click the envelope icon to toggle read or unread.'
  },
  {
    id: 'metadata',
    title: 'Tags, Channels, Visibility & Subject',
    description:
      'Add #tags or publish to channels, click the globe to toggle public/private visibility, add a subject line, or delete your message.'
  },
  {
    id: 'controls',
    title: 'Default Mark, Collapse & Select',
    description:
      'The star marks the default outgoing branch. Use the arrow to collapse long messages or check the box to select multiple nodes to copy.'
  },
  {
    id: 'actions',
    title: 'Reply, Prompt & Save',
    description:
      'Reply branches the conversation from this node, Prompt invokes an AI bot with branch context, and Save bookmarks the message.'
  },
  {
    id: 'menu',
    title: 'Subcontextual Menu (⋯)',
    description:
      'Opens extra node tools: Copy text, Copy link, Refresh replies, 🪡 Stitch (connect messages across threads), Center view, Order replies, Set default outgoing, and Similar search.'
  },
  {
    id: 'navigation',
    title: 'Sibling Replies',
    description:
      'Use the left and right rails to move between sibling replies on this branch.'
  }
];

const currentPhase = computed(() => phases[currentPhaseIndex.value] || phases[0]);

const seedDemoMessages = () => {
  const uid = user.value?.uid || 'demo_user';
  const tag = user.value?.user_tag || 'you';
  const name = user.value?.displayName || user.value?.display_name || tag;

  store.commit('messages/SET_MESSAGE', {
    id: DEMO_REPLY_PARENT_ID,
    content: PARENT_COPY,
    author: { uid: 'demo_alice', user_tag: 'alice', display_name: 'Alice' },
    public: true,
    parent_id: null,
    child_ids: [DEMO_NODE_1, DEMO_NODE_2],
    reply_order: [DEMO_NODE_1, DEMO_NODE_2],
    default_outgoing: DEMO_NODE_1,
    stitch_parent_ids: [],
    stitch_child_ids: [],
    timestamp: '2026-10-16T20:00:00Z'
  });

  store.commit('messages/SET_MESSAGE', {
    id: DEMO_NODE_1,
    content: REPLY_ONE_COPY,
    author: { uid: 'demo_seth', user_tag: 'seth', display_name: 'seth' },
    public: true,
    is_read: false,
    parent_id: DEMO_REPLY_PARENT_ID,
    child_ids: [],
    stitch_parent_ids: [],
    stitch_child_ids: [],
    tags: ['architecture', 'branch-1'],
    channels: ['general'],
    recipients: [
      { uid, user_tag: tag, display_name: name, public: true },
      { uid: 'bot_claude', user_tag: 'claude', display_name: 'Claude', is_bot: true, public: true }
    ],
    timestamp: '2026-10-16T20:05:00Z'
  });

  store.commit('messages/SET_MESSAGE', {
    id: DEMO_NODE_2,
    content: REPLY_TWO_COPY,
    author: { uid: 'demo_olivia', user_tag: 'olivia', display_name: 'Olivia' },
    public: true,
    is_read: false,
    parent_id: DEMO_REPLY_PARENT_ID,
    child_ids: [],
    stitch_parent_ids: [],
    stitch_child_ids: [],
    tags: ['benchmarks', 'branch-2'],
    channels: ['general'],
    recipients: [
      { uid, user_tag: tag, display_name: name, public: true },
      { uid: 'demo_alice', user_tag: 'alice', display_name: 'Alice', public: true }
    ],
    timestamp: '2026-10-16T20:06:00Z'
  });

  activeChildId.value = DEMO_NODE_1;

  store.commit('messages/SET_BRANCH_LINK', {
    parentId: DEMO_REPLY_PARENT_ID,
    childId: DEMO_NODE_1
  });
};

const syncMenuForPhase = () => {
  nextTick(() => {
    store.dispatch('navigation/hideActionBar', DEMO_NODE_1);
    store.dispatch('navigation/hideActionBar', DEMO_NODE_2);
  });
};

const setPhase = (idx) => {
  const clamped = Math.max(0, Math.min(phases.length - 1, idx));
  currentPhaseIndex.value = clamped;
  syncMenuForPhase();
};

const selectPhaseById = (id) => {
  const idx = phases.findIndex(p => p.id === id);
  if (idx !== -1) setPhase(idx);
};

const switchDemoSibling = (targetId, direction) => {
  activeChildId.value = targetId;
  store.commit('messages/SET_BRANCH_LINK', {
    parentId: DEMO_REPLY_PARENT_ID,
    childId: targetId
  });
  store.commit('navigation/SET_LAST_SIBLING_NAVIGATION', {
    targetId,
    direction
  });
  syncMenuForPhase();
};

// Intercept clicks on the real MessageNode so sibling navigation works inside the modal without navigating the app router
const onNodeStageClick = (e) => {
  const el = e.target;
  if (!el || typeof el.closest !== 'function') return;

  // Allow real sibling navigator prev/next clicks
  const sibPrev = el.closest('.sibling-navigator .nav-prev, .mobile-sibling-nav .mobile-nav-prev');
  const sibNext = el.closest('.sibling-navigator .nav-next, .mobile-sibling-nav .mobile-nav-next');
  if (sibPrev || sibNext) {
    e.stopPropagation();
    e.preventDefault();
    if (sibPrev && activeChildId.value === DEMO_NODE_2) {
      switchDemoSibling(DEMO_NODE_1, 'prev');
    } else if (sibNext && activeChildId.value === DEMO_NODE_1) {
      switchDemoSibling(DEMO_NODE_2, 'next');
    }
    return;
  }

  // All other clicks jump to the matching explanation phase without firing external modals/API calls
  e.stopPropagation();
  e.preventDefault();

  if (el.closest('.recipients-toggle') || el.closest('.envelope-icon-button')) {
    selectPhaseById('recipients');
  } else if (
    el.closest('.tags-toggle') ||
    el.closest('.channels-toggle') ||
    el.closest('.globe-emoji') ||
    el.closest('.delete-icon-button') ||
    el.closest('.add-subject-button')
  ) {
    selectPhaseById('metadata');
  } else if (
    el.closest('.default-outgoing-mark') ||
    el.closest('.collapse-button') ||
    el.closest('.selection-checkbox')
  ) {
    selectPhaseById('controls');
  } else if (el.closest('.more-button') || el.closest('.more-menu')) {
    selectPhaseById('menu');
  } else if (el.closest('.compact-hover-toolbar') || el.closest('.message-actions')) {
    selectPhaseById('actions');
  } else if (el.closest('.reply-count') || el.closest('.compact-reply-count')) {
    selectPhaseById('navigation');
  }
};

const selectTheme = (themeId) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (_) {}
};

const hasSeenOnboarding = () => {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
};

const markOnboardingSeen = () => {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch (_) {}
};

const handleNext = () => {
  if (currentModal.value === 1) {
    currentModal.value = 2;
    setPhase(0);
    return;
  }
  if (currentModal.value === 2) {
    if (currentPhaseIndex.value < phases.length - 1) {
      setPhase(currentPhaseIndex.value + 1);
    } else {
      store.dispatch('navigation/hideActionBar', activeChildId.value);
      currentModal.value = 3;
    }
  }
};

const handleBack = () => {
  if (currentModal.value === 3) {
    currentModal.value = 2;
    setPhase(phases.length - 1);
    return;
  }
  if (currentModal.value === 2) {
    if (currentPhaseIndex.value > 0) {
      setPhase(currentPhaseIndex.value - 1);
    } else {
      store.dispatch('navigation/hideActionBar', activeChildId.value);
      currentModal.value = 1;
    }
  }
};

const dismissOnboarding = () => {
  markOnboardingSeen();
  store.dispatch('navigation/hideActionBar', DEMO_NODE_1);
  store.dispatch('navigation/hideActionBar', DEMO_NODE_2);
  store.dispatch('ui/setOnboardingOpen', false);
};

// Auto-trigger only once per browser when first authenticated
watch(
  [authReady, isAuthenticated, () => user.value?.uid, () => route.path],
  () => {
    if (!authReady.value || !isAuthenticated.value || !user.value) return;
    const path = route.path || '';
    if (path === '/login' || path === '/register') return;
    if (!hasSeenOnboarding() && !onboardingOpen.value) {
      markOnboardingSeen();
      store.dispatch('ui/setOnboardingOpen', true);
    }
  },
  { immediate: true }
);

watch(onboardingOpen, (isOpen) => {
  if (isOpen) {
    seedDemoMessages();
    currentModal.value = 1;
    currentPhaseIndex.value = 0;
    store.dispatch('navigation/hideActionBar', DEMO_NODE_1);
    store.dispatch('navigation/hideActionBar', DEMO_NODE_2);
  } else {
    store.dispatch('navigation/hideActionBar', DEMO_NODE_1);
    store.dispatch('navigation/hideActionBar', DEMO_NODE_2);
  }
});

let pointerDownInsideModal = false;
const onContainerPointerDown = () => {
  pointerDownInsideModal = true;
};
const onOverlayPointerDown = (event) => {
  if (event.target === event.currentTarget) {
    pointerDownInsideModal = false;
  }
};
const onOverlayClick = () => {
  if (pointerDownInsideModal) {
    pointerDownInsideModal = false;
    return;
  }
  dismissOnboarding();
};

const onKeydown = (e) => {
  // Global shortcut: Ctrl+Shift+O or Cmd+Shift+O toggles onboarding anytime
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    store.dispatch('ui/setOnboardingOpen', !onboardingOpen.value);
    return;
  }

  if (!onboardingOpen.value) return;
  if (e.key === 'Escape') {
    dismissOnboarding();
  } else if (e.key === 'ArrowRight') {
    if (currentModal.value < 3) handleNext();
  } else if (e.key === 'ArrowLeft') {
    if (currentModal.value > 1 || currentPhaseIndex.value > 0) handleBack();
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 9, 8, 0.78);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2200;
  padding: 24px;
}

.onboarding-modal {
  position: relative;
  width: 100%;
  max-width: 520px;
  background: var(--app-surface-1, #1c1e1c);
  color: var(--app-text-primary, #f3ecdc);
  border: 1px solid var(--border-color, #2f332f);
  border-radius: 20px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  transition: max-width 0.2s ease;
}

.onboarding-modal.is-tour {
  max-width: 740px;
}

.close-button {
  position: absolute;
  top: 20px;
  right: 22px;
  background: transparent;
  border: none;
  color: var(--app-text-secondary, #b2aa99);
  font-size: 24px;
  line-height: 1;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.close-button:hover {
  color: var(--app-text-primary, #f3ecdc);
}

.onboarding-body {
  padding: 56px 48px 40px;
  display: flex;
  flex-direction: column;
}

.simple-step {
  align-items: center;
  text-align: center;
  gap: 28px;
}

.simple-step h2,
.phase-info h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--app-text-primary, #f3ecdc);
}

.simple-sub {
  margin: -12px 0 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--app-text-secondary, #b2aa99);
  max-width: 380px;
}

/* ==================== STEP 1: THEME ==================== */
.theme-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 24px;
  border-radius: 14px;
  background: var(--app-surface-2, #232623);
  border: 2px solid var(--primary-color, #8fbf9f);
  color: inherit;
  cursor: pointer;
}

.theme-swatches {
  display: flex;
  gap: 6px;
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.theme-name {
  font-size: 16px;
  font-weight: 600;
}

.theme-tag {
  font-size: 12px;
  color: var(--primary-color, #8fbf9f);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(143, 191, 159, 0.14);
}

/* ==================== STEP 2: REAL MESSAGE NODE TOUR ==================== */
.tour-step {
  gap: 32px;
}

.real-node-stage {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 4px 20px;
}

.mock-parent {
  width: calc(100% - 64px);
  margin: 0 auto;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--color-surface, #232623);
  text-align: left;
}

.mock-parent-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}

.mock-parent-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary, #f3ecdc);
}

.mock-parent-tag {
  font-size: 12px;
  color: var(--app-text-secondary, #b2aa99);
}

.mock-parent-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--app-text-primary, #f3ecdc);
}

.phase-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  min-height: 168px;
}

.phase-counter-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.phase-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--primary-color, #8fbf9f);
  cursor: pointer;
}

.phase-chevron svg {
  width: 14px;
  height: 14px;
  display: block;
}

.phase-chevron:hover:not(:disabled) {
  background: rgba(143, 191, 159, 0.14);
}

.phase-chevron:disabled {
  opacity: 0.3;
  cursor: default;
}

.phase-counter {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--primary-color, #8fbf9f);
  min-width: 2.6em;
}

.phase-description {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--app-text-secondary, #b2aa99);
  max-width: 540px;
  min-height: 4.65em;
}

/* Keep the reply toolbar and its menu visible without hovering the node. */
.real-node-stage :deep(.compact-hover-toolbar) {
  opacity: 1;
  pointer-events: auto;
}

.real-node-stage :deep(.more-menu) {
  right: 0 !important;
  left: auto !important;
  bottom: calc(100% + 4px) !important;
  top: auto !important;
  z-index: 40 !important;
}

/* Softly dim non-active controls on the real MessageNode and spotlight the active phase */
.real-node-stage :deep(.recipients-toggle),
.real-node-stage :deep(.envelope-icon-button),
.real-node-stage :deep(.tags-toggle),
.real-node-stage :deep(.channels-toggle),
.real-node-stage :deep(.globe-emoji),
.real-node-stage :deep(.delete-icon-button),
.real-node-stage :deep(.add-subject-button),
.real-node-stage :deep(.default-outgoing-mark),
.real-node-stage :deep(.collapse-button),
.real-node-stage :deep(.selection-checkbox),
.real-node-stage :deep(.compact-hover-toolbar .compact-action-button),
.real-node-stage :deep(.reply-count) {
  opacity: 0.3;
  transition: opacity 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

/* Demo authors stay the normal text color, including a name that matches the viewer. */
.real-node-stage :deep(.user-display__name--current),
.real-node-stage :deep(.message-author.current-user-name) {
  color: var(--color-text, #f3ecdc);
  font-weight: 600;
}

/* Rails follow clickability, not the phase spotlight. The blanket dim above was
   keeping clickable .nav-button rails at 30% and leaving the chevron green. */
.real-node-stage :deep(.sibling-navigator .nav-button),
.real-node-stage :deep(.mobile-sibling-nav .mobile-nav-btn) {
  transition: opacity 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.real-node-stage :deep(.sibling-navigator .nav-button.disabled),
.real-node-stage :deep(.sibling-navigator .nav-button:disabled),
.real-node-stage :deep(.mobile-sibling-nav .mobile-nav-btn.disabled),
.real-node-stage :deep(.mobile-sibling-nav .mobile-nav-btn:disabled) {
  opacity: 0.3;
}

.real-node-stage :deep(.sibling-navigator .nav-button:not(.disabled):not(:disabled)),
.real-node-stage :deep(.mobile-sibling-nav .mobile-nav-btn:not(.disabled):not(:disabled)) {
  opacity: 1;
  filter: none;
}

.real-node-stage :deep(.sibling-navigator .nav-button.nav-prev:not(.disabled):not(:disabled) .left-triangle) {
  opacity: 1;
  border-right-color: var(--color-text) !important;
}

.real-node-stage :deep(.sibling-navigator .nav-button.nav-next:not(.disabled):not(:disabled) .right-triangle) {
  opacity: 1;
  border-left-color: var(--color-text) !important;
}

.real-node-stage :deep(.mobile-sibling-nav .mobile-nav-btn:not(.disabled):not(:disabled)) {
  color: var(--color-text);
}

/* Phase 1: Recipients & Read */
.real-node-stage.phase-recipients :deep(.recipients-toggle),
.real-node-stage.phase-recipients :deep(.envelope-icon-button) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 16px rgba(143, 191, 159, 0.35);
  border-radius: 8px;
}

/* Phase 2: Tags, Channels, Visibility & Subject */
.real-node-stage.phase-metadata :deep(.tags-toggle),
.real-node-stage.phase-metadata :deep(.channels-toggle),
.real-node-stage.phase-metadata :deep(.globe-emoji),
.real-node-stage.phase-metadata :deep(.delete-icon-button),
.real-node-stage.phase-metadata :deep(.add-subject-button) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 16px rgba(143, 191, 159, 0.35);
  border-radius: 8px;
}

/* Phase 3: Collapse, Select & Default Mark */
.real-node-stage.phase-controls :deep(.default-outgoing-mark),
.real-node-stage.phase-controls :deep(.collapse-button),
.real-node-stage.phase-controls :deep(.selection-checkbox) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 16px rgba(143, 191, 159, 0.35);
  border-radius: 6px;
}

/* Phase 4: Reply, Prompt & Save */
.real-node-stage.phase-actions :deep(.compact-hover-toolbar .compact-action-button:not(.more-button)) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 16px rgba(143, 191, 159, 0.35);
  border-radius: 6px;
}

/* Phase 5: Subcontextual Menu */
.real-node-stage.phase-menu :deep(.compact-hover-toolbar .more-button),
.real-node-stage.phase-menu :deep(.more-menu) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 20px rgba(143, 191, 159, 0.35);
}

.real-node-stage.phase-menu :deep(.more-menu .compact-action-button) {
  opacity: 1;
  box-shadow: none;
}

/* Phase 6: spotlight border on the rail that can be clicked. */
.real-node-stage.phase-navigation :deep(.sibling-navigator .nav-button:not(.disabled):not(:disabled)::before) {
  display: block;
  border: 2px solid var(--primary-color, #8fbf9f);
  box-sizing: border-box;
}

.real-node-stage.phase-navigation :deep(.mobile-sibling-nav .mobile-nav-btn:not(.disabled):not(:disabled)) {
  border: 2px solid var(--primary-color, #8fbf9f);
  box-shadow: none;
}

/* ==================== STEP 3: MESSAGE LINK ==================== */
.message-link {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-color, #8fbf9f);
  text-decoration: none;
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid rgba(143, 191, 159, 0.35);
  background: rgba(143, 191, 159, 0.1);
  transition: background-color 0.15s ease;
}

.message-link:hover {
  background: rgba(143, 191, 159, 0.2);
}

/* ==================== FOOTER ==================== */
.onboarding-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 48px 36px;
}

.btn-primary {
  padding: 10px 22px;
  border-radius: 10px;
  border: 1px solid rgba(143, 191, 159, 0.45);
  background: var(--accent-primary, #598958);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--accent-primary-hover, #699b68);
}

.btn-secondary {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--border-color, #2f332f);
  background: transparent;
  color: var(--app-text-primary, #f3ecdc);
  font-size: 14px;
  cursor: pointer;
}

.btn-text {
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--app-text-secondary, #b2aa99);
  font-size: 14px;
  cursor: pointer;
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.2s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .mock-parent {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .onboarding-body {
    padding: 40px 20px 24px;
  }

  .onboarding-footer {
    padding: 16px 20px 24px;
  }
}
</style>
