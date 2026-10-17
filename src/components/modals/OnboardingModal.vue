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
            <!-- Active Mock Parent Above -->
            <div v-if="activeParentMessage" class="mock-parent-preview">
              <div class="mock-parent-header">
                <span class="mock-parent-author">@{{ activeParentMessage.author?.user_tag }}</span>
                <span class="mock-parent-kind">
                  {{ activeParentId === activeChildMessage?.parent_id ? 'Reply parent' : '🪡 Stitched parent' }}
                </span>
              </div>
              <div class="mock-parent-body">{{ activeParentMessage.content }}</div>
            </div>

            <!-- Actual MessageNode Component -->
            <MessageNode
              v-if="activeChildMessage"
              :key="activeChildMessage.id"
              :message="activeChildMessage"
              :active-parent-id="activeParentId"
              display-mode="full"
              :compact="false"
              :selectable="true"
              :selected="false"
              :in-list-view="false"
            />
          </div>

          <!-- Simple Phase Description -->
          <div class="phase-info">
            <span class="phase-counter">
              {{ currentPhaseIndex + 1 }} / {{ phases.length }}
            </span>
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

          <router-link
            :to="introThreadRoute"
            class="message-link"
            @click="dismissOnboarding"
          >
            stitch.fyi{{ introThreadRoute }} →
          </router-link>
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

const ONBOARDING_STORAGE_KEY = 'stitch_onboarding_completed_v1';
const THEME_STORAGE_KEY = 'stitch_theme';
const INTRO_THREAD_MESSAGE_ID = '579d38c3';

// Two mock messages (siblings), each with two mock parents (one reply parent + one stitched parent)
const DEMO_NODE_1 = 'onboarding_demo_node_1';
const DEMO_NODE_2 = 'onboarding_demo_node_2';
const DEMO_REPLY_PARENT_ID = 'onboarding_demo_reply_parent';
const DEMO_STITCH_PARENT_1_ID = 'onboarding_demo_stitch_parent_1';
const DEMO_STITCH_PARENT_2_ID = 'onboarding_demo_stitch_parent_2';

const store = useStore();
const route = useRoute();

const user = computed(() => store.getters['auth/user']);
const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);
const authReady = computed(() => store.getters['auth/authReady']);
const onboardingOpen = computed(() => store.getters['ui/onboardingOpen']);

const currentModal = ref(1);
const currentPhaseIndex = ref(0);

// Track which of the 2 mock messages is shown and which of its 2 parents is active
const activeChildId = ref(DEMO_NODE_1);
const activeOriginByChild = ref({
  [DEMO_NODE_1]: DEMO_REPLY_PARENT_ID,
  [DEMO_NODE_2]: DEMO_REPLY_PARENT_ID
});

const activeParentId = computed(() => {
  return activeOriginByChild.value[activeChildId.value] || DEMO_REPLY_PARENT_ID;
});

const activeChildMessage = computed(() => store.getters['messages/getMessage'](activeChildId.value));
const activeParentMessage = computed(() => store.getters['messages/getMessage'](activeParentId.value));

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
      'The link icon marks the default outgoing branch. Use the arrow to collapse long messages or check the box to select multiple nodes to copy.'
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
    title: 'Branch & Origin Navigation',
    description:
      'Try clicking the top origin switcher arrows to swap between each message’s 2 parents, or click the left/right sibling triangles to flip between the 2 sibling messages.'
  }
];

const currentPhase = computed(() => phases[currentPhaseIndex.value] || phases[0]);

const seedDemoMessages = () => {
  const uid = user.value?.uid || 'demo_user';
  const tag = user.value?.user_tag || 'you';
  const name = user.value?.displayName || user.value?.display_name || tag;

  // Shared Reply Parent (has both DEMO_NODE_1 and DEMO_NODE_2 as children)
  store.commit('messages/SET_MESSAGE', {
    id: DEMO_REPLY_PARENT_ID,
    content: 'Parent A (Reply Parent): "How should we design the multi-agent architecture?"',
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

  // Stitched Parent for Message 1 (also lists both children so sibling nav stays active)
  store.commit('messages/SET_MESSAGE', {
    id: DEMO_STITCH_PARENT_1_ID,
    content: 'Parent B1 (Stitched Origin for Message 1): Notes from last week’s graph routing brainstorm.',
    author: { uid: 'demo_bob', user_tag: 'bob', display_name: 'Bob' },
    public: true,
    parent_id: null,
    child_ids: [],
    stitch_parent_ids: [],
    stitch_child_ids: [DEMO_NODE_1, DEMO_NODE_2],
    reply_order: [DEMO_NODE_1, DEMO_NODE_2],
    default_outgoing: DEMO_NODE_1,
    timestamp: '2026-10-16T20:01:00Z'
  });

  // Stitched Parent for Message 2
  store.commit('messages/SET_MESSAGE', {
    id: DEMO_STITCH_PARENT_2_ID,
    content: 'Parent B2 (Stitched Origin for Message 2): Benchmark comparison thread from @claude.',
    author: { uid: 'bot_claude', user_tag: 'claude', display_name: 'Claude', is_bot: true },
    public: true,
    parent_id: null,
    child_ids: [],
    stitch_parent_ids: [],
    stitch_child_ids: [DEMO_NODE_1, DEMO_NODE_2],
    reply_order: [DEMO_NODE_1, DEMO_NODE_2],
    default_outgoing: DEMO_NODE_1,
    timestamp: '2026-10-16T20:02:00Z'
  });

  // Mock Message 1 (Sibling 1 of 2)
  store.commit('messages/SET_MESSAGE', {
    id: DEMO_NODE_1,
    content:
      'Message 1 of 2: We can route each prompt down its own branch and 🪡 stitch related conclusions together. Try the ▶ rail on the right or the origin switcher above!',
    author: { uid, user_tag: tag, display_name: name },
    public: true,
    is_read: false,
    parent_id: DEMO_REPLY_PARENT_ID,
    child_ids: [DEMO_NODE_2],
    stitch_parent_ids: [DEMO_STITCH_PARENT_1_ID],
    stitch_child_ids: [],
    tags: ['architecture', 'branch-1'],
    channels: ['general'],
    recipients: [
      { uid, user_tag: tag, display_name: name, public: true },
      { uid: 'bot_claude', user_tag: 'claude', display_name: 'Claude', is_bot: true, public: true }
    ],
    timestamp: '2026-10-16T20:05:00Z'
  });

  // Mock Message 2 (Sibling 2 of 2)
  store.commit('messages/SET_MESSAGE', {
    id: DEMO_NODE_2,
    content:
      'Message 2 of 2: Alternative sibling branch! Notice this message has its own unique content and its own second stitched parent above. Click ◀ on the left to go back.',
    author: { uid, user_tag: tag, display_name: name },
    public: true,
    is_read: false,
    parent_id: DEMO_REPLY_PARENT_ID,
    child_ids: [DEMO_NODE_1],
    stitch_parent_ids: [DEMO_STITCH_PARENT_2_ID],
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
  activeOriginByChild.value = {
    [DEMO_NODE_1]: DEMO_REPLY_PARENT_ID,
    [DEMO_NODE_2]: DEMO_REPLY_PARENT_ID
  };

  store.commit('messages/SET_BRANCH_LINK', {
    parentId: DEMO_REPLY_PARENT_ID,
    childId: DEMO_NODE_1
  });
  store.commit('messages/SET_BRANCH_LINK', {
    parentId: DEMO_STITCH_PARENT_1_ID,
    childId: DEMO_NODE_1
  });
  store.commit('messages/SET_BRANCH_LINK', {
    parentId: DEMO_STITCH_PARENT_2_ID,
    childId: DEMO_NODE_1
  });
};

const syncMenuForPhase = (phaseId) => {
  nextTick(() => {
    if (phaseId === 'menu') {
      store.dispatch('navigation/showActionBar', activeChildId.value);
    } else {
      store.dispatch('navigation/hideActionBar', DEMO_NODE_1);
      store.dispatch('navigation/hideActionBar', DEMO_NODE_2);
    }
  });
};

const setPhase = (idx) => {
  const clamped = Math.max(0, Math.min(phases.length - 1, idx));
  currentPhaseIndex.value = clamped;
  syncMenuForPhase(phases[clamped].id);
};

const selectPhaseById = (id) => {
  const idx = phases.findIndex(p => p.id === id);
  if (idx !== -1) setPhase(idx);
};

const switchDemoSibling = (targetId, direction) => {
  activeChildId.value = targetId;
  [DEMO_REPLY_PARENT_ID, DEMO_STITCH_PARENT_1_ID, DEMO_STITCH_PARENT_2_ID].forEach((pid) => {
    store.commit('messages/SET_BRANCH_LINK', { parentId: pid, childId: targetId });
  });
  store.commit('navigation/SET_LAST_SIBLING_NAVIGATION', {
    targetId,
    direction
  });
  syncMenuForPhase(currentPhase.value.id);
};

const toggleDemoOriginForCurrentChild = (dir) => {
  const child = activeChildMessage.value;
  if (!child) return;
  const parents = [child.parent_id, ...(child.stitch_parent_ids || [])].filter(Boolean);
  const currentIdx = parents.indexOf(activeParentId.value);
  const nextIdx = currentIdx + dir;
  if (nextIdx >= 0 && nextIdx < parents.length) {
    activeOriginByChild.value = {
      ...activeOriginByChild.value,
      [activeChildId.value]: parents[nextIdx]
    };
  }
};

// Intercept clicks on the real MessageNode so sibling & origin navigation work inside the modal without navigating the app router
const onNodeStageClick = (e) => {
  const el = e.target;
  if (!el || typeof el.closest !== 'function') return;

  // Allow real origin switcher prev/next clicks without router navigation
  const switcherPrev = el.closest('.link-switcher-container .switcher-btn.prev');
  const switcherNext = el.closest('.link-switcher-container .switcher-btn.next');
  if (switcherPrev || switcherNext) {
    e.stopPropagation();
    e.preventDefault();
    selectPhaseById('navigation');
    toggleDemoOriginForCurrentChild(switcherPrev ? -1 : 1);
    return;
  }

  // Allow real sibling navigator prev/next clicks
  const sibPrev = el.closest('.sibling-navigator .nav-prev, .mobile-sibling-nav .mobile-nav-prev');
  const sibNext = el.closest('.sibling-navigator .nav-next, .mobile-sibling-nav .mobile-nav-next');
  if (sibPrev || sibNext) {
    e.stopPropagation();
    e.preventDefault();
    selectPhaseById('navigation');
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
  } else if (el.closest('.desktop-menu-container') || el.closest('.desktop-action-menu')) {
    selectPhaseById('menu');
  } else if (el.closest('.message-actions')) {
    selectPhaseById('actions');
  } else if (
    el.closest('.link-switcher-container') ||
    el.closest('.sibling-navigator') ||
    el.closest('.reply-count')
  ) {
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
  gap: 18px;
  padding: 8px 4px;
}

/* Compact parent preview card above the MessageNode so origin switching is visibly live */
.mock-parent-preview {
  margin: 0 38px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--app-surface-2, #232623);
  border: 1px dashed var(--border-color, #2f332f);
  font-size: 13px;
  color: var(--app-text-secondary, #b2aa99);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mock-parent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
}

.mock-parent-author {
  font-weight: 600;
  color: var(--app-text-primary, #f3ecdc);
}

.mock-parent-kind {
  color: var(--primary-color, #8fbf9f);
}

.mock-parent-body {
  color: var(--app-text-primary, #f3ecdc);
  opacity: 0.9;
}

.phase-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  min-height: 92px;
}

.phase-counter {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--primary-color, #8fbf9f);
}

.phase-description {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--app-text-secondary, #b2aa99);
  max-width: 540px;
}

/* Keep the real MessageNode's desktop subcontext menu nicely anchored inside the modal */
.real-node-stage :deep(.desktop-action-menu) {
  position: absolute !important;
  right: 0 !important;
  left: auto !important;
  bottom: calc(100% + 8px) !important;
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
.real-node-stage :deep(.desktop-actions > .action-button),
.real-node-stage :deep(.desktop-menu-container .menu-button),
.real-node-stage :deep(.link-switcher-container .switchable-state),
.real-node-stage :deep(.sibling-navigator .nav-button),
.real-node-stage :deep(.reply-count) {
  opacity: 0.3;
  transition: opacity 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
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
.real-node-stage.phase-actions :deep(.desktop-actions > .action-button) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 16px rgba(143, 191, 159, 0.35);
}

/* Phase 5: Subcontextual Menu */
.real-node-stage.phase-menu :deep(.desktop-menu-container .menu-button),
.real-node-stage.phase-menu :deep(.desktop-action-menu) {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--primary-color, #8fbf9f), 0 0 20px rgba(143, 191, 159, 0.35);
}

/* Phase 6: Branch & Origin Navigation — no box border around origin switcher or sibling nav */
.real-node-stage.phase-navigation :deep(.link-switcher-container .switchable-state),
.real-node-stage.phase-navigation :deep(.sibling-navigator .nav-button),
.real-node-stage.phase-navigation :deep(.reply-count) {
  opacity: 1;
  box-shadow: none;
  filter: drop-shadow(0 0 8px rgba(143, 191, 159, 0.55));
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

@media (max-width: 640px) {
  .onboarding-body {
    padding: 40px 20px 24px;
  }

  .onboarding-footer {
    padding: 16px 20px 24px;
  }
}
</style>
