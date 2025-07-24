<template>
  <div v-if="isOpen" class="modal-overlay" @click.stop="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Create New User</h3>
        <button class="close-button" @click.stop="closeModal">×</button>
      </div>
      
      <div class="modal-content">
        <form @submit.prevent="handleSubmit">
          <!-- Email Field -->
          <div class="form-group">
            <label for="email">Email Address</label>
            <input 
              id="email" 
              v-model="formData.email" 
              type="email" 
              placeholder="user@example.com"
              :class="{ 'error': emailError }"
              @blur="validateEmail"
            />
            <div v-if="emailError" class="field-error">{{ emailError }}</div>
            <div v-else class="field-hint">The user's email address</div>
          </div>

          <!-- Display Name Field -->
          <div class="form-group">
            <label for="displayName">Display Name <span class="required">*</span></label>
            <input 
              id="displayName" 
              v-model="formData.display_name" 
              type="text" 
              placeholder="John Doe"
              :class="{ 'error': displayNameError }"
              @blur="validateDisplayName"
              required
            />
            <div v-if="displayNameError" class="field-error">{{ displayNameError }}</div>
            <div v-else class="field-hint">The user's public display name</div>
          </div>

          <!-- User Tag Field -->
          <div class="form-group">
            <label for="userTag">User Tag <span class="required">*</span></label>
            <input 
              id="userTag" 
              v-model="formData.user_tag" 
              type="text" 
              placeholder="john_doe"
              :class="{ 'error': userTagError }"
              @input="formatUserTag"
              @blur="validateUserTag"
              required
            />
            <div v-if="userTagError" class="field-error">{{ userTagError }}</div>
            <div v-else class="field-hint">Unique identifier (letters, numbers, underscores, and hyphens only)</div>
          </div>

          <!-- Status/Role Field -->
          <div class="form-group">
            <label for="status">Role/Status <span class="required">*</span></label>
            <select 
              id="status" 
              v-model="formData.status" 
              :class="{ 'error': statusError }"
              required
            >
              <option value="">Select a role...</option>
              <option value="whitelisted">Whitelisted</option>
              <option value="admin">Admin</option>
              <option value="import">Import</option>
            </select>
            <div v-if="statusError" class="field-error">{{ statusError }}</div>
            <div v-else class="field-hint">The user's access level and permissions</div>
          </div>

          <!-- General Error Message -->
          <div v-if="generalError" class="error-message">
            {{ generalError }}
          </div>
        </form>
      </div>
      
      <div class="modal-footer">
        <button type="button" class="cancel-btn" @click.stop="closeModal" :disabled="isSubmitting">
          Cancel
        </button>
        <button 
          type="button" 
          class="create-btn" 
          @click.stop="handleSubmit" 
          :disabled="!canSubmit || isSubmitting"
        >
          {{ isSubmitting ? 'Creating...' : 'Create User' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import AdminService from '../services/AdminService';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close', 'user-created']);

// Form data
const formData = ref({
  email: '',
  display_name: '',
  user_tag: '',
  status: ''
});

// Validation errors
const emailError = ref('');
const displayNameError = ref('');
const userTagError = ref('');
const statusError = ref('');
const generalError = ref('');

// Form state
const isSubmitting = ref(false);

// Watch for modal open to reset form
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

// Computed properties
const canSubmit = computed(() => {
  return formData.value.display_name && 
         formData.value.user_tag && 
         formData.value.status && 
         !emailError.value && 
         !displayNameError.value && 
         !userTagError.value && 
         !statusError.value && 
         !isSubmitting.value;
});

// Form methods
const resetForm = () => {
  formData.value = {
    email: '',
    display_name: '',
    user_tag: '',
    status: ''
  };
  emailError.value = '';
  displayNameError.value = '';
  userTagError.value = '';
  statusError.value = '';
  generalError.value = '';
};

const validateEmail = () => {
  return true;
};

const validateDisplayName = () => {
  displayNameError.value = '';
  const displayName = formData.value.display_name.trim();
  
  if (!displayName) {
    displayNameError.value = 'Display name is required';
    return false;
  }
  
  if (displayName.length < 1) {
    displayNameError.value = 'Display name must be at least 1 character';
    return false;
  }
  
  if (displayName.length > 50) {
    displayNameError.value = 'Display name must be less than 50 characters';
    return false;
  }
  
  return true;
};

const formatUserTag = () => {
  // Convert to lowercase and replace invalid characters
  formData.value.user_tag = formData.value.user_tag
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
};

const validateUserTag = () => {
  userTagError.value = '';
  const userTag = formData.value.user_tag.trim();
  
  if (!userTag) {
    userTagError.value = 'User tag is required';
    return false;
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(userTag)) {
    userTagError.value = 'User tag must contain only letters, numbers, underscores, and hyphens';
    return false;
  }
  
  if (userTag.length < 1) {
    userTagError.value = 'User tag must be at least 1 character';
    return false;
  }
  
  if (userTag.length > 30) {
    userTagError.value = 'User tag must be less than 30 characters';
    return false;
  }
  
  return true;
};

const validateForm = () => {
  const isEmailValid = validateEmail();
  const isDisplayNameValid = validateDisplayName();
  const isUserTagValid = validateUserTag();
  
  statusError.value = '';
  if (!formData.value.status) {
    statusError.value = 'Please select a role/status';
  }
  
  return isEmailValid && isDisplayNameValid && isUserTagValid && formData.value.status;
};

const handleSubmit = async () => {
  if (!validateForm() || isSubmitting.value) {
    return;
  }
  
  isSubmitting.value = true;
  generalError.value = '';
  
  try {
    const response = await AdminService.createUser({
      email: formData.value.email.trim(),
      display_name: formData.value.display_name.trim(),
      user_tag: formData.value.user_tag.trim(),
      status: formData.value.status
    });
    
    if (response.success) {
      emit('user-created', response.user);
      resetForm();
      emit('close');
    } else {
      // Handle specific error cases
      if (response.error.toLowerCase().includes('email')) {
        emailError.value = response.error;
      } else if (response.error.toLowerCase().includes('tag')) {
        userTagError.value = response.error;
      } else {
        generalError.value = response.error;
      }
    }
  } catch (error) {
    console.error('Error creating user:', error);
    generalError.value = 'An unexpected error occurred. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

const closeModal = () => {
  resetForm();
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-index-modal, 9999);
}

.modal-container {
  background-color: var(--color-surface, #222);
  border-radius: var(--radius-md, 8px);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border, #333);
}

.modal-header {
  padding: var(--space-md, 16px);
  border-bottom: 1px solid var(--color-border, #333);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-lg, 1.25rem);
  color: var(--color-text, #fff);
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-xl, 1.5rem);
  cursor: pointer;
  color: var(--color-text-secondary, #aaa);
  padding: 4px;
  border-radius: var(--radius-sm, 4px);
  transition: color var(--transition-fast, 0.2s);
}

.close-button:hover {
  color: var(--color-text, #fff);
}

.modal-content {
  padding: var(--space-md, 16px);
}

.form-group {
  margin-bottom: var(--space-md, 16px);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-xs, 6px);
  font-weight: 500;
  color: var(--color-text, #fff);
  font-size: var(--font-size-sm, 0.9rem);
}

.required {
  color: var(--color-error, #dc2626);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: var(--space-sm, 12px);
  border: 1px solid var(--color-border, #333);
  border-radius: var(--radius-sm, 4px);
  background: var(--color-background, #111);
  color: var(--color-text, #fff);
  font-size: var(--font-size-sm, 0.9rem);
  transition: border-color var(--transition-fast, 0.2s);
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary, #4f8cff);
}

.form-group input.error,
.form-group select.error {
  border-color: var(--color-error, #dc2626);
}

.form-group select {
  cursor: pointer;
}

.field-error {
  margin-top: var(--space-xs, 6px);
  color: var(--color-error, #dc2626);
  font-size: var(--font-size-xs, 0.75rem);
}

.field-hint {
  margin-top: var(--space-xs, 6px);
  color: var(--color-text-secondary, #aaa);
  font-size: var(--font-size-xs, 0.75rem);
}

.error-message {
  background: rgba(220, 38, 38, 0.1);
  color: var(--color-error, #dc2626);
  padding: var(--space-sm, 12px);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid rgba(220, 38, 38, 0.3);
  margin-top: var(--space-md, 16px);
  font-size: var(--font-size-sm, 0.9rem);
}

.modal-footer {
  padding: var(--space-md, 16px);
  border-top: 1px solid var(--color-border, #333);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md, 16px);
}

.cancel-btn,
.create-btn {
  padding: var(--space-sm, 12px) var(--space-md, 16px);
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-weight: 500;
  font-size: var(--font-size-sm, 0.9rem);
  transition: all var(--transition-fast, 0.2s);
}

.cancel-btn {
  background-color: transparent;
  color: var(--color-text, #fff);
  border: 1px solid var(--color-border, #333);
}

.cancel-btn:hover:not(:disabled) {
  background-color: var(--color-hover-overlay, #333);
}

.create-btn {
  background-color: var(--color-primary, #4f8cff);
  color: var(--color-text-inverse, #fff);
}

.create-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark, #357ae8);
}

.cancel-btn:disabled,
.create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    margin: var(--space-sm, 12px);
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .cancel-btn,
  .create-btn {
    width: 100%;
  }
}
</style> 