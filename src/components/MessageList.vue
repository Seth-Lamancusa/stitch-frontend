<script setup>
import { computed, onMounted, watch, ref, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { initializeFirebase } from '../firebase';
import MessageService from '../services/MessageService';

/**
 * MessageList component displays a list of message threads based on the active tab.
 * Public messages are shown when activeTab is 'public',
 * Private messages are shown when activeTab is 'private'.
 */

const store = useStore();
const router = useRouter();

// Track loading states
const isLoadingMessages = ref(true); // Used for both initial load and refreshes
const hasLoadedOnce = ref(false);

const activeTab = computed(() => store.getters['ui/activeTab']);
const messageListTitle = computed(() => {
  return activeTab.value === 'public' ? 'Public Messages' : 'Private Messages';
});

const threads = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  const currentUser = store.getters['auth/user'];
  const userEmail = currentUser?.email;
  
  // Filter to only include pinned messages
  const filteredMessages = allMessages.filter(msg => {
    const isPublic = msg.public === 1 || msg.public === true;
    const isUserRecipient = userEmail && msg.recipients && 
      Array.isArray(msg.recipients) && msg.recipients.includes(userEmail);
    const isPinned = msg.is_pinned === 1 || msg.is_pinned === true;
    
    if (activeTab.value === 'public') {
      // Public tab: show pinned public messages
      return isPublic && isPinned;
    } else {
      // Private tab: show pinned private messages OR public pinned messages where user is explicitly a recipient
      return isPinned && (!isPublic || isUserRecipient);
    }
  });
  
  // Sort by timestamp (newest first)
  const result = filteredMessages.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  return result;
});

// For completeness, still include the global loading state
const globalLoadingState = computed(() => {
  return store.getters['ui/isLoading']('threads');
});

const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const canInteract = computed(() => store.getters['auth/canInteract']);

const firebaseReady = ref(false);
const replyCounts = ref({}); // Track reply counts by thread ID

// Get display version of author for a message
function getAuthorDisplay(message) {
  return message.author_display_name || '';
}

// Get author user tag
function getAuthorUserTag(message) {
  return message.author_user_tag || null;
}

// Get reply count from child_ids
function getReplyCount(message) {
  // Use child_ids array if available
  if (message.child_ids && Array.isArray(message.child_ids)) {
    return message.child_ids.length;
  }
  // Fall back to existing counts if available
  return replyCounts.value[message.id] || 0;
}

// Navigate to thread view when a thread is clicked
const viewThread = (threadId) => {
  router.push({ name: 'thread', params: { id: threadId } });
};

// Create a new message thread
const createNewThread = () => {
  // Simply navigate to the new thread route
  router.push('/new-thread');
  console.log('Navigating to new thread route');
};

// Handle the new message button click
const handleNewThreadClick = (event) => {
  // First check if user is logged in
  if (!user.value) {
    alert("Please log in to create new messages");
    return;
  }

  // Check user status directly
  if (user.value.status === 'admin' || user.value.status === 'whitelisted') {
    createNewThread();
  } else {
    alert("You need to be whitelisted to create new messages");
  }
};

// Add method to identify temporary threads
const isTemporaryThread = (id) => {
  return typeof id === 'string' && id.toString().startsWith('temp-');
};

// Function to check if the author is the current user
function isCurrentUserAuthor(message) {
  if (!user.value) return false;
  
  // First check by author_user_tag if available
  if (message.author_user_tag && user.value.user_tag === message.author_user_tag) {
    return true;
  }
  
  // Then check by email
  if (message.author_email && user.value.email === message.author_email) {
    return true;
  }
  
  // Finally check content_author for older messages
  if (message.content_author === user.value.uid) {
    return true;
  }
  
  return false;
}

// Load messages with unified loading state
const loadMessages = async () => {
  isLoadingMessages.value = true;
  try {
    console.log('[Debug] Loading messages for tab:', activeTab.value);
    await store.dispatch('messages/fetchThreads');
  } catch (error) {
    console.error('Error loading messages:', error);
  } finally {
    // Always set loading to false when done
    isLoadingMessages.value = false;
    hasLoadedOnce.value = true;
    console.log('[Debug] Finished loading messages');
  }
};

// Fetch messages on mount and when activeTab changes
onMounted(async () => {
  try {
    await initializeFirebase();
    firebaseReady.value = true;
  } catch (error) {
    console.error("Firebase initialization failed in MessageList:", error);
  }
  
  // Always load messages with the unified loading state
  await loadMessages();
});

// Watch for tab changes and reload messages
watch(activeTab, async () => {
  // Always reload messages when tab changes
  await loadMessages();
});
</script>

<template>
  <div class="message-list">
    <!-- Empty state - only shown when no messages and not loading -->
    <div v-if="!isLoadingMessages && hasLoadedOnce && threads.length === 0" class="empty-state">
      <p>No {{ activeTab }} messages found.</p>
    </div>
    
    <!-- Error state -->
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <!-- Messages container -->
    <div class="messages-container">
      <!-- Messages list -->
      <div 
        v-for="thread in threads" 
        :key="thread.id" 
        class="message-item pinned-message"
        :data-thread-id="thread.id"
        @click="viewThread(thread.id)"
      >
        <div class="message-header">
          <h3 class="message-title">
            📌 {{ thread.title || 'Untitled Message' }}
          </h3>
          <div class="author-info">
            <div class="author-pin-section">
              <span class="message-author" :class="{ 'current-user-name': isCurrentUserAuthor(thread) }">{{ getAuthorDisplay(thread) }}</span>
              <span v-if="getAuthorUserTag(thread)" class="author-user-tag">@{{ getAuthorUserTag(thread) }}</span>
            </div>
          </div>
        </div>
        
        <p class="message-desc">
          {{ thread.description || 'No description' }}
        </p>
        
        <div class="message-footer">
          <span class="reply-count">{{ getReplyCount(thread) }} replies</span>
          <span class="message-date">{{ new Date(thread.timestamp).toLocaleString() }}</span>
        </div>
      </div>
      
      <!-- Unified loading indicator - always visible when loading -->
      <div v-if="isLoadingMessages" class="loading-indicator" :class="{ 'full-height': threads.length === 0 }">
        <div class="loading-spinner"></div>
        <p>{{ threads.length === 0 ? 'Loading messages...' : 'Loading more messages...' }}</p>
      </div>
    </div>
    
    <div class="message-list-header">
      <button 
        class="new-message-btn"
        :class="{ 'disabled': !canInteract }"
        @click="handleNewThreadClick"
      >
        <span class="btn-icon">+</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
  scroll-behavior: smooth;
}

.section-title {
  font-size: 1.2rem;
  margin-bottom: var(--spacing-sm);
  color: var(--text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.message-item {
  background-color: var(--card-background);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: box-shadow 0.3s, transform 0.2s;
  position: relative;
}

.message-item:hover {
  box-shadow: var(--card-shadow);
  transform: translateY(-2px);
}

.pinned-message {
  border-color: var(--primary-color-light, #c8e6ff);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-sm);
}

.author-pin-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-title {
  margin: 0;
  color: var(--primary-color);
  font-size: 1.2rem;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-author {
  font-size: 0.9rem;
  color: var(--text-color-light);
}

.message-author.current-user-name {
  font-weight: 800;
  color: var(--primary-color, #4a90e2);
}

.author-user-tag {
  font-size: 0.8rem;
  color: var(--text-color-light);
  opacity: 0.8;
}

.message-desc {
  margin-bottom: var(--spacing-md);
  color: var(--text-color);
}

.message-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-color-light);
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-color-light);
  text-align: center;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--spacing-sm);
  height: auto;
  padding: var(--spacing-sm);
}

.loading-indicator.full-height {
  height: 160px;
}

.error-message {
  color: #e74c3c;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  text-align: center;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--text-color-light);
  text-align: center;
  flex-direction: column;
  gap: 16px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top: 3px solid var(--primary-color, #007bff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.new-message-btn {
  position: fixed;
  bottom: var(--spacing-xl);
  right: var(--spacing-xl);
  background-color: var(--primary-color);
  color: black;
  border: none;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background-color 0.3s;
  z-index: 10;
  font-size: 52px;
}

.new-message-btn:hover {
  background-color: var(--primary-color-dark);
}

.new-message-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: all;
}

.page-title {
  font-size: 1.6rem;
  margin-bottom: var(--spacing-md);
  color: var(--text-color);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}
</style> 