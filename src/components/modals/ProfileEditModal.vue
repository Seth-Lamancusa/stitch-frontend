<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useAuthentication } from '@/composables/useAuthentication';
import DevModal from '@/components/modals/DevModal.vue';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

const store = useStore();
const user = computed(() => store.getters['auth/user']);
const isManaged = computed(() => !!(user.value && user.value.is_managed));

const displayName = ref('');
const tag = ref('');
const phoneNumber = ref('');
const email = ref('');
const endpoint = ref('');
const isPrivate = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const tagError = ref('');
const displayNameError = ref('');
const phoneNumberError = ref('');
const emailError = ref('');
const noChangesMessage = ref('');
const updateSuccess = ref(false);

// Change password state
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const changePwBusy = ref(false);
const changePwError = ref('');
const changePwSuccess = ref('');

// Verification state
const emailCode = ref('');
const phoneCode = ref('');
const endpointVerificationMessage = ref('');
const requestingEmailCode = ref(false);
const requestingPhoneCode = ref(false);
const verifyingEmail = ref(false);
const verifyingPhone = ref(false);
const verificationMessage = ref('');

// Send code state/timers
const emailCodeSent = ref(false);
const phoneCodeSent = ref(false);
const emailCooldown = ref(0);
const phoneCooldown = ref(0);
let emailCooldownTimerId = null;
let phoneCooldownTimerId = null;

const { changePassword, requestEmailVerification, verifyEmailWithCode, requestPhoneVerification, verifyPhoneWithCode, requestEndpointVerification: requestEndpointChallenge, verifyEndpointWithChallenge } = useAuthentication();
const notifyPrefs = ref({ email: false, phone: false, endpoint: false });
const showPhoneConsent = ref(false);

// Password visibility toggles
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

// Endpoint signing secret management (write-only)
const secretBusy = ref(false);
const secretError = ref('');
const generatedSecret = ref(''); // reveal-once buffer
const hasJustRevealedSecret = ref(false);

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return b64;
}

function generateStrongSecret(lengthBytes = 32) {
  const arr = new Uint8Array(lengthBytes);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return base64UrlEncode(arr);
}

const revealSecretOnce = (secret) => {
  generatedSecret.value = secret;
  hasJustRevealedSecret.value = true;
};

const dismissRevealedSecret = () => {
  generatedSecret.value = '';
  hasJustRevealedSecret.value = false;
};

const copyRevealedSecret = async () => {
  try {
    await navigator.clipboard.writeText(generatedSecret.value);
  } catch (e) {
    secretError.value = 'Failed to copy';
    setTimeout(() => { secretError.value = ''; }, 2000);
  }
};

const setOrRotateSigningSecret = async () => {
  secretError.value = '';
  if (!endpoint.value || !endpoint.value.trim()) {
    secretError.value = 'Add and verify an endpoint first';
    return;
  }
  try {
    secretBusy.value = true;
    const newSecret = generateStrongSecret(32);
    const payload = {
      endpoint_signing_secret: newSecret,
    };
    // No Key-Id in contract; single secret per endpoint
    // Include endpoint if changed locally (backend can also infer current contact)
    const originalEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
    if (endpoint.value !== originalEndpoint) {
      payload.endpoint = endpoint.value.trim();
    }
    await store.dispatch('auth/updateProfile', payload);
    // After successful write, the auth store refreshes /me and sets has_endpoint_signing_secret
    revealSecretOnce(newSecret);
  } catch (e) {
    secretError.value = e.message || 'Failed to update signing secret';
  } finally {
    secretBusy.value = false;
  }
};

// API Keys modal state
const showApiKeysModal = ref(false);

// Verification status flags
const isEmailVerified = computed(() => !!(user.value?.is_email_verified));
const isPhoneVerified = computed(() => !!(user.value?.is_phone_verified));
const isEndpointVerified = computed(() => !!((user.value?.contacts || []).some(c => c.type === 'endpoint' && c.verified)));
// Saved contact presence flags
const hasSavedEmail = computed(() => !!(user.value?.email));
const hasSavedPhone = computed(() => !!(user.value?.phone_number));
const hasSavedEndpoint = computed(() => !!((user.value?.contacts || []).find(c => c.type === 'endpoint')?.value));
// Signing secret presence flag from /me
const hasEndpointSigningSecret = computed(() => !!(user.value?.has_endpoint_signing_secret));

// ------------------------------------------------------------
// Normalization helpers for equality/dirty checks
// ------------------------------------------------------------
function normalizeTrimmed(value) {
  const v = (value ?? '').toString();
  return v.trim();
}

function normalizeLowerTrimmed(value) {
  return normalizeTrimmed(value).toLowerCase();
}

function normalizePhoneForCompare(value) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1); // US canonical 10-digit
  }
  if (digits.length === 10) return digits;
  return digits; // fallback: compare raw digits
}

function normalizeEndpointForCompare(value) {
  const v = normalizeTrimmed(value);
  if (!v) return '';
  try {
    const url = new URL(v);
    // normalize scheme/host case and strip trailing slash on pathname
    const scheme = url.protocol.toLowerCase();
    const host = url.hostname.toLowerCase();
    let path = url.pathname || '';
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    const normalized = `${scheme}//${host}${path}${url.search || ''}`;
    return normalized;
  } catch (_) {
    // If not a valid URL, fall back to trimmed string without trailing slash
    return v.endsWith('/') && v.length > 1 ? v.slice(0, -1) : v;
  }
}

// Global keyboard handling (Esc to close with confirm)
const onGlobalKeydown = (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
  }
};

// Overlay click guard: prevent close when pointer starts inside and ends outside
const startedInsideModal = ref(false);
const markStartedInside = () => { startedInsideModal.value = true; };
const onOverlayPointerDown = () => { startedInsideModal.value = false; };
const onOverlayClick = () => {
  if (startedInsideModal.value) {
    startedInsideModal.value = false;
    return; // ignore stray click after dragging out
  }
  closeModal();
};

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
  email.value = user.value?.email || '';
  endpoint.value = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
  isPrivate.value = !!(user.value?.private);
  const _contacts = (user.value?.contacts || []);
  notifyPrefs.value = {
    email: !!_contacts.find(c => c.type==='email' && c.notify),
    phone: !!_contacts.find(c => c.type==='phone' && c.notify),
    endpoint: !!_contacts.find(c => c.type==='endpoint' && c.notify)
  };
  errorMessage.value = '';
  tagError.value = '';
  displayNameError.value = '';
  phoneNumberError.value = '';
  emailError.value = '';
  noChangesMessage.value = '';
  emailCode.value = '';
  phoneCode.value = '';
  endpointVerificationMessage.value = '';
  verificationMessage.value = '';
  // Reset verification flow state
  emailCodeSent.value = false;
  phoneCodeSent.value = false;
  // Reset timers
  emailCooldown.value = 0;
  phoneCooldown.value = 0;
  if (emailCooldownTimerId) { clearInterval(emailCooldownTimerId); emailCooldownTimerId = null; }
  if (phoneCooldownTimerId) { clearInterval(phoneCooldownTimerId); phoneCooldownTimerId = null; }
  // No Key-Id in contract
  generatedSecret.value = '';
  hasJustRevealedSecret.value = false;
  secretError.value = '';
  // reset password visibility toggles
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  showConfirmPassword.value = false;
  // hide phone consent info by default
  showPhoneConsent.value = false;
};

onMounted(() => {
  resetForm();
  window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  if (emailCooldownTimerId) clearInterval(emailCooldownTimerId);
  if (phoneCooldownTimerId) clearInterval(phoneCooldownTimerId);
  window.removeEventListener('keydown', onGlobalKeydown);
});

// Hide consent info when phone number is cleared
watch(phoneNumber, (v) => {
  if (!v || !v.trim()) {
    showPhoneConsent.value = false;
  }
});

const validateTag = () => {
  tagError.value = '';
  if (!tag.value.trim()) {
    return true;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tag.value)) {
    tagError.value = 'Tag must contain only letters, numbers, underscores, and hyphens';
    return false;
  }
  if (tag.value.length < 1) {
    tagError.value = 'Tag must be at least 1 character long';
    return false;
  }
  return true;
};

const validatePhoneNumber = () => {
  phoneNumberError.value = '';
  if (!phoneNumber.value.trim()) {
    return true;
  }
  const digitsOnly = phoneNumber.value.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    phoneNumberError.value = 'Please enter a valid phone number';
    return false;
  }
  if (digitsOnly.length === 11 && digitsOnly[0] !== '1') {
    phoneNumberError.value = 'Please enter a valid US phone number';
    return false;
  }
  return true;
};

const validateEmail = () => {
  emailError.value = '';
  if (!email.value.trim()) {
    return true;
  }
  const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmail.test(email.value)) {
    emailError.value = 'Please enter a valid email';
    return false;
  }
  return true;
};

// Function to check if the form has any changes from the original user data (normalized)
const hasFormChanges = computed(() => {
  if (!user.value) return false;
  const originalDisplayName = user.value.displayName || '';
  const originalTag = user.value.user_tag || '';
  const originalPhoneNumber = user.value?.phone_number || '';
  const originalEmail = user.value?.email || '';
  const originalEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
  const originalPrivate = !!(user.value?.private);

  const displayNameChanged = normalizeTrimmed(displayName.value) !== normalizeTrimmed(originalDisplayName);
  const tagChanged = normalizeLowerTrimmed(tag.value) !== normalizeLowerTrimmed(originalTag);
  const phoneChanged = normalizePhoneForCompare(phoneNumber.value) !== normalizePhoneForCompare(originalPhoneNumber);
  const emailChanged = normalizeLowerTrimmed(email.value) !== normalizeLowerTrimmed(originalEmail);
  const endpointChanged = normalizeEndpointForCompare(endpoint.value) !== normalizeEndpointForCompare(originalEndpoint);
  const privateChanged = !!isPrivate.value !== originalPrivate;

  return displayNameChanged || tagChanged || phoneChanged || emailChanged || endpointChanged || privateChanged || notifyPrefsChanged();
});

// Function to determine if the update button should be enabled
const canSubmit = computed(() => {
  return !tagError.value && 
         !displayNameError.value && 
         !phoneNumberError.value &&
         !emailError.value &&
         !isSubmitting.value;
});

const validateForm = () => {
  let isValid = true;
  displayNameError.value = '';
  phoneNumberError.value = '';
  emailError.value = '';
  noChangesMessage.value = '';
  if (!hasFormChanges.value) {
    noChangesMessage.value = 'Make changes before updating';
    return false;
  }
  const originalPhoneNumber = user.value?.phone_number || '';
  const isPhoneNumberBeingCleared = originalPhoneNumber && !phoneNumber.value.trim();
  if (!displayName.value.trim() && !tag.value.trim() && !phoneNumber.value.trim() && !email.value.trim() && !isPhoneNumberBeingCleared) {
    errorMessage.value = 'Please fill at least one field';
    return false;
  }
  if (displayName.value.trim() && displayName.value.length > 50) {
    displayNameError.value = 'Display name should be less than 50 characters';
    isValid = false;
  }
  if (!validateTag()) {
    isValid = false;
  }
  if (!validatePhoneNumber()) {
    isValid = false;
  }
  if (!validateEmail()) {
    isValid = false;
  }
  // Endpoint: basic URL check if provided
  if (endpoint.value && endpoint.value.trim()) {
    try {
      new URL(endpoint.value.trim());
    } catch (_) {
      isValid = false;
    }
  }
  return isValid;
};

const notifyPrefsChanged = () => {
  const contacts = (user.value?.contacts || []);
  const orig = {
    email: !!contacts.find(c => c.type==='email' && c.notify),
    phone: !!contacts.find(c => c.type==='phone' && c.notify),
    endpoint: !!contacts.find(c => c.type==='endpoint' && c.notify)
  };
  return orig.email !== notifyPrefs.value.email || orig.phone !== notifyPrefs.value.phone || orig.endpoint !== notifyPrefs.value.endpoint;
};

const validateNewPassword = () => {
  const pw = newPassword.value || '';
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include a letter and a number';
  return '';
};

const submitPasswordChange = async () => {
  changePwError.value = '';
  changePwSuccess.value = '';
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    changePwError.value = 'All password fields are required';
    return;
  }
  const policyErr = validateNewPassword();
  if (policyErr) {
    changePwError.value = policyErr;
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    changePwError.value = 'New passwords do not match';
    return;
  }
  try {
    changePwBusy.value = true;
    await changePassword({ current_password: currentPassword.value, new_password: newPassword.value });
    changePwSuccess.value = 'Password changed successfully';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (e) {
    changePwError.value = e.message || 'Failed to change password';
  } finally {
    changePwBusy.value = false;
  }
};

const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    if (!hasFormChanges.value) {
      // Treat Enter as Done when no changes
      e.preventDefault();
      closeModal();
      return;
    }
    if (!canSubmit.value) {
      e.preventDefault();
      if (!hasFormChanges.value) {
        noChangesMessage.value = 'Make changes before updating';
      }
      return;
    }
    updateProfile();
  }
};

const updateProfile = async () => {
  try {
    if (!validateForm()) {
      return;
    }
    isSubmitting.value = true;
    errorMessage.value = '';
    noChangesMessage.value = '';
    const profileUpdate = {};
    const originalPhoneNumber = user.value?.phone_number || '';
    const originalEmail = user.value?.email || '';
    const originalEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
    const originalPrivate = !!(user.value?.private);

    // Only include changed fields (normalized)
    if (normalizeTrimmed(displayName.value) !== normalizeTrimmed(user.value?.displayName || '')) {
      profileUpdate.display_name = normalizeTrimmed(displayName.value);
    }
    if (normalizeLowerTrimmed(tag.value) !== normalizeLowerTrimmed(user.value?.user_tag || '')) {
      profileUpdate.user_tag = normalizeTrimmed(tag.value);
    }
    if (normalizePhoneForCompare(phoneNumber.value) !== normalizePhoneForCompare(originalPhoneNumber)) {
      const trimmed = normalizeTrimmed(phoneNumber.value);
      profileUpdate.phone_number = trimmed || null;
    }
    if (normalizeLowerTrimmed(email.value) !== normalizeLowerTrimmed(originalEmail)) {
      const trimmed = normalizeTrimmed(email.value);
      profileUpdate.email = trimmed || null;
    }
    if (normalizeEndpointForCompare(endpoint.value) !== normalizeEndpointForCompare(originalEndpoint)) {
      const trimmed = normalizeTrimmed(endpoint.value);
      profileUpdate.endpoint = trimmed || null;
    }
    if (!!isPrivate.value !== originalPrivate) {
      profileUpdate.private = !!isPrivate.value;
    }
    if (notifyPrefsChanged()) {
      profileUpdate.notify = { ...notifyPrefs.value };
    }
    await store.dispatch('auth/updateProfile', profileUpdate);
    // Keep modal open after successful update; refresh form with saved data
    resetForm();
    // Show transient success state on the Update button
    updateSuccess.value = true;
    setTimeout(() => { updateSuccess.value = false; }, 1800);
  } catch (error) {
    const code = error && error.message;
    if (code === 'user_tag_conflict') {
      tagError.value = 'That tag is already taken';
      errorMessage.value = '';
    } else if (code === 'email_conflict') {
      emailError.value = 'That email is already in use';
      errorMessage.value = '';
    } else if (code === 'phone_conflict') {
      phoneNumberError.value = 'That phone number is already in use';
      errorMessage.value = '';
    } else if (code === 'multiple_emails_not_allowed') {
      emailError.value = 'Only one email is allowed per account';
      errorMessage.value = '';
    } else if (code === 'multiple_phones_not_allowed') {
      phoneNumberError.value = 'Only one phone number is allowed per account';
      errorMessage.value = '';
    } else if (code === 'multiple_endpoints_not_allowed') {
      errorMessage.value = 'Only one endpoint is allowed per account';
    } else if (code === 'managed_contacts_endpoints_only') {
      errorMessage.value = 'Managed users may only have an endpoint contact';
    } else {
      errorMessage.value = code || 'Failed to update profile';
    }
  } finally {
    isSubmitting.value = false;
  }
};

// Verification handlers
const sendEmailCode = async () => {
  verificationMessage.value = '';
  if (!validateEmail() || !email.value.trim()) {
    emailError.value = emailError.value || 'Enter a valid email first';
    return;
  }
  try {
    requestingEmailCode.value = true;
    await requestEmailVerification(email.value.trim());
    verificationMessage.value = 'Verification code sent to email';
    emailCodeSent.value = true;
    // start cooldown
    if (emailCooldownTimerId) { clearInterval(emailCooldownTimerId); emailCooldownTimerId = null; }
    emailCooldown.value = 60;
    emailCooldownTimerId = setInterval(() => {
      if (emailCooldown.value > 0) {
        emailCooldown.value -= 1;
      } else {
        clearInterval(emailCooldownTimerId);
        emailCooldownTimerId = null;
      }
    }, 1000);
  } catch (e) {
    verificationMessage.value = e.message || 'Failed to send email code';
  } finally {
    requestingEmailCode.value = false;
  }
};

const confirmEmailCode = async () => {
  verificationMessage.value = '';
  if (!email.value.trim() || !emailCode.value.trim()) {
    verificationMessage.value = 'Enter your email and the received code';
    return;
  }
  try {
    verifyingEmail.value = true;
    await verifyEmailWithCode({ email: email.value.trim(), code: emailCode.value.trim() });
    verificationMessage.value = 'Email verified';
    emailCode.value = '';
  } catch (e) {
    verificationMessage.value = e.message || 'Failed to verify email';
  } finally {
    verifyingEmail.value = false;
  }
};

const sendPhoneCode = async () => {
  verificationMessage.value = '';
  if (!validatePhoneNumber() || !phoneNumber.value.trim()) {
    phoneNumberError.value = phoneNumberError.value || 'Enter a valid phone first';
    return;
  }
  try {
    requestingPhoneCode.value = true;
    await requestPhoneVerification(phoneNumber.value.trim());
    verificationMessage.value = 'Verification code sent to phone';
    phoneCodeSent.value = true;
    // start cooldown
    if (phoneCooldownTimerId) { clearInterval(phoneCooldownTimerId); phoneCooldownTimerId = null; }
    phoneCooldown.value = 60;
    phoneCooldownTimerId = setInterval(() => {
      if (phoneCooldown.value > 0) {
        phoneCooldown.value -= 1;
      } else {
        clearInterval(phoneCooldownTimerId);
        phoneCooldownTimerId = null;
      }
    }, 1000);
  } catch (e) {
    verificationMessage.value = e.message || 'Failed to send phone code';
  } finally {
    requestingPhoneCode.value = false;
  }
};
// Endpoint verification handlers
const requestingEndpointCode = ref(false);
const verifyingEndpoint = ref(false);

const verifyEndpointFlow = async () => {
  endpointVerificationMessage.value = '';
  try {
    if (!endpoint.value || !endpoint.value.trim()) {
      endpointVerificationMessage.value = 'Enter an endpoint URL first';
      return;
    }
    verifyingEndpoint.value = true;
    // Step 1: create challenge
    await requestEndpointChallenge(endpoint.value.trim());
    // Step 2: attempt verification by echo
    await verifyEndpointWithChallenge({ endpoint: endpoint.value.trim() });
    endpointVerificationMessage.value = 'Endpoint verified';
    // Auto-enable notify on successful verification
    notifyPrefs.value.endpoint = true;
  } catch (e) {
    endpointVerificationMessage.value = e.message || 'Failed to verify endpoint';
  } finally {
    verifyingEndpoint.value = false;
  }
};

const confirmPhoneCode = async () => {
  verificationMessage.value = '';
  if (!phoneNumber.value.trim() || !phoneCode.value.trim()) {
    verificationMessage.value = 'Enter your phone and the received code';
    return;
  }
  try {
    verifyingPhone.value = true;
    await verifyPhoneWithCode({ phone: phoneNumber.value.trim(), code: phoneCode.value.trim() });
    verificationMessage.value = 'Phone verified';
    phoneCode.value = '';
  } catch (e) {
    verificationMessage.value = e.message || 'Failed to verify phone';
  } finally {
    verifyingPhone.value = false;
  }
};

const closeModal = () => {
  // If there are unsaved changes, show confirm prompt instead of closing immediately
  if (hasFormChanges.value) {
    showUnsavedConfirm.value = true;
    return;
  }
  emit('close');
};

// Unsaved-changes confirmation state and handlers
const showUnsavedConfirm = ref(false);
const confirmClose = () => {
  showUnsavedConfirm.value = false;
  emit('close');
};
const cancelClose = () => {
  showUnsavedConfirm.value = false;
};

// Delete account (simple)
const deleteBusy = ref(false);
const deleteError = ref('');
const deleteAccount = async () => {
  if (deleteBusy.value) return;
  deleteError.value = '';
  if (!window.confirm('This will permanently delete your account. Continue?')) return;
  try {
    deleteBusy.value = true;
    await store.dispatch('auth/deleteOwnAccount');
    emit('close');
  } catch (e) {
    deleteError.value = e.message || 'Failed to delete account';
  } finally {
    deleteBusy.value = false;
  }
};
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @pointerdown="onOverlayPointerDown" @click.self="onOverlayClick">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Edit Profile</h3>
          <button class="close-button" @click="closeModal">×</button>
        </div>
        
        <div class="modal-content">
          <div class="form-group">
            <div class="form-row">
              <label for="displayName">Display Name</label>
              <input 
                id="displayName" 
                v-model="displayName" 
                type="text" 
                placeholder="Your public display name"
                @keydown="handleKeydown"
              />
            </div>
            <div class="field-error" v-if="displayNameError">{{ displayNameError }}</div>
            <div v-else class="field-hint">This name will be visible to everyone</div>
          </div>
          
          <div class="form-group">
            <div class="form-row">
              <label for="tag">Tag</label>
              <input 
                id="tag" 
                v-model="tag" 
                type="text" 
                placeholder="Your unique tag"
                @keydown="handleKeydown"
                @blur="validateTag"
              />
            </div>
            <div class="field-error" v-if="tagError">{{ tagError }}</div>
            <div v-else class="field-hint">A unique identifier for your account (letters, numbers, underscores, and hyphens only)</div>
          </div>

          <!-- Privacy settings moved to first section -->
          <div class="form-group">
            <div class="form-row privacy-row">
              <label style="min-width:auto;">Privacy</label>
              <label class="notify-toggle">
                <input type="checkbox" v-model="isPrivate" />
                <span class="notify-text">Private account</span>
              </label>
            </div>
            <div class="field-hint">Private profiles are visible only to users you follow or manage, or who follow or manage you.</div>
          </div>

          <div class="form-group contact-section" v-if="!isManaged">
            <div class="form-row">
              <label for="email">Email</label>
              <div class="control">
                <input 
                  id="email" 
                  v-model="email" 
                  type="email" 
                  placeholder="you@example.com"
                  :disabled="user?.is_managed"
                  @keydown="handleKeydown"
                  @blur="validateEmail"
                />
                <div class="notify-group">
                  <label class="notify-toggle" :class="{ disabled: !isEmailVerified || user?.is_managed }">
                    <input type="checkbox" v-model="notifyPrefs.email" :disabled="!isEmailVerified || user?.is_managed" /><span class="notify-text">Notify</span>
                  </label>
                  <span v-if="isEmailVerified" class="status-badge ok">Verified</span>
                </div>
              </div>
            </div>
            <div class="field-error" v-if="emailError">{{ emailError }}</div>
            <div class="verify-row warn" v-if="!isEmailVerified && hasSavedEmail">
              <span class="verify-label">Unverified</span>
              <button class="verify-btn" @click="sendEmailCode" :disabled="requestingEmailCode || emailCooldown > 0">{{ requestingEmailCode ? 'Sending…' : (emailCooldown > 0 ? `Resend in ${emailCooldown}s` : 'Send Code') }}</button>
              <input class="code-input" v-model="emailCode" placeholder="Enter code" />
              <button class="verify-btn" v-if="emailCodeSent" @click="confirmEmailCode" :disabled="verifyingEmail || !emailCode.trim()">{{ verifyingEmail ? 'Verifying…' : 'Verify' }}</button>
            </div>
          </div>

          
          
          <div class="form-group contact-section" v-if="!isManaged">
            <div class="form-row">
              <label for="phoneNumber">Phone Number</label>
              <div class="control">
                <div class="input-with-icon">
                  <input 
                    id="phoneNumber" 
                    v-model="phoneNumber" 
                    type="tel" 
                    placeholder="(555) 123-4567"
                    :disabled="user?.is_managed"
                    @keydown="handleKeydown"
                    @blur="validatePhoneNumber"
                  />
                  <button type="button" class="info-btn" @click="showPhoneConsent = !showPhoneConsent" :aria-pressed="showPhoneConsent ? 'true' : 'false'" title="SMS consent details">ⓘ</button>
                </div>
                <div class="notify-group">
                  <label class="notify-toggle" :class="{ disabled: !isPhoneVerified || !isEmailVerified || user?.is_managed }">
                    <input type="checkbox" v-model="notifyPrefs.phone" :disabled="!isPhoneVerified || !isEmailVerified || user?.is_managed" /><span class="notify-text">Notify</span>
                  </label>
                  <span v-if="isPhoneVerified" class="status-badge ok">Verified</span>
                </div>
              </div>
            </div>
            <div class="field-error" v-if="phoneNumberError">{{ phoneNumberError }}</div>
            <div class="verify-row warn" v-if="!isPhoneVerified && hasSavedPhone">
              <span class="verify-label">Unverified</span>
              <button class="verify-btn" @click="sendPhoneCode" :disabled="requestingPhoneCode || phoneCooldown > 0">{{ requestingPhoneCode ? 'Sending…' : (phoneCooldown > 0 ? `Resend in ${phoneCooldown}s` : 'Send Code') }}</button>
              <input class="code-input" v-model="phoneCode" placeholder="Enter code" />
              <button class="verify-btn" v-if="phoneCodeSent" @click="confirmPhoneCode" :disabled="verifyingPhone || !phoneCode.trim()">{{ verifyingPhone ? 'Verifying…' : 'Verify' }}</button>
            </div>
            <div v-if="showPhoneConsent && phoneNumber.trim()" class="consent-message">
              <p>By providing your phone number, you agree to receive text messages from Stitch at the number provided. Message and data rates may apply. Message frequency varies. To opt-out, remove your phone number here. View our Terms of Service and Privacy Policy at <a href="https://stitch.fyi/terms" target="_blank" rel="noopener noreferrer">stitch.fyi/terms</a>.</p>
            </div>
          </div>

          <div class="form-group contact-section">
            <div class="form-row">
              <label for="endpoint">Webhook Endpoint</label>
              <div class="control">
                <input 
                  id="endpoint" 
                  v-model="endpoint" 
                  type="url" 
                  placeholder="https://bot.example.com/hook"
                  @keydown="handleKeydown"
                />
                <div class="notify-group">
                  <label class="notify-toggle" :class="{ disabled: !isEndpointVerified || (!isEmailVerified && !isManaged) }">
                    <input type="checkbox" v-model="notifyPrefs.endpoint" :disabled="!isEndpointVerified || (!isEmailVerified && !isManaged)" /><span class="notify-text">Notify</span>
                  </label>
                  <span v-if="isEndpointVerified" class="status-badge ok">Verified</span>
                </div>
              </div>
            </div>
            <div class="verify-row warn" v-if="!isEndpointVerified && hasSavedEndpoint"> 
              <span class="verify-label">Unverified</span>
              <button class="verify-btn" @click="verifyEndpointFlow" :disabled="verifyingEndpoint || !endpoint">{{ verifyingEndpoint ? 'Verifying…' : 'Verify' }}</button>
              <span class="verify-tip" title="We POST a nonce to your endpoint; it must echo it back as JSON {nonce: '...'} or plaintext.">Your server must echo the posted nonce (JSON {nonce:"..."} or plaintext).</span>
            </div>
            <div class="verification-message" v-if="endpointVerificationMessage">{{ endpointVerificationMessage }}</div>

            <!-- Endpoint Signing Secret (write-only) -->
            
            <div class="form-row" style="margin-top: 8px; align-items: center;">
              <label>Endpoint Signing Secret</label>
              <div style="display:flex; gap:8px; align-items:center; width:100%;">
                <button class="update-btn" @click="setOrRotateSigningSecret" :disabled="secretBusy || !isEndpointVerified">
                  <div class="button-inner">
                    <div v-if="secretBusy" class="spinner"></div>
                    {{ secretBusy ? 'Saving…' : (hasSavedEndpoint ? 'Rotate Secret' : 'Create Secret') }}
                  </div>
                </button>
                <span v-if="hasEndpointSigningSecret" class="verified-badge" title="Signing secret exists">✓</span>
                <span class="field-hint" v-if="!isEndpointVerified">Verify endpoint to enable</span>
              </div>
            </div>
            <div v-if="hasJustRevealedSecret" class="verify-row" style="margin-top:8px;">
              <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <span class="verify-label">Copy your secret now (shown once):</span>
                  <button class="verify-btn" @click="copyRevealedSecret">Copy</button>
                  <button class="verify-btn" @click="dismissRevealedSecret">Dismiss</button>
                </div>
                <input readonly :value="generatedSecret" style="font-family: monospace;" />
                <div class="field-hint">This value is write-only and cannot be viewed again after dismissal.</div>
                <div class="field-hint">Requests will include headers X-Stitch-Timestamp and X-Stitch-Signature.</div>
                <div class="field-error" v-if="secretError">{{ secretError }}</div>
              </div>
            </div>
          </div>

        <hr />

          <div class="verification-message" v-if="verificationMessage">{{ verificationMessage }}</div>

          <!-- Change Password Section -->
          <div class="form-group" v-if="!isManaged">
            <h4 style="margin: 0 0 8px 0;">Change Password</h4>
            <div class="form-row">
              <label for="currentPassword">Current password</label>
              <div class="password-field">
                <input id="currentPassword" :type="showCurrentPassword ? 'text' : 'password'" v-model="currentPassword" placeholder="••••••••" />
                <button type="button" class="eye-toggle" @click="showCurrentPassword = !showCurrentPassword" :aria-pressed="showCurrentPassword ? 'true' : 'false'" :title="showCurrentPassword ? 'Hide password' : 'Show password'">{{ showCurrentPassword ? '🙈' : '👁️' }}</button>
              </div>
            </div>
            <div class="form-row" style="margin-top: 8px;">
              <label for="newPassword">New password</label>
              <div class="password-field">
                <input id="newPassword" :type="showNewPassword ? 'text' : 'password'" v-model="newPassword" placeholder="••••••••" />
                <button type="button" class="eye-toggle" @click="showNewPassword = !showNewPassword" :aria-pressed="showNewPassword ? 'true' : 'false'" :title="showNewPassword ? 'Hide password' : 'Show password'">{{ showNewPassword ? '🙈' : '👁️' }}</button>
              </div>
            </div>
            <div class="form-row" style="margin-top: 8px;">
              <label for="confirmPassword">Confirm new</label>
              <div class="password-field">
                <input id="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" v-model="confirmPassword" placeholder="••••••••" />
                <button type="button" class="eye-toggle" @click="showConfirmPassword = !showConfirmPassword" :aria-pressed="showConfirmPassword ? 'true' : 'false'" :title="showConfirmPassword ? 'Hide password' : 'Show password'">{{ showConfirmPassword ? '🙈' : '👁️' }}</button>
              </div>
            </div>
            <div class="field-hint">Minimum 8 characters, must include a letter and a number.</div>
            <div class="field-error" v-if="changePwError">{{ changePwError }}</div>
            <div class="field-hint" v-if="changePwSuccess" style="color: var(--color-success, #10b981);">{{ changePwSuccess }}</div>
            <div style="display:flex; justify-content:flex-end; margin-top: 10px;">
              <button class="update-btn" @click="submitPasswordChange" :disabled="changePwBusy">
                <div class="button-inner">
                  <div v-if="changePwBusy" class="spinner"></div>
                  {{ changePwBusy ? 'Updating...' : 'Change Password' }}
                </div>
              </button>
            </div>
          </div>
          
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <!-- Danger Zone (simple) -->
          <div class="form-group" style="border-top:1px solid var(--color-border); padding-top: var(--space-sm); margin-top: 16px;">
            <h4 style="margin: 0 0 8px 0; color: var(--color-error);">Danger zone</h4>
            <div class="field-hint">Deleting your account is permanent and cannot be undone.</div>
            <div class="field-error" v-if="deleteError" style="margin-top: 6px;">{{ deleteError }}</div>
            <div style="display:flex; justify-content:flex-end; margin-top: 10px;">
              <button class="update-btn" :disabled="deleteBusy" style="background: #ef4444;" @click="deleteAccount">
                <div class="button-inner">
                  <div v-if="deleteBusy" class="spinner"></div>
                  {{ deleteBusy ? 'Deleting…' : 'Delete account' }}
                </div>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="error-message footer-message" v-if="noChangesMessage">
            <span>{{ noChangesMessage }}</span>
          </div>
          <div class="button-group">
            <button class="cancel-btn" @click="closeModal" :disabled="isSubmitting">{{ hasFormChanges ? 'Cancel' : 'Done' }}</button>
            <button v-if="hasFormChanges" class="update-btn" :class="{ success: updateSuccess }" @click="updateProfile" :disabled="!canSubmit">
              <div class="button-inner">
                <div v-if="isSubmitting" class="spinner"></div>
                <span v-else-if="updateSuccess" class="checkmark">✓</span>
                {{ isSubmitting ? 'Saving…' : (updateSuccess ? 'Saved' : 'Save Changes') }}
              </div>
            </button>
          </div>
        </div>
        <DevModal :isOpen="showApiKeysModal" @close="() => { showApiKeysModal = false }" />
        
        <!-- Unsaved changes confirmation -->
        <div v-if="showUnsavedConfirm" class="confirm-overlay" @click.self="confirmClose">
          <div class="confirm-card">
            <div class="confirm-title">Discard changes?</div>
            <div class="confirm-text">You have unsaved changes. Are you sure you want to close?</div>
            <div class="confirm-actions">
              <button class="cancel-btn" @click="cancelClose">Cancel</button>
              <button class="update-btn" @click="confirmClose">Close without saving</button>
            </div>
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
  width: 92%;
  max-width: 560px;
  max-height: 82vh;
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

.password-field { position: relative; display: grid; grid-template-columns: 1fr auto; align-items: center; }
.password-field input { padding-right: 36px; }
.eye-toggle { margin-left: 6px; background: transparent; border: 1px solid var(--color-border); color: var(--color-text); border-radius: var(--radius-sm); cursor: pointer; padding: 6px 8px; font-size: 14px; }
.eye-toggle:hover { background: var(--color-hover-overlay); }

.form-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.form-row label {
  min-width: 140px;
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
  margin-top: var(--space-md);
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

.info-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
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

.update-btn.success {
  background-color: var(--color-success, #10b981);
}

.update-btn.success:hover:not(:disabled) {
  background-color: #0ea371;
}

.checkmark { font-weight: 700; margin-right: 6px; }

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.verify-row { display: flex; gap: 8px; align-items: center; margin-top: 16px; margin-bottom: 0px; padding: 8px 10px; border-radius: 8px; }
.verify-row.warn { background: rgba(234, 179, 8, 0.10); border: 1px solid rgba(234,179,8,0.35); }
.verify-label { font-size: 12px; font-weight: 600; color: #b45309; }
.verify-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.code-input { max-width: 120px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-input-background); color: var(--color-text); }
.verification-message { font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 6px 0; }
.verified-badge { color: var(--color-success, #10b981); margin-left: 6px; font-size: 14px; }
.notify-group { display: inline-flex; align-items: center; gap: 8px; }
.notify-toggle { display:inline-grid; grid-auto-flow: column; align-items:center; column-gap: 6px; font-size: 12px; padding: 2px 4px; }
.notify-toggle input[type="checkbox"] { margin: 0; padding: 0; }
.notify-text { display: inline-block; line-height: 1; }
.notify-toggle.disabled { opacity: 0.6; }
.control { display:flex; align-items:center; gap: 8px; width: 100%; }
.input-with-icon { display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr auto; align-items: center; gap: 6px; width: 100%; }
.status-badge { font-size: 11px; padding: 2px 6px; border-radius: 10px; border: 1px solid var(--color-border); color: var(--color-text-secondary); }
.status-badge.ok { background: rgba(16, 185, 129, 0.12); color: var(--color-success, #10b981); border-color: rgba(16,185,129,0.35); }
.status-badge.warn { background: rgba(234, 179, 8, 0.12); color: #eab308; border-color: rgba(234,179,8,0.35); }
.verify-tip { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.contact-section { border-top: 1px solid var(--color-border); padding-top: var(--space-sm); margin-top: 16px; }
.form-row { margin-top: 12px; }

.privacy-row { align-items: center; justify-content: space-between; }
/* Ensure the privacy toggle doesn't inherit the generic 140px label min-width */
.privacy-row label.notify-toggle { min-width: 0; width: auto; }
@media (max-width: 600px) {
  .privacy-row { justify-content: flex-start; gap: 12px; }
}

/* Unsaved changes confirmation styles */
.confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: calc(var(--z-index-modal) + 1); }
.confirm-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; width: 92%; max-width: 420px; box-shadow: var(--color-card-shadow); }
.confirm-title { font-weight: 600; margin-bottom: 6px; }
.confirm-text { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: 12px; }
.confirm-actions { display: flex; gap: 12px; justify-content: flex-end; }
@media (max-width: 600px) {
  .modal-container { width: 96%; max-width: 560px; max-height: 86vh; }
  .form-row { flex-direction: column; align-items: stretch; gap: 6px; }
  .form-row label { min-width: 0; width: 100%; }
  .control { flex-direction: column; align-items: stretch; gap: 6px; }
  .input-with-icon { width: 100%; }
  .notify-group { align-self: flex-start; width: auto; }
  .status-badge { align-self: flex-start; }
  .notify-toggle { align-self: flex-start; width: auto; }
  .verify-row { align-items: flex-start; flex-wrap: wrap; }
  .code-input { max-width: 100%; }
}
</style> 