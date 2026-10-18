<template>
  <div class="app-layout app-canvas">
    <div class="app-header">
      <div class="branding">
        <router-link to="/home" class="logo-link" @click.prevent="onLogoClick">
          <img src="@/assets/stitch_logo.png" alt="Stitch" class="logo-image" />
        </router-link>
      </div>
      
      <!-- Navigation Tabs - desktop only -->
      <div class="navigation-tabs" role="tablist" aria-label="Main tabs">
          <!-- Search tab commented out
          <router-link 
            to="/search" 
            class="nav-tab"
            :class="{ 'active': activeTab === 'search' }"
            role="tab"
            :aria-selected="activeTab === 'search'"
          >
            <span class="tab-emoji" aria-hidden="true">🔎</span>
            <span class="tab-label">Search</span>
          </router-link>
          -->
          <router-link 
            to="/history" 
            class="nav-tab has-glyph"
            :class="{ 'active': activeTab === 'history' }"
            role="tab"
            :aria-selected="activeTab === 'history'"
          >
            <TabGlyph name="history" :size="36" />
            <span class="tab-label">History</span>
          </router-link>
          <router-link 
            to="/timeline" 
            class="nav-tab has-glyph"
            :class="{ 'active': activeTab === 'timeline' }"
            role="tab"
            :aria-selected="activeTab === 'timeline'"
          >
            <TabGlyph name="timeline" :size="36" />
            <span class="tab-label">Timeline</span>
          </router-link>
          <router-link 
            to="/saved" 
            class="nav-tab has-glyph"
            :class="{ 'active': activeTab === 'saved' }"
            role="tab"
            :aria-selected="activeTab === 'saved'"
          >
            <TabGlyph name="saved" :size="36" />
            <span class="tab-label">Saved</span>
          </router-link>
          <router-link 
            to="/channels" 
            class="nav-tab has-glyph"
            :class="{ 'active': activeTab === 'channels' }"
            role="tab"
            :aria-selected="activeTab === 'channels'"
          >
            <TabGlyph name="channels" :size="36" />
            <span class="tab-label">Channels</span>
          </router-link>
          <router-link 
            to="/inbox" 
            class="nav-tab has-glyph"
            :class="{ 'active': activeTab === 'inbox' }"
            role="tab"
            :aria-selected="activeTab === 'inbox'"
          >
            <TabGlyph name="inbox" :size="36" />
            <span class="tab-label">Inbox</span>
            <span v-if="isUnreadCountLoading" class="unread-inline-badge">
              <span class="loading-spinner"></span>
            </span>
            <span v-else-if="unreadCount > 0" class="unread-inline-badge">{{ unreadCount }}</span>
          </router-link>
          <router-link
            v-if="isAdmin"
            to="/admin/metrics"
            class="nav-tab"
            :class="{ 'active': activeTab === 'admin-metrics' }"
            role="tab"
            :aria-selected="activeTab === 'admin-metrics'"
          >
            <span class="tab-emoji" aria-hidden="true">📊</span>
            <span class="tab-label">Admin</span>
          </router-link>
        </div>
      
      <div class="user-controls">
        <div class="user-info" v-if="user">
          <div
            class="username-container"
            ref="usernameContainerRef"
            :class="{ 'is-switching': isSwitchingPrincipal }"
            :aria-busy="isSwitchingPrincipal"
            :aria-disabled="isSwitchingPrincipal"
            :title="isSwitchingPrincipal ? switchingStatusMessage : 'Edit profile'"
            @click="openProfileModal"
          >
            <UserDisplay
              :user="displayedPrincipal"
              :display-name="displayedPrincipalName"
              :user-tag="displayedPrincipalTag"
              :show-tag="!!displayedPrincipalTag"
              name-class="username"
              tag-class="user-tag"
              variant="header"
            />
            <span v-if="isDelegated" class="acting-chip" title="Acting as">Acting as</span>
            <span
              v-if="isSwitchingPrincipal"
              class="profile-switch-status"
              role="status"
              aria-live="polite"
              :aria-label="switchingStatusMessage"
            >
              <span class="profile-switch-spinner" aria-hidden="true"></span>
              <span class="profile-switch-text" aria-hidden="true">{{ switchingStatusMessage }}</span>
            </span>
            <span v-else class="edit-icon" title="Edit profile">✎</span>
          </div>
          <div class="principal-menu-wrapper">
            <button
              class="principal-dropdown-toggle"
              type="button"
              aria-haspopup="menu"
              :aria-expanded="isPrincipalMenuOpen"
              title="Switch principal"
              @click.stop="togglePrincipalMenu"
            >▾</button>
            <div
              v-if="isPrincipalMenuOpen"
              ref="principalMenuWrapperRef"
              class="principal-menu"
              role="menu"
            >
              <div class="menu-section">
                <div
                  class="menu-item manager"
                  :class="{
                    active: activePrincipalUid === managerUid,
                    pending: switchingPrincipalUid === managerUid
                  }"
                  role="menuitem"
                  @click="onSelectPrincipal(managerUid)"
                >
                  <div class="menu-item-main">
                    <UserDisplay
                      :user="managerPrincipal"
                      :display-name="managerDisplayName"
                      :user-tag="managerTag"
                      :show-tag="!!managerTag"
                      name-class="menu-item-name"
                      tag-class="menu-item-tag"
                      variant="menu"
                    />
                  </div>
                  <span
                    v-if="switchingPrincipalUid === managerUid"
                    class="menu-item-status"
                    aria-hidden="true"
                  >
                    <span class="menu-switch-spinner"></span>
                  </span>
                </div>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-section managed-users-section">
                <div v-if="managedLoading" class="menu-loading">
                  <span class="loading-spinner"></span>
                  <span>Loading managed users…</span>
                </div>
                <template v-else>
                  <div
                    v-for="m in managedUsersOrderedForMenu"
                    :key="managedUserSortKey(m) || resolveUid(m) || m?.user_tag || Math.random()"
                    class="menu-item"
                    :class="{
                      active: resolveUid(m) === activePrincipalUid,
                      pending: switchingPrincipalUid === resolveUid(m),
                      dragging: managedUserSortKey(m) === managedDragKey,
                      'drag-over': managedUserSortKey(m) === managedDragOverKey
                    }"
                    role="menuitem"
                    @click="onSelectPrincipal(resolveUid(m))"
                    :draggable="!!managedUserSortKey(m)"
                    @dragstart="onManagedDragStart(managedUserSortKey(m), $event)"
                    @dragover.prevent="onManagedDragOver(managedUserSortKey(m), $event)"
                    @drop.prevent="onManagedDrop(managedUserSortKey(m), $event)"
                    @dragend="onManagedDragEnd"
                  >
                    <div class="menu-item-main">
                      <UserDisplay
                        :user="m"
                        :display-name="getUserDisplayName(m)"
                        :user-tag="m && m.user_tag"
                        :show-tag="!!(m && m.user_tag)"
                        name-class="menu-item-name"
                        tag-class="menu-item-tag"
                        variant="menu"
                      />
                    </div>
                    <span
                      v-if="switchingPrincipalUid === resolveUid(m)"
                      class="menu-item-status"
                      aria-hidden="true"
                    >
                      <span class="menu-switch-spinner"></span>
                    </span>
                  </div>
                  <div v-if="managedUsersOrderedForMenu.length === 0" class="menu-empty">No managed users</div>
                </template>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-section">
                <div class="menu-item create" role="menuitem" @click="onCreateManagedUser">
                  <span class="menu-item-name">＋ Create new managed user</span>
                </div>
                <div class="menu-item" role="menuitem" @click="onOpenOnboarding">
                  <span class="menu-item-name">✨ Replay onboarding tour</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Auth status badges - only shown when auth is ready -->
          <template v-if="authReady">
          </template>

          <!-- Loading spinner when auth is not ready -->
          <span v-else class="auth-loading-badge" title="Loading authentication status">
            <span class="auth-loading-spinner"></span>
          </span>
        </div>
        <button
          v-if="user"
          @click="openApiKeysModal"
          class="dev-btn"
          type="button"
          title="Developer tools"
          aria-label="Open developer tools"
        >Dev</button>
        <button
          @click="openSettingsModal"
          class="settings-btn"
          type="button"
          title="Settings"
          aria-label="Open settings"
        >
          <svg class="settings-gear-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 21a8.985 8.985 0 0 1-1.755-.173 1 1 0 0 1-.791-.813l-.273-1.606a6.933 6.933 0 0 1-1.32-.762l-1.527.566a1 1 0 0 1-1.1-.278 8.977 8.977 0 0 1-1.756-3.041 1 1 0 0 1 .31-1.092l1.254-1.04a6.979 6.979 0 0 1 0-1.524L3.787 10.2a1 1 0 0 1-.31-1.092 8.977 8.977 0 0 1 1.756-3.042 1 1 0 0 1 1.1-.278l1.527.566a6.933 6.933 0 0 1 1.32-.762l.274-1.606a1 1 0 0 1 .791-.813 8.957 8.957 0 0 1 3.51 0 1 1 0 0 1 .791.813l.273 1.606a6.933 6.933 0 0 1 1.32.762l1.527-.566a1 1 0 0 1 1.1.278 8.977 8.977 0 0 1 1.756 3.041 1 1 0 0 1-.31 1.092l-1.254 1.04a6.979 6.979 0 0 1 0 1.524l1.254 1.04a1 1 0 0 1 .31 1.092 8.977 8.977 0 0 1-1.756 3.041 1 1 0 0 1-1.1.278l-1.527-.566a6.933 6.933 0 0 1-1.32.762l-.273 1.606a1 1 0 0 1-.791.813A8.985 8.985 0 0 1 12 21zm-.7-2.035a6.913 6.913 0 0 0 1.393 0l.247-1.451a1 1 0 0 1 .664-.779 4.974 4.974 0 0 0 1.696-.975 1 1 0 0 1 1.008-.186l1.381.512a7.012 7.012 0 0 0 .7-1.206l-1.133-.939a1 1 0 0 1-.343-.964 5.018 5.018 0 0 0 0-1.953 1 1 0 0 1 .343-.964l1.124-.94a7.012 7.012 0 0 0-.7-1.206l-1.38.512a1 1 0 0 1-1-.186 4.974 4.974 0 0 0-1.688-.976 1 1 0 0 1-.664-.779l-.248-1.45a6.913 6.913 0 0 0-1.393 0l-.25 1.45a1 1 0 0 1-.664.779A4.974 4.974 0 0 0 8.7 8.24a1 1 0 0 1-1 .186l-1.385-.512a7.012 7.012 0 0 0-.7 1.206l1.133.939a1 1 0 0 1 .343.964 5.018 5.018 0 0 0 0 1.953 1 1 0 0 1-.343.964l-1.128.94a7.012 7.012 0 0 0 .7 1.206l1.38-.512a1 1 0 0 1 1 .186 4.974 4.974 0 0 0 1.688.976 1 1 0 0 1 .664.779zm.7-3.725a3.24 3.24 0 0 1 0-6.48 3.24 3.24 0 0 1 0 6.48zm0-4.48A1.24 1.24 0 1 0 13.24 12 1.244 1.244 0 0 0 12 10.76z"/>
          </svg>
        </button>
        <button v-if="user" @click="logout" class="logout-btn">Logout</button>
        <template v-else>
          <LoginButton />
          <RegisterButton />
        </template>
      </div>
    </div>
    
    <div class="main-content">
      <div v-if="user && authReady && !isEmailVerified && !isDelegated && !(user && user.is_managed)" class="verify-banner">
        <span>Verify your email to unlock messaging & notifications.</span>
        <a class="verify-link" href="#" @click.prevent="openProfileModal">Verify now</a>
      </div>
      <slot></slot>
    </div>
    
    <ProfileEditModal 
      :isOpen="isProfileModalOpen" 
      @close="closeProfileModal" 
    />
    <DevModal 
      :isOpen="isApiKeysModalOpen" 
      @close="closeApiKeysModal" 
    />
    <ManagedUserCreateModal 
      :isOpen="isCreateManagedModalOpen" 
      @close="closeCreateManagedModal" 
    />
    <GlobalNotifications />
    
    <router-link
      to="/messages/a784e721"
      class="global-feedback-btn"
      title="Give feedback"
      aria-label="Give feedback"
    >
      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 3.5h16a2.5 2.5 0 0 1 2.5 2.5v8.5a2.5 2.5 0 0 1-2.5 2.5H10.2L4.8 21.2a.9.9 0 0 1-1.4-.7v-3.5H4A2.5 2.5 0 0 1 1.5 14.5V6A2.5 2.5 0 0 1 4 3.5z"/>
      </svg>
    </router-link>

    <!-- Global Create Button (floating, appears on all tabs) -->
    <button
      v-if="user && canInteract"
      class="global-create-btn"
      @click="handleGlobalCreateClick"
      title="Create new"
      aria-label="Create new"
    >
      <span class="btn-icon">+</span>
    </button>

    <!-- Global Create Options Modal -->
    <NewThreadModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @new-thread="handleNewThread"
      @import="handleImport"
      @create-channel="handleCreateChannel"
    />

    <!-- Create Channel Modal -->
    <CreateChannelModal
      :show="showCreateChannelModal"
      @close="showCreateChannelModal = false"
      @created="handleChannelCreated"
    />
    
    <!-- Mobile tab bar - only visible on mobile -->
    <MobileTabBar />
    <div
      v-if="isSwitchingPrincipal"
      class="switching-overlay"
      aria-hidden="true"
    ></div>
  </div>
</template>

<script setup>
  import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useAuthentication } from '../../composables/useAuthentication';
import LoginButton from '@/components/buttons/LoginButton.vue'
import RegisterButton from '@/components/buttons/RegisterButton.vue'
import ProfileEditModal from '../modals/ProfileEditModal.vue';
import DevModal from '../modals/DevModal.vue';
import ManagedUserCreateModal from '../modals/ManagedUserCreateModal.vue';
import GlobalNotifications from '../GlobalNotifications.vue';
import MobileTabBar from './MobileTabBar.vue';
import TabGlyph from './TabGlyph.vue';
import UserDisplay from '../common/UserDisplay.vue';
import NewThreadModal from '../modals/NewThreadModal.vue';
import CreateChannelModal from '../modals/CreateChannelModal.vue';
import { ADMIN_ORIGIN } from '@/config/appConfig.js';

const router = useRouter();
const route = useRoute();
const store = useStore();
const { signInWithApiKey, logout } = useAuthentication();

// Debug: enable dropdown state logging by default; can be toggled via DevTools
try { if (typeof window !== 'undefined') { window.__STITCH_DEBUG_MENU = true; } } catch (_) {}

  const user = computed(() => store.getters['auth/user']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const authReady = computed(() => store.getters['auth/authReady']);
  const activeTab = computed(() => {
  const p = route.path || '';
  if (p.startsWith('/search')) return 'search';
  if (p.startsWith('/history')) return 'history';
  if (p.startsWith('/timeline')) return 'timeline';
  if (p.startsWith('/saved')) return 'saved';
  if (p.startsWith('/channels')) return 'channels';
  if (p.startsWith('/inbox')) return 'inbox';
  if (p.startsWith('/admin')) return 'admin-metrics';
  return 'history';
  });

const unreadCount = computed(() => store.getters['messages/getUnreadMessageCount']);
const isUnreadCountLoading = computed(() => store.getters['messages/isLoading']('fetchingUnreadCount'));
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);
const isApiKeysModalOpen = ref(false);
const isPrincipalMenuOpen = ref(false);
const principalMenuWrapperRef = ref(null);
const usernameContainerRef = ref(null);
const switchingPrincipalUid = ref(null);
const isSwitchingPrincipal = computed(() => !!switchingPrincipalUid.value);
const isCreateManagedModalOpen = ref(false);
const showCreateModal = ref(false);
const showCreateChannelModal = ref(false);

// Check scopes for create modal
const hasImportScope = computed(() => {
  return store.getters['auth/hasAnyScope'](['msg.import.cursor', 'msg.import.audio']);
});

const hasChannelCreateScope = computed(() => {
  return store.getters['auth/hasScope']('channels.create');
});

const shouldShowCreateModal = computed(() => {
  return hasImportScope.value || hasChannelCreateScope.value;
});

const canInteract = computed(() => store.getters['auth/canInteract']);

// Public SPA: no internal/admin tabs here

const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

const isEmailVerified = computed(() => !!(user.value && user.value.is_email_verified));

// Fetch unread count when user authentication state changes
watch(
  () => user.value,
  (newUser) => {
    if (newUser) {
      store.dispatch('messages/fetchUnreadMessageCount');
    } else {
      store.commit('messages/SET_UNREAD_MESSAGE_COUNT', 0);
    }
  },
  { immediate: true }
);

// Note: Removed duplicate onMounted call - the watch with immediate: true already handles initial mount

// Principal dropdown data (wired)
const managedUsersFromStore = computed(() => (store.getters['auth/managedUsers'] || []));
const managedUsers = computed(() => managedLoading.value ? [] : (managedUsersFromStore.value || []));
const managedLoading = ref(false);
const resolveUid = (u) => (u && (u.uid || u.id || u._key)) || null;
const activePrincipalUid = computed(() => store.getters['auth/activePrincipalUid'] || resolveUid(user.value));
const managerUid = computed(() => store.getters['auth/managerUid'] || resolveUid(user.value));

// Managed users reordering (drag/drop) - persisted in localStorage per manager
const isManagedUsersReordering = ref(false);
const managedDragKey = ref(null);
const managedDragOverKey = ref(null);
const suppressManagedClick = ref(false);

const managedUserSortKey = (m) => {
  const uid = resolveUid(m);
  return uid || (m && m.user_tag ? m.user_tag : null);
};

const managedUsersOrderKey = computed(() => {
  if (typeof window === 'undefined') return null;
  const baseUid = managerUid.value || resolveUid(user.value) || 'unknown';
  return `managed_users_order:${baseUid}`;
});

const managedUsersOrder = ref([]);

const loadManagedUsersOrder = () => {
  try {
    const key = managedUsersOrderKey.value;
    if (!key || typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) managedUsersOrder.value = parsed.filter(v => typeof v === 'string' && v.length > 0);
  } catch (e) {
    console.warn('[TabViewLayout] Failed to load managed user order:', e);
  }
};

const persistManagedUsersOrder = (orderedItems) => {
  try {
    const key = managedUsersOrderKey.value;
    if (!key || typeof window === 'undefined' || !window.localStorage) return;
    const order = (orderedItems || [])
      .map(managedUserSortKey)
      .filter(v => typeof v === 'string' && v.length > 0);
    managedUsersOrder.value = order;
    window.localStorage.setItem(key, JSON.stringify(order));
  } catch (e) {
    console.warn('[TabViewLayout] Failed to persist managed user order:', e);
  }
};

const managedUsersOrderedForMenu = computed(() => {
  const list = managedUsers.value || [];
  if (!Array.isArray(managedUsersOrder.value) || managedUsersOrder.value.length === 0) return list;

  const keyToItem = new Map();
  for (const m of list) {
    const k = managedUserSortKey(m);
    if (k) keyToItem.set(k, m);
  }

  const ordered = [];
  const used = new Set();

  for (const k of managedUsersOrder.value) {
    if (k && keyToItem.has(k) && !used.has(k)) {
      ordered.push(keyToItem.get(k));
      used.add(k);
    }
  }

  // Append items missing from stored order.
  for (const m of list) {
    const k = managedUserSortKey(m);
    if (!k) {
      ordered.push(m);
      continue;
    }
    if (!used.has(k)) ordered.push(m);
  }

  return ordered;
});

watch(
  managedUsersOrderKey,
  () => {
    managedUsersOrder.value = [];
    loadManagedUsersOrder();
  },
  { immediate: true }
);
const getUserDisplayName = (u) => {
  if (!u) return 'Unknown';
  return u.displayName || u.display_name || (u.user_tag ? `@${u.user_tag}` : (u.email || 'Unknown'));
};
// Manager row should always reflect the true manager principal (act.sub when acting-as).
// Never fall back to the active (delegated) user — that is what made the first row
// show the bot you are currently acting as.
const managerSnapshot = computed(() => store.getters['auth/managerSnapshot']);
const managerPrincipal = computed(() => {
  const manager = managerUid.value;
  if (!manager) return user.value;
  if (resolveUid(user.value) === manager) return user.value;
  return managerSnapshot.value || { uid: manager };
});
const managerDisplayName = computed(() => {
  const manager = managerUid.value;
  if (!manager) return getUserDisplayName(user.value);
  if (resolveUid(user.value) === manager) return getUserDisplayName(user.value);
  if (managerSnapshot.value) return getUserDisplayName(managerSnapshot.value);
  return 'Manager';
});
const managerTag = computed(() => {
  const manager = managerUid.value;
  if (!manager) return (user.value && user.value.user_tag) ? user.value.user_tag : null;
  if (resolveUid(user.value) === manager) return (user.value && user.value.user_tag) ? user.value.user_tag : null;
  return (managerSnapshot.value && managerSnapshot.value.user_tag) ? managerSnapshot.value.user_tag : null;
});
// Header: show selected principal name/tag
const displayedPrincipal = computed(() => {
  const current = activePrincipalUid.value;
  const manager = managerUid.value;
  if (!current) return user.value;
  if (current === manager) return user.value;
  const list = managedUsers.value || [];
  return list.find((u) => resolveUid(u) === current) || user.value;
});
const displayedPrincipalName = computed(() => getUserDisplayName(displayedPrincipal.value));
const displayedPrincipalTag = computed(() => (displayedPrincipal.value && displayedPrincipal.value.user_tag) ? displayedPrincipal.value.user_tag : null);
const isDelegated = computed(() => {
  try {
    const active = activePrincipalUid.value;
    const manager = managerUid.value;
    return !!(active && manager && active !== manager);
  } catch (_) { return false; }
});
const switchingStatusMessage = computed(() => (isSwitchingPrincipal.value ? 'Switching…' : ''));

const togglePrincipalMenu = async () => {
  const next = !isPrincipalMenuOpen.value;
  isPrincipalMenuOpen.value = next;
  if (next) {
    try {
      managedLoading.value = true;
      await store.dispatch('auth/fetchManagedUsers');
      await store.dispatch('auth/ensureManagerSnapshot', {
        managerUid: managerUid.value,
        managedUid: activePrincipalUid.value
      });
    } catch (e) {
      console.warn('[TabViewLayout] fetchManagedUsers failed', e);
    } finally {
      managedLoading.value = false;
    }
    // Debug snapshot
    try {
      // eslint-disable-next-line no-underscore-dangle
      const dbg = (typeof window !== 'undefined') && window.__STITCH_DEBUG_MENU;
      if (dbg) {
        const manager = managerUid.value;
        const active = activePrincipalUid.value;
        const list = managedUsers.value || [];
        const found = list.find(u => (u && (u.uid || u._key || u.id)) === manager);
        const managerSource = (user.value && user.value.uid === manager) ? 'self' : (found ? 'managed_list' : 'fallback');
        const header = {
          displayedPrincipalUid: (displayedPrincipal.value && (displayedPrincipal.value.uid || displayedPrincipal.value._key || displayedPrincipal.value.id)) || null,
          displayedPrincipalName: displayedPrincipalName.value,
          displayedPrincipalTag: displayedPrincipalTag.value,
          isDelegated: isDelegated.value,
        };
        // Trim list for logging
        const listPreview = list.slice(0, 5).map(u => ({ uid: u && (u.uid || u._key || u.id), display_name: u && (u.displayName || u.display_name), user_tag: u && u.user_tag }));
        console.log('[PrincipalMenu][debug]', {
          managerUid: manager,
          activePrincipalUid: active,
          managerSource,
          managerRow: { name: managerDisplayName.value, tag: managerTag.value },
          user: user.value ? { uid: user.value.uid, displayName: user.value.displayName, user_tag: user.value.user_tag } : null,
          header,
          managedUsersCount: list.length,
          managedUsersPreview: listPreview,
        });
      }
    } catch (_) {}
  }
};
const closePrincipalMenu = () => { isPrincipalMenuOpen.value = false; };
const onSelectPrincipal = async (_uid) => {
  if (!_uid || switchingPrincipalUid.value) return;
  if (isManagedUsersReordering.value || suppressManagedClick.value) return;
  const currentActive = activePrincipalUid.value;
  if (_uid === currentActive) {
    closePrincipalMenu();
    return;
  }
  const manager = managerUid.value;
  const isTargetManager = !!manager && _uid === manager;
  const mustHopThroughManager = !isTargetManager && isDelegated.value;

  switchingPrincipalUid.value = _uid;
  try {
    if (isTargetManager) {
      await store.dispatch('auth/returnToSelf');
      closePrincipalMenu();
      return;
    }

    if (mustHopThroughManager) {
      await store.dispatch('auth/returnToSelf');
    }

    await store.dispatch('auth/switchPrincipal', { managedUid: _uid });
    closePrincipalMenu();
  } catch (e) {
    console.error('[TabViewLayout] principal switch failed', e);
  } finally {
    switchingPrincipalUid.value = null;
  }
};
const onCreateManagedUser = () => { closePrincipalMenu(); isCreateManagedModalOpen.value = true; };
const onOpenOnboarding = () => {
  closePrincipalMenu();
  store.dispatch('ui/setOnboardingOpen', true);
};

// Drag/drop handlers for managed users menu reordering
const onManagedDragStart = (key, event) => {
  if (!key) return;
  isManagedUsersReordering.value = true;
  managedDragKey.value = key;
  managedDragOverKey.value = key;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    try { event.dataTransfer.setData('text/plain', key); } catch (_) {}
  }
};

const onManagedDragOver = (key, event) => {
  if (!isManagedUsersReordering.value) return;
  if (event) event.preventDefault();
  managedDragOverKey.value = key;
};

const onManagedDrop = (targetKey, event) => {
  if (!isManagedUsersReordering.value) return;
  event?.preventDefault?.();

  const fromKey = event?.dataTransfer?.getData?.('text/plain');
  if (!fromKey || !targetKey || fromKey === targetKey) return;

  const current = managedUsersOrderedForMenu.value || [];
  const fromIndex = current.findIndex(m => managedUserSortKey(m) === fromKey);
  const toIndexRaw = current.findIndex(m => managedUserSortKey(m) === targetKey);
  if (fromIndex < 0 || toIndexRaw < 0) return;

  // If removing from before the insertion point, the insertion index shifts left by 1.
  const toIndex = fromIndex < toIndexRaw ? toIndexRaw - 1 : toIndexRaw;

  const next = current.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  persistManagedUsersOrder(next);

  // Prevent the click handler from running right after drop.
  suppressManagedClick.value = true;
  setTimeout(() => { suppressManagedClick.value = false; }, 80);

  isManagedUsersReordering.value = false;
  managedDragKey.value = null;
  managedDragOverKey.value = null;
};

const onManagedDragEnd = () => {
  isManagedUsersReordering.value = false;
  managedDragKey.value = null;
  managedDragOverKey.value = null;
};

const closeCreateManagedModal = () => {
  isCreateManagedModalOpen.value = false;
};

const onDocumentClick = (e) => {
  if (!isPrincipalMenuOpen.value) return;
  const menuEl = principalMenuWrapperRef.value;
  const nameEl = usernameContainerRef.value;
  if (menuEl && menuEl.contains(e.target)) return;
  if (nameEl && nameEl.contains(e.target)) return;
  closePrincipalMenu();
};

onMounted(() => { document.addEventListener('click', onDocumentClick); });
onBeforeUnmount(() => { document.removeEventListener('click', onDocumentClick); });

// Sync store's active tab with route-driven value
watch(
  () => route.path,
  () => {
    if (activeTab.value) {
      store.dispatch('navigation/setActiveTab', activeTab.value);
    }
  },
  { immediate: true }
);

const openProfileModal = () => {
  if (user.value && !isSwitchingPrincipal.value) {
    isProfileModalOpen.value = true;
  }
};

const closeProfileModal = () => {
  isProfileModalOpen.value = false;
};

// Removed click-driven tab syncing; route is now the single source of truth

const openApiKeysModal = () => {
  if (user.value) {
    isApiKeysModalOpen.value = true;
  }
};

const closeApiKeysModal = () => {
  isApiKeysModalOpen.value = false;
};

const openSettingsModal = () => {
  store.dispatch('ui/setSettingsModalOpen', true);
};

const onLogoClick = (event) => {
  console.log('[TabViewLayout] Stitch logo clicked → navigating to /home');
  try {
    router.push('/home');
  } catch (e) {
    console.warn('[TabViewLayout] router.push to /home failed, falling back to replace', e);
    router.replace('/home');
  }
};

// Global create button handlers
const handleGlobalCreateClick = () => {
  if (!user.value) {
    store.commit('ui/SET_ERROR', { code: 'auth_required', message: 'Please log in to create new content' });
    return;
  }

  if (!canInteract.value) {
    store.commit('ui/SET_ERROR', { code: 'permission_required', message: 'You need write permission to create new content' });
    return;
  }

  // If user has import or channel.create scopes, show modal
  // Otherwise go straight to new thread
  if (shouldShowCreateModal.value) {
    showCreateModal.value = true;
  } else {
    router.push('/new-thread');
  }
};

const handleNewThread = () => {
  showCreateModal.value = false;
  router.push('/new-thread');
};

const handleImport = () => {
  showCreateModal.value = false;
  store.dispatch('navigation/setPreviousRoute', route.path);
  router.push('/import');
};

const handleCreateChannel = () => {
  showCreateModal.value = false;
  showCreateChannelModal.value = true;
};

const handleChannelCreated = async (newChannel) => {
  console.log('[TabViewLayout] Channel created:', newChannel);
  showCreateChannelModal.value = false;
  
  // Trigger refresh so ChannelsView can reload its list
  store.dispatch('navigation/triggerRefresh');
  
  // Navigate to channels tab if not already there to show the new channel
  if (route.path !== '/channels') {
    router.push('/channels');
  }
};
</script>

<style scoped>
.app-layout {
  display: grid;
  grid-template-rows: auto 1fr;
  height: var(--app-height, 100vh);
  position: relative;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  border-bottom: 1px solid var(--color-border, #eee);
  background: var(--color-chrome, #0e0c0d);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  gap: var(--space-lg, 24px);
  min-width: 0;
  width: 100%;
  container-type: inline-size;
  container-name: app-header;
}

.branding {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.logo-link {
  text-decoration: none;
}

.logo-link:hover .logo-image {
  opacity: 0.9;
}

.logo-image {
  height: 2rem;
  width: auto;
  display: block;
}

.navigation-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 12px);
  flex-wrap: nowrap; /* Keep on one line */
  overflow-x: auto; /* Scroll if tabs overflow */
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Hide by default (Firefox) */
  flex: 1;
}

/* Hide navigation tabs on mobile - shown in footer instead */
@media (max-width: 768px) {
  .navigation-tabs {
    display: none;
  }
}

/* Hide scrollbar by default in WebKit; reveal on interaction */
.navigation-tabs::-webkit-scrollbar { height: 0px; }
.navigation-tabs:hover::-webkit-scrollbar,
.navigation-tabs:focus-within::-webkit-scrollbar,
.navigation-tabs:active::-webkit-scrollbar { height: 6px; }
.navigation-tabs:hover::-webkit-scrollbar-thumb,
.navigation-tabs:focus-within::-webkit-scrollbar-thumb,
.navigation-tabs:active::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 6px;
}

.nav-tab {
  text-decoration: none;
  color: var(--color-text-secondary, #aaa);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border-radius: var(--radius-sm, 4px);
  transition: background-color var(--transition-fast, 0.2s);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.nav-tab:hover {
  background-color: var(--color-hover-overlay, #222);
}

.nav-tab.active {
  background-color: var(--color-primary, #598958);
  color: var(--color-text-inverse, #fffcef);
}

.nav-tab :deep(.tab-glyph) {
  opacity: 0.45;
}

.nav-tab.has-glyph.active {
  background-color: transparent;
}

.nav-tab.active :deep(.tab-glyph) {
  opacity: 1;
}

/* Names stay beside the icons while the header row has room. */
@container app-header (max-width: 1200px) {
  .navigation-tabs .tab-label {
    display: none;
  }
}

.unread-inline-badge {
  background-color: #dc2626; /* Red color */
  color: white;
  border-radius: 12px;
  height: 16px;
  font-size: 10px;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  min-width: 16px;
  padding: 0 6px;
  margin-left: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  vertical-align: middle;
  overflow: hidden; /* Ensure spinner stays within bounds */
  position: relative; /* Create containing block */
}

.loading-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-top: 1.5px solid white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: block;
  flex-shrink: 0;
  margin: 0;
  position: relative;
  z-index: 1;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.user-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 12px);
  flex-shrink: 0;
  margin-left: auto;
}

/* Ensure direct children (including wrapped button components) are centered */
.user-controls > * {
  display: flex;
  align-items: center;
  padding: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin-right: var(--space-sm, 12px);
}

.principal-menu-wrapper {
  position: relative;
  flex-shrink: 0;
}

.principal-dropdown-toggle {
  background: transparent;
  color: var(--color-text, #fff);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  padding: 2px 6px;
  cursor: pointer;
  line-height: 1;
}

.principal-dropdown-toggle:hover {
  background-color: var(--color-hover-overlay, #222);
}

.principal-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--color-surface, #111);
  color: var(--color-text, #fff);
  border: 1px solid var(--color-border, #2a2a2a);
  border-radius: 8px;
  min-width: 220px;
  padding: 6px;
  margin-top: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  z-index: 200;
}

.menu-section { display: flex; flex-direction: column; gap: 2px; }
.menu-section.managed-users-section {
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Scrollbar styling for managed users section */
.menu-section.managed-users-section::-webkit-scrollbar {
  width: 6px;
}

.menu-section.managed-users-section::-webkit-scrollbar-track {
  background: transparent;
}

.menu-section.managed-users-section::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.menu-section.managed-users-section::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.35);
}

/* Firefox scrollbar */
.menu-section.managed-users-section {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.menu-divider { height: 1px; background: var(--color-border, #2a2a2a); margin: 6px 0; }

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text, #eee);
}

.menu-item:hover { background: var(--color-hover-overlay, #222); }
.menu-item.manager { font-weight: 700; }
.menu-item.active {
  background: var(--color-primary, #4f8cff);
  color: #111;
}
.menu-item.pending {
  opacity: 0.65;
  cursor: wait;
}

.menu-item[draggable="true"] {
  cursor: grab;
  user-select: none;
}

.menu-item.dragging {
  opacity: 0.65;
  background: var(--color-hover-overlay, #222);
}

.menu-item.drag-over {
  outline: 1px dashed rgba(89, 137, 88, 0.95);
  outline-offset: -2px;
}

.menu-item-main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.menu-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-item-tag {
  opacity: 0.7;
  font-size: 0.85em;
  margin-left: auto;
  padding-left: 6px;
  text-align: right;
}
.menu-item-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}
.menu-switch-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-top-color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.menu-empty { padding: 6px 8px; opacity: 0.7; font-style: italic; }

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  transition: background-color var(--transition-fast, 0.2s);
  min-width: 0;
  overflow: hidden;
}

/* Name lives inside UserDisplay, so truncation has to cross the component boundary. */
.username-container :deep(.user-display) {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  flex-wrap: nowrap;
}

.username-container :deep(.user-display__name) {
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.username-container:hover {
  background-color: var(--color-hover-overlay, #222);
}

.username-container.is-switching {
  cursor: default;
  pointer-events: none;
  opacity: 0.9;
}

.username-container.is-switching .username,
.username-container.is-switching .user-tag {
  opacity: 0.7;
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: var(--font-size-xs, 0.85rem);
  color: var(--color-text-secondary, #aaa);
  opacity: 0.8;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--color-text, #fff);
  flex-shrink: 0;
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.acting-chip {
  background: var(--color-secondary-light, rgba(89, 137, 88, 0.2));
  color: var(--color-accent-light, #9dcc98);
  border: 1px solid rgba(89, 137, 88, 0.4);
  border-radius: 6px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 1.4;
  margin-left: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

.profile-switch-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary, #bbb);
}

.profile-switch-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--color-primary, #4f8cff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.profile-switch-text {
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 600px) {
  .profile-switch-text {
    display: none;
  }
}

.switching-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 500;
  pointer-events: all;
  cursor: wait;
}

.logout-btn {
  background-color: transparent;
  color: var(--color-text, #fff);
  padding: var(--space-xs, 6px) var(--space-sm, 12px);
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: var(--font-size-xs, 0.85rem);
}

.logout-btn:hover {
  background-color: var(--color-hover-overlay, #222);
}

.login-btn {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
  padding: 2px 8px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: calc(var(--font-size-xs, 0.85rem) - 2px);
  line-height: 1.1;
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark, #357ae8);
}

/* Ensure register button matches compact login sizing if component exposes a class */
.register-btn {
  background-color: transparent;
  color: var(--color-text, #fff);
  padding: 2px 8px;
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: calc(var(--font-size-xs, 0.85rem) - 2px);
  line-height: 1.1;
  text-decoration: none;
}

.register-btn:hover {
  background-color: var(--color-hover-overlay, #222);
}

/* Dev & Settings buttons: neutral styling, compact padding */
.dev-btn,
.settings-btn {
  background-color: transparent;
  color: var(--color-text, #fff);
  padding: 2px 8px;
  border: 1px solid var(--color-border, #eee);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: calc(var(--font-size-xs, 0.85rem) - 2px);
  line-height: 1.1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.settings-btn {
  padding: 4px 6px;
}

.settings-gear-icon {
  width: 15px;
  height: 15px;
  display: block;
}

.dev-btn:hover,
.settings-btn:hover {
  background-color: var(--color-hover-overlay, #222);
}

/* Desktop: make dev & settings buttons match logout button above 852px */
@media (min-width: 853px) {
  .dev-btn {
    padding: var(--space-xs, 6px) var(--space-sm, 12px);
    font-size: var(--font-size-xs, 0.85rem);
    line-height: normal;
  }

  .settings-btn {
    padding: var(--space-xs, 6px) 8px;
    line-height: normal;
  }

  .settings-gear-icon {
    width: 16px;
    height: 16px;
  }
}

.whitelist-badge, .non-whitelist-badge, .guest-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--space-xs, 6px);
}

.whitelist-badge {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}


.non-whitelist-badge {
  background-color: var(--color-warning, #ffb300);
  color: var(--color-text-inverse, #fff);
}

.guest-badge {
  background-color: var(--color-surface-light, #272a27);
  color: var(--color-text-inverse, #fffcef);
  border: 1px solid var(--color-border, #323632);
}

.auth-loading-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  background-color: var(--color-surface, #222);
  border: 1px solid var(--color-border, #eee);
  overflow: hidden;
  margin-left: var(--space-xs, 6px);
}

.auth-loading-spinner {
  display: block;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary, #4f8cff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.main-content {
  padding: 6px;
  overflow-y: auto;
  overflow-x: hidden; /* Prevent horizontal overflow */
  height: 100%;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box; /* Include padding in width calculation */
}

/* Add bottom padding on mobile to account for mobile tab bar */
@media (max-width: 768px) {
  .main-content {
    padding-bottom: 104px; /* Height of the mobile tab bar plus a little clearance */
  }
}

/* Banner prompting email verification */
.verify-banner {
  background: rgba(255, 193, 7, 0.12);
  color: var(--color-text, #fff);
  border: 1px solid rgba(255, 193, 7, 0.35);
  border-radius: 6px;
  padding: 8px 12px;
  margin: 8px 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.verify-link {
  color: var(--color-primary, #4f8cff);
  text-decoration: none;
  font-weight: 600;
}
.verify-link:hover { text-decoration: underline; }

/* (removed) simple tab transition */

/* Mobile responsive styles */
@media (max-width: 852px) {
  .verify-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 10px;
  }
  .verify-link {
    align-self: flex-start;
  }
  .app-header {
    padding: 0 12px; /* Reduce header padding */
    gap: 8px;
    min-width: 0;
  }
  
  .logo-image {
    height: 1.2rem; /* Smaller logo */
  }
  
  .user-controls {
    gap: var(--space-xs, 8px); /* Reduce gap */
    flex: 1 1 auto;
    min-width: 0;
    justify-content: flex-end;
  }
  
  .user-info {
    gap: 2px; /* Minimal gap */
    margin-right: 0;
    min-width: 0; /* Allow shrinking */
    flex: 0 1 auto;
  }
  
  .username-container {
    gap: 2px; /* Reduce gap */
    padding: 1px 4px; /* Smaller padding */
    max-width: 100%;
    min-width: 0;
    flex: 1 1 auto;
  }

  .username-container :deep(.user-display__name) {
    max-width: none;
    flex: 1 1 auto;
    font-size: calc(var(--font-size-xs));
  }

  .username-container :deep(.user-tag) {
    display: none; /* Hide user tag on mobile to save space */
  }
  
  .username {
    max-width: 60px; /* Much smaller username width on mobile */
    font-size: calc(var(--font-size-xs)); /* Smaller font */
  }
  
  .user-tag {
    font-size: calc(var(--font-size-xs) - 2px); /* Even smaller tag */
    display: none; /* Hide user tag on mobile to save space */
  }

  .edit-icon {
    display: none;
  }
  
  
  .whitelist-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 14px; /* Smaller badges */
    height: 14px;
    line-height: 14px;
    font-size: 10px;
    margin-left: 2px; /* Reduce margin */
  }
  
  .logout-btn, .login-btn, .dev-btn, .settings-btn {
    padding: var(--space-xs, 6px) var(--space-sm, 8px); /* Smaller button padding */
    font-size: calc(var(--font-size-xs) - 1px); /* Smaller font */
    white-space: nowrap; /* Prevent text wrapping */
    flex-shrink: 0; /* Never shrink the logout button */
  }
}

/* Matched corner controls. Sage fill with a matte wood grain. */
.global-feedback-btn,
.global-create-btn {
  position: fixed;
  bottom: var(--space-xl);
  z-index: 10;
  isolation: isolate;
  overflow: hidden;
  width: 84px;
  height: 84px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-primary);
  background-image: url("/textures/wood-matte-contrast.png");
  background-repeat: repeat;
  background-size: 168px;
  background-blend-mode: overlay;
  color: var(--color-text-inverse);
  text-decoration: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background-color var(--transition-normal);
}

.global-feedback-btn {
  left: var(--space-xl);
}

.global-create-btn {
  right: var(--space-xl);
  line-height: 1;
}

.global-feedback-btn .btn-icon,
.global-create-btn .btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.global-feedback-btn .btn-icon {
  width: 42px;
  height: 42px;
}

.global-create-btn .btn-icon {
  transform: translateY(-2px);
  font-size: 80px;
  width: auto;
  height: auto;
}

.global-feedback-btn:hover,
.global-create-btn:hover {
  background-color: var(--color-primary-dark);
  color: var(--color-text-inverse);
}

.global-feedback-btn:focus-visible,
.global-create-btn:focus-visible {
  outline: 3px solid var(--color-cream);
  outline-offset: 3px;
}

/* Mobile responsive for global create and feedback buttons */
@media (max-width: 768px) {
  .global-feedback-btn,
  .global-create-btn {
    background-size: 64px;
  }

  .global-create-btn {
    width: 52px;
    height: 52px;
    bottom: 80px; /* Move up to avoid mobile tab bar */
    right: var(--space-md);
  }

  .global-create-btn .btn-icon {
    transform: translateY(-1px);
    font-size: 48px;
  }

  .global-feedback-btn {
    width: 52px;
    height: 52px;
    bottom: 80px;
    left: var(--space-md);
  }

  .global-feedback-btn .btn-icon {
    width: 26px;
    height: 26px;
  }
}

@media (max-width: 480px) {
  .verify-banner {
    padding: 6px 8px;
    gap: 6px;
  }
  .app-header {
    padding: 0 8px; /* Even less padding on very narrow screens */
    min-height: 56px; /* Ensure minimum height */
    gap: 6px;
  }
  
  .logo-image {
    height: 1rem; /* Even smaller logo */
  }
  
  .user-controls {
    gap: 4px; /* Minimal gap */
    min-width: 0;
  }
  
  .user-info {
    margin-right: 0;
    min-width: 0;
  }
  
  .username-container {
    max-width: 100%;
    padding: 1px 2px;
  }
  
  .username,
  .username-container :deep(.user-display__name) {
    max-width: none;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .whitelist-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 12px; /* Very small badges */
    height: 12px;
    line-height: 12px;
    font-size: 8px;
    margin-left: 1px;
  }
  
  .logout-btn, .login-btn, .dev-btn, .settings-btn {
    padding: 4px 6px; /* Minimal button padding */
    font-size: calc(var(--font-size-xs) - 2px); /* Very small font */
    min-width: 0; /* Allow content to dictate width */
  }
}

/* Simplified layout on ultra-narrow screens */
@media (max-width: 330px) {
  .app-header {
    padding: 8px;
  }
  
  .branding {
    flex-shrink: 0; /* Never shrink logo */
  }
  
  .user-controls {
    min-width: 0;
  }
  
  .user-tag,
  .username-container :deep(.user-tag) {
    display: none; /* Hide user tag for space */
  }
  
  .username,
  .username-container :deep(.user-display__name) {
    max-width: none;
  }
  
  .logout-btn, .login-btn, .dev-btn, .settings-btn {
    min-width: 0;
    padding: 4px 8px;
    font-size: calc(var(--font-size-xs));
  }
}
</style>

<style>
/* Non-scoped global styles for mobile tab bar - ensures it works on all routes */
@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex !important;
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    transform: none !important;
    width: 100% !important;
    max-width: none !important;
    background: var(--color-chrome, #0e0c0d) !important;
    border-top: 1px solid #2a2a2a !important;
    padding: 16px 0 calc(16px + env(safe-area-inset-bottom)) !important;
    z-index: 100 !important;
    justify-content: space-around !important;
    align-items: center !important;
    gap: 0 !important;
    box-shadow: none !important;
  }
  
  .mobile-tab-bar .mobile-tab {
    display: flex !important;
    flex: 1 1 0 !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-decoration: none !important;
    color: #aaa !important;
    padding: 4px 0 !important;
    max-width: none !important;
    gap: 0 !important;
    background: transparent !important;
    border-radius: 0 !important;
  }
  
  .mobile-tab-bar .mobile-tab.active {
    background-color: transparent !important;
    color: inherit !important;
    border-radius: 0 !important;
  }

  .mobile-tab-bar .tab-glyph {
    width: 40px !important;
    height: 40px !important;
    opacity: 0.45;
  }

  .mobile-tab-bar .mobile-tab.active .tab-glyph {
    opacity: 1 !important;
  }
  
  .mobile-tab-bar .tab-label {
    display: none !important;
  }
}
</style> 
