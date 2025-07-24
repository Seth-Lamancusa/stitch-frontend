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
const phoneNumber = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const tagError = ref('');
const displayNameError = ref('');
const phoneNumberError = ref('');
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
  phoneNumber.value = user.value?.phone_number || '';
  errorMessage.value = '';
  tagError.value = '';
  displayNameError.value = '';
  phoneNumberError.value = '';
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
  
  // Check if tag is alphanumeric with underscores and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(tag.value)) {
    tagError.value = 'Tag must contain only letters, numbers, underscores, and hyphens';
    return false;
  }
  
  // Check minimum length
  if (tag.value.length < 1) {
    tagError.value = 'Tag must be at least 1 character long';
    return false;
  }
  
  return true;
};

const validatePhoneNumber = () => {
  phoneNumberError.value = '';
  
  // If empty, it's valid (phone number is optional)
  if (!phoneNumber.value.trim()) {
    return true;
  }
  
  // Remove all non-digit characters for validation
  const digitsOnly = phoneNumber.value.replace(/\D/g, '');
  
  // Check if it's a valid US phone number (10 or 11 digits)
  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    phoneNumberError.value = 'Please enter a valid phone number';
    return false;
  }
  
  // If 11 digits, first digit should be 1 (US country code)
  if (digitsOnly.length === 11 && digitsOnly[0] !== '1') {
    phoneNumberError.value = 'Please enter a valid US phone number';
    return false;
  }
  
  return true;
};

// Function to check if the form has any changes from the original user data
const hasFormChanges = computed(() => {
  if (!user.value) return false;
  
  const originalDisplayName = user.value.displayName || '';
  const originalTag = user.value.user_tag || '';
  const originalPhoneNumber = user.value?.phone_number || '';
  
  return displayName.value !== originalDisplayName || 
         tag.value !== originalTag ||
         phoneNumber.value !== originalPhoneNumber;
});

// Function to determine if the update button should be enabled
const canSubmit = computed(() => {
  // Only check for validation errors and submission state
  return !tagError.value && 
         !displayNameError.value && 
         !phoneNumberError.value &&
         !isSubmitting.value;
});

const validateForm = () => {
  let isValid = true;
  displayNameError.value = '';
  phoneNumberError.value = '';
  noChangesMessage.value = '';
  
  // Check if there are any changes
  if (!hasFormChanges.value) {
    noChangesMessage.value = 'Make changes before updating';
    return false;
  }
  
  // Check if at least one field is filled OR if we're clearing the phone number
  const originalPhoneNumber = user.value?.phone_number || '';
  const isPhoneNumberBeingCleared = originalPhoneNumber && !phoneNumber.value.trim();
  
  if (!displayName.value.trim() && !tag.value.trim() && !phoneNumber.value.trim() && !isPhoneNumberBeingCleared) {
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
  
  // Validate phone number
  if (!validatePhoneNumber()) {
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
    
    const profileUpdate = {};
    
    if (displayName.value.trim()) {
      profileUpdate.display_name = displayName.value.trim();
    }
    
    if (tag.value.trim()) {
      profileUpdate.user_tag = tag.value.trim();
    }
    
    // Always include phone_number if the form has changes to it
    const originalPhoneNumber = user.value?.phone_number || '';
    if (phoneNumber.value !== originalPhoneNumber) {
      profileUpdate.phone_number = phoneNumber.value.trim() || null;
    }
    
    await store.dispatch('auth/updateProfile', profileUpdate);
    
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
            <div v-else class="field-hint">A unique identifier for your account (letters, numbers, underscores, and hyphens only)</div>
          </div>
          
          <div class="form-group">
            <label for="phoneNumber">Phone Number (Optional)</label>
            <input 
              id="phoneNumber" 
              v-model="phoneNumber" 
              type="tel" 
              placeholder="(555) 123-4567"
              @keydown="handleKeydown"
              @blur="validatePhoneNumber"
            />
            <div v-if="phoneNumberError" class="field-error">{{ phoneNumberError }}</div>
            <div v-else class="field-hint">Receive SMS notifications for new messages</div>
          </div>
          
          <div v-if="phoneNumber.trim()" class="consent-message">
            <p>By providing your phone number, you agree to receive text messages from Stitch at the number provided. Message and data rates may apply. Message frequency varies. To opt-out, remove your phone number here. View our Terms of Service and Privacy Policy at <a href="https://stitch.fyi/terms" target="_blank" rel="noopener noreferrer">stitch.fyi/terms</a>.</p>
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
  transition: opacity var(--transition-fast);
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
  z-index: var(--z-index-modal);
  backdrop-filter: blur(2px);
}

.modal-container {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 450px;
  max-height: 75vh;
  box-shadow: var(--color-card-shadow);
  overflow: hidden;
  animation: modal-appear var(--transition-normal);
  display: flex;
  flex-direction: column;
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
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.7;
  transition: opacity var(--transition-fast);
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
  padding: var(--space-lg);
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-xs);
  color: var(--color-text);
  font-weight: 500;
  font-size: var(--font-size-sm);
}

.form-group input {
  width: 100%;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-background);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin-top: 4px;
}

.consent-message {
  background-color: rgba(52, 152, 219, 0.1);
  border: 1px solid rgba(52, 152, 219, 0.2);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-lg);
}

.consent-message p {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.consent-message a {
  color: var(--color-primary);
  text-decoration: none;
}

.consent-message a:hover {
  text-decoration: underline;
}

.error-message {
  color: var(--color-error);
  margin: 2px 0;
  font-size: var(--font-size-xs);
  display: block;
}

.modal-footer {
  display: flex;
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-border);
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
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  display: inline-block;
}

.button-group {
  display: flex;
  gap: var(--space-md);
  margin-left: auto;
}

.cancel-btn {
  background-color: transparent;
  color: var(--color-text);
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background-color var(--transition-fast);
}

.cancel-btn:hover {
  background-color: var(--color-hover-overlay);
}

.update-btn {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
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
  font-size: var(--font-size-sm);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  border-top-color: var(--color-text-inverse);
  animation: spin 1s linear infinite;
  margin-right: var(--space-xs);
}

.update-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
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