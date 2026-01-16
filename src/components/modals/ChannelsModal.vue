<template>
  <div v-if="isVisible" class="modal-overlay" :class="{ 'closing': isClosing }" @click.self="closeModal" @mousedown.stop @click.stop>
    <div class="channels-modal" @mousedown.stop @click.stop>
      <div class="modal-header">
        <h3>{{ isAddMode ? 'Channels' : 'Channels (new message)' }}</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>

      <div class="modal-content">
        <div class="edit-section">
          <p class="modal-description" v-if="!isAddMode">
            Select channels to organize this message. Messages in channels are visible to all channel members.
          </p>
          <p class="modal-description" v-if="isAddMode">
            Add or remove channels for this message. Changes are saved immediately.
          </p>

          <!-- Channel Selection Dropdown -->
          <div class="channel-input-container">
            <ChannelDropdown
              :available-channels="availableChannels"
              :selected-channel-ids="channelsLocal.map(ch => ch.id)"
              placeholder="Select a channel..."
              :disabled="isUpdating"
              @select="handleChannelSelect"
            />
          </div>

          <!-- Existing Channels Section (only in add mode) -->
          <div v-if="isAddMode && existingChannels.length > 0" class="existing-channels-section">
            <p class="section-header">Current channels</p>
            <div class="channels-list">
              <div 
                v-for="(channel, index) in existingChannels" 
                :key="channel.id" 
                class="channel-row existing-channel"
              >
                <div class="channel-info">
                  <span class="channel-name">📢 {{ channel.display_name }}</span>
                  <span class="channel-meta">
                    <span class="channel-description-text">{{ channel.description }}</span>
                    <span v-if="channel.member_count" class="channel-members">{{ channel.member_count }} members</span>
                  </span>
                </div>
                <button 
                  class="remove-channel-btn" 
                  @click.stop="removeChannel(index)" 
                  aria-label="Remove channel" 
                  :disabled="isUpdating"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <!-- Selected Channels List -->
          <div class="channels-list">
            <div v-if="displayChannels.length === 0" class="no-channels">
              <p v-if="!isAddMode">No channels selected</p>
              <p v-else-if="existingChannels.length === 0">No channels</p>
            </div>
            <div v-else class="channels-rows">
              <div 
                v-for="(channel, index) in displayChannels" 
                :key="getChannelKey(channel, index)" 
                class="channel-row"
                :class="{ 'staged': isAddMode && !isExistingChannel(channel.id) }"
              >
                <div class="channel-info">
                  <span class="channel-name">📢 {{ channel.display_name }}</span>
                  <span class="channel-meta">
                    <span class="channel-description-text">{{ channel.description }}</span>
                    <span v-if="channel.member_count" class="channel-members">{{ channel.member_count }} members</span>
                    <span v-if="channel.is_admin" class="channel-admin-badge">Admin</span>
                  </span>
                </div>
                <button 
                  class="remove-channel-btn" 
                  @click.stop="removeChannel(index)" 
                  aria-label="Remove channel" 
                  :disabled="isUpdating"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="done-button" @click.stop="handleDone" :disabled="isUpdating">
          {{ isUpdating ? 'Saving...' : 'Done' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import ChannelDropdown from '../ChannelDropdown.vue';

// Sample hardcoded data
const SAMPLE_CHANNELS = [
  {
    id: 'e5b8b22a',
    display_name: 'Physics Monastery',
    description: 'The one and only.',
    member_count: 12,
    is_admin: true,
    created_at: '2026-01-15T16:05:56.794615Z'
  },
  {
    id: 'f83377b7',
    display_name: 'Engineering',
    description: 'Engineering team discussions',
    member_count: 8,
    is_admin: false,
    created_at: '2026-01-15T14:48:46.786641Z'
  },
  {
    id: 'a1b2c3d4',
    display_name: 'Design',
    description: 'Design team collaboration',
    member_count: 5,
    is_admin: false,
    created_at: '2026-01-10T10:00:00.000000Z'
  },
  {
    id: 'x9y8z7w6',
    display_name: 'Marketing',
    description: 'Marketing campaigns and announcements',
    member_count: 15,
    is_admin: true,
    created_at: '2026-01-08T09:30:00.000000Z'
  }
];

const SAMPLE_EXISTING_CHANNELS = [
  {
    id: 'e5b8b22a',
    display_name: 'Physics Monastery',
    description: 'The one and only.',
    member_count: 12,
    is_admin: true
  }
];

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  isAddMode: { type: Boolean, default: false },
  existingChannels: { type: Array, default: () => [] },
  messageId: { type: String, default: null }
});

const emit = defineEmits(['close', 'done', 'change', 'update']);

const isClosing = ref(false);
const isUpdating = ref(false);

// Available channels (user's channels) - hardcoded for now
const availableChannels = ref(SAMPLE_CHANNELS);

// Local working copy of selected channels
const channelsLocal = ref([]);

// Initialize from props or use sample data
const initializeChannels = () => {
  if (props.isAddMode) {
    // In add mode, start with existing channels
    channelsLocal.value = (props.existingChannels.length > 0 
      ? props.existingChannels 
      : SAMPLE_EXISTING_CHANNELS).slice();
  } else {
    // In draft mode, start with sample selected channels
    channelsLocal.value = [
      {
        id: 'e5b8b22a',
        display_name: 'Physics Monastery',
        description: 'The one and only.',
        member_count: 12,
        is_admin: true
      }
    ];
  }
};

// Display channels - handles both draft and add mode
const displayChannels = computed(() => {
  return channelsLocal.value || [];
});

const isChannelSelected = (channelId) => {
  return channelsLocal.value.some(ch => ch.id === channelId);
};

const isExistingChannel = (channelId) => {
  if (!props.isAddMode) return false;
  return props.existingChannels.some(ch => ch.id === channelId);
};

const getChannelKey = (channel, index) => {
  return `${channel.id}:${index}`;
};

const handleChannelSelect = (channel) => {
  if (!channel || isUpdating.value || isChannelSelected(channel.id)) return;

  // Add to local list
  channelsLocal.value.push({
    id: channel.id,
    display_name: channel.display_name,
    description: channel.description,
    member_count: channel.member_count,
    is_admin: channel.is_admin
  });

  emitChannelUpdates();
};

const removeChannel = async (index) => {
  if (index < 0 || index >= channelsLocal.value.length || isUpdating.value) return;
  
  channelsLocal.value.splice(index, 1);
  await emitChannelUpdates();
};

const emitChannelUpdates = async () => {
  const channelIds = channelsLocal.value.map(ch => ch.id);
  
  if (props.isAddMode && props.messageId) {
    // Add mode: emit update event (would call API)
    isUpdating.value = true;
    try {
      emit('update', { messageId: props.messageId, channel_ids: channelIds });
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.error('Failed to update channels:', e);
    } finally {
      isUpdating.value = false;
    }
  } else {
    // Draft mode: emit change event (would update store)
    emit('change', channelIds);
  }
};

const closeModal = () => {
  isClosing.value = true;
  setTimeout(() => {
    isClosing.value = false;
    emit('close');
  }, 150);
};

const handleDone = () => {
  const channelIds = channelsLocal.value.map(ch => ch.id);
  emit('done', channelIds);
  closeModal();
};

watch(() => props.isVisible, (visible) => {
  if (visible) {
    initializeChannels();
  }
});

// Watch existingChannels to refresh local channels after backend updates (when modal is open)
watch(() => props.existingChannels, (newChannels) => {
  if (props.isVisible && !isUpdating.value && props.isAddMode) {
    channelsLocal.value = (newChannels || []).slice();
  }
}, { deep: true });

onMounted(() => {
  if (props.isVisible) {
    initializeChannels();
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 1001; padding: 20px;
}
.modal-overlay.closing { animation: quick-fade-out 150ms ease forwards; }

.channels-modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 0; min-width: 360px; max-width: 560px; width: 100%;
  max-height: 85vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
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
}
.close-button:hover { color: var(--color-error); }

.modal-content { 
  padding: 16px 20px; 
  flex: 1; 
  min-height: 0; 
  overflow-y: auto; 
}
.section-header { 
  margin: 0 0 8px 0; 
  color: var(--color-text-tertiary, #666); 
  font-size: var(--font-size-sm); 
  font-weight: 400; 
  opacity: 0.8; 
}
.modal-description { 
  margin: 0 0 16px 0; 
  color: var(--color-text-secondary); 
  font-size: var(--font-size-sm); 
  line-height: 1.5;
}

.channel-input-container { 
  margin-bottom: 16px; 
}

.existing-channels-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.channels-list { 
  min-height: 40px; 
  margin-top: 12px; 
  height: 300px; 
  overflow-y: auto; 
  padding-right: 4px; 
}
.channels-rows { 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
}
.channel-row { 
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  padding: 12px; 
  border-radius: var(--radius-md); 
  background-color: var(--color-surface-light, rgba(0, 0, 0, 0.02)); 
  border: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}
.channel-row:hover { 
  background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.04)); 
}
.channel-row.staged {
  border-left: 3px solid var(--color-primary);
  background-color: rgba(79, 140, 255, 0.05);
}
.channel-row.existing-channel {
  opacity: 0.9;
}
.channel-info { 
  display: flex; 
  flex-direction: column; 
  gap: 4px; 
  flex: 1; 
  min-width: 0; 
}
.channel-name { 
  color: var(--color-text); 
  font-size: var(--font-size-base); 
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.channel-meta { 
  display: flex; 
  gap: 12px; 
  font-size: var(--font-size-xs); 
  color: var(--color-text-tertiary);
  flex-wrap: wrap;
}
.channel-description-text {
  opacity: 0.8;
}
.channel-members {
  opacity: 0.7;
}
.channel-admin-badge {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  opacity: 1;
}
.remove-channel-btn { 
  background: none; 
  border: none; 
  color: var(--color-text-secondary); 
  cursor: pointer; 
  font-size: 18px; 
  line-height: 1; 
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.remove-channel-btn:hover { 
  background-color: var(--color-error-light, rgba(255, 59, 48, 0.1)); 
  color: var(--color-error); 
}
.remove-channel-btn:disabled { 
  opacity: 0.3; 
  cursor: not-allowed; 
}
.no-channels { 
  color: var(--color-text-secondary); 
  font-size: var(--font-size-sm); 
  font-style: italic; 
  padding: 20px;
  text-align: center;
}

.modal-footer { 
  padding: 12px 20px 16px; 
  border-top: 1px solid var(--color-border); 
  display: flex; 
  justify-content: flex-end; 
}
.done-button { 
  padding: 10px 16px; 
  background-color: var(--color-primary); 
  color: var(--color-text-inverse); 
  border: none; 
  border-radius: var(--radius-md); 
  font-weight: 500; 
  font-size: var(--font-size-sm); 
  cursor: pointer; 
  transition: background-color 0.2s ease;
}
.done-button:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}
.done-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes quick-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }

@media (max-width: 768px) {
  .modal-overlay { padding: 10px; }
  .channels-modal { min-width: unset; max-height: 90vh; }
}
</style>

