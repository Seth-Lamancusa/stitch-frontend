<script setup>
import { computed, onMounted, watch, ref, onMounted as onMountedVue, onUnmounted } from 'vue';
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

const activeTab = computed(() => store.getters['ui/activeTab']);
const threads = computed(() => {
  const allMessages = store.getters['messages/getLoadedMessages'] || [];
  const currentUser = store.getters['auth/user'];
  const userEmail = currentUser?.email;
  
  // Get recommended message IDs from store for filtering
  const recommendedMessageIds = store.getters['messages/getRecommendedMessageIds'] || [];
  
  const filteredMessages = allMessages.filter(msg => {
    const isPublic = msg.public === 1 || msg.public === true;
    const isUserRecipient = userEmail && msg.recipients && 
      Array.isArray(msg.recipients) && msg.recipients.includes(userEmail);
    const isRecommended = recommendedMessageIds.includes(msg.id);
    
    if (activeTab.value === 'public') {
      // Public tab: show only public messages that are recommended
      return isPublic && isRecommended;
    } else {
      // Private tab: show any private messages OR public messages where user is explicitly a recipient
      return !isPublic || isUserRecipient;
    }
  });
  
  // Sort messages with pinned at top, then by timestamp
  return filteredMessages.sort((a, b) => {
    // First sort by pinned status (pinned messages come first)
    if ((a.is_pinned === 1) && (b.is_pinned !== 1)) return -1;
    if ((a.is_pinned !== 1) && (b.is_pinned === 1)) return 1;
    
    // Then sort by timestamp (newest first)
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
});

const isLoading = computed(() => store.getters['ui/isLoading']('threads'));
const error = computed(() => store.getters['ui/error']);
const user = computed(() => store.getters['auth/user']);
const isWhitelisted = computed(() => store.getters['auth/isWhitelisted']);
const canInteract = computed(() => store.getters['auth/canInteract']);

const firebaseReady = ref(false);
const replyCounts = ref({}); // Track reply counts by thread ID

// Get display version of author for a message
function getAuthorDisplay(message) {
  const currentUser = store.getters['auth/user'];
  
  // Special case for ChatGPT
  if (message.content_author === 'chatgpt' || message.content_author === 'chatgpt-system' || message.author_email === 'chatgpt') {
    return 'ChatGPT';
  }
  
  // If the current user is the author, prefer the up-to-date display name from auth state
  if (currentUser && (
      message.content_author === currentUser.uid || 
      message.author_email === currentUser.email
    )) {
    // Use the current user's display name from the auth store (most up-to-date)
    if (currentUser.displayName) {
      return currentUser.displayName;
    }
  }
  
  // For other authors, use the hierarchy from the message
  // Use display name if available
  if (message.author_display_name) {
    return message.author_display_name;
  }
  
  // For email-only authors (legacy data)
  if (message.author_email_display) {
    return message.author_email_display;
  }
  
  // Use user tag if no display name is available
  if (message.author_user_tag) {
    return message.author_user_tag;
  }
  
  // If it's a special character author like email, show that
  if (typeof message.content_author === 'string' && message.content_author.includes('@')) {
    return message.content_author;
  }
  
  // Last resort: just show content_author (could be UUID)
  return message.content_author;
}

// Get author user tag
function getAuthorUserTag(message) {
  const currentUser = store.getters['auth/user'];
  
  // Skip for ChatGPT
  if (message.content_author === 'chatgpt' || message.content_author === 'chatgpt-system' || message.author_email === 'chatgpt') {
    return null;
  }
  
  // If the current user is the author, use their tag from auth state
  if (currentUser && (
      message.content_author === currentUser.uid || 
      message.author_email === currentUser.email
    )) {
    if (currentUser.user_tag) {
      return currentUser.user_tag;
    }
  }
  
  // Otherwise use the tag from the message
  if (message.author_user_tag) {
    return message.author_user_tag;
  }
  
  return null;
}

// Navigate to thread view when a thread is clicked
const viewThread = (threadId) => {
  router.push({ name: 'thread', params: { id: threadId } });
};

// Create a new message thread
const createNewThread = () => {
  // Create a minimal temp thread object - just the ID and metadata
  // Removing any content or message-like properties
  const tempThread = {
    id: 'temp-' + Date.now(),
    // Explicitly set public based on active tab
    public: activeTab.value === 'public',
    timestamp: new Date().toISOString(),
    isNewThreadDraft: true, // Flag to indicate this is just a draft marker, not a message
    // Always initialize with empty recipients array
    recipients: []
  };
  
  console.log(`Creating new thread in ${activeTab.value} tab (public: ${tempThread.public})`);
  
  // Store it and redirect
  store.dispatch('ui/createTempThread', tempThread);
  router.push({ name: 'thread', params: { id: tempThread.id } });
};

// Handle the new message button click
const handleNewThreadClick = (event) => {
  // Only navigate if user can interact
  if (canInteract.value) {
    createNewThread();
  } else {
    // Optionally show a message explaining why they can't create a thread
    alert(user.value 
      ? "You need to be whitelisted to create new messages" 
      : "Please log in to create new messages");
  }
};

// Add method to identify temporary threads
const isTemporaryThread = (id) => {
  return typeof id === 'string' && id.toString().startsWith('temp-');
};

// Update fetchReplyCounts to skip temporary threads
const fetchReplyCounts = async () => {
  // Only fetch if we have threads and the user is authenticated
  if (threads.value.length && user.value) {
    try {
      // Fetch reply counts for each thread
      for (const thread of threads.value) {
        // Skip temporary threads
        if (isTemporaryThread(thread.id)) {
          continue;
        }
        
        const response = await MessageService.getReplyCount(thread.id);
        // Store the count in our replyCounts ref
        replyCounts.value[thread.id] = response.data.count;
      }
    } catch (error) {
      console.error('Error fetching reply counts:', error);
    }
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
  
  // Always fetch threads regardless of Firebase status
  await store.dispatch('messages/fetchThreads');
  
  // After messages are loaded, fetch reply counts
  await fetchReplyCounts();
});

watch(activeTab, async () => {
  await store.dispatch('messages/fetchThreads');
  // Refresh reply counts when active tab changes
  await fetchReplyCounts();
});

// Also watch threads for changes to handle dynamic updates
watch(threads, async () => {
  // If threads change, update reply counts
  await fetchReplyCounts();
}, { deep: true });
</script>

<template>
  <div class="message-list">
    <div v-if="isLoading" class="loading-indicator">
      Loading messages...
    </div>
    
    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-else-if="threads.length === 0" class="empty-state">
      <p>No {{ activeTab }} messages found.</p>
    </div>
    
    <!-- All messages in a single list with pinned ones at the top -->
    <div v-else class="messages-container">
      <div 
        v-for="thread in threads" 
        :key="thread.id" 
        class="message-item"
        :class="{'pinned-message': thread.is_pinned === 1}"
        :data-thread-id="thread.id"
        @click="viewThread(thread.id)"
      >
        <div class="message-header">
          <h3 class="message-title">
            {{ thread.title || 'Untitled Message' }}
          </h3>
          <div class="author-info">
            <div class="author-pin-section">
            <span class="message-author">By {{ getAuthorDisplay(thread) }}</span>
            <span v-if="getAuthorUserTag(thread)" class="author-user-tag">@{{ getAuthorUserTag(thread) }}</span>
          </div>
            <span v-if="thread.is_pinned === 1" class="pin-indicator">📌</span>
          </div>
        </div>
        
        <p class="message-desc">
          {{ thread.description || 'No description' }}
        </p>
        
        <div class="message-footer">
          <span class="reply-count">{{ replyCounts[thread.id] || 0 }} replies</span>
          <span class="message-date">{{ new Date(thread.timestamp).toLocaleString() }}</span>
        </div>
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

.author-user-tag {
  font-size: 0.8rem;
  color: var(--text-color-light);
  opacity: 0.8;
}

.pin-indicator {
  color: var(--primary-color);
  font-size: 1rem;
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

.loading-indicator,
.error-message,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: var(--text-color-light);
  text-align: center;
}

.error-message {
  color: #e74c3c;
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
</style> 