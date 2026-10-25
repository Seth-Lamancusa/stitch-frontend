<template>
  <TabViewLayout>
    <div class="channels-view">
      <!-- Mode description: explains that channel selection is global (filter + default for new messages) -->
      <div class="mode-description">
        <span class="info-icon">ℹ</span>
        <p>Channels are group discussion spaces. Selecting a channel here applies it everywhere: new messages will be sent in the channel and Inbox, History, and Timeline will be filtered to include only messages sent in the channel.</p>
      </div>
      
      <!-- Channel selector dropdown -->
      <div class="channel-selector">
        <ChannelSelectDropdown
          :channels="userChannels"
          :selected-id="selectedChannelId || ''"
          :loading="channelsLoading"
          :can-create="canCreateChannel"
          @select="handleChannelSelect"
          @create="showCreateChannelModal = true"
        />
      </div>

      <!-- Selected channel: header, members, admin actions -->
      <div v-if="selectedChannel" class="channel-content">
        <div class="channel-header">
          <div class="channel-info">
            <!-- View mode: name + description + edit button (admin) -->
            <template v-if="!isEditingChannel">
              <h2 class="channel-name">{{ selectedChannel.display_name }}</h2>
              <p class="channel-description">{{ selectedChannel.description || 'No description' }}</p>
              <button
                v-if="selectedChannel.is_admin"
                type="button"
                class="edit-channel-btn"
                @click="startEditChannel"
                title="Edit channel name and description"
                aria-label="Edit channel"
              >
                Edit channel
              </button>
            </template>
            <!-- Edit mode: inputs + save/cancel (admin) -->
            <template v-else>
              <div class="edit-channel-form">
                <label for="edit-channel-name" class="edit-label">Name</label>
                <input
                  id="edit-channel-name"
                  v-model="editDisplayName"
                  type="text"
                  class="edit-input"
                  placeholder="Channel name"
                  maxlength="200"
                  @keydown.enter.prevent="saveChannelEdit"
                />
                <label for="edit-channel-desc" class="edit-label">Description</label>
                <textarea
                  id="edit-channel-desc"
                  v-model="editDescription"
                  class="edit-textarea"
                  placeholder="Channel description (max 512 characters)"
                  rows="3"
                  maxlength="512"
                />
                <div class="edit-actions">
                  <button type="button" class="cancel-edit-btn" @click="cancelEditChannel">Cancel</button>
                  <button type="button" class="save-edit-btn" :disabled="isSavingEdit || !editDisplayName.trim()" @click="saveChannelEdit">
                    {{ isSavingEdit ? 'Saving...' : 'Save' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div class="channel-actions">
            <button
              v-if="selectedChannel.is_admin && !isEditingChannel"
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

        <!-- Members: list for all; add/remove only for admins -->
        <div class="channel-members-section">
          <h3 class="members-heading">Members</h3>
          <div v-if="membersLoading" class="members-loading">Loading members...</div>
          <template v-else>
            <div v-if="selectedChannel?.is_admin" class="add-member-row">
              <UserSearchInput @user-selected="handleAddMember" />
              <span v-if="addMemberError" class="add-member-error">{{ addMemberError }}</span>
              <span v-if="isAddingMember" class="add-member-status">Adding...</span>
            </div>
            <ul class="members-list">
              <li v-for="member in channelMembers" :key="member.uid" class="member-row">
                <span class="member-info">
                  <span class="member-name">{{ member.display_name }}</span>
                  <span class="member-tag">@{{ member.user_tag }}</span>
                  <span v-if="member.is_admin" class="member-admin-badge">Admin</span>
                </span>
                <span class="member-actions">
                  <button
                    v-if="member.uid !== user?.uid && selectedChannel?.is_admin"
                    type="button"
                    class="member-remove-btn"
                    title="Remove from channel"
                    aria-label="Remove from channel"
                    @click="handleRemoveMember(member)"
                  >
                    Remove
                  </button>
                  <button
                    v-else-if="member.uid === user?.uid"
                    type="button"
                    class="member-leave-btn"
                    title="Leave channel"
                    aria-label="Leave channel"
                    @click="handleLeaveChannel"
                  >
                    Leave channel
                  </button>
                </span>
              </li>
            </ul>
          </template>
        </div>

      </div>

      <!-- No channel selected state -->
      <div v-else-if="!channelsLoading" class="no-selection-state">
        <p v-if="userChannels.length === 0">
          You are not a member of any channels yet.
          <template v-if="canCreateChannel"> Open the menu above to create one.</template>
        </p>
        <p v-else>Select a channel from the dropdown above to manage it and see members.</p>
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

      <CreateChannelModal
        :show="showCreateChannelModal"
        @close="showCreateChannelModal = false"
        @created="handleChannelCreated"
      />
    </div>
  </TabViewLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import TabViewLayout from '../../components/layouts/TabViewLayout.vue';
import UserSearchInput from '../../components/UserSearchInput.vue';
import ChannelSelectDropdown from '../../components/ChannelSelectDropdown.vue';
import CreateChannelModal from '../../components/modals/CreateChannelModal.vue';
import ChannelsService from '../../services/ChannelsService.js';

const store = useStore();
const route = useRoute();
const router = useRouter();

// State
const userChannels = ref([]);
const channelsLoading = ref(false);
const showDeleteConfirm = ref(false);
const showCreateChannelModal = ref(false);
const isDeletingChannel = ref(false);
// Edit channel (admin): inline name/description
const isEditingChannel = ref(false);
const editDisplayName = ref('');
const editDescription = ref('');
const isSavingEdit = ref(false);
// Members (for admin): list, add, remove
const channelMembers = ref([]);
const membersLoading = ref(false);
const isAddingMember = ref(false);
const addMemberError = ref('');

// Computed - use store for selectedChannelId
const user = computed(() => store.getters['auth/user']);
const canCreateChannel = computed(() => store.getters['auth/hasScope']('channels.create'));
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

const handleChannelSelect = (channelId) => {
  const nextId = channelId || null;
  selectedChannelId.value = nextId;
  if (nextId) {
    router.replace({ path: '/channels', query: { channelId: nextId } });
  } else {
    router.replace({ path: '/channels' });
  }
};

const handleChannelCreated = async (newChannel) => {
  showCreateChannelModal.value = false;
  const channelId = newChannel?.id || newChannel?._key || '';
  await fetchUserChannels();
  if (channelId && !userChannels.value.some((channel) => (channel.id || channel._key) === channelId)) {
    userChannels.value = [newChannel, ...userChannels.value];
  }
  if (channelId) {
    selectedChannelId.value = channelId;
    router.replace({ path: '/channels', query: { channelId } });
  }
};

// --- Edit channel (admin): start, cancel, save ---
const startEditChannel = () => {
  if (!selectedChannel.value) return;
  editDisplayName.value = selectedChannel.value.display_name || '';
  editDescription.value = selectedChannel.value.description || '';
  isEditingChannel.value = true;
};

const cancelEditChannel = () => {
  isEditingChannel.value = false;
  editDisplayName.value = '';
  editDescription.value = '';
};

const saveChannelEdit = async () => {
  if (!selectedChannel.value || isSavingEdit.value) return;
  const name = editDisplayName.value?.trim();
  if (!name) return;

  const channelId = selectedChannel.value.id || selectedChannel.value._key;
  if (!channelId) return;

  try {
    isSavingEdit.value = true;
    const updated = await ChannelsService.updateChannel(channelId, {
      display_name: name,
      description: (editDescription.value || '').trim()
    });
    // Update channel in local list so dropdown and header stay in sync
    const idx = userChannels.value.findIndex(ch => (ch.id || ch._key) === channelId);
    if (idx !== -1) {
      userChannels.value = [
        ...userChannels.value.slice(0, idx),
        { ...userChannels.value[idx], ...updated },
        ...userChannels.value.slice(idx + 1)
      ];
    }
    store.commit('ui/SET_SUCCESS', 'Channel updated');
    isEditingChannel.value = false;
  } catch (err) {
    console.error('[ChannelsView] Error updating channel:', err);
    store.commit('ui/SET_ERROR', err.response?.data?.detail || err.message || 'Failed to update channel');
  } finally {
    isSavingEdit.value = false;
  }
};

// --- Members (admin): fetch, add, remove ---
const fetchChannelMembers = async () => {
  if (!selectedChannelId.value) {
    channelMembers.value = [];
    return;
  }
  try {
    membersLoading.value = true;
    addMemberError.value = '';
    const list = await ChannelsService.getChannelMembers(selectedChannelId.value);
    channelMembers.value = Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('[ChannelsView] Error fetching channel members:', err);
    store.commit('ui/SET_ERROR', err.message || 'Failed to load members');
    channelMembers.value = [];
  } finally {
    membersLoading.value = false;
  }
};

const handleAddMember = async (selectedUser) => {
  if (!selectedChannelId.value || !selectedUser?.uid || isAddingMember.value) return;
  const already = channelMembers.value.some(m => m.uid === selectedUser.uid);
  if (already) {
    addMemberError.value = 'Already a member';
    return;
  }
  addMemberError.value = '';
  try {
    isAddingMember.value = true;
    const result = await ChannelsService.addChannelMembers(selectedChannelId.value, [selectedUser.uid]);
    const added = result?.added || [];
    const failed = result?.failed || [];
    if (added.length) {
      store.commit('ui/SET_SUCCESS', `Added @${selectedUser.user_tag || selectedUser.display_name} to the channel`);
      await fetchChannelMembers();
    }
    if (failed.length) {
      addMemberError.value = 'Could not add one or more users (may already be members or lack access)';
    }
  } catch (err) {
    console.error('[ChannelsView] Error adding member:', err);
    const msg = err.response?.data?.detail || err.message || 'Failed to add member';
    store.commit('ui/SET_ERROR', msg);
    addMemberError.value = msg;
  } finally {
    isAddingMember.value = false;
  }
};

const handleRemoveMember = async (member) => {
  if (!selectedChannelId.value || !member?.uid || !selectedChannel.value?.is_admin) return;
  try {
    await ChannelsService.removeChannelMember(selectedChannelId.value, member.uid);
    store.commit('ui/SET_SUCCESS', `Removed @${member.user_tag} from the channel`);
    await fetchChannelMembers();
  } catch (err) {
    console.error('[ChannelsView] Error removing member:', err);
    store.commit('ui/SET_ERROR', err.response?.data?.detail || err.message || 'Failed to remove member');
  }
};

const handleLeaveChannel = async () => {
  if (!selectedChannelId.value || !user.value?.uid) return;
  try {
    await ChannelsService.removeChannelMember(selectedChannelId.value, user.value.uid);
    store.commit('ui/SET_SUCCESS', 'You left the channel');
    channelMembers.value = [];
    selectedChannelId.value = '';
    router.replace({ path: '/channels' });
    await fetchUserChannels();
  } catch (err) {
    console.error('[ChannelsView] Error leaving channel:', err);
    store.commit('ui/SET_ERROR', err.response?.data?.detail || err.message || 'Failed to leave channel');
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
    
    selectedChannelId.value = '';
    await fetchUserChannels();
    if (userChannels.value.length > 0) {
      selectedChannelId.value = userChannels.value[0].id || userChannels.value[0]._key;
      fetchChannelMembers();
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

// Refresh the list when another view asks the app to reload (e.g. after a mutation elsewhere)
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
  }
});

// Watch for channel selection changes: fetch members when a channel is selected; exit edit mode when switching
watch(selectedChannelId, (newChannelId, oldChannelId) => {
  if (newChannelId !== oldChannelId) {
    cancelEditChannel();
  }
  if (newChannelId && newChannelId !== oldChannelId) {
    fetchChannelMembers();
  } else if (!newChannelId) {
    channelMembers.value = [];
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
      store.dispatch('navigation/setSelectedChannelId', null);
    } else if (selectedChannelId.value) {
      fetchChannelMembers();
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
  padding: 12px;
  max-width: 900px;
  margin: 0 auto;
}

.channel-selector {
  margin-bottom: var(--space-lg);
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

.edit-channel-btn {
  margin-top: var(--space-sm);
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-primary);
  background: transparent;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.edit-channel-btn:hover {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.edit-channel-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  width: 100%;
}

.edit-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.edit-input,
.edit-textarea {
  padding: 8px 12px;
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
}

.edit-input:focus,
.edit-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.15);
}

.edit-textarea {
  resize: vertical;
  min-height: 72px;
}

.edit-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.cancel-edit-btn {
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.cancel-edit-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.save-edit-btn {
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-inverse);
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.save-edit-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.save-edit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Members section (admin only) */
.channel-members-section {
  padding: var(--space-md);
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}
.members-heading {
  margin: 0 0 var(--space-sm) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
}
.members-loading,
.add-member-error,
.add-member-status {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.add-member-error { color: var(--color-error, #ef4444); }
.add-member-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}
.add-member-row .user-search-input { flex: 1; min-width: 200px; }
.members-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border);
  gap: var(--space-sm);
}
.member-row:last-child { border-bottom: none; }
.member-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.member-name { font-weight: 500; color: var(--color-text); }
.member-tag { font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.member-admin-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}
.member-remove-btn,
.member-leave-btn {
  font-size: var(--font-size-xs);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
.member-remove-btn:hover,
.member-leave-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-error);
}

.loading-state,
.no-selection-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
  min-height: 120px;
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

/* Mobile responsive styles */
@media (max-width: 768px) {
  .channels-view {
    max-width: 100%;
    padding: 8px 4px;
  }

  .channel-header {
    padding: var(--space-sm);
  }

  .channel-name {
    font-size: var(--font-size-lg);
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
