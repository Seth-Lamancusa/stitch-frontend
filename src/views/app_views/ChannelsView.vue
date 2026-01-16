<template>
  <TabViewLayout>
    <div class="channels-view">
      <!-- Mode description -->
      <div class="mode-description">
        <span class="info-icon">ℹ</span>
        <p>Channels are group discussion spaces. Select a channel to view its messages, or browse all your channels below.</p>
      </div>
      
      <!-- Channel selector dropdown -->
      <div class="channel-selector">
        <div class="selector-row">
          <select 
            v-model="selectedChannelId" 
            class="channel-dropdown"
            aria-label="Select a channel"
            @change="handleChannelSelect"
          >
            <option value="">{{ channelsLoading ? 'Loading channels...' : 'Select a channel' }}</option>
            <option 
              v-for="channel in userChannels" 
              :key="channel.id || channel._key"
              :value="channel.id || channel._key"
            >
              {{ channel.display_name }} - {{ channel.description }}
            </option>
          </select>
        </div>
      </div>

      <!-- Selected channel details and messages -->
      <div v-if="selectedChannel" class="channel-content">
        <div class="channel-header">
          <div class="channel-info">
            <h2 class="channel-name">{{ selectedChannel.display_name }}</h2>
            <p class="channel-description">{{ selectedChannel.description }}</p>
          </div>
          <div class="channel-actions">
            <button
              v-if="selectedChannel.is_admin"
              class="delete-channel-btn"
              @click="showDeleteConfirm = true"
              title="Delete channel"
              aria-label="Delete channel"
            >
              <svg class="delete-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Channel messages list -->
        <MessageList 
          v-if="channelMessages.length > 0 || isLoadingMessages"
          mode="custom" 
          :customMessages="channelMessages"
          :hideHeader="true"
          :hideInfoBox="true"
        />
        
        <!-- Loading state -->
        <div v-if="isLoadingMessages && channelMessages.length === 0" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
        
        <!-- Empty state when no messages -->
        <div v-if="!isLoadingMessages && channelMessages.length === 0" class="empty-state">
          <p>No messages in this channel yet.</p>
        </div>

        <!-- Load more button -->
        <div v-if="hasMoreMessages && !isLoadingMessages" class="load-more-container">
          <button @click="loadMoreMessages" class="load-more-btn">
            Load More Messages
          </button>
        </div>
      </div>

      <!-- No channel selected state -->
      <div v-else-if="!channelsLoading" class="no-selection-state">
        <p v-if="userChannels.length === 0">You are not a member of any channels yet.</p>
        <p v-else>Select a channel from the dropdown above to view its messages.</p>
      </div>

      <!-- Initial loading state -->
      <div v-if="channelsLoading && userChannels.length === 0" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading your channels...</p>
      </div>

      <!-- Delete Channel Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="modal-overlay" @click.stop="showDeleteConfirm = false">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3>Delete Channel</h3>
            <button class="close-button" @click.stop="showDeleteConfirm = false">×</button>
          </div>
          <div class="modal-content">
            <p class="warning-text">
              Are you sure you want to delete "<strong>{{ selectedChannel?.display_name }}</strong>"?
            </p>
            <p class="delete-details">
              <strong>Warning:</strong> This will permanently delete the channel and remove all messages from it.
              This action cannot be undone.
            </p>
          </div>
          <div class="modal-footer">
            <button class="cancel-btn" @click.stop="showDeleteConfirm = false" :disabled="isDeletingChannel">
              Cancel
            </button>
            <button class="delete-btn" @click.stop="handleDeleteChannel" :disabled="isDeletingChannel">
              {{ isDeletingChannel ? 'Deleting...' : 'Delete Channel' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </TabViewLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import MessageList from '../../components/MessageList.vue';
import ChannelsService from '../../services/ChannelsService.js';

const store = useStore();
const route = useRoute();
const router = useRouter();

// State
const userChannels = ref([]);
const channelMessages = ref([]);
const channelsLoading = ref(false);
const isLoadingMessages = ref(false);
const hasMoreMessages = ref(false);
const currentSkip = ref(0);
const pageSize = 15;
const showDeleteConfirm = ref(false);
const isDeletingChannel = ref(false);

// Computed - use store for selectedChannelId
const user = computed(() => store.getters['auth/user']);
const selectedChannelId = computed({
  get: () => store.getters['navigation/selectedChannelId'],
  set: (value) => {
    store.dispatch('navigation/setSelectedChannelId', value);
  }
});
const selectedChannel = computed(() => {
  if (!selectedChannelId.value) return null;
  return userChannels.value.find(
    ch => (ch.id || ch._key) === selectedChannelId.value
  );
});

// Methods
const fetchUserChannels = async () => {
  if (!user.value) {
    console.log('[ChannelsView] No user, skipping channel fetch');
    return;
  }

  try {
    channelsLoading.value = true;
    const channels = await ChannelsService.getUserChannels();
    userChannels.value = Array.isArray(channels) ? channels : [];
    console.log('[ChannelsView] Fetched channels:', userChannels.value.length);
  } catch (error) {
    console.error('[ChannelsView] Error fetching channels:', error);
    store.commit('ui/SET_ERROR', 'Failed to load channels');
    userChannels.value = [];
  } finally {
    channelsLoading.value = false;
  }
};

const fetchChannelMessages = async (reset = false) => {
  if (!selectedChannelId.value) return;

  try {
    isLoadingMessages.value = true;
    
    const skip = reset ? 0 : currentSkip.value;
    const response = await ChannelsService.getChannelMessages(
      selectedChannelId.value,
      skip,
      pageSize
    );

    if (reset) {
      // Reset - replace messages
      channelMessages.value = response.messages || [];
      currentSkip.value = response.messages?.length || 0;
    } else {
      // Append - add more messages
      channelMessages.value = [
        ...channelMessages.value,
        ...(response.messages || [])
      ];
      currentSkip.value += response.messages?.length || 0;
    }

    hasMoreMessages.value = response.has_more || false;
    
    console.log('[ChannelsView] Fetched messages:', {
      channelId: selectedChannelId.value,
      messagesCount: response.messages?.length || 0,
      totalLoaded: channelMessages.value.length,
      hasMore: hasMoreMessages.value
    });
  } catch (error) {
    console.error('[ChannelsView] Error fetching channel messages:', error);
    store.commit('ui/SET_ERROR', 'Failed to load channel messages');
    if (reset) {
      channelMessages.value = [];
    }
  } finally {
    isLoadingMessages.value = false;
  }
};

const handleChannelSelect = () => {
  const channelId = selectedChannelId.value;
  console.log('[ChannelsView] Channel selected:', channelId);
  
  // Persist to store (already done via computed setter, but ensure it's saved)
  store.dispatch('navigation/setSelectedChannelId', channelId);
  
  // Update URL with channel ID for proper back navigation
  if (channelId) {
    router.replace({ path: '/channels', query: { channelId } });
  } else {
    router.replace({ path: '/channels' });
  }
  
  // Reset message state
  channelMessages.value = [];
  currentSkip.value = 0;
  hasMoreMessages.value = false;

  // Fetch messages for selected channel
  if (channelId) {
    fetchChannelMessages(true);
  }
};

const loadMoreMessages = () => {
  if (!isLoadingMessages.value && hasMoreMessages.value) {
    fetchChannelMessages(false);
  }
};

// Handle channel deletion
const handleDeleteChannel = async () => {
  if (!selectedChannel.value || isDeletingChannel.value) return;

  const channelId = selectedChannel.value.id || selectedChannel.value._key;
  if (!channelId) return;

  try {
    isDeletingChannel.value = true;
    await ChannelsService.deleteChannel(channelId);
    
    store.commit('ui/SET_NOTIFICATION', { 
      message: `Channel '${selectedChannel.value.display_name}' deleted successfully`, 
      type: 'success' 
    });
    
    // Clear selection and refresh channel list
    selectedChannelId.value = '';
    channelMessages.value = [];
    await fetchUserChannels();
    
    // Select first channel if available
    if (userChannels.value.length > 0) {
      selectedChannelId.value = userChannels.value[0].id || userChannels.value[0]._key;
      fetchChannelMessages(true);
    }
    
    showDeleteConfirm.value = false;
  } catch (error) {
    console.error('[ChannelsView] Error deleting channel:', error);
    let errorMessage = 'Failed to delete channel';
    if (error.response?.status === 403) {
      errorMessage = 'You do not have permission to delete this channel';
    } else if (error.response?.status === 404) {
      errorMessage = 'Channel not found';
    } else if (error.message) {
      errorMessage = `Failed to delete channel: ${error.message}`;
    }
    store.commit('ui/SET_ERROR', errorMessage);
  } finally {
    isDeletingChannel.value = false;
  }
};

// Handle channel creation from global create button (via refresh trigger)
watch(() => store.getters['navigation/refreshTrigger'], async (newTrigger) => {
  if (newTrigger > 0) {
    // Refresh channels when refresh is triggered (e.g., after channel creation)
    await fetchUserChannels();
  }
});

// Watch route query for channelId changes (e.g., when navigating back)
watch(() => route.query.channelId, (channelId) => {
  if (channelId && channelId !== selectedChannelId.value) {
    store.dispatch('navigation/setSelectedChannelId', channelId);
  } else if (!channelId && selectedChannelId.value) {
    // URL doesn't have channelId but store does - update URL
    router.replace({ path: '/channels', query: { channelId: selectedChannelId.value } });
  }
}, { immediate: true });

// Lifecycle
onMounted(() => {
  console.log('[ChannelsView] Component mounted');
  
  // Restore selected channel from URL query (takes precedence over store)
  const urlChannelId = route.query.channelId;
  const storedChannelId = store.getters['navigation/selectedChannelId'];
  
  if (urlChannelId) {
    // URL takes precedence - restore from URL
    store.dispatch('navigation/setSelectedChannelId', urlChannelId);
  } else if (storedChannelId) {
    // Restore from store - update URL to match
    router.replace({ path: '/channels', query: { channelId: storedChannelId } });
  }
  
  fetchUserChannels();
});

// Watch for user changes (login/logout)
watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) {
    // User logged in
    fetchUserChannels();
  } else if (!newUser && oldUser) {
    // User logged out
    userChannels.value = [];
    store.dispatch('navigation/setSelectedChannelId', null);
    channelMessages.value = [];
  }
});

// Watch for channel selection changes and fetch messages
watch(selectedChannelId, (newChannelId, oldChannelId) => {
  if (newChannelId && newChannelId !== oldChannelId) {
    // Reset message state
    channelMessages.value = [];
    currentSkip.value = 0;
    hasMoreMessages.value = false;
    
    // Fetch messages for selected channel
    fetchChannelMessages(true);
  } else if (!newChannelId) {
    // Clear messages when no channel selected
    channelMessages.value = [];
    currentSkip.value = 0;
    hasMoreMessages.value = false;
  }
});

// Watch for channels loaded and restore selection
watch(userChannels, (channels) => {
  if (channels.length > 0 && selectedChannelId.value) {
    // Verify selected channel still exists
    const channelExists = channels.some(
      ch => (ch.id || ch._key) === selectedChannelId.value
    );
    
    if (!channelExists) {
      // Selected channel no longer exists, clear selection
      store.dispatch('navigation/setSelectedChannelId', null);
    } else if (!channelMessages.value.length && selectedChannelId.value) {
      // Channel exists but messages not loaded yet, fetch them
      fetchChannelMessages(true);
    }
  } else if (channels.length > 0 && !selectedChannelId.value) {
    // No channel selected but channels available - check URL
    const urlChannelId = route.query.channelId;
    if (urlChannelId) {
      const channelExists = channels.some(
        ch => (ch.id || ch._key) === urlChannelId
      );
      if (channelExists) {
        store.dispatch('navigation/setSelectedChannelId', urlChannelId);
      }
    }
  }
}, { immediate: true });
</script>

<style scoped>
.channels-view {
  padding: 8px;
  max-width: 900px;
  margin: 0 auto;
}

.mode-description {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  width: 66%;
  padding: var(--space-md);
  margin: 0 auto var(--space-md) auto;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
}

.mode-description .info-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--color-surface-light);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  font-style: normal;
  margin-top: 2px;
}

.mode-description p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.channel-selector {
  margin-bottom: var(--space-lg);
}

.selector-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.channel-dropdown {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.channel-dropdown:hover {
  border-color: var(--color-primary);
}

.channel-dropdown:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.1);
}

.channel-content {
  margin-top: var(--space-lg);
}

.channel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
  gap: var(--space-md);
}

.channel-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  flex: 1;
}

.channel-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.delete-channel-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  border-radius: var(--radius-xs);
  width: 24px;
  height: 24px;
}

.delete-channel-btn:hover {
  background-color: #fff0f0;
  transform: scale(1.1);
}

.delete-channel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-channel-btn .delete-icon {
  width: 16px;
  height: 16px;
  fill: var(--color-error);
  transition: all var(--transition-fast);
}

.delete-channel-btn:hover .delete-icon {
  fill: #d32f2f;
}

.channel-name {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
}

.channel-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.loading-state,
.empty-state,
.no-selection-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
  min-height: 200px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-md);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: var(--space-lg);
}

.load-more-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.load-more-btn:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.load-more-btn:active {
  transform: translateY(0);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .channels-view {
    max-width: 100%;
    padding: 8px 4px;
  }

  .mode-description {
    width: calc(100% - var(--space-md) * 2);
    padding: var(--space-sm);
  }

  .channel-dropdown {
    padding: 10px 12px;
    font-size: var(--font-size-sm);
  }

  .channel-header {
    padding: var(--space-sm);
  }

  .channel-name {
    font-size: var(--font-size-lg);
  }
}

@media (max-width: 480px) {
  .mode-description {
    width: 100%;
    margin: 0 0 var(--space-md) 0;
  }
}

/* Delete Channel Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0;
  min-width: 360px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.2s ease;
}

.close-button:hover {
  color: var(--color-error);
}

.modal-content {
  padding: 20px;
  flex: 1;
}

.warning-text {
  margin: 0 0 16px 0;
  color: var(--color-text);
  font-size: var(--font-size-base);
  line-height: 1.5;
}

.warning-text strong {
  color: var(--color-text);
  font-weight: 600;
}

.delete-details {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.delete-details strong {
  color: var(--color-error);
  font-weight: 600;
}

.modal-footer {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.cancel-btn {
  padding: 10px 16px;
  background-color: var(--color-surface-light);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.cancel-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-btn {
  padding: 10px 16px;
  background-color: var(--color-error, #ef4444);
  color: var(--color-text-inverse, #ffffff);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.delete-btn:hover:not(:disabled) {
  background-color: var(--color-error-dark, #dc2626);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .modal-container {
    min-width: unset;
    max-width: 90vw;
  }
  
  .channel-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .channel-actions {
    justify-content: flex-end;
    margin-top: var(--space-sm);
  }
}

</style>

