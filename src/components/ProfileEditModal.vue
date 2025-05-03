<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

const store = useStore();
const user = computed(() => store.getters['auth/user']);

const displayName = ref('');
const tag = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const tagError = ref('');
const displayNameError = ref('');
const noChangesMessage = ref('');

// Reset form whenever modal is opened
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

const resetForm = () => {
  displayName.value = user.value?.displayName || '';
  tag.value = user.value?.user_tag || '';
  errorMessage.value = '';
  tagError.value = '';
  displayNameError.value = '';
  noChangesMessage.value = '';
};

onMounted(() => {
  resetForm();
});

const validateTag = () => {
  tagError.value = '';
  
  // If empty, it's valid (tag is optional)
  if (!tag.value.trim()) {
    return true;
  }
  
  // Check if tag is alphanumeric
  if (!/^[a-zA-Z0-9]+$/.test(tag.value)) {
    tagError.value = 'Tag must contain only letters and numbers';
    return false;
  }
  
  // Check minimum length
  if (tag.value.length < 3) {
    tagError.value = 'Tag must be at least 3 characters long';
    return false;
  }
  
  return true;
};

// Function to check if the form has any changes from the original user data
const hasFormChanges = computed(() => {
  if (!user.value) return false;
  
  const originalDisplayName = user.value.displayName || '';
  const originalTag = user.value.user_tag || '';
  
  return displayName.value !== originalDisplayName || 
         tag.value !== originalTag;
});

// Function to determine if the update button should be enabled
const canSubmit = computed(() => {
  // Only check for validation errors and submission state
  return !tagError.value && 
         !displayNameError.value && 
         !isSubmitting.value;
});

const validateForm = () => {
  let isValid = true;
  displayNameError.value = '';
  noChangesMessage.value = '';
  
  // Check if there are any changes
  if (!hasFormChanges.value) {
    noChangesMessage.value = 'Make changes before updating';
    return false;
  }
  
  // Check if at least one field is filled
  if (!displayName.value.trim() && !tag.value.trim()) {
    errorMessage.value = 'Please fill at least one field';
    return false;
  }
  
  // Validate display name if provided
  if (displayName.value.trim() && displayName.value.length > 50) {
    displayNameError.value = 'Display name should be less than 50 characters';
    isValid = false;
  }
  
  // Validate tag
  if (!validateTag()) {
    isValid = false;
  }
  
  return isValid;
};

const handleKeydown = (e) => {
  // If Enter is pressed
  if (e.key === 'Enter') {
    // If the form can't be submitted, prevent default and show message
    if (!canSubmit.value) {
      e.preventDefault();
      if (!hasFormChanges.value) {
        noChangesMessage.value = 'Make changes before updating';
      }
      return;
    }
    
    // Otherwise, submit the form
    updateProfile();
  }
};

const updateProfile = async () => {
  try {
    // Validate form first
    if (!validateForm()) {
      return;
    }
    
    isSubmitting.value = true;
    errorMessage.value = '';
    noChangesMessage.value = '';
    
    await store.dispatch('auth/updateProfile', {
      displayName: displayName.value.trim() || undefined,
      user_tag: tag.value.trim() || undefined
    });
    
    emit('close');
  } catch (error) {
    errorMessage.value = error.message || 'Failed to update profile';
  } finally {
    isSubmitting.value = false;
  }
};

const closeModal = () => {
  emit('close');
};
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Edit Profile</h3>
          <button class="close-button" @click="closeModal">×</button>
        </div>
        
        <div class="modal-content">
          <div class="form-group">
            <label for="displayName">Display Name</label>
            <input 
              id="displayName" 
              v-model="displayName" 
              type="text" 
              placeholder="Your public display name"
              @keydown="handleKeydown"
            />
            <div v-if="displayNameError" class="field-error">{{ displayNameError }}</div>
            <div v-else class="field-hint">This name will be visible to everyone</div>
          </div>
          
          <div class="form-group">
            <label for="tag">Tag</label>
            <input 
              id="tag" 
              v-model="tag" 
              type="text" 
              placeholder="Your unique tag"
              @keydown="handleKeydown"
              @blur="validateTag"
            />
            <div v-if="tagError" class="field-error">{{ tagError }}</div>
            <div v-else class="field-hint">A unique identifier for your account (letters and numbers only)</div>
          </div>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </div>
        
        <div class="modal-footer">
          <div v-if="noChangesMessage" class="error-message footer-message">
            <span>{{ noChangesMessage }}</span>
          </div>
          <div class="button-group">
            <button class="cancel-btn" @click="closeModal">Cancel</button>
            <button 
              class="update-btn" 
              @click="updateProfile" 
              :disabled="!canSubmit"
            >
              <div class="button-inner">
                <div v-if="isSubmitting" class="spinner"></div>
                {{ isSubmitting ? 'Updating...' : 'Update Profile' }}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-container {
  background-color: var(--card-background);
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: modal-appear 0.3s ease-out;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-color);
  opacity: 0.7;
  transition: opacity 0.2s ease;
  height: 24px;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.close-button:hover {
  opacity: 1;
}

.modal-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-color);
  font-weight: 500;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--input-background);
  color: var(--text-color);
  font-size: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb, 0, 120, 212), 0.2);
}

.field-hint {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.field-error {
  font-size: 12px;
  color: #e74c3c;
  margin-top: 4px;
}

.error-message {
  color: #e74c3c;
  margin: 2px 0;
  font-size: 12px;
  display: block;
}

.modal-footer {
  display: flex;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.footer-message {
  margin: 0;
  text-align: left;
  flex-grow: 1;
  display: flex;
  align-items: center;
}

.footer-message span {
  background-color: rgba(231, 76, 60, 0.1);
  border-radius: 3px;
  padding: 1px 6px;
  display: inline-block;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.cancel-btn {
  background-color: transparent;
  color: var(--text-color);
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.cancel-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.update-btn {
  background-color: var(--primary-color);
  color: black;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  min-width: 140px;
  height: 38px;
  position: relative;
  overflow: hidden;
}

.button-inner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  border-top-color: #000;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

.update-btn:hover:not(:disabled) {
  background-color: var(--primary-color-dark, #0069d9);
}

.update-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style> 