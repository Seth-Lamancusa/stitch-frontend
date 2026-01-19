<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useAuthentication } from '@/composables/useAuthentication';
import DevModal from '@/components/modals/DevModal.vue';
import UserDisplay from '../common/UserDisplay.vue';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

const store = useStore();
const user = computed(() => store.getters['auth/user']);
const isManaged = computed(() => !!(user.value && user.value.is_managed));
const activePrincipalUid = computed(() => store.getters['auth/activePrincipalUid']);
const managerUid = computed(() => store.getters['auth/managerUid']);
const isDelegatedToManagedUser = computed(() => {
  // Check if we're in a delegated session acting as a managed user
  // This happens when activePrincipalUid !== managerUid and we're viewing that managed user's profile
  return activePrincipalUid.value && 
         managerUid.value && 
         activePrincipalUid.value !== managerUid.value &&
         user.value &&
         activePrincipalUid.value === user.value.uid;
});

const BIO_MAX_LENGTH = 500;

const displayName = ref('');
const tag = ref('');
const phoneNumber = ref('');
const email = ref('');
const bio = ref('');
const endpoint = ref('');
const isPrivate = ref(false);
const isBot = ref(false);
const inputModalities = ref('');
const outputModalities = ref('');
const thirdPartyIntegrations = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const tagError = ref('');
const displayNameError = ref('');
const phoneNumberError = ref('');
const emailError = ref('');
const bioError = ref('');
const botCapabilitiesError = ref('');
const noChangesMessage = ref('');
const updateSuccess = ref(false);
const updateError = ref(false);

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
    loadManagersAndManagedUsers();
  }
});

const resetForm = () => {
  displayName.value = user.value?.displayName || '';
  tag.value = user.value?.user_tag || '';
  phoneNumber.value = user.value?.phone_number || '';
  email.value = user.value?.email || '';
  bio.value = user.value?.bio || '';
  endpoint.value = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
  isPrivate.value = !!(user.value?.private);
  isBot.value = !!(user.value?.is_bot);
  inputModalities.value = user.value?.input_modalities || '';
  outputModalities.value = user.value?.output_modalities || '';
  thirdPartyIntegrations.value = user.value?.third_party_integrations || '';
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
  bioError.value = '';
  botCapabilitiesError.value = '';
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
  // reset password visibility toggles
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  showConfirmPassword.value = false;
  // hide phone consent info by default
  showPhoneConsent.value = false;
  // Reset convert to managed user state
  managerSearchQuery.value = '';
  managerSearchResults.value = [];
  showManagerSearchResults.value = false;
  isSearchingManager.value = false;
  hasSearchedManager.value = false;
  isManagerValid.value = null;
  selectedManager.value = null;
  convertToManagedError.value = '';
  convertToManagedSuccess.value = '';
  if (managerSearchTimeout) { clearTimeout(managerSearchTimeout); managerSearchTimeout = null; }
  // Reset add manager state
  addManagerSearchQuery.value = '';
  addManagerSearchResults.value = [];
  showAddManagerSearchResults.value = false;
  isSearchingAddManager.value = false;
  hasSearchedAddManager.value = false;
  isAddManagerValid.value = null;
  selectedAddManager.value = null;
  addManagerError.value = '';
  addManagerSuccess.value = '';
  if (addManagerSearchTimeout) { clearTimeout(addManagerSearchTimeout); addManagerSearchTimeout = null; }
};

onMounted(() => {
  resetForm();
  window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  if (emailCooldownTimerId) clearInterval(emailCooldownTimerId);
  if (phoneCooldownTimerId) clearInterval(phoneCooldownTimerId);
  if (managerSearchTimeout) clearTimeout(managerSearchTimeout);
  if (addManagerSearchTimeout) clearTimeout(addManagerSearchTimeout);
  window.removeEventListener('keydown', onGlobalKeydown);
});

// Hide consent info when phone number is cleared
watch(phoneNumber, (v) => {
  if (!v || !v.trim()) {
    showPhoneConsent.value = false;
  }
});

watch(isBot, (value) => {
  if (!value) {
    botCapabilitiesError.value = '';
  }
});

const validateTag = () => {
  tagError.value = '';
  if (!tag.value.trim()) {
    return true;
  }
  if (tag.value.length < 2) {
    tagError.value = 'Tag must be at least 2 characters long';
    return false;
  }
  if (tag.value.length > 24) {
    tagError.value = 'Tag must be no more than 24 characters long';
    return false;
  }
  if (!/^[a-zA-Z0-9-]+$/.test(tag.value)) {
    tagError.value = 'Tag must contain only letters, numbers, and hyphens';
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
  const originalBio = user.value?.bio || '';
  const originalInputModalities = user.value?.input_modalities || '';
  const originalOutputModalities = user.value?.output_modalities || '';
  const originalThirdPartyIntegrations = user.value?.third_party_integrations || '';

  const displayNameChanged = normalizeTrimmed(displayName.value) !== normalizeTrimmed(originalDisplayName);
  const tagChanged = normalizeLowerTrimmed(tag.value) !== normalizeLowerTrimmed(originalTag);
  const phoneChanged = normalizePhoneForCompare(phoneNumber.value) !== normalizePhoneForCompare(originalPhoneNumber);
  const emailChanged = normalizeLowerTrimmed(email.value) !== normalizeLowerTrimmed(originalEmail);
  const endpointChanged = normalizeEndpointForCompare(endpoint.value) !== normalizeEndpointForCompare(originalEndpoint);
  const privateChanged = !!isPrivate.value !== originalPrivate;
  const bioChanged = normalizeTrimmed(bio.value) !== normalizeTrimmed(originalBio);
  const botChanged = !!isBot.value !== !!(user.value?.is_bot);
  const inputModalitiesChanged = normalizeTrimmed(inputModalities.value) !== normalizeTrimmed(originalInputModalities);
  const outputModalitiesChanged = normalizeTrimmed(outputModalities.value) !== normalizeTrimmed(originalOutputModalities);
  const thirdPartyIntegrationsChanged = normalizeTrimmed(thirdPartyIntegrations.value) !== normalizeTrimmed(originalThirdPartyIntegrations);

  return displayNameChanged || tagChanged || phoneChanged || emailChanged || endpointChanged || privateChanged || bioChanged || botChanged || inputModalitiesChanged || outputModalitiesChanged || thirdPartyIntegrationsChanged || notifyPrefsChanged();
});

// Function to determine if the update button should be enabled
const canSubmit = computed(() => {
  return !tagError.value && 
         !displayNameError.value && 
         !phoneNumberError.value &&
         !emailError.value &&
         !bioError.value &&
         !isSubmitting.value;
});

const validateForm = () => {
  let isValid = true;
  displayNameError.value = '';
  phoneNumberError.value = '';
  emailError.value = '';
  bioError.value = '';
  botCapabilitiesError.value = '';
  noChangesMessage.value = '';
  if (!hasFormChanges.value) {
    noChangesMessage.value = 'Make changes before updating';
    return false;
  }
  const originalPhoneNumber = user.value?.phone_number || '';
  const isPhoneNumberBeingCleared = originalPhoneNumber && !phoneNumber.value.trim();
  const originalBio = user.value?.bio || '';
  const bioChanged = normalizeTrimmed(bio.value) !== normalizeTrimmed(originalBio);
  const botChanged = !!isBot.value !== !!(user.value?.is_bot);
  if (!displayName.value.trim() && !tag.value.trim() && !phoneNumber.value.trim() && !email.value.trim() && !bio.value.trim() && !isPhoneNumberBeingCleared && !bioChanged && !botChanged) {
    errorMessage.value = 'Please fill at least one field';
    return false;
  }
  if (displayName.value.trim() && displayName.value.length > 50) {
    displayNameError.value = 'Display name should be less than 50 characters';
    isValid = false;
  }
  if (bio.value && bio.value.length > BIO_MAX_LENGTH) {
    bioError.value = `Bio must be ${BIO_MAX_LENGTH} characters or less`;
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
    const hasCapabilityValues = !!(normalizeTrimmed(inputModalities.value) || normalizeTrimmed(outputModalities.value) || normalizeTrimmed(thirdPartyIntegrations.value));
    if (!isBot.value && hasCapabilityValues) {
    botCapabilitiesError.value = 'Enable the bot toggle to describe capabilities.';
    isValid = false;
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
  let profileUpdate = {};
  try {
    if (!validateForm()) {
      return;
    }
    isSubmitting.value = true;
    errorMessage.value = '';
    noChangesMessage.value = '';
    profileUpdate = {};
    const originalPhoneNumber = user.value?.phone_number || '';
    const originalEmail = user.value?.email || '';
    const originalBio = user.value?.bio || '';
    const originalEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
    const originalPrivate = !!(user.value?.private);
    const originalInputModalities = user.value?.input_modalities || '';
    const originalOutputModalities = user.value?.output_modalities || '';
    const originalThirdPartyIntegrations = user.value?.third_party_integrations || '';

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
    if (normalizeTrimmed(bio.value) !== normalizeTrimmed(originalBio)) {
      const trimmedBio = normalizeTrimmed(bio.value);
      profileUpdate.bio = trimmedBio || null;
    }
    if (!!isPrivate.value !== originalPrivate) {
      profileUpdate.private = !!isPrivate.value;
    }
    if (!!isBot.value !== !!(user.value?.is_bot)) {
      profileUpdate.is_bot = !!isBot.value;
    }
    if (normalizeTrimmed(inputModalities.value) !== normalizeTrimmed(originalInputModalities)) {
      const trimmed = normalizeTrimmed(inputModalities.value);
      profileUpdate.input_modalities = trimmed || null;
    }
    if (normalizeTrimmed(outputModalities.value) !== normalizeTrimmed(originalOutputModalities)) {
      const trimmed = normalizeTrimmed(outputModalities.value);
      profileUpdate.output_modalities = trimmed || null;
    }
    if (normalizeTrimmed(thirdPartyIntegrations.value) !== normalizeTrimmed(originalThirdPartyIntegrations)) {
      const trimmed = normalizeTrimmed(thirdPartyIntegrations.value);
      profileUpdate.third_party_integrations = trimmed || null;
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
    if (code === 'bio_too_long') {
      bioError.value = `Bio must be ${BIO_MAX_LENGTH} characters or less`;
      errorMessage.value = '';
    } else if (code === 'invalid_bio') {
      bioError.value = 'Bio must be plain text';
      errorMessage.value = '';
    } else if (code === 'invalid_is_bot') {
      errorMessage.value = 'Invalid bot flag value';
    } else if (code === 'bot_fields_require_is_bot') {
      botCapabilitiesError.value = 'Enable the bot toggle before setting bot capabilities.';
      errorMessage.value = '';
    } else if (code === 'invalid_input_modalities') {
      botCapabilitiesError.value = 'Enter input modalities as a comma-separated list (e.g., "txt, png").';
      errorMessage.value = '';
    } else if (code === 'invalid_output_modalities') {
      botCapabilitiesError.value = 'Enter output modalities as a comma-separated list.';
      errorMessage.value = '';
    } else if (code === 'invalid_third_party_integrations') {
      botCapabilitiesError.value = 'Enter a valid integration name.';
      errorMessage.value = '';
    } else if (code === 'user_tag_conflict') {
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
    } else if (code && code.includes && code.includes('status code 409')) {
      // Friendly fallback when backend didn't return a specific conflict code
      if (Object.prototype.hasOwnProperty.call(profileUpdate, 'email')) {
        emailError.value = 'That email is already in use';
        errorMessage.value = '';
      } else if (Object.prototype.hasOwnProperty.call(profileUpdate, 'phone_number')) {
        phoneNumberError.value = 'That phone number is already in use';
        errorMessage.value = '';
      } else if (Object.prototype.hasOwnProperty.call(profileUpdate, 'user_tag')) {
        tagError.value = 'That tag is already taken';
        errorMessage.value = '';
      } else if (Object.prototype.hasOwnProperty.call(profileUpdate, 'bio')) {
        bioError.value = 'That bio value is not allowed';
        errorMessage.value = '';
      } else {
        errorMessage.value = 'That value is already in use';
      }
    } else {
      errorMessage.value = code || 'Failed to update profile';
    }
    // Flash error state on the Save Changes button
    updateError.value = true;
    setTimeout(() => { updateError.value = false; }, 1200);
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

// Convert to managed user state
const managerSearchQuery = ref('');
const managerSearchResults = ref([]);
const showManagerSearchResults = ref(false);
const isSearchingManager = ref(false);
const hasSearchedManager = ref(false);
const isManagerValid = ref(null);
const selectedManager = ref(null);
const convertToManagedBusy = ref(false);
const convertToManagedError = ref('');
const convertToManagedSuccess = ref('');
let managerSearchTimeout = null;

const canConvertToManaged = computed(() => {
  return selectedManager.value && selectedManager.value.uid && !convertToManagedBusy.value;
});

const searchManager = (event) => {
  clearTimeout(managerSearchTimeout);
  const query = event.target.value.trim();
  
  isSearchingManager.value = query.length >= 1;
  
  if (query.length < 1) {
    isManagerValid.value = null;
    managerSearchResults.value = [];
    showManagerSearchResults.value = false;
    selectedManager.value = null;
    return;
  }
  
  managerSearchTimeout = setTimeout(async () => {
    try {
      isSearchingManager.value = true;
      hasSearchedManager.value = true;
      
      const results = await store.dispatch('auth/searchUsers', query);
      
      if (!results || !Array.isArray(results)) {
        managerSearchResults.value = [];
        showManagerSearchResults.value = false;
        isManagerValid.value = false;
        selectedManager.value = null;
      } else {
        // Filter out current user (can't be own manager)
        const currentUserUid = user.value?.uid;
        const filteredResults = results.filter(u => u.uid !== currentUserUid);
        
        managerSearchResults.value = filteredResults;
        showManagerSearchResults.value = filteredResults.length > 0;
        
        if (filteredResults.length > 0) {
          isManagerValid.value = true;
          // Pre-select if exact match
          const exactMatch = filteredResults.find(u => 
            u.user_tag.toLowerCase() === query.toLowerCase() ||
            u.display_name.toLowerCase() === query.toLowerCase()
          );
          if (exactMatch && !selectedManager.value) {
            selectedManager.value = exactMatch;
            managerSearchQuery.value = `${exactMatch.display_name} (@${exactMatch.user_tag})`;
            showManagerSearchResults.value = false;
          }
        } else {
          isManagerValid.value = false;
          selectedManager.value = null;
        }
      }
      
      isSearchingManager.value = false;
    } catch (error) {
      console.error('Error searching manager:', error);
      isManagerValid.value = false;
      managerSearchResults.value = [];
      showManagerSearchResults.value = false;
      selectedManager.value = null;
      isSearchingManager.value = false;
    }
  }, 300);
};

const selectManager = (user) => {
  selectedManager.value = user;
  managerSearchQuery.value = `${user.display_name} (@${user.user_tag})`;
  showManagerSearchResults.value = false;
  isManagerValid.value = true;
};

const clearManagerSearch = () => {
  managerSearchQuery.value = '';
  isManagerValid.value = null;
  managerSearchResults.value = [];
  isSearchingManager.value = false;
  hasSearchedManager.value = false;
  showManagerSearchResults.value = false;
  selectedManager.value = null;
};

const convertToManaged = async () => {
  if (!selectedManager.value || !selectedManager.value.uid) {
    convertToManagedError.value = 'Please select a manager';
    return;
  }
  
  if (selectedManager.value.uid === user.value?.uid) {
    convertToManagedError.value = 'You cannot be your own manager';
    return;
  }
  
  convertToManagedError.value = '';
  convertToManagedSuccess.value = '';
  
  if (!window.confirm('Converting to a managed user will remove your email and phone contacts, keeping only endpoint contacts. Continue?')) {
    return;
  }
  
  try {
    convertToManagedBusy.value = true;
    await store.dispatch('auth/convertToManagedUser', {
      uid: user.value.uid,
      managerUid: selectedManager.value.uid
    });
    convertToManagedSuccess.value = 'Successfully converted to managed user';
    // Reload the managers list and reset form
    await loadManagersAndManagedUsers();
    setTimeout(() => {
      resetForm();
    }, 1500);
  } catch (e) {
    const errorMsg = e.message || 'Failed to convert to managed user';
    if (errorMsg.includes('already_managed')) {
      convertToManagedError.value = 'This account is already a managed user';
    } else if (errorMsg.includes('cannot_be_own_manager')) {
      convertToManagedError.value = 'You cannot be your own manager';
    } else if (errorMsg.includes('manager_not_found')) {
      convertToManagedError.value = 'Manager not found';
    } else {
      convertToManagedError.value = errorMsg;
    }
  } finally {
    convertToManagedBusy.value = false;
  }
};

// Management state - lists of managers and managed users
const managersList = ref([]);
const managedUsersList = ref([]);
const loadingManagers = ref(false);
const loadingManagedUsers = ref(false);

// Add manager state
const addManagerSearchQuery = ref('');
const addManagerSearchResults = ref([]);
const showAddManagerSearchResults = ref(false);
const isSearchingAddManager = ref(false);
const hasSearchedAddManager = ref(false);
const isAddManagerValid = ref(null);
const selectedAddManager = ref(null);
const addManagerBusy = ref(false);
const addManagerError = ref('');
const addManagerSuccess = ref('');
let addManagerSearchTimeout = null;

const canAddManager = computed(() => {
  return selectedAddManager.value && selectedAddManager.value.uid && !addManagerBusy.value;
});

// Load managers and managed users
const loadManagersAndManagedUsers = async () => {
  if (!user.value || !user.value.uid) return;
  
  // Load managers for this user
  try {
    loadingManagers.value = true;
    const managers = await store.dispatch('auth/fetchManagersForUser', user.value.uid);
    managersList.value = managers || [];
  } catch (error) {
    console.error('Error loading managers:', error);
    managersList.value = [];
  } finally {
    loadingManagers.value = false;
  }
  
  // Load managed users (users this user manages)
  // Skip if we're delegated to a managed user (would show manager's managed users, not this user's)
  if (isDelegatedToManagedUser.value) {
    managedUsersList.value = [];
    loadingManagedUsers.value = false;
    return;
  }
  
  try {
    loadingManagedUsers.value = true;
    // fetchManagedUsers uses the current user context
    await store.dispatch('auth/fetchManagedUsers');
    managedUsersList.value = store.getters['auth/managedUsers'] || [];
  } catch (error) {
    console.error('Error loading managed users:', error);
    managedUsersList.value = [];
  } finally {
    loadingManagedUsers.value = false;
  }
};

const removeManager = async (managerUid) => {
  if (!user.value || !user.value.uid) return;
  
  if (!window.confirm('Remove this manager? They will no longer be able to act on your behalf.')) {
    return;
  }
  
  try {
    await store.dispatch('auth/removeManagerFromUser', {
      uid: user.value.uid,
      managerUid: managerUid
    });
    // Reload the managers list
    await loadManagersAndManagedUsers();
  } catch (error) {
    console.error('Error removing manager:', error);
    addManagerError.value = error.message || 'Failed to remove manager';
  }
};

const searchAddManager = (event) => {
  clearTimeout(addManagerSearchTimeout);
  const query = event.target.value.trim();
  
  isSearchingAddManager.value = query.length >= 1;
  
  if (query.length < 1) {
    isAddManagerValid.value = null;
    addManagerSearchResults.value = [];
    showAddManagerSearchResults.value = false;
    selectedAddManager.value = null;
    return;
  }
  
  addManagerSearchTimeout = setTimeout(async () => {
    try {
      isSearchingAddManager.value = true;
      hasSearchedAddManager.value = true;
      
      const results = await store.dispatch('auth/searchUsers', query);
      
      if (!results || !Array.isArray(results)) {
        addManagerSearchResults.value = [];
        showAddManagerSearchResults.value = false;
        isAddManagerValid.value = false;
        selectedAddManager.value = null;
      } else {
        // Filter out current user (can't be own manager)
        const currentUserUid = user.value?.uid;
        const filteredResults = results.filter(u => u.uid !== currentUserUid);
        
        addManagerSearchResults.value = filteredResults;
        showAddManagerSearchResults.value = filteredResults.length > 0;
        
        if (filteredResults.length > 0) {
          isAddManagerValid.value = true;
          // Pre-select if exact match
          const exactMatch = filteredResults.find(u => 
            u.user_tag.toLowerCase() === query.toLowerCase() ||
            u.display_name.toLowerCase() === query.toLowerCase()
          );
          if (exactMatch && !selectedAddManager.value) {
            selectedAddManager.value = exactMatch;
            addManagerSearchQuery.value = `${exactMatch.display_name} (@${exactMatch.user_tag})`;
            showAddManagerSearchResults.value = false;
          }
        } else {
          isAddManagerValid.value = false;
          selectedAddManager.value = null;
        }
      }
      
      isSearchingAddManager.value = false;
    } catch (error) {
      console.error('Error searching add manager:', error);
      isAddManagerValid.value = false;
      addManagerSearchResults.value = [];
      showAddManagerSearchResults.value = false;
      selectedAddManager.value = null;
      isSearchingAddManager.value = false;
    }
  }, 300);
};

const selectAddManager = (user) => {
  selectedAddManager.value = user;
  addManagerSearchQuery.value = `${user.display_name} (@${user.user_tag})`;
  showAddManagerSearchResults.value = false;
  isAddManagerValid.value = true;
};

const clearAddManagerSearch = () => {
  addManagerSearchQuery.value = '';
  isAddManagerValid.value = null;
  addManagerSearchResults.value = [];
  isSearchingAddManager.value = false;
  hasSearchedAddManager.value = false;
  showAddManagerSearchResults.value = false;
  selectedAddManager.value = null;
};

const addManager = async () => {
  if (!selectedAddManager.value || !selectedAddManager.value.uid) {
    addManagerError.value = 'Please select a manager';
    return;
  }
  
  if (selectedAddManager.value.uid === user.value?.uid) {
    addManagerError.value = 'You cannot be your own manager';
    return;
  }
  
  addManagerError.value = '';
  addManagerSuccess.value = '';
  
  try {
    addManagerBusy.value = true;
    await store.dispatch('auth/addManagerToUser', {
      uid: user.value.uid,
      managerUid: selectedAddManager.value.uid
    });
    addManagerSuccess.value = `Successfully added ${selectedAddManager.value.display_name} as a manager`;
    // Clear the search
    clearAddManagerSearch();
    // Reload the managers list
    await loadManagersAndManagedUsers();
    // Auto-clear success message after a few seconds
    setTimeout(() => {
      addManagerSuccess.value = '';
    }, 3000);
  } catch (e) {
    const errorMsg = e.message || 'Failed to add manager';
    if (errorMsg.includes('already_manager')) {
      addManagerError.value = 'This user is already a manager';
    } else if (errorMsg.includes('cannot_be_own_manager')) {
      addManagerError.value = 'You cannot be your own manager';
    } else if (errorMsg.includes('manager_not_found')) {
      addManagerError.value = 'Manager not found';
    } else {
      addManagerError.value = errorMsg;
    }
  } finally {
    addManagerBusy.value = false;
  }
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
          <section class="form-section">
            <div class="section-header">
              <h4>Profile basics</h4>
              <p>Update what people see on your public profile.</p>
            </div>
            <div class="field">
              <label for="displayName">Display Name</label>
              <input 
                id="displayName" 
                v-model="displayName" 
                type="text" 
                placeholder="Your public display name"
                @keydown="handleKeydown"
              />
              <div class="field-error" v-if="displayNameError">{{ displayNameError }}</div>
              <div v-else class="field-hint">This name will be visible to everyone.</div>
            </div>
            <div class="field">
              <label for="bio">Bio</label>
              <textarea
                id="bio"
                v-model="bio"
                :maxlength="BIO_MAX_LENGTH"
                placeholder="Share a short description"
              ></textarea>
              <div class="field-error" v-if="bioError">{{ bioError }}</div>
              <div class="field-hint">Let others know who you are. {{ (bio && bio.length) || 0 }}/{{ BIO_MAX_LENGTH }} characters.</div>
            </div>
            <div class="field">
              <label for="tag">Tag</label>
              <input 
                id="tag" 
                v-model="tag" 
                type="text" 
                placeholder="Your unique tag"
                maxlength="24"
                @keydown="handleKeydown"
                @blur="validateTag"
              />
              <div class="field-error" v-if="tagError">{{ tagError }}</div>
              <div v-else class="field-hint">A unique identifier (letters, numbers, underscores, or hyphens).</div>
            </div>
          </section>

          <section class="form-section">
            <div class="section-header">
              <h4>Account settings</h4>
              <p>Control how your account behaves across Stitch.</p>
            </div>
            <div class="field">
              <label class="toggle-pill">
                <input type="checkbox" v-model="isPrivate" />
                <span class="notify-text">Private account</span>
              </label>
              <div class="field-hint">Private profiles are visible only to users you manage or who manage you.</div>
            </div>
            <div class="field">
              <label class="toggle-pill">
                <input type="checkbox" v-model="isBot" />
                <span class="notify-text">Mark this account as a bot</span>
              </label>
            </div>
          </section>

          <section v-if="isBot" class="form-section bot-capabilities-section">
            <div class="section-header">
              <h4>Bot capabilities</h4>
              <p>Help people understand what this bot can handle.</p>
            </div>
            <div class="capabilities-fields">
              <div class="field">
                <label for="inputModalities">Input modalities</label>
                <input
                  id="inputModalities"
                  v-model="inputModalities"
                  type="text"
                  placeholder="e.g., txt, png, pdf"
                />
                <div class="field-hint">Comma-separated list of supported input filetypes.</div>
              </div>
              <div class="field">
                <label for="outputModalities">Output modalities</label>
                <input
                  id="outputModalities"
                  v-model="outputModalities"
                  type="text"
                  placeholder="e.g., txt, png"
                />
                <div class="field-hint">Comma-separated list of output filetypes.</div>
              </div>
              <div class="field">
                <label for="thirdPartyIntegrations">3rd party integrations</label>
                <input
                  id="thirdPartyIntegrations"
                  v-model="thirdPartyIntegrations"
                  type="text"
                  placeholder="e.g., OpenAI, Anthropic"
                />
                <div class="field-hint">Optional 3rd party integrations list.</div>
              </div>
            </div>
            <div class="field-error" v-if="botCapabilitiesError">{{ botCapabilitiesError }}</div>
          </section>

          <section class="form-section">
            <div class="section-header">
              <h4>Contact & notifications</h4>
              <p>Verified channels can receive security alerts and automation events.</p>
            </div>

            <div class="field" v-if="!isManaged">
              <div class="field-header">
                <label for="email">Email</label>
                <div class="field-meta">
                  <label class="notify-toggle" :class="{ disabled: !isEmailVerified || user?.is_managed }">
                    <input type="checkbox" v-model="notifyPrefs.email" :disabled="!isEmailVerified || user?.is_managed" /><span class="notify-text">Notify</span>
                  </label>
                  <span v-if="isEmailVerified" class="status-badge ok">Verified</span>
                </div>
              </div>
              <input 
                id="email" 
                v-model="email" 
                type="email" 
                placeholder="you@example.com"
                :disabled="user?.is_managed"
                @keydown="handleKeydown"
                @blur="validateEmail"
              />
              <div class="field-error" v-if="emailError">{{ emailError }}</div>
              <div class="verification-stack warn" v-if="!isEmailVerified && hasSavedEmail">
                <span class="verify-label">Unverified</span>
                <div class="verification-actions">
                  <button class="verify-btn" @click="sendEmailCode" :disabled="requestingEmailCode || emailCooldown > 0">{{ requestingEmailCode ? 'Sending…' : (emailCooldown > 0 ? `Resend in ${emailCooldown}s` : 'Send Code') }}</button>
                  <input class="code-input" v-model="emailCode" placeholder="Enter code" />
                  <button class="verify-btn" @click="confirmEmailCode" :disabled="verifyingEmail || !emailCode.trim()">{{ verifyingEmail ? 'Verifying…' : 'Verify' }}</button>
                </div>
              </div>
            </div>

            <div class="field" v-if="!isManaged">
              <div class="field-header">
                <label for="phoneNumber">Phone Number</label>
                <div class="field-meta">
                  <label class="notify-toggle" :class="{ disabled: !isPhoneVerified || !isEmailVerified || user?.is_managed }">
                    <input type="checkbox" v-model="notifyPrefs.phone" :disabled="!isPhoneVerified || !isEmailVerified || user?.is_managed" /><span class="notify-text">Notify</span>
                  </label>
                  <span v-if="isPhoneVerified" class="status-badge ok">Verified</span>
                </div>
              </div>
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
              <div class="field-error" v-if="phoneNumberError">{{ phoneNumberError }}</div>
              <div class="verification-stack warn" v-if="!isPhoneVerified && hasSavedPhone">
                <span class="verify-label">Unverified</span>
                <div class="verification-actions">
                  <button class="verify-btn" @click="sendPhoneCode" :disabled="requestingPhoneCode || phoneCooldown > 0">{{ requestingPhoneCode ? 'Sending…' : (phoneCooldown > 0 ? `Resend in ${phoneCooldown}s` : 'Send Code') }}</button>
                  <input class="code-input" v-model="phoneCode" placeholder="Enter code" />
                  <button class="verify-btn" v-if="phoneCodeSent" @click="confirmPhoneCode" :disabled="verifyingPhone || !phoneCode.trim()">{{ verifyingPhone ? 'Verifying…' : 'Verify' }}</button>
                </div>
              </div>
              <div v-if="showPhoneConsent && phoneNumber.trim()" class="consent-message">
                <p>By providing your phone number, you agree to receive text messages from Stitch at the number provided. Message and data rates may apply. Message frequency varies. To opt-out, remove your phone number here. View our Terms of Service and Privacy Policy at <a href="https://stitch.fyi/terms" target="_blank" rel="noopener noreferrer">stitch.fyi/terms</a>.</p>
              </div>
            </div>

            <div class="field">
              <div class="field-header">
                <label for="endpoint">Webhook Endpoint</label>
                <div class="field-meta">
                  <label class="notify-toggle" :class="{ disabled: !isEndpointVerified || (!isEmailVerified && !isManaged) }">
                    <input type="checkbox" v-model="notifyPrefs.endpoint" :disabled="!isEndpointVerified || (!isEmailVerified && !isManaged)" /><span class="notify-text">Notify</span>
                  </label>
                  <span v-if="isEndpointVerified" class="status-badge ok">Verified</span>
                </div>
              </div>
              <input 
                id="endpoint" 
                v-model="endpoint" 
                type="url" 
                placeholder="https://bot.example.com/hook"
                @keydown="handleKeydown"
              />
              <div class="verification-stack warn" v-if="!isEndpointVerified && hasSavedEndpoint"> 
                <div class="verification-header">
                  <span class="verify-label">Unverified</span>
                  <span class="verify-tip" title="We POST a nonce to your endpoint; it must echo it back as JSON {nonce: '...'} or plaintext.">Your server must echo the posted nonce.</span>
                </div>
                <div class="verification-actions">
                  <button class="verify-btn" @click="verifyEndpointFlow" :disabled="verifyingEndpoint || !endpoint">{{ verifyingEndpoint ? 'Verifying…' : 'Verify' }}</button>
                </div>
              </div>
              <div class="verification-message" v-if="endpointVerificationMessage">{{ endpointVerificationMessage }}</div>
            </div>

            <div class="verification-message" v-if="verificationMessage">{{ verificationMessage }}</div>
          </section>

          <section class="form-section">
            <div class="section-header">
              <h4>Management</h4>
              <p>Control who can manage your account and see which users you manage.</p>
            </div>

            <!-- Current Managers List -->
            <div class="management-lists">
              <div class="management-list-section">
                <div class="list-header">
                  <h5>Your Managers</h5>
                  <span class="list-count" v-if="!loadingManagers">{{ managersList.length }}</span>
                </div>
                <div v-if="loadingManagers" class="loading-state">Loading...</div>
                <div v-else-if="managersList.length === 0" class="empty-state">
                  No managers yet. Add a manager below to grant them access to manage your account.
                </div>
                <div v-else class="managers-list">
                  <div 
                    v-for="manager in managersList" 
                    :key="manager.uid"
                    class="manager-item"
                  >
                    <UserDisplay
                      :user="manager"
                      :display-name="manager.display_name || 'User'"
                      :user-tag="manager.user_tag"
                      :show-tag="!!manager.user_tag"
                      name-class="manager-name"
                      tag-class="manager-tag"
                      variant="compact"
                    />
                    <button 
                      class="remove-manager-btn"
                      @click="removeManager(manager.uid)"
                      title="Remove manager"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <!-- Managed Users List -->
              <div v-if="!isDelegatedToManagedUser" class="management-list-section">
                <div class="list-header">
                  <h5>Users You Manage</h5>
                  <span class="list-count" v-if="!loadingManagedUsers">{{ managedUsersList.length }}</span>
                </div>
                <div v-if="loadingManagedUsers" class="loading-state">Loading...</div>
                <div v-else-if="managedUsersList.length === 0" class="empty-state">
                  You don't manage any users yet.
                </div>
                <div v-else class="managers-list">
                  <div 
                    v-for="managedUser in managedUsersList" 
                    :key="managedUser.uid"
                    class="manager-item"
                  >
                    <UserDisplay
                      :user="managedUser"
                      :display-name="managedUser.display_name || 'User'"
                      :user-tag="managedUser.user_tag"
                      :show-tag="!!managedUser.user_tag"
                      name-class="manager-name"
                      tag-class="manager-tag"
                      variant="compact"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Add Manager -->
            <div class="management-action">
              <div class="action-header">
                <h5>Add Manager</h5>
                <p>Grant another user permission to manage your account and act on your behalf.</p>
              </div>
              <div class="field">
                <label for="addManagerSearch">Find a user</label>
                <div class="recipient-input-container">
                  <div class="manager-input-wrapper" :class="{ 'valid': isAddManagerValid === true, 'invalid': isAddManagerValid === false, 'searching': isSearchingAddManager }">
                    <input
                      id="addManagerSearch"
                      v-model="addManagerSearchQuery"
                      @input="searchAddManager"
                      @keydown.escape="clearAddManagerSearch"
                      placeholder="Search by username or tag"
                      class="manager-input"
                      autocomplete="off"
                      data-lpignore="true"
                      data-form-type="other"
                    />
                    <div v-if="isSearchingAddManager" class="input-indicator" title="Searching...">
                      <div class="spinner"></div>
                    </div>
                    <div v-else-if="isAddManagerValid === true" class="input-indicator success" title="Valid user">✓</div>
                    <div v-else-if="isAddManagerValid === false" class="input-indicator error" title="Invalid user">✗</div>
                  </div>
                  <button 
                    @click="addManager" 
                    class="add-recipient-btn"
                    :disabled="!canAddManager || addManagerBusy"
                  >
                    <div v-if="addManagerBusy" class="spinner" style="margin-right: 6px;"></div>
                    {{ addManagerBusy ? 'Adding...' : 'Add Manager' }}
                  </button>
                </div>
              </div>
              <div class="search-results-container">
                <div v-if="showAddManagerSearchResults && addManagerSearchResults && addManagerSearchResults.length > 0" class="search-results-list">
                  <div 
                    v-for="(user, index) in addManagerSearchResults" 
                    :key="user.uid" 
                    class="search-result-item"
                    @click.stop="selectAddManager(user)"
                  >
                    <div class="search-result-content">
                      <UserDisplay
                        :user="user"
                        :display-name="user.display_name || 'User'"
                        :user-tag="user.user_tag"
                        :show-tag="!!user.user_tag"
                        name-class="search-result-name"
                        tag-class="search-result-tag"
                        variant="menu"
                      />
                    </div>
                  </div>
                </div>
                <div v-else-if="addManagerSearchResults.length === 0 && hasSearchedAddManager && !isSearchingAddManager" class="no-search-results">
                  No users found. Try a different search term.
                </div>
              </div>
              <div class="field-error" v-if="addManagerError">{{ addManagerError }}</div>
              <div class="field-hint" v-if="addManagerSuccess" style="color: var(--color-success, #10b981);">{{ addManagerSuccess }}</div>
            </div>

            <!-- Convert to Managed User (only if not already managed) -->
            <div v-if="!isManaged" class="management-action">
              <div class="action-header">
                <h5>Convert to Managed User</h5>
                <p>Choose a manager to convert this account. Email and phone access will be removed.</p>
              </div>
            <div class="field">
              <label for="managerSearch">Find a manager</label>
              <div class="recipient-input-container">
                <div class="manager-input-wrapper" :class="{ 'valid': isManagerValid === true, 'invalid': isManagerValid === false, 'searching': isSearchingManager }">
                  <input
                    id="managerSearch"
                    v-model="managerSearchQuery"
                    @input="searchManager"
                    @keydown.escape="clearManagerSearch"
                    placeholder="Search by username or tag"
                    class="manager-input"
                    autocomplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                  <div v-if="isSearchingManager" class="input-indicator" title="Searching...">
                    <div class="spinner"></div>
                  </div>
                  <div v-else-if="isManagerValid === true" class="input-indicator success" title="Valid manager">✓</div>
                  <div v-else-if="isManagerValid === false" class="input-indicator error" title="Invalid manager">✗</div>
                </div>
                <button 
                  @click="convertToManaged" 
                  class="add-recipient-btn"
                  :disabled="!canConvertToManaged || convertToManagedBusy"
                >
                  <div v-if="convertToManagedBusy" class="spinner" style="margin-right: 6px;"></div>
                  {{ convertToManagedBusy ? 'Converting...' : 'Convert' }}
                </button>
              </div>
            </div>
            <div class="search-results-container">
              <div v-if="showManagerSearchResults && managerSearchResults && managerSearchResults.length > 0" class="search-results-list">
                <div 
                  v-for="(user, index) in managerSearchResults" 
                  :key="user.uid" 
                  class="search-result-item"
                  @click.stop="selectManager(user)"
                >
                  <div class="search-result-content">
                <UserDisplay
                    :user="user"
                  :display-name="user.display_name || 'User'"
                  :user-tag="user.user_tag"
                  :show-tag="!!user.user_tag"
                  name-class="search-result-name"
                  tag-class="search-result-tag"
                  variant="menu"
                />
                  </div>
                </div>
              </div>
              <div v-else-if="managerSearchResults.length === 0 && hasSearchedManager && !isSearchingManager" class="no-search-results">
                No users found. Try a different search term.
              </div>
              </div>
              <div class="field-error" v-if="convertToManagedError">{{ convertToManagedError }}</div>
              <div class="field-hint" v-if="convertToManagedSuccess" style="color: var(--color-success, #10b981);">{{ convertToManagedSuccess }}</div>
            </div>
          </section>

          <section class="form-section" v-if="!isManaged">
            <div class="section-header">
              <h4>Change password</h4>
              <p>Minimum 8 characters, must include a letter and a number.</p>
            </div>
            <div class="field">
              <label for="currentPassword">Current password</label>
              <div class="password-field">
                <input id="currentPassword" :type="showCurrentPassword ? 'text' : 'password'" v-model="currentPassword" placeholder="••••••••" />
                <button type="button" class="eye-toggle" @click="showCurrentPassword = !showCurrentPassword" :aria-pressed="showCurrentPassword ? 'true' : 'false'" :title="showCurrentPassword ? 'Hide password' : 'Show password'">{{ showCurrentPassword ? '🙈' : '👁️' }}</button>
              </div>
            </div>
            <div class="field">
              <label for="newPassword">New password</label>
              <div class="password-field">
                <input id="newPassword" :type="showNewPassword ? 'text' : 'password'" v-model="newPassword" placeholder="••••••••" />
                <button type="button" class="eye-toggle" @click="showNewPassword = !showNewPassword" :aria-pressed="showNewPassword ? 'true' : 'false'" :title="showNewPassword ? 'Hide password' : 'Show password'">{{ showNewPassword ? '🙈' : '👁️' }}</button>
              </div>
            </div>
            <div class="field">
              <label for="confirmPassword">Confirm new password</label>
              <div class="password-field">
                <input id="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" v-model="confirmPassword" placeholder="••••••••" />
                <button type="button" class="eye-toggle" @click="showConfirmPassword = !showConfirmPassword" :aria-pressed="showConfirmPassword ? 'true' : 'false'" :title="showConfirmPassword ? 'Hide password' : 'Show password'">{{ showConfirmPassword ? '🙈' : '👁️' }}</button>
              </div>
            </div>
            <div class="field-error" v-if="changePwError">{{ changePwError }}</div>
            <div class="field-hint" v-if="changePwSuccess" style="color: var(--color-success, #10b981);">{{ changePwSuccess }}</div>
            <div class="field-actions">
              <button class="update-btn" @click="submitPasswordChange" :disabled="changePwBusy">
                <div class="button-inner">
                  <div v-if="changePwBusy" class="spinner"></div>
                  {{ changePwBusy ? 'Updating...' : 'Change Password' }}
                </div>
              </button>
            </div>
          </section>

          <section class="form-section danger-zone">
            <div class="section-header">
              <h4>Danger zone</h4>
              <p>Deleting your account is permanent and cannot be undone.</p>
            </div>
            <div class="field-error" v-if="deleteError">{{ deleteError }}</div>
            <div class="field-actions">
              <button class="update-btn" :disabled="deleteBusy" @click="deleteAccount">
                <div class="button-inner">
                  <div v-if="deleteBusy" class="spinner"></div>
                  {{ deleteBusy ? 'Deleting…' : 'Delete account' }}
                </div>
              </button>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <div class="footer-message">
            <div v-if="errorMessage" class="error-message footer-error"><span>{{ errorMessage }}</span></div>
            <div v-else-if="noChangesMessage" class="footer-hint"><span>{{ noChangesMessage }}</span></div>
          </div>
          <div class="button-group">
            <button class="cancel-btn" @click="closeModal" :disabled="isSubmitting">{{ hasFormChanges ? 'Cancel' : 'Done' }}</button>
            <button v-if="hasFormChanges" class="update-btn" :class="{ success: updateSuccess, error: updateError }" @click="updateProfile" :disabled="!canSubmit">
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
  max-width: 660px;
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
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, var(--radius-md));
  padding: var(--space-lg);
  background-color: var(--color-surface);
  box-shadow: var(--color-card-shadow, none);
}

.section-header {
  margin-bottom: var(--space-md);
}

.section-header h4 {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.section-header p {
  margin: 4px 0 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: var(--space-md);
}

.field:last-child {
  margin-bottom: 0;
}

.field label {
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}

.field-header label {
  margin-bottom: 0;
}

.field-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.field input,
.field textarea {
  width: 100%;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-background);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field textarea {
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.password-field {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
}

.password-field input {
  padding-right: 36px;
}

.eye-toggle {
  margin-left: 6px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 6px 8px;
  font-size: 14px;
}

.eye-toggle:hover {
  background: var(--color-hover-overlay);
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin-top: 2px;
}

.toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-input-background);
  font-size: var(--font-size-sm);
  cursor: pointer;
  width: fit-content;
}

.toggle-pill input[type="checkbox"] {
  margin: 0;
}

.consent-message {
  background-color: rgba(52, 152, 219, 0.1);
  border: 1px solid rgba(52, 152, 219, 0.2);
  border-radius: var(--radius-md);
  padding: var(--space-md);
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.update-btn.error {
  background-color: var(--color-error, #ef4444);
}

.update-btn.error:hover:not(:disabled) {
  background-color: #dc2626;
}

.checkmark {
  font-weight: 700;
  margin-right: 6px;
}

.verify-label {
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
}

.verify-btn {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.verify-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.code-input {
  max-width: 140px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-input-background);
  color: var(--color-text);
}

.verification-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
}

.verification-stack.warn {
  background: rgba(234, 179, 8, 0.10);
  border: 1px solid rgba(234,179,8,0.35);
}

.verification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.verification-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.verification-message {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 6px 0;
}

.bot-capabilities-section .capabilities-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
}

.bot-capabilities-section .muted {
  color: var(--color-text-secondary);
}

.notify-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.notify-toggle {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  column-gap: 6px;
  font-size: 12px;
  padding: 2px 4px;
}

.notify-toggle input[type="checkbox"] {
  margin: 0;
  padding: 0;
}

.notify-text {
  line-height: 1;
  white-space: nowrap;
}

.notify-toggle.disabled {
  opacity: 0.6;
}

.control {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.input-with-icon {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.status-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.status-badge.ok {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-success, #10b981);
  border-color: rgba(16,185,129,0.35);
}

.status-badge.warn {
  background: rgba(234, 179, 8, 0.12);
  color: #eab308;
  border-color: rgba(234,179,8,0.35);
}

.verify-tip {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.field-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.danger-zone {
  border-color: rgba(239, 68, 68, 0.45);
  background-color: rgba(239, 68, 68, 0.05);
}

.danger-zone .section-header h4 {
  color: var(--color-error);
}

.danger-zone .update-btn {
  background: #ef4444;
}

.danger-zone .update-btn:hover:not(:disabled) {
  background: #dc2626;
}

.danger-zone .update-btn:disabled {
  opacity: 0.7;
}

/* Unsaved changes confirmation styles */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: calc(var(--z-index-modal) + 1);
}

.confirm-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  width: 92%;
  max-width: 420px;
  box-shadow: var(--color-card-shadow);
}

.confirm-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.confirm-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* Management section styles */
.management-lists {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.management-lists > .management-list-section:only-child {
  grid-column: 1 / -1;
}

.management-list-section {
  background: var(--color-input-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.list-header h5 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.list-count {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  min-width: 24px;
  text-align: center;
}

.loading-state,
.empty-state {
  padding: var(--space-md);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-style: italic;
}

.managers-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.manager-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: background-color 0.2s ease;
}

.manager-item:hover {
  background: var(--color-hover-overlay);
}

.manager-name {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.manager-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.remove-manager-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-error);
  font-size: 20px;
  line-height: 1;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: var(--space-sm);
}

.remove-manager-btn:hover {
  background: var(--color-error);
  color: var(--color-text-inverse);
  border-color: var(--color-error);
}

.management-action {
  margin-top: var(--space-md);
}

.action-header {
  margin-bottom: var(--space-md);
}

.action-header h5 {
  margin: 0 0 var(--space-xs) 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.action-header p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Convert to managed user styles */
.recipient-input-container {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.manager-input-wrapper {
  flex: 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-input-background);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  padding-right: 8px;
}

.manager-input-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb, 79, 140, 255), 0.2);
}

.manager-input-wrapper.valid {
  border-color: var(--color-success);
}

.manager-input-wrapper.invalid {
  border-color: var(--color-error);
}

.manager-input-wrapper.searching {
  border-color: var(--color-primary);
}

.manager-input {
  width: 100%;
  padding: 10px 12px;
  border: none !important;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
  box-shadow: none !important;
  border-radius: 0;
}

.manager-input:focus {
  border: none !important;
  outline: none;
  box-shadow: none !important;
}

.manager-input::placeholder {
  color: var(--color-text-secondary);
}

.input-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 20px;
  font-size: 14px;
}

.input-indicator.success {
  color: var(--color-success);
}

.input-indicator.error {
  color: var(--color-error);
}

.add-recipient-btn {
  padding: 12px 16px;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-recipient-btn:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.add-recipient-btn:disabled {
  background-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: not-allowed;
  transform: none;
}

.search-results-container {
  position: relative;
  margin-bottom: 16px;
}

.search-results-list {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.2s ease;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: var(--color-hover-overlay);
}

.search-result-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-result-name {
  font-weight: 500;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.search-result-tag {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.no-search-results {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

@media (max-width: 900px) {
  .management-lists {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .modal-container {
    width: 96%;
    max-width: 560px;
    max-height: 86vh;
  }

  .modal-content {
    padding: var(--space-md);
  }

  .form-section {
    padding: var(--space-md);
  }

  .control {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .input-with-icon {
    width: 100%;
  }

  .notify-group,
  .status-badge,
  .notify-toggle {
    align-self: flex-start;
  }

  .field-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .recipient-input-container {
    flex-direction: column;
  }

  .add-recipient-btn {
    width: 100%;
  }

  .code-input {
    max-width: 100%;
  }
}
</style>