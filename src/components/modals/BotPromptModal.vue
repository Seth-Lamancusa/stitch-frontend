<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import FeaturedBotsService from '../../services/FeaturedBotsService.js';
import MessageService from '../../services/MessageService.js';

const store = useStore();

// Global modal visibility and target
const isOpen = computed(() => store.getters['navigation/botPromptModalVisible']);
const targetMessageId = computed(() => store.getters['navigation/botPromptTargetMessageId']);

// Bots
const featuredBots = ref([]);
const mainBots = computed(() => featuredBots.value.filter(bot => !bot.advanced));
const advancedBots = computed(() => featuredBots.value.filter(bot => bot.advanced));
const showAdvancedBots = ref(false);

// Selection
const selectedBots = ref({}); // uid -> true
const isAdding = ref(false);
const addSuccess = ref(false);
const addError = ref(null);
const addToAncestors = ref(true);

const selectedBotsList = computed(() => featuredBots.value.filter(bot => !!selectedBots.value[bot.uid]));

const resetState = () => {
  selectedBots.value = {};
  isAdding.value = false;
  addSuccess.value = false;
  addError.value = null;
  showAdvancedBots.value = false;
  addToAncestors.value = true;
};

const loadBots = async () => {
  try {
    featuredBots.value = await FeaturedBotsService.listFeaturedBots();
  } catch (_e) {
    featuredBots.value = [];
  }
};

watch(isOpen, (open) => {
  if (open) {
    resetState();
    loadBots();
  } else {
    resetState();
  }
});

onMounted(() => {
  if (isOpen.value) {
    resetState();
    loadBots();
  }
});

const closeModal = () => {
  store.dispatch('navigation/hideBotPromptModal');
};

const isBotSelected = (bot) => !!selectedBots.value[bot.uid];
const toggleBotSelected = (bot) => {
  const current = !!selectedBots.value[bot.uid];
  selectedBots.value = { ...selectedBots.value, [bot.uid]: !current };
};

const addSelectedBots = async () => {
  if (!targetMessageId.value || selectedBotsList.value.length === 0) return;
  try {
    isAdding.value = true;
    addError.value = null;
    const recipientsToAdd = selectedBotsList.value.map(bot => ({
      uid: bot.uid,
      display_name: bot.display_name,
      user_tag: bot.user_tag,
      public: true,
      visible: true
    }));
    await MessageService.addRecipientsToMessage(targetMessageId.value, recipientsToAdd, addToAncestors.value, true);
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
      <div class="bot-prompt-modal" @click.stop>
        <div class="modal-header">
          <h3>Prompt Bot Response</h3>
          <button class="close-button" @click="closeModal" aria-label="Close bot prompt modal">×</button>
        </div>

        <div class="modal-content">
          <p class="modal-description">Select one or more bots to add as recipients to this message.</p>
          <div class="ancestors-toggle" title="Also add recipients to all visible parents up to the visible root">
            <label>
              <input type="checkbox" v-model="addToAncestors" />
              <span>Add to all ancestors</span>
            </label>
          </div>

          <div class="bot-options">
            <div class="main-bot-options">
              <div 
                v-for="bot in mainBots" 
                :key="bot.uid"
                class="bot-option-button"
                :class="{ 'bot-selected': isBotSelected(bot) }"
                @click="toggleBotSelected(bot)"
              >
                <span class="bot-option-icon">
                  <input type="checkbox" :checked="isBotSelected(bot)" @click.stop @change="toggleBotSelected(bot)" />
                </span>
                <span class="bot-option-text">{{ bot.display_name }}</span>
              </div>
            </div>

            <div v-if="advancedBots.length > 0" class="advanced-bot-options">
              <span class="advanced-bots-inline">
                <button 
                  class="advanced-bots-toggle"
                  @click="showAdvancedBots = !showAdvancedBots"
                  :aria-expanded="showAdvancedBots"
                >
                  <span class="advanced-bots-text">Advanced ({{ advancedBots.length }})</span>
                  <span class="advanced-bots-icon" :class="{ 'expanded': showAdvancedBots }">▼</span>
                </button>
              </span>
              <div v-if="showAdvancedBots" class="advanced-bot-list">
                <div 
                  v-for="bot in advancedBots" 
                  :key="bot.uid"
                  class="bot-option-button advanced-bot-button"
                  :class="{ 'bot-selected': isBotSelected(bot) }"
                  @click="toggleBotSelected(bot)"
                >
                  <span class="bot-option-icon">
                    <input type="checkbox" :checked="isBotSelected(bot)" @click.stop @change="toggleBotSelected(bot)" />
                  </span>
                  <span class="bot-option-text">{{ bot.display_name }}</span>
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
            :disabled="isAdding || selectedBotsList.length === 0"
            @click.stop="addSelectedBots"
          >
            <span v-if="isAdding" class="button-loading"><span class="bot-loading-spinner"></span><span>Adding...</span></span>
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

.bot-prompt-modal {
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

.bot-options { display: flex; flex-direction: column; gap: 12px; margin-top: var(--space-md); }
.bot-option-button { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background-color: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); cursor: pointer; transition: all var(--transition-fast); font-size: var(--font-size-md); width: 100%; text-align: left; margin-bottom: 6px; }
.bot-option-button:hover:not(:disabled) { background-color: var(--color-hover-overlay); border-color: var(--color-border-hover); }
.bot-option-icon { font-size: var(--font-size-lg); display: flex; align-items: center; justify-content: center; min-width: 20px; }
.bot-option-text { font-weight: 500; flex: 1; }

.advanced-bot-options { margin-top: 8px; }
.advanced-bots-inline { display: inline-block; }
.advanced-bots-toggle { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px; background: transparent; border: none; color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); font-size: var(--font-size-xs); opacity: 0.7; }
.advanced-bots-toggle:hover { background-color: var(--color-hover-overlay); border-radius: var(--radius-sm); opacity: 1; }
.advanced-bots-text { font-weight: 400; }
.advanced-bots-icon { font-size: 9px; transition: transform var(--transition-fast); }
.advanced-bots-icon.expanded { transform: rotate(180deg); }
.advanced-bot-list { margin-top: 6px; padding-left: 0; }
.advanced-bot-button { margin-bottom: 6px; opacity: 0.8; transform: scale(0.95); }
.advanced-bot-button:last-child { margin-bottom: 0; }

.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: var(--space-lg); }
.add-button { padding: 10px 20px; background-color: var(--color-primary); color: var(--color-text-inverse); border: none; border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; transition: all 0.2s ease; }
.add-button:hover:not(:disabled) { background-color: var(--color-primary-dark); transform: translateY(-1px); }
.add-button:disabled { background-color: var(--color-border); color: var(--color-text-secondary); cursor: not-allowed; transform: none; }
.add-button.success { background-color: var(--color-success); color: rgba(255, 255, 255, 0.9); }
.cancel-button { padding: 10px 20px; background-color: transparent; color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-weight: 500; font-size: var(--font-size-sm); cursor: pointer; transition: all 0.2s ease; }
.cancel-button:hover { background-color: var(--color-hover-overlay); border-color: var(--color-border-dark); }
.button-loading { display: inline-flex; align-items: center; gap: 8px; }
.bot-loading-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite; }

@media (max-width: 768px) {
  .bot-prompt-modal { max-width: 95%; padding: var(--space-md); }
  .bot-option-button { padding: 10px 12px; font-size: var(--font-size-sm); }
  .bot-option-icon { font-size: var(--font-size-md); min-width: 18px; }
}

@media (max-width: 480px) {
  .bot-prompt-modal { padding: var(--space-sm); }
  .bot-option-button { padding: 8px 10px; gap: 8px; }
}
</style>


