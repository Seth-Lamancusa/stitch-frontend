<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import MessageService from '../services/MessageService';
import MessageNode from './MessageNode.vue';

const store = useStore();
const router = useRouter();
const route = useRoute();

// Loading state for pinned messages
const isLoading = ref(false);
const hasLoaded = ref(false);

// Get pinned messages from store
const pinnedMessages = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  
  // Filter for pinned messages only
  const pinned = allMessages.filter(message => {
    return message.is_pinned === 1 || message.is_pinned === true;
  });
  
  // Sort by timestamp (newest first)
  return pinned.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

const user = computed(() => store.getters['auth/user']);

// Get reply count from child_ids
function getReplyCount(message) {
  if (message.child_ids && Array.isArray(message.child_ids)) {
    return message.child_ids.length;
  }
  return 0;
}

// Navigate to thread view when a pinned message is clicked
const viewMessage = (messageId) => {
  // Store current route before navigation
  store.dispatch('navigation/setPreviousRoute', route.path);
  
  router.push({ path: `/cloud/${messageId}` });
};

// Handle message deletion requests
const confirmDeleteMessage = (message) => {
  store.dispatch('ui/showDeleteConfirm', message);
};

// Get all messages in a thread (for unread count calculation)
function getThreadMessages(threadId) {
  const allMessages = store.getters['messages/getLoadedMessages'];
  
  // Find thread root in case threadId is not the actual root
  let rootId = threadId;
  let currentMessage = allMessages.find(m => m.id === threadId);
  
  // Traverse up to find the root if needed
  while (currentMessage && currentMessage.parent_id) {
    const parent = allMessages.find(m => m.id === currentMessage.parent_id);
    if (parent) {
      rootId = parent.id;
      currentMessage = parent;
    } else {
      break;
    }
  }
  
  // Find all messages in this thread (having rootId as ancestor)
  const threadMessages = allMessages.filter(message => {
    // Include the root itself
    if (message.id === rootId) return true;
    
    // Check if this message has rootId as an ancestor
    let parent = message;
    while (parent && parent.parent_id) {
      if (parent.parent_id === rootId) return true;
      
      // Move up to the parent
      parent = allMessages.find(m => m.id === parent.parent_id);
      if (!parent) break;
    }
    
    return false;
  });
  
  return threadMessages;
}

// Load pinned messages
const loadPinnedMessages = async () => {
  if (isLoading.value || hasLoaded.value) return;
  
  isLoading.value = true;
  
  try {
    console.log('[PinnedMessageList] Loading pinned messages');
    
    // Use the existing pinned messages endpoint
    const response = await MessageService.getPinnedMessages(50); // Get more pinned messages
    const messages = response.data || [];
    
    console.log(`[PinnedMessageList] Loaded ${messages.length} pinned messages`);
    
    // Add messages to store
    store.commit('messages/SET_MESSAGES', messages);
    
    hasLoaded.value = true;
  } catch (error) {
    console.error('[PinnedMessageList] Error loading pinned messages:', error);
  } finally {
    isLoading.value = false;
  }
};

// Load pinned messages on component mount
onMounted(async () => {
  await loadPinnedMessages();
});
</script>

<template>
  <div class="pinned-message-list">
    <!-- Loading indicator for pinned messages -->
    <div v-if="isLoading && pinnedMessages.length === 0" class="loading-indicator">
      <div class="loading-spinner"></div>
      <p>Loading pinned messages...</p>
    </div>
    
    <!-- Pinned messages container -->
    <div v-if="pinnedMessages.length > 0" class="pinned-messages-container">
      <div 
        v-for="message in pinnedMessages" 
        :key="message.id" 
        class="message-list-item"
        @click="viewMessage(message.id)"
      >
        <MessageNode
          :message="message"
          :is-selected="false"
          :indent-level="0"
          :loaded-replies="getReplyCount(message)"
          :total-replies="getReplyCount(message)"
          :can-reply="false"
          :inListView="true"
          :threadMessages="getThreadMessages(message.id)"
          @delete="confirmDeleteMessage"
        />
      </div>
    </div>
    
    <!-- No pinned messages state -->
    <div v-else-if="!isLoading && hasLoaded" class="no-pinned-messages">
      <p>No pinned messages yet.</p>
    </div>
  </div>
</template>

<style scoped>
.pinned-message-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.pinned-messages-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.message-list-item {
  width: 100%;
  cursor: pointer;
  position: relative;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.message-list-item:hover {
  opacity: 0.95;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-secondary);
  text-align: center;
  flex-direction: column;
  gap: 12px;
  padding: var(--space-md);
  min-height: 60px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.no-pinned-messages {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--space-md);
  font-style: italic;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 