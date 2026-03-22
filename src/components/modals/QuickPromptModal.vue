<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import MessageService from '../../services/MessageService.js';

const store = useStore();

// Global modal visibility and target
const isOpen = computed(() => store.getters['navigation/speedDialModalVisible']);
const targetMessageId = computed(() => store.getters['navigation/speedDialTargetMessageId']);

// Speed dial users from store
const speedDialUsers = computed(() => store.getters['speedDial/users']);
const mainUsers = computed(() => store.getters['speedDial/mainUsers']);
const expandedUsers = computed(() => store.getters['speedDial/expandedUsers']);
const showExpanded = ref(false);

// Selection
const selectedUsers = ref({}); // uid -> true
const isAdding = ref(false);
const addSuccess = ref(false);
const addError = ref(null);
const addToAncestors = ref(true);

const selectedUsersList = computed(() => speedDialUsers.value.filter(user => !!selectedUsers.value[user.uid]));

const resetState = () => {
  selectedUsers.value = {};
  isAdding.value = false;
  addSuccess.value = false;
  addError.value = null;
  showExpanded.value = false;
  addToAncestors.value = true;
};

watch(isOpen, (open) => {
  if (open) {
    resetState();
  } else {
    resetState();
  }
});

onMounted(() => {
  if (isOpen.value) {
    resetState();
  }
});

const closeModal = () => {
  store.dispatch('navigation/hideSpeedDialModal');
};

const isUserSelected = (user) => !!selectedUsers.value[user.uid];
const toggleUserSelected = (user) => {
  const current = !!selectedUsers.value[user.uid];
  selectedUsers.value = { ...selectedUsers.value, [user.uid]: !current };
};

const addSelectedUsers = async () => {
  if (!targetMessageId.value || selectedUsersList.value.length === 0) return;
  try {
    isAdding.value = true;
    addError.value = null;
    
    const recipients = selectedUsersList.value.map(user => ({
      uid: user.uid,
      display_name: user.display_name,
      user_tag: user.user_tag,
      public: true,
      visible: true
    }));

    // 1. Grant Access (Silent Add)
    // We set notify: false because we will follow up with an explicit ping
    const accessRecipients = recipients.map(r => ({ ...r, notify: false }));
    await MessageService.addRecipientsToMessage(targetMessageId.value, accessRecipients, addToAncestors.value);

    // 2. Trigger Response (Explicit Ping)
    const pingRecipients = recipients.map(r => r.user_tag || r.uid);
    
    // Resolve context (ancestors) for the bot
    let context = null;
    try {
      const branchMessages = store.getters['messages/getVisibleBranchMessages'](targetMessageId.value);
      if (branchMessages && branchMessages.length > 0) {
        context = branchMessages;
        console.log(`[QuickPromptModal] Resolved context for ping: ${context.length} messages`);
      }
    } catch (contextError) {
      console.warn('[QuickPromptModal] Failed to resolve context for ping:', contextError);
    }

    await MessageService.pingMessage(targetMessageId.value, pingRecipients, context);

    await store.dispatch('messages/refreshLoadedAncestors', {
      messageId: targetMessageId.value,
      get_replies: true,
      get_children: true,
    });
    addSuccess.value = true;
    setTimeout(() => {
      addSuccess.value = false;
      closeModal();
    }, 250);
  } catch (error) {
    addError.value = error?.response?.data?.detail || error?.message || 'Failed to add recipients';
  } finally {
    isAdding.value = false;
  }
};
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="quick-prompt-modal" @click.stop>
        <div class="modal-header">
          <h3>Quick Prompt</h3>
          <button class="close-button" @click="closeModal" aria-label="Close quick prompt modal">×</button>
        </div>

        <div class="modal-content">
          <p class="modal-description">Select recipients from your speed dial to prompt a response.</p>
          <div class="ancestors-toggle" title="Also add recipients to all visible parents up to the visible root">
            <label>
              <input type="checkbox" v-model="addToAncestors" />
              <span>Add to all ancestors</span>
            </label>
          </div>

          <div class="speed-dial-options">
            <div v-if="speedDialUsers.length === 0" class="no-speed-dial">
              <p>No speed dial contacts yet.</p>
              <p class="hint">Add users to your speed dial from the Recipients modal.</p>
            </div>

            <div v-else class="main-options">
              <div 
                v-for="user in mainUsers" 
                :key="user.uid"
                class="user-option-button"
                :class="{ 'user-selected': isUserSelected(user) }"
                @click="toggleUserSelected(user)"
              >
                <span class="user-option-icon">
                  <input type="checkbox" :checked="isUserSelected(user)" @click.stop @change="toggleUserSelected(user)" />
                </span>
                <span class="user-option-text">{{ user.display_name }}</span>
              </div>
            </div>

            <div v-if="expandedUsers.length > 0" class="expanded-options">
              <span class="expanded-inline">
                <button 
                  class="expanded-toggle"
                  @click="showExpanded = !showExpanded"
                  :aria-expanded="showExpanded"
                >
                  <span class="expanded-text">More ({{ expandedUsers.length }})</span>
                  <span class="expanded-icon" :class="{ 'expanded': showExpanded }">▼</span>
                </button>
              </span>
              <div v-if="showExpanded" class="expanded-list">
                <div 
                  v-for="user in expandedUsers" 
                  :key="user.uid"
                  class="user-option-button expanded-button"
                  :class="{ 'user-selected': isUserSelected(user) }"
                  @click="toggleUserSelected(user)"
                >
                  <span class="user-option-icon">
                    <input type="checkbox" :checked="isUserSelected(user)" @click.stop @change="toggleUserSelected(user)" />
                  </span>
                  <span class="user-option-text">{{ user.display_name }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="addError" class="error-message">{{ addError }}</div>
        </div>

        <div class="modal-footer">
          <button 
            class="add-button"
            :class="{ 'success': addSuccess }"
            :disabled="isAdding || selectedUsersList.length === 0"
            @click.stop="addSelectedUsers"
          >
            <span v-if="isAdding" class="button-loading"><span class="loading-spinner"></span><span>Adding...</span></span>
            <span v-else-if="addSuccess">Added!</span>
            <span v-else>Add</span>
          </button>
          <button class="cancel-button" :disabled="isAdding" @click.stop="closeModal">Cancel</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity var(--transition-fast); }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.quick-prompt-modal {
  position: relative;
  max-width: 450px;
  width: 95%;
  height: 75vh;
  max-height: 75vh;
  background-color: var(--color-surface);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  overflow-y: auto;
}

.modal-header { display: flex; justify-content: space-between; align-items: center; }
.close-button { background: none; border: none; cursor: pointer; font-size: 1.5rem; color: var(--color-text); }
.modal-content { flex: 1; }
.modal-description { margin-bottom: 0; color: var(--color-text); }

.ancestors-toggle { display: inline-flex; align-items: center; gap: 6px; margin: 6px 0; opacity: 0.8; }
.ancestors-toggle label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.ancestors-toggle input[type="checkbox"] { width: 14px; height: 14px; accent-color: var(--color-primary); }
.ancestors-toggle span { font-size: var(--font-size-xs); color: var(--color-text-secondary); }

.speed-dial-options { display: flex; flex-direction: column; gap: 12px; margin-top: var(--space-md); }

.no-speed-dial { 
  text-align: center; 
  padding: var(--space-lg); 
  color: var(--color-text-secondary);
}
.no-speed-dial p { margin: 0 0 8px 0; }
.no-speed-dial .hint { font-size: var(--font-size-xs); opacity: 0.7; }

.user-option-button { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); cursor: pointer; transition: all var(--transition-fast); font-size: var(--font-size-md); width: 100%; text-align: left; margin-bottom: 6px; }
.user-option-button:hover:not(:disabled) { background-color: var(--color-hover-overlay); border-color: var(--color-border-hover); }
.user-option-button.user-selected { background-color: var(--color-primary-light); border-color: var(--color-primary); }
.user-option-icon { font-size: var(--font-size-lg); display: flex; align-items: center; justify-content: center; min-width: 20px; }
.user-option-text { font-weight: 500; flex: 1; }

.expanded-options { margin-top: 8px; }
.expanded-inline { display: inline-block; }
.expanded-toggle { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px; background: transparent; border: none; color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); font-size: var(--font-size-xs); opacity: 0.7; }
.expanded-toggle:hover { background-color: var(--color-hover-overlay); border-radius: var(--radius-sm); opacity: 1; }
.expanded-text { font-weight: 400; }
.expanded-icon { font-size: 9px; transition: transform var(--transition-fast); }
.expanded-icon.expanded { transform: rotate(180deg); }
.expanded-list { margin-top: 6px; padding-left: 0; }
.expanded-button { margin-bottom: 6px; opacity: 0.8; transform: scale(0.95); }
.expanded-button:last-child { margin-bottom: 0; }

.error-message { color: var(--color-error); font-size: var(--font-size-sm); margin-top: var(--space-md); }

.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: var(--space-lg); }
.add-button { padding: 10px 20px; background-color: var(--color-primary); color: var(--color-text-inverse); border: none; border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; transition: all 0.2s ease; }
.add-button:hover:not(:disabled) { background-color: var(--color-primary-dark); transform: translateY(-1px); }
.add-button:disabled { background-color: var(--color-border); color: var(--color-text-secondary); cursor: not-allowed; transform: none; }
.add-button.success { background-color: var(--color-success); color: rgba(255, 255, 255, 0.9); }
.cancel-button { padding: 10px 20px; background-color: transparent; color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; transition: all 0.2s ease; }
.cancel-button:hover { background-color: var(--color-hover-overlay); border-color: var(--color-border-dark); }
.button-loading { display: inline-flex; align-items: center; gap: 8px; }
.loading-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite; }

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .quick-prompt-modal { max-width: 95%; padding: var(--space-md); }
  .user-option-button { padding: 10px 12px; font-size: var(--font-size-sm); }
  .user-option-icon { font-size: var(--font-size-md); min-width: 18px; }
}

@media (max-width: 480px) {
  .quick-prompt-modal { padding: var(--space-sm); }
  .user-option-button { padding: 8px 10px; gap: 8px; }
}
</style>


