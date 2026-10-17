<template>
  <div class="thread-view app-canvas">
    <!-- Loading states -->
    <div v-if="!authReady" class="auth-loading">
      <p>Loading...</p>
    </div>
    
    <!-- Normal view - show when auth is ready -->
    <template v-else>
      <!-- Thread header with navigation back and title -->
      <div class="thread-header">
        <button @click="cancelThread()" class="back-button">
          &larr; Cancel
        </button>
        <h2 class="thread-title">New Message</h2>
        <div class="user-controls">
          <div class="user-info">
            <div class="username-container" @click="openProfileModal" v-if="user">
              <span class="username">{{ userDisplayName }}</span>
              <span v-if="userTag" class="user-tag">@{{ userTag }}</span>
              <span class="edit-icon" title="Edit profile">✎</span>
            </div>
            <span v-else class="username">Guest</span>

            <!-- Auth status badges -->
            <span v-if="!user" class="guest-badge" title="Not logged in">?</span>
          </div>
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
          <LoginButton v-else />
        </div>
      </div>
      
      <!-- Guest notification box - only shown for guests -->
      <div v-if="!user && !loginModalOpen" class="guest-notification">
        <div class="notification-content">
          <div class="notification-icon">🔒</div>
          <div class="notification-text">
            <h3>Not logged in</h3>
            <p>You need to login to send messages</p>
          </div>
          <div class="notification-arrow">↑</div>
        </div>
      </div>

      <!-- Background: embedded recipients and channels -->
      <div v-if="user" class="new-thread-background">
        <div class="draft-panel">
          <section class="draft-section">
            <h3 class="draft-label">Recipients</h3>
            <div class="draft-recipients">
              <div class="draft-input-row">
                <div class="draft-input-wrap" :class="{ searching: isSearching }">
                  <input
                    v-model="newRecipient"
                    type="text"
                    placeholder="Search by username or tag"
                    class="draft-input"
                    @input="onRecipientSearchInput"
                    @keydown.enter.prevent="addRecipientFromSearch"
                  />
                  <div v-if="isSearching" class="draft-search-indicator" title="Searching...">
                    <div class="draft-spinner"></div>
                  </div>
                </div>
                <button
                  type="button"
                  class="draft-add-btn"
                  :disabled="!canAddRecipient"
                  @click="addRecipientFromSearch"
                >
                  Add
                </button>
              </div>

              <div v-if="showRecipientResults" class="draft-search-results">
                <div
                  v-for="u in searchResults"
                  :key="u.uid"
                  class="draft-search-item"
                >
                  <button type="button" class="draft-search-item-main" @click="selectRecipient(u)">
                    <span class="draft-search-name">{{ u.display_name || u.user_tag }}</span>
                    <span class="draft-search-tag">@{{ u.user_tag }}</span>
                  </button>
                  <button
                    type="button"
                    class="draft-speed-dial-star"
                    :class="{ 'in-speed-dial': isInSpeedDial(u.uid), loading: !!speedDialLoading[u.uid] }"
                    :disabled="!!speedDialLoading[u.uid]"
                    :title="isInSpeedDial(u.uid) ? 'Remove from Speed Dial' : 'Add to Speed Dial'"
                    @click.stop="isInSpeedDial(u.uid) ? removeFromSpeedDial(u) : addToSpeedDial(u)"
                  >
                    <span v-if="speedDialLoading[u.uid]" class="draft-spinner draft-spinner--tiny"></span>
                    <span v-else-if="isInSpeedDial(u.uid)">★</span>
                    <span v-else>☆</span>
                  </button>
                </div>
                <p v-if="searchResults.length === 0 && hasSearched && !isSearching" class="draft-no-results">
                  No users found. Try a different search term.
                </p>
              </div>

              <div class="draft-speed-dial">
                <p class="draft-speed-dial-label">Speed Dial</p>
                <div v-if="speedDialUsers.length > 0" class="draft-speed-dial-cards">
                  <div
                    v-for="u in mainSpeedDialUsers"
                    :key="u.uid"
                    class="draft-speed-dial-card"
                    :class="{ 'draft-speed-dial-card--selected': isSpeedDialUserSelected(u) }"
                  >
                    <button type="button" class="draft-speed-dial-info" @click="toggleSpeedDialUser(u)">
                      <span class="draft-speed-dial-name">{{ u.display_name }}</span>
                      <span class="draft-speed-dial-tag">@{{ u.user_tag }}</span>
                    </button>
                    <div class="draft-speed-dial-controls">
                      <label class="draft-speed-dial-checkbox">
                        <input
                          type="checkbox"
                          :checked="isSpeedDialUserSelected(u)"
                          @click.prevent="toggleSpeedDialUser(u)"
                        />
                      </label>
                      <button
                        type="button"
                        class="draft-speed-dial-tier"
                        :disabled="!!speedDialLoading[u.uid]"
                        :title="u.tier === 1 ? 'Move to More' : 'Move to main'"
                        @click.stop="toggleSpeedDialTier(u)"
                      >
                        <span v-if="speedDialLoading[u.uid]" class="draft-spinner draft-spinner--tiny"></span>
                        <span v-else>{{ u.tier === 1 ? '↓' : '↑' }}</span>
                      </button>
                      <button
                        type="button"
                        class="draft-speed-dial-remove"
                        :disabled="!!speedDialLoading[u.uid]"
                        title="Remove from Speed Dial"
                        @click.stop="removeFromSpeedDial(u)"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="draft-speed-dial-empty">
                  <p>No speed dial contacts yet.</p>
                  <p class="hint">Search for users above and click ☆ to add them.</p>
                </div>

                <div v-if="expandedSpeedDialUsers.length > 0" class="draft-speed-dial-more">
                  <button
                    type="button"
                    class="draft-speed-dial-more-btn"
                    :aria-expanded="showMoreSpeedDial"
                    @click="showMoreSpeedDial = !showMoreSpeedDial"
                  >
                    <span>More ({{ expandedSpeedDialUsers.length }})</span>
                    <span class="draft-speed-dial-more-icon" :class="{ expanded: showMoreSpeedDial }">▼</span>
                  </button>
                  <div v-if="showMoreSpeedDial" class="draft-speed-dial-cards">
                    <div
                      v-for="u in expandedSpeedDialUsers"
                      :key="u.uid"
                      class="draft-speed-dial-card draft-speed-dial-card--more"
                      :class="{ 'draft-speed-dial-card--selected': isSpeedDialUserSelected(u) }"
                    >
                      <button type="button" class="draft-speed-dial-info" @click="toggleSpeedDialUser(u)">
                        <span class="draft-speed-dial-name">{{ u.display_name }}</span>
                        <span class="draft-speed-dial-tag">@{{ u.user_tag }}</span>
                      </button>
                      <div class="draft-speed-dial-controls">
                        <label class="draft-speed-dial-checkbox">
                          <input
                            type="checkbox"
                            :checked="isSpeedDialUserSelected(u)"
                            @click.prevent="toggleSpeedDialUser(u)"
                          />
                        </label>
                        <button
                          type="button"
                          class="draft-speed-dial-tier"
                          :disabled="!!speedDialLoading[u.uid]"
                          :title="u.tier === 1 ? 'Move to More' : 'Move to main'"
                          @click.stop="toggleSpeedDialTier(u)"
                        >
                          <span v-if="speedDialLoading[u.uid]" class="draft-spinner draft-spinner--tiny"></span>
                          <span v-else>{{ u.tier === 1 ? '↓' : '↑' }}</span>
                        </button>
                        <button
                          type="button"
                          class="draft-speed-dial-remove"
                          :disabled="!!speedDialLoading[u.uid]"
                          title="Remove from Speed Dial"
                          @click.stop="removeFromSpeedDial(u)"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="draft-recipient-cards">
                <div
                  v-for="(r, i) in replyRecipients"
                  :key="r.uid || i"
                  class="draft-recipient-card"
                >
                  <div class="draft-recipient-card-main">
                    <div class="draft-recipient-card-name-line">
                      <div class="draft-recipient-card-name">{{ r.display_name || r.user_tag }}</div>
                      <div v-if="r.user_tag" class="draft-recipient-card-tag">@{{ r.user_tag }}</div>
                    </div>
                  </div>

                  <BotVersionPicker
                    v-if="isBotRecipient(r) && getAvailableVersions(r).length > 1"
                    :available-versions="getAvailableVersions(r)"
                    :model-value="r.bot_version_id || null"
                    @update:modelValue="(val) => store.dispatch('navigation/setRecipientBotVersion', { uid: r.uid, versionId: val })"
                  />

                  <button type="button" class="draft-recipient-remove" aria-label="Remove" @click="removeRecipient(i)">×</button>
                </div>

                <p v-if="!replyRecipients.length" class="draft-empty">No recipients yet</p>
              </div>
            </div>
          </section>

          <section class="draft-section">
            <h3 class="draft-label">Channels</h3>
            <div class="draft-channels">
              <div class="draft-channel-row">
                <ChannelDropdown
                  :available-channels="availableChannels"
                  :selected-channel-ids="replyChannelIds"
                  :placeholder="isLoadingChannels ? 'Loading channels...' : 'Select a channel...'"
                  :disabled="isLoadingChannels"
                  @select="onChannelSelect"
                />
              </div>
              <div class="draft-channel-list">
                <div
                  v-for="(ch, i) in selectedChannelsDisplay"
                  :key="ch.id"
                  class="draft-channel-card"
                >
                  <div class="draft-channel-info">
                    <span class="draft-channel-name">📢 {{ ch.display_name || ch.id }}</span>
                    <span v-if="ch.description || ch.member_count || ch.is_admin" class="draft-channel-meta">
                      <span v-if="ch.description" class="draft-channel-description">{{ ch.description }}</span>
                      <span v-if="ch.member_count">{{ ch.member_count }} members</span>
                      <span v-if="ch.is_admin" class="draft-channel-admin">Admin</span>
                    </span>
                  </div>
                  <button type="button" class="draft-channel-remove" aria-label="Remove channel" @click="removeChannel(i)">×</button>
                </div>
                <p v-if="!replyChannelIds.length" class="draft-empty">No channels selected</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Reply box component -->
      <reply-box
        :is-new-thread="true"
        :can-interact="canInteract"
        ref="replyBox"
        @send-success="handleSendSuccess"
        @send-error="handleSendError"
      />

      <!-- Loading Overlay -->
      <div v-if="isCreatingThread" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-main-line">
            <p class="loading-message">{{ loadingMessage }}</p>
            <div class="import-spinner"></div>
          </div>
          <p class="loading-submessage">{{ loadingSubmessage }}</p>
        </div>
      </div>

      <!-- Global Notifications component -->
      <GlobalNotifications />
      
      <!-- Profile Edit Modal -->
      <ProfileEditModal 
        :isOpen="isProfileModalOpen" 
        @close="closeProfileModal" 
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import ReplyBox from '../../components/ReplyBox.vue';
import GlobalNotifications from '../../components/GlobalNotifications.vue';
import ProfileEditModal from '../../components/modals/ProfileEditModal.vue';
import ChannelDropdown from '../../components/ChannelDropdown.vue';
import ChannelsService from '../../services/ChannelsService.js';
import { useAuthentication } from '../../composables/useAuthentication';
import LoginButton from '@buttons/LoginButton.vue'
import BotVersionPicker from '../../components/common/BotVersionPicker.vue';

// Setup store and routing
const store = useStore();
const router = useRouter();
const route = useRoute();
const { signInWithGoogle, logout } = useAuthentication();

// Refs
const messageList = ref(null);
const replyBox = ref(null);

// Update the refs
const isCreatingThread = ref(false);
const loadingMessage = ref('Creating new thread...');
const loadingSubmessage = ref('This will only take a moment');

// Add login state
const isLoggingIn = ref(false);
const isProfileModalOpen = ref(false);

// Computed properties from store
const user = computed(() => store.getters['auth/user']);
const loginModalOpen = computed(() => store.getters['ui/loginModalOpen']);
const authReady = computed(() => store.getters['auth/authReady']);
const isAdmin = computed(() => store.getters['auth/isAdmin']);
const canInteract = computed(() => store.getters['auth/canInteract']);

// User display properties
const userDisplayName = computed(() => {
  if (!user.value) return 'Guest';
  return user.value.displayName || user.value.email || 'Unknown User';
});

const userTag = computed(() => {
  if (!user.value) return null;
  return user.value.user_tag || null;
});

// canInteract provided by store: admin or msg.write

// Add computed property for current reply visibility
const isPublic = computed(() => store.getters['navigation/replyIsPublic']);

// Single source of truth with ReplyBox: recipients and channels from navigation store
const replyRecipients = computed(() => store.getters['navigation/replyRecipients'] || []);
const replyChannelIds = computed(() => store.getters['navigation/replyChannelIds'] || []);

// Recipients: search and add
const newRecipient = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const showRecipientResults = ref(false);
const hasSearched = ref(false);
let searchTimeout = null;

const canAddRecipient = computed(() => {
  const tag = newRecipient.value.trim();
  if (tag) return true;
  return searchResults.value.length > 0;
});

function onRecipientSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout);
  const query = newRecipient.value.trim();
  if (!query) {
    searchResults.value = [];
    showRecipientResults.value = false;
    hasSearched.value = false;
    return;
  }
  searchTimeout = setTimeout(async () => {
    isSearching.value = true;
    hasSearched.value = true;
    try {
      const results = await store.dispatch('auth/searchUsers', query);
      const list = Array.isArray(results) ? results : [];
      searchResults.value = list;
      showRecipientResults.value = true;
    } catch (e) {
      searchResults.value = [];
      showRecipientResults.value = true;
    }
    isSearching.value = false;
  }, 300);
}

function addRecipientFromSearch() {
  if (searchResults.value.length > 0) {
    selectRecipient(searchResults.value[0]);
  }
}

function selectRecipient(user) {
  if (!user?.user_tag) return;
  store.dispatch('navigation/addRecipient', {
    uid: user.uid,
    display_name: user.display_name,
    user_tag: user.user_tag,
    public: true,
    notify: true,
    is_bot: !!(user.is_bot ?? user.isBot),
    available_versions: user.available_versions ?? user.availableVersions ?? null
  });
  newRecipient.value = '';
  searchResults.value = [];
  showRecipientResults.value = false;
}

function removeRecipient(index) {
  store.dispatch('navigation/removeRecipient', index);
}

function isBotRecipient(r) {
  return !!(r?.is_bot ?? r?.isBot);
}

function getAvailableVersions(r) {
  const v = r?.available_versions ?? r?.availableVersions;
  return Array.isArray(v) ? v : [];
}

// Speed dial (same controls as the recipients modal)
const speedDialUsers = computed(() => store.getters['speedDial/users'] || []);
const mainSpeedDialUsers = computed(() => store.getters['speedDial/mainUsers'] || []);
const expandedSpeedDialUsers = computed(() => store.getters['speedDial/expandedUsers'] || []);
const showMoreSpeedDial = ref(false);
const speedDialLoading = reactive({});

function isSpeedDialUserSelected(u) {
  return (replyRecipients.value || []).some((r) => r.uid === u.uid);
}

function isInSpeedDial(uid) {
  return store.getters['speedDial/isInSpeedDial'](uid);
}

function setSpeedDialLoading(uid, on) {
  if (on) speedDialLoading[uid] = true;
  else delete speedDialLoading[uid];
}

function toggleSpeedDialUser(user) {
  if (isSpeedDialUserSelected(user)) {
    const index = (replyRecipients.value || []).findIndex((r) => r.uid === user.uid);
    if (index !== -1) store.dispatch('navigation/removeRecipient', index);
  } else {
    store.dispatch('navigation/addRecipient', {
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag,
      public: true,
      notify: true,
      is_bot: !!(user.is_bot ?? user.isBot),
      available_versions: user.available_versions ?? user.availableVersions ?? null
    });
  }
}

async function addToSpeedDial(user) {
  if (!user?.uid) return;
  setSpeedDialLoading(user.uid, true);
  try {
    await store.dispatch('speedDial/addToSpeedDial', { uid: user.uid });
  } catch (err) {
    store.commit('ui/SET_ERROR', {
      code: 'speed_dial_add_failed',
      message: err?.response?.data?.detail || 'Failed to add to speed dial'
    });
  } finally {
    setSpeedDialLoading(user.uid, false);
  }
}

async function removeFromSpeedDial(user) {
  if (!user?.uid) return;
  setSpeedDialLoading(user.uid, true);
  try {
    await store.dispatch('speedDial/removeFromSpeedDial', user.uid);
  } catch (err) {
    store.commit('ui/SET_ERROR', {
      code: 'speed_dial_remove_failed',
      message: err?.response?.data?.detail || 'Failed to remove from speed dial'
    });
  } finally {
    setSpeedDialLoading(user.uid, false);
  }
}

async function toggleSpeedDialTier(user) {
  if (!user?.uid) return;
  const newTier = user.tier === 1 ? 2 : 1;
  setSpeedDialLoading(user.uid, true);
  try {
    await store.dispatch('speedDial/updateTier', { uid: user.uid, tier: newTier });
  } catch (err) {
    store.commit('ui/SET_ERROR', {
      code: 'speed_dial_tier_failed',
      message: err?.response?.data?.detail || 'Failed to update tier'
    });
  } finally {
    setSpeedDialLoading(user.uid, false);
  }
}

// Channels: dropdown and list
const availableChannels = ref([]);
const isLoadingChannels = ref(false);

const selectedChannelsDisplay = computed(() => {
  const ids = replyChannelIds.value || [];
  const byId = new Map(availableChannels.value.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id) || { id, display_name: id }).filter(Boolean);
});

function onChannelSelect(channel) {
  if (!channel?.id) return;
  const ids = [...(replyChannelIds.value || [])];
  if (ids.includes(channel.id)) return;
  ids.push(channel.id);
  store.commit('navigation/SET_REPLY_CHANNEL_IDS', ids);
}

function removeChannel(index) {
  const ids = [...(replyChannelIds.value || [])];
  ids.splice(index, 1);
  store.commit('navigation/SET_REPLY_CHANNEL_IDS', ids);
}

async function loadChannels() {
  isLoadingChannels.value = true;
  try {
    const list = await ChannelsService.getUserChannels();
    availableChannels.value = Array.isArray(list) ? list : [];
  } catch (e) {
    availableChannels.value = [];
  }
  isLoadingChannels.value = false;
}

// Add computed property for previous route
const previousRoute = computed(() => store.getters['navigation/previousRoute']);

// Lifecycle hooks
onMounted(async () => {
  // Add reload detection
  window.addEventListener('beforeunload', () => {
    console.log('[NewThreadView] 🚨 PAGE RELOAD DETECTED!');
    console.trace('[NewThreadView] Reload stack trace:');
  });
  
  // Wait for auth to be ready before proceeding - auth store handles initialization
  if (!authReady.value) {
    console.log(`[NewThreadView] Auth not ready, waiting...`);
    await new Promise((resolve) => {
      const unwatch = store.watch(
        () => store.getters['auth/authReady'],
        (newValue) => {
          if (newValue) {
            console.log(`[NewThreadView] Auth ready now`);
            unwatch();
            resolve();
          }
        }
      );
    });
  }
  
  // Reset visibility settings for new threads
  console.log(`[NewThreadView] Resetting visibility settings for new thread`);
  
  // Set default visibility to public and clear recipients in one call
  store.dispatch('navigation/setVisibilitySettings', {
    isPublic: false,
    recipients: []
  });
  
  // Clear channels so each new-thread visit starts fresh (no carry-over between new messages)
  store.commit('navigation/CLEAR_REPLY_CHANNEL_IDS');
  const globalId = store.getters['navigation/selectedChannelId'];
  if (globalId) {
    store.commit('navigation/SET_REPLY_CHANNEL_IDS', [globalId]);
  }
  
  // Load channels and speed dial when logged in
  if (user.value) {
    loadChannels();
    store.dispatch('speedDial/fetchSpeedDial');
  }
  // Focus the reply box textarea on mount
  nextTick(() => {
    if (replyBox.value) {
      replyBox.value.focus();
    }
  });
});

// Watch for rejection state changes and redirect to /public
// No whitelist rejection flow anymore

// Methods
const cancelThread = () => {
  // Get reply content
  const content = replyBox.value?.content?.trim();
  
  if (content) {
    if (!confirm("Discard this thread? Any unsent message will be lost.")) {
      return;
    }
  }
  
  // Navigate back to the previous route
  router.push(previousRoute.value);
};

const handleSendSuccess = async (newMessage) => {
  try {
    // Set loading state to show overlay
    isCreatingThread.value = true;
    loadingMessage.value = 'Creating new thread...';
    loadingSubmessage.value = 'This will only take a moment';
    
    // Redirect to the new thread
    router.replace({ path: `/messages/${newMessage.id}` });
  } catch (error) {
    console.error('Error handling message success:', error);
    store.commit('ui/SET_ERROR', 'Failed to complete thread creation.');
  } finally {
    // This may not execute if navigation happens first
    isCreatingThread.value = false;
  }
};

const handleSendError = (error) => {
  console.error('Error sending message:', error);
  store.commit('ui/SET_ERROR', 'Failed to create thread. Please try again.');
};

// Login handled by LoginButton component

// Profile modal methods
const openProfileModal = () => {
  if (user.value) {
    isProfileModalOpen.value = true;
  }
};

const closeProfileModal = () => {
  isProfileModalOpen.value = false;
};

const openSettingsModal = () => {
  store.dispatch('ui/setSettingsModalOpen', true);
};
</script>

<style scoped>
.thread-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Embedded recipients and channels, stacked as surface cards */
.new-thread-background {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: var(--space-lg) var(--space-md) var(--space-xl);
}

.draft-panel {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.draft-section {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}

.draft-label {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.draft-recipients,
.draft-channels {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.draft-input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.draft-input-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-background, var(--color-surface-light));
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.draft-input-wrap:focus-within,
.draft-input-wrap.searching {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.draft-input {
  width: 100%;
  padding: 12px 36px 12px 12px;
  font-size: var(--font-size-sm);
  border: none;
  background: transparent;
  color: var(--color-text);
  outline: none;
}

.draft-input::placeholder {
  color: var(--color-text-secondary);
}

.draft-search-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
}

.draft-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: draft-spin 1s linear infinite;
}

.draft-spinner--tiny {
  width: 12px;
  height: 12px;
}

@keyframes draft-spin {
  to { transform: rotate(360deg); }
}

.draft-add-btn {
  padding: 12px 16px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.draft-add-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.draft-add-btn:disabled {
  background: var(--color-border);
  color: var(--color-text-secondary);
  cursor: default;
}

.draft-search-results {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.draft-search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 4px;
  border-bottom: 1px solid var(--color-border);
}

.draft-search-item:last-child {
  border-bottom: none;
}

.draft-search-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 4px 8px;
  border: none;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius-sm);
}

.draft-search-item-main:hover {
  background: var(--color-hover-overlay);
}

.draft-search-name {
  font-weight: 500;
  font-size: var(--font-size-sm);
}

.draft-search-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.draft-speed-dial-star {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
}

.draft-speed-dial-star:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-hover-overlay);
}

.draft-speed-dial-star.in-speed-dial {
  color: var(--color-warning, #d4923a);
  border-color: var(--color-warning, #d4923a);
}

.draft-speed-dial-star:disabled {
  opacity: 0.6;
  cursor: default;
}

.draft-no-results,
.draft-empty,
.draft-speed-dial-empty {
  margin: 0;
  padding: 12px;
  text-align: center;
  font-size: var(--font-size-sm);
  font-style: italic;
  color: var(--color-text-secondary);
}

.draft-speed-dial-empty p {
  margin: 0;
}

.draft-speed-dial-empty .hint {
  margin-top: 4px;
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.draft-recipient-cards,
.draft-channel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.draft-recipient-card,
.draft-channel-card {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background-color: var(--color-primary-light);
  border: 1px solid rgba(var(--color-primary-rgb), 0.35);
}

.draft-channel-card {
  background-color: var(--color-surface-light);
  border-color: var(--color-border);
}

.draft-recipient-card-main,
.draft-channel-info {
  flex: 1;
  min-width: 0;
}

.draft-recipient-card-name-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  min-width: 0;
}

.draft-recipient-card-name,
.draft-channel-name {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.draft-recipient-card-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.draft-channel-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.draft-channel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.draft-channel-description {
  opacity: 0.85;
}

.draft-channel-admin {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
}

.draft-recipient-remove,
.draft-channel-remove {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-error);
  font-size: 18px;
  cursor: pointer;
}

.draft-channel-remove {
  color: var(--color-text-secondary);
}

.draft-recipient-remove:hover,
.draft-channel-remove:hover {
  background-color: rgba(196, 71, 71, 0.12);
  color: var(--color-error);
}

.draft-speed-dial {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.draft-speed-dial-label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.draft-speed-dial-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  column-gap: 12px;
  row-gap: 6px;
}

.draft-speed-dial-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 4px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.draft-speed-dial-card:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-hover);
}

.draft-speed-dial-card--selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.draft-speed-dial-card--more {
  opacity: 0.92;
}

.draft-speed-dial-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.draft-speed-dial-name {
  width: 100%;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.draft-speed-dial-tag {
  width: 100%;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.draft-speed-dial-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.draft-speed-dial-checkbox {
  display: flex;
  cursor: pointer;
}

.draft-speed-dial-checkbox input {
  width: 14px;
  height: 14px;
  margin: 0;
  appearance: none;
  border: 2px solid var(--color-border-light);
  border-radius: 3px;
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
}

.draft-speed-dial-checkbox input:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.draft-speed-dial-checkbox input:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -54%);
  color: var(--color-text-inverse);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.draft-speed-dial-tier,
.draft-speed-dial-remove {
  width: 18px;
  height: 18px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  line-height: 1;
}

.draft-speed-dial-tier {
  font-size: 12px;
  opacity: 0.7;
}

.draft-speed-dial-remove {
  font-size: 14px;
  opacity: 0.55;
}

.draft-speed-dial-tier:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-light);
  opacity: 1;
}

.draft-speed-dial-remove:hover:not(:disabled) {
  color: var(--color-error);
  background: rgba(196, 71, 71, 0.12);
  opacity: 1;
}

.draft-speed-dial-tier:disabled,
.draft-speed-dial-remove:disabled {
  cursor: default;
}

.draft-speed-dial-more {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.draft-speed-dial-more-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  font-size: var(--font-size-xs);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.draft-speed-dial-more-btn:hover {
  color: var(--color-text);
  background: var(--color-hover-overlay);
}

.draft-speed-dial-more-icon {
  font-size: 9px;
  transition: transform 0.2s ease;
}

.draft-speed-dial-more-icon.expanded {
  transform: rotate(180deg);
}

.draft-channel-row :deep(.channel-dropdown) {
  width: 100%;
}

@media (max-width: 640px) {
  .draft-section {
    padding: var(--space-md);
  }

  .draft-input-row {
    flex-direction: column;
  }

  .draft-add-btn {
    width: 100%;
  }

  .draft-speed-dial-cards {
    grid-template-columns: 1fr 1fr;
  }
}

.thread-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface);
  z-index: 5;
}

.back-button {
  padding: var(--space-xs) var(--space-sm);
  background-color: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
}

.thread-title {
  margin: 0;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-left: 80px;
  padding-right: 80px;
  gap: 20px;
  overflow-y: auto;
  justify-content: flex-start;
  margin-bottom: 130px;
  min-height: 0;
  max-height: calc(100vh - 200px);
}

.import-hint {
  text-align: center;
  padding: var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  background-color: var(--color-surface-light);
  border-radius: var(--radius-md);
  width: 50%;
  margin: 100px auto;
}

.import-link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.import-link:hover {
  color: var(--color-primary-dark);
  text-decoration: underline;
}

.import-disabled-message {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(3px);
}

.loading-content {
  background-color: var(--color-surface);
  padding: var(--space-xl);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.loading-main-line {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-xs);
  width: 100%;
}

.import-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: import-spin 1.2s linear infinite;
  margin-left: var(--space-sm);
}

.loading-message {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin: 0;
  color: var(--color-text);
}

.loading-submessage {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

@keyframes import-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Responsive styles */
@media (max-width: 768px) {
  .messages-container {
    padding-left: 12px;
    padding-right: 12px;
    margin-bottom: 70px;
    max-height: calc(100vh - 120px);
  }
  
  .import-hint {
    width: 90%;
    margin: 60px auto;
    padding: var(--space-md);
    font-size: calc(var(--font-size-sm));
  }
  
  .thread-header {
    padding: var(--space-xs) var(--space-sm);
  }
  
  .back-button {
    padding: 4px 8px;
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .thread-title {
    font-size: var(--font-size-md);
  }
}

@media (max-width: 480px) {
  .messages-container {
    padding-left: 8px;
    padding-right: 8px;
    margin-bottom: 80px;
  }
  
  .import-hint {
    width: 96%;
    margin: 40px auto;
    padding: var(--space-sm);
    font-size: calc(var(--font-size-sm) - 1px);
  }
  
  .thread-header {
    padding: 6px 8px;
  }
  
  .back-button {
    padding: 3px 6px;
    font-size: calc(var(--font-size-xs));
  }
  
  .thread-title {
    font-size: calc(var(--font-size-md) - 1px);
  }
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .thread-header {
    background-color: var(--color-chrome, #0e0c0d);
  }
  
  .loading-content {
    background-color: var(--surface-color-dark, #222);
    border: 1px solid var(--border-color-dark, #444);
  }
  
  .loading-message {
    color: var(--text-color-dark, #eee);
  }
  
  .loading-submessage {
    color: var(--text-color-light-dark, #aaa);
  }
  
  .import-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #10a37f;
  }
}

.user-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-right: var(--space-sm);
}

.username-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
}

.username-container:hover {
  background-color: var(--color-hover-overlay);
}

.username {
  display: inline-block;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.edit-icon {
  font-size: 12px;
  opacity: 0.7;
  color: var(--color-text);
}

.username-container:hover .edit-icon {
  opacity: 1;
}

.logout-btn,
.settings-btn {
  background-color: transparent;
  color: var(--color-text);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.settings-btn {
  padding: var(--space-xs) 8px;
}

.settings-gear-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.logout-btn:hover,
.settings-btn:hover {
  background-color: var(--color-hover-overlay);
}

.login-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--space-xs) var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.login-btn:hover {
  background-color: var(--color-primary-dark);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.whitelist-badge, .non-whitelist-badge, .guest-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  font-size: 12px;
  margin-left: var(--space-xs);
}

.whitelist-badge {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}


.non-whitelist-badge {
  background-color: var(--color-warning);
  color: var(--color-text-inverse);
}

.guest-badge {
  background-color: var(--color-surface-light);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-border);
}

.auth-loading-badge {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  text-align: center;
  line-height: 18px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;
  margin-left: var(--space-xs);
}

.auth-loading-spinner {
  display: block;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .user-controls {
    gap: var(--space-xs);
    flex-shrink: 0;
  }
  
  .user-info {
    gap: 2px;
    margin-right: var(--space-xs);
    min-width: 0;
  }
  
  .username-container {
    gap: 2px;
    padding: 1px 4px;
    max-width: 100px;
    min-width: 0;
  }
  
  .username {
    max-width: 60px;
    font-size: var(--font-size-xs);
  }
  
  .user-tag {
    font-size: calc(var(--font-size-xs) - 2px);
    display: none;
  }
  
  .edit-icon {
    display: none;
  }
  
  .whitelist-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 14px;
    height: 14px;
    line-height: 14px;
    font-size: 10px;
    margin-left: 2px;
  }
  
  .logout-btn, .login-btn, .settings-btn {
    padding: var(--space-xs) var(--space-sm);
    font-size: calc(var(--font-size-xs) - 1px);
    white-space: nowrap;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .user-controls {
    gap: 4px;
    flex-shrink: 0;
  }
  
  .user-info {
    margin-right: 4px;
    min-width: 0;
  }
  
  .username-container {
    max-width: 80px;
    padding: 1px 2px;
  }
  
  .username {
    max-width: 50px;
    font-size: calc(var(--font-size-xs) - 1px);
  }
  
  .whitelist-badge, .non-whitelist-badge, .guest-badge, .auth-loading-badge {
    width: 12px;
    height: 12px;
    line-height: 12px;
    font-size: 8px;
    margin-left: 1px;
  }
  
  .logout-btn, .login-btn {
    padding: 4px 6px;
    font-size: calc(var(--font-size-xs) - 2px);
    min-width: 50px;
  }

  .settings-btn {
    padding: 4px 6px;
    min-width: 0;
  }

  .settings-gear-icon {
    width: 14px;
    height: 14px;
  }
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .thread-header {
    background-color: var(--color-chrome, #0e0c0d);
  }
  
  .loading-content {
    background-color: var(--surface-color-dark, #222);
    border: 1px solid var(--border-color-dark, #444);
  }
  
  .loading-message {
    color: var(--text-color-dark, #eee);
  }
  
  .loading-submessage {
    color: var(--text-color-light-dark, #aaa);
  }
  
  .import-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-top-color: #10a37f;
  }
}

/* Thread markers and loading indicators */
.thread-begin-marker {
  margin-bottom: 20px;
}

.thread-end-marker {
  margin-top: 20px;
  margin-bottom: 20px;
}

.auth-loading,
.loading-indicator,
.error-message,
.not-found {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--color-text-secondary);
  text-align: center;
  gap: var(--space-sm);
}

/* Guest notification styles */
.guest-notification {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  opacity: 0.9;
}

.notification-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.notification-text {
  text-align: center;
}

.notification-text h3 {
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.notification-text p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.notification-arrow {
  font-size: 1.5rem;
  color: var(--color-primary);
  font-weight: bold;
  animation: arrow-pulse 2s ease-in-out infinite;
}

@keyframes arrow-pulse {
  0%, 100% { opacity: 0.6; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
}

/* Dark theme for guest notification */
@media (prefers-color-scheme: dark) {
  .notification-content {
    background-color: var(--surface-color-dark, #222);
    border-color: var(--border-color-dark, #444);
  }
  
  .notification-text h3 {
    color: var(--text-color-dark, #eee);
  }
  
  .notification-text p {
    color: var(--text-color-light-dark, #aaa);
  }
}
</style> 
