<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useStore } from 'vuex';
import { useAuthentication } from '@/composables/useAuthentication';
import ApiKeysService from '@/services/ApiKeysService';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);

const store = useStore();
const user = computed(() => store.getters['auth/user']);
const isApiAllowed = computed(() => store.getters['auth/isApiAllowed']);
const contactSupportHref = 'mailto:seth@stitch.fyi?subject=Stitch%20API%20Access%20Request';
const { requestEndpointVerification: requestEndpointChallenge, verifyEndpointWithChallenge } = useAuthentication();

const loading = ref(false);
const errorMessage = ref('');
const keys = ref([]);
const creating = ref(false);
const newKeyLabel = ref('');
const newKeyScopes = ref('');
const createdKeyToken = ref('');

// Webhook/endpoint state
const endpoint = ref('');
const endpointVerificationMessage = ref('');
const verifyingEndpoint = ref(false);
const savingEndpoint = ref(false);
const saveSucceeded = ref(false);
const verifySucceeded = ref(false);
const secretBusy = ref(false);
const secretError = ref('');
const generatedSecret = ref('');
const hasJustRevealedSecret = ref(false);
const secretCopied = ref(false);
const endpointRotationHint = ref('');

let saveFlashTimer = null;
let verifyFlashTimer = null;
let copyFlashTimer = null;

const FLASH_MS = 1600;

function clearFlashTimers() {
  if (saveFlashTimer) clearTimeout(saveFlashTimer);
  if (verifyFlashTimer) clearTimeout(verifyFlashTimer);
  if (copyFlashTimer) clearTimeout(copyFlashTimer);
  saveFlashTimer = null;
  verifyFlashTimer = null;
  copyFlashTimer = null;
}

function flashSaveSuccess() {
  saveSucceeded.value = true;
  if (saveFlashTimer) clearTimeout(saveFlashTimer);
  saveFlashTimer = setTimeout(() => {
    saveSucceeded.value = false;
    saveFlashTimer = null;
  }, FLASH_MS);
}

function flashVerifySuccess() {
  verifySucceeded.value = true;
  if (verifyFlashTimer) clearTimeout(verifyFlashTimer);
  verifyFlashTimer = setTimeout(() => {
    verifySucceeded.value = false;
    verifyFlashTimer = null;
  }, FLASH_MS);
}

const saveButtonLabel = computed(() => {
  if (savingEndpoint.value) return 'Saving…';
  if (saveSucceeded.value) return 'Saved';
  return 'Save';
});

const verifyButtonLabel = computed(() => {
  if (verifyingEndpoint.value) return 'Verifying…';
  if (verifySucceeded.value) return 'Verified';
  return 'Verify';
});

// Mobile detection (600px breakpoint)
const isMobile = ref(window.innerWidth <= 600);

const handleResize = () => {
  isMobile.value = window.innerWidth <= 600;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  if (props.isOpen) {
    if (isApiAllowed.value) loadKeys();
    resetDevForm();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  clearFlashTimers();
});

const isEmailVerified = computed(() => !!(user.value?.is_email_verified));
const isManaged = computed(() => !!(user.value && user.value.is_managed));
const isEndpointVerified = computed(() => !!((user.value?.contacts || []).some(c => c.type === 'endpoint' && c.verified)));
const hasSavedEndpoint = computed(() => !!((user.value?.contacts || []).find(c => c.type === 'endpoint')?.value));
const hasEndpointSigningSecret = computed(() => !!(user.value?.has_endpoint_signing_secret));
const originalEndpoint = computed(() => (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '');
const endpointChanged = computed(() => {
  const current = (endpoint.value || '').trim();
  const original = (originalEndpoint.value || '').trim();
  return !!original && !!current && current !== original;
});
const hasSecretForCurrentEndpoint = computed(() => hasEndpointSigningSecret.value && !endpointChanged.value);

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
  secretCopied.value = false;
};

const dismissRevealedSecret = () => {
  generatedSecret.value = '';
  hasJustRevealedSecret.value = false;
  secretCopied.value = false;
};

const copyRevealedSecret = async () => {
  try {
    await navigator.clipboard.writeText(generatedSecret.value);
    secretCopied.value = true;
    if (copyFlashTimer) clearTimeout(copyFlashTimer);
    copyFlashTimer = setTimeout(() => {
      secretCopied.value = false;
      copyFlashTimer = null;
    }, FLASH_MS);
  } catch (e) {
    secretError.value = 'Failed to copy';
    setTimeout(() => { secretError.value = ''; }, 2000);
  }
};

async function loadKeys() {
  if (!isApiAllowed.value) {
    keys.value = [];
    return;
  }
  try {
    loading.value = true;
    errorMessage.value = '';
    keys.value = await ApiKeysService.listKeys();
  } catch (e) {
    errorMessage.value = e?.message || 'Failed to load API keys';
  } finally {
    loading.value = false;
  }
}

async function revoke(credId) {
  if (!isApiAllowed.value) return;
  try {
    loading.value = true;
    await ApiKeysService.revokeKey(credId);
    await loadKeys();
  } catch (e) {
    errorMessage.value = e?.message || 'Failed to revoke key';
  } finally {
    loading.value = false;
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    resetDevForm();
    if (isApiAllowed.value) {
      loadKeys();
    } else {
      keys.value = [];
      createdKeyToken.value = '';
      errorMessage.value = '';
    }
  }
});

watch(isApiAllowed, (allowed) => {
  if (allowed && props.isOpen) {
    loadKeys();
    resetDevForm();
  } else if (!allowed) {
    keys.value = [];
    createdKeyToken.value = '';
    errorMessage.value = '';
  }
});

async function createKey() {
  if (!isApiAllowed.value) return;
  try {
    creating.value = true;
    errorMessage.value = '';
    createdKeyToken.value = '';
    const res = await ApiKeysService.createKey({ label: newKeyLabel.value.trim(), scopes_cap: newKeyScopes.value.trim() || undefined });
    createdKeyToken.value = res?.api_key || '';
    newKeyLabel.value = '';
    newKeyScopes.value = '';
    await loadKeys();
  } catch (e) {
    errorMessage.value = e?.message || 'Failed to create key';
  } finally {
    creating.value = false;
  }
}

function resetDevForm() {
  endpoint.value = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
  endpointVerificationMessage.value = '';
  generatedSecret.value = '';
  hasJustRevealedSecret.value = false;
  secretError.value = '';
  endpointRotationHint.value = '';
  savingEndpoint.value = false;
  saveSucceeded.value = false;
  verifySucceeded.value = false;
  secretCopied.value = false;
  clearFlashTimers();
}

async function saveEndpoint() {
  try {
    const prevEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
    const next = (endpoint.value || '').trim();
    if (next === prevEndpoint) {
      flashSaveSuccess();
      return;
    }
    savingEndpoint.value = true;
    saveSucceeded.value = false;
    const payload = { endpoint: next || null };
    if (next && !prevEndpoint) {
      payload.notify = { endpoint: true };
    }
    const result = await store.dispatch('auth/updateProfile', payload);
    // If there was a signing secret before and the URL changed, re-verification is required.
    // Secret rotation is recommended but not required (backend can migrate the existing secret).
    if (hasEndpointSigningSecret.value && prevEndpoint && next && next !== prevEndpoint) {
      endpointRotationHint.value = 'Endpoint URL updated. Verify this URL to resume deliveries. Rotating your signing secret is optional (recommended).';
    } else {
      endpointRotationHint.value = '';
    }
    resetDevForm();
    flashSaveSuccess();
    if (next) {
      if (result && result.endpoint_verified) {
        endpointVerificationMessage.value = 'Endpoint verified';
        flashVerifySuccess();
        endpointRotationHint.value = '';
      } else if (result && result.endpoint_verified === false) {
        endpointVerificationMessage.value = 'Saved. Verification failed — click Verify to retry.';
      }
    }
  } catch (e) {
    endpointVerificationMessage.value = e.message || 'Failed to update endpoint';
  } finally {
    savingEndpoint.value = false;
  }
}

async function verifyEndpointFlow() {
  endpointVerificationMessage.value = '';
  verifySucceeded.value = false;
  try {
    const next = (endpoint.value || '').trim();
    if (!next) {
      endpointVerificationMessage.value = 'Enter an endpoint URL first';
      return;
    }
    verifyingEndpoint.value = true;
    await requestEndpointChallenge(next);
    await verifyEndpointWithChallenge({ endpoint: next });
    endpointVerificationMessage.value = 'Endpoint verified';
    flashVerifySuccess();
  } catch (e) {
    endpointVerificationMessage.value = e.message || 'Failed to verify endpoint';
  } finally {
    verifyingEndpoint.value = false;
  }
}

async function setOrRotateSigningSecret() {
  secretError.value = '';
  if (!endpoint.value || !endpoint.value.trim()) {
    secretError.value = 'Add and verify an endpoint first';
    return;
  }
  try {
    secretBusy.value = true;
    const newSecret = generateStrongSecret(32);
    const payload = { endpoint_signing_secret: newSecret };
    const originalEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
    if (endpoint.value !== originalEndpoint) {
      payload.endpoint = endpoint.value.trim();
    }
    await store.dispatch('auth/updateProfile', payload);
    revealSecretOnce(newSecret);
  } catch (e) {
    secretError.value = e.message || 'Failed to update signing secret';
  } finally {
    secretBusy.value = false;
  }
}
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-container">
        <div class="modal-header">
          <div class="header-copy">
            <h3>Developer tools</h3>
            <p class="header-subtitle">Webhooks and API keys for this account</p>
          </div>
          <button class="close-button" type="button" @click="emit('close')" aria-label="Close">×</button>
        </div>

        <!-- Mobile warning -->
        <div v-if="isMobile" class="mobile-warning-container">
          <div class="mobile-warning">
            <div class="mobile-warning-content">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <h4>Desktop Required</h4>
              <p>Developer tools require a larger screen. Please access this section from a desktop or tablet device.</p>
            </div>
          </div>
        </div>

        <!-- Desktop content -->
        <div v-else class="desktop-content-wrapper">
          <!-- Unverified email banner -->
          <div v-if="user && !isEmailVerified && !(user && user.is_managed)" class="verify-banner">
            <span>Verify your email to unlock messaging &amp; notifications.</span>
            <a class="verify-link" href="#" @click.prevent="emit('close')">Verify now</a>
          </div>

          <div class="modal-content">
            <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

            <section class="panel">
              <div class="panel-header">
                <h4>Webhook endpoint</h4>
                <p>Receive signed POSTs when events should be delivered to your service.</p>
              </div>

              <div class="field">
                <label for="endpointUrl">Endpoint URL</label>
                <div class="field-row">
                  <input id="endpointUrl" placeholder="https://bot.example.com/hook" v-model="endpoint" />
                  <span v-if="isEndpointVerified" class="status-badge ok">Verified</span>
                  <button
                    class="btn secondary btn-feedback"
                    :class="{ success: saveSucceeded }"
                    type="button"
                    :disabled="savingEndpoint"
                    @click="saveEndpoint"
                  >{{ saveButtonLabel }}</button>
                </div>
              </div>

              <div v-if="endpointChanged && hasEndpointSigningSecret" class="callout warning">
                <strong>Heads up:</strong> You changed your endpoint URL. After saving and verifying this URL, click
                <em>Rotate Secret</em> below if you want to rotate your signing secret (recommended). Your existing secret can be reused.
              </div>

              <div class="field">
                <span class="field-label">Verification</span>
                <div class="field-row wrap">
                  <button
                    class="btn secondary btn-feedback"
                    :class="{ success: verifySucceeded }"
                    type="button"
                    @click="verifyEndpointFlow"
                    :disabled="verifyingEndpoint || !endpoint"
                  >{{ verifyButtonLabel }}</button>
                  <span class="field-hint inline">We POST a nonce to your endpoint; it must echo it back as JSON {nonce:"..."} or plaintext.</span>
                </div>
                <div class="verification-message" :class="{ ok: endpointVerificationMessage === 'Endpoint verified' }" v-if="endpointVerificationMessage">
                  {{ endpointVerificationMessage }}
                </div>
              </div>

              <div class="field">
                <span class="field-label">Signing secret</span>
                <div class="field-row">
                  <button class="btn primary" type="button" @click="setOrRotateSigningSecret" :disabled="secretBusy || !isEndpointVerified">
                    <span v-if="secretBusy" class="spinner small"></span>
                    {{ secretBusy ? 'Saving…' : (hasSavedEndpoint ? 'Rotate Secret' : 'Create Secret') }}
                  </button>
                  <span v-if="hasSecretForCurrentEndpoint" class="verified-badge" title="Signing secret exists for this endpoint">✓</span>
                  <span class="field-hint inline" v-if="!isEndpointVerified">Verify endpoint to enable</span>
                </div>
              </div>

              <div v-if="hasJustRevealedSecret" class="callout reveal">
                <div class="note">Copy your secret now (shown once):</div>
                <input readonly :value="generatedSecret" class="mono" />
                <div class="reveal-actions">
                  <button class="btn secondary" :class="{ success: secretCopied }" type="button" @click="copyRevealedSecret">
                    {{ secretCopied ? 'Copied' : 'Copy' }}
                  </button>
                  <button class="btn secondary" type="button" @click="dismissRevealedSecret">Dismiss</button>
                </div>
                <div class="field-hint">This value is write-only and cannot be viewed again after dismissal.</div>
                <div class="field-hint">Requests will include headers X-Stitch-Timestamp and X-Stitch-Signature.</div>
                <div class="error" v-if="secretError">{{ secretError }}</div>
              </div>
            </section>

            <div class="api-section-wrapper" :class="{ 'blocked-state': !isApiAllowed }">
              <div class="modal-content-body" :class="{ 'is-blurred': !isApiAllowed }">
                <section class="panel">
                  <div v-if="!isManaged">
                    <div class="panel-header">
                      <h4>API keys</h4>
                      <p>Create keys for programmatic access. New tokens are shown once.</p>
                    </div>
                    <div class="create-grid">
                      <div class="field">
                        <label for="newKeyLabel">Label</label>
                        <input id="newKeyLabel" placeholder="Optional label" v-model="newKeyLabel" />
                      </div>
                      <div class="field">
                        <label for="newKeyScopes">Scopes cap</label>
                        <input id="newKeyScopes" placeholder="e.g. messages.read messages.write" v-model="newKeyScopes" />
                        <div class="field-hint">Leave empty to use default: messages.read messages.write</div>
                      </div>
                    </div>
                    <div class="actions">
                      <button class="btn primary" type="button" :disabled="creating" @click="createKey">{{ creating ? 'Creating…' : 'Create Key' }}</button>
                    </div>
                    <div v-if="createdKeyToken" class="callout success">
                      <div class="note">Copy your new API key now. It will not be shown again.</div>
                      <div class="mono token">{{ createdKeyToken }}</div>
                    </div>
                  </div>

                  <div v-else class="managed-delegation-hint">
                    <div class="panel-header">
                      <h4>Managed account</h4>
                      <p>Managed users (bots) cannot create API keys. Ask your manager to delegate for you, then use that token to import messages.</p>
                    </div>
                  </div>
                </section>

                <div class="table-wrap">
                  <div class="table">
                    <div class="row header">
                      <div>Label</div>
                      <div>Scopes</div>
                      <div>Created</div>
                      <div>Last used</div>
                      <div></div>
                    </div>
                    <div v-if="loading" class="row empty"><div>Loading…</div></div>
                    <div v-else-if="!keys.length" class="row empty"><div>No active keys</div></div>
                    <div v-else v-for="k in keys" :key="k.cred_id" class="row">
                      <div>{{ k.label || '—' }}</div>
                      <div class="mono">{{ k.scopes_cap || '—' }}</div>
                      <div class="mono">{{ k.created_at?.slice(0,19).replace('T',' ') }}</div>
                      <div class="mono">{{ k.last_used_at ? k.last_used_at.slice(0,19).replace('T',' ') : '—' }}</div>
                      <div class="actions">
                        <button class="btn danger" type="button" :disabled="loading" @click="revoke(k.cred_id)">Revoke</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!isApiAllowed" class="blocked-overlay">
                <div class="blocked-card">
                  <h4>Partner access required</h4>
                  <p>API key tooling is limited to approved partners. Reach out to get added to the allowlist.</p>
                  <a :href="contactSupportHref" class="contact-support-btn">Contact for access</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="button-group">
            <button class="btn secondary" type="button" @click="emit('close')">Close</button>
          </div>
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
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-modal);
  backdrop-filter: blur(4px);
  padding: var(--space-lg);
}
.modal-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: min(960px, 100%);
  max-height: 88vh;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-surface-dark);
}
.header-copy h3 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: 600;
  line-height: var(--line-height-tight);
}
.header-subtitle {
  margin: var(--space-xxs) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-secondary);
  height: 32px;
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}
.close-button:hover {
  color: var(--color-text);
  background: var(--color-hover-overlay);
}
.desktop-content-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.modal-content {
  padding: var(--space-lg) var(--space-xl);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.api-section-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.api-section-wrapper.blocked-state { overflow: hidden; }
.modal-content-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  transition: opacity var(--transition-normal), filter var(--transition-normal);
}
.modal-content-body.is-blurred {
  filter: grayscale(1);
  opacity: 0.4;
  pointer-events: none;
}
.blocked-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-lg);
  z-index: 10;
  background: rgba(18, 18, 18, 0.45);
}
.blocked-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-lg) var(--space-xl);
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}
.blocked-overlay h4 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text);
}
.blocked-overlay p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}
.blocked-overlay .contact-support-btn {
  align-self: center;
  background: var(--color-secondary);
  color: #fff;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.blocked-overlay .contact-support-btn:hover { background: var(--color-secondary-dark); }

.panel {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.panel-header h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}
.panel-header p {
  margin: var(--space-xxs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.field label,
.field-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}
.field input,
.callout input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius-md);
  background: var(--color-input-background);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}
.field input:focus,
.callout input:focus {
  outline: none;
  border-color: var(--color-input-focus-border);
}
.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.field-row.wrap { flex-wrap: wrap; }
.field-row input { flex: 1; min-width: 0; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xxs);
  border-radius: var(--radius-md);
  padding: 8px 14px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), opacity var(--transition-fast);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn.primary {
  background: var(--color-secondary);
  color: #fff;
  border: 1px solid transparent;
  min-width: 7.5rem;
}
.btn.primary:hover:not(:disabled) { background: var(--color-secondary-dark); }
.btn.secondary {
  background: var(--color-surface-light);
  color: var(--color-text);
  border: 1px solid var(--color-border-light);
  min-width: 5.5rem;
}
.btn-feedback {
  min-width: 6.75rem;
}
.btn.secondary:hover:not(:disabled) { background: var(--color-hover-overlay); }
.btn.secondary.success {
  border-color: rgba(76, 175, 80, 0.45);
  color: var(--color-success);
  background: rgba(76, 175, 80, 0.12);
}
.btn.danger {
  background: transparent;
  color: var(--color-error);
  border: 1px solid var(--color-border-light);
  min-width: auto;
}
.btn.danger:hover:not(:disabled) {
  background: rgba(220, 53, 69, 0.1);
  border-color: var(--color-error);
}

.callout {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}
.callout.warning {
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.35);
  color: var(--color-text-secondary);
}
.callout.success {
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.35);
}
.callout.reveal {
  background: var(--color-surface-light);
  border: 1px solid var(--color-border-light);
}
.callout .note {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.reveal-actions {
  display: flex;
  gap: var(--space-sm);
}

.status-badge {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
.status-badge.ok {
  background: rgba(76, 175, 80, 0.12);
  color: var(--color-success);
  border-color: rgba(76, 175, 80, 0.35);
}
.verified-badge {
  color: var(--color-success);
  font-size: var(--font-size-md);
}
.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
.field-hint.inline { flex: 1; min-width: 180px; }
.verification-message {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.verification-message.ok { color: var(--color-success); }
.error { color: var(--color-error); font-size: var(--font-size-sm); }

.spinner.small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.create-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}
.actions { display: flex; }
.mono {
  font-family: var(--font-family-code);
  font-size: var(--font-size-xs);
}
.token { word-break: break-all; color: var(--color-text); }

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-dark);
}
.table {
  min-width: 640px;
  display: grid;
}
.row {
  display: grid;
  grid-template-columns: 1.2fr 1.3fr 1fr 1fr auto;
  align-items: center;
  gap: var(--space-md);
  padding: 12px var(--space-md);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.row:last-child { border-bottom: none; }
.row.header {
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
  background: var(--color-surface-light);
}
.row.empty {
  color: var(--color-text-secondary);
  grid-template-columns: 1fr;
}
.row:not(.header):not(.empty):hover {
  background: var(--color-hover-overlay);
}

.modal-footer {
  display: flex;
  padding: var(--space-md) var(--space-xl);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  background: var(--color-surface-dark);
}
.button-group {
  display: flex;
  gap: var(--space-md);
  margin-left: auto;
}

.mobile-warning-container {
  overflow-y: auto;
  flex: 1;
}
.mobile-warning {
  padding: var(--space-xxl) var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}
.mobile-warning-content {
  text-align: center;
  max-width: 400px;
  color: var(--color-text);
}
.mobile-warning-content svg {
  margin: 0 auto 16px;
  opacity: 0.5;
}
.mobile-warning-content h4 {
  margin: 0 0 12px;
  font-size: var(--font-size-lg);
  font-weight: 600;
}
.mobile-warning-content p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.verify-banner {
  background: rgba(255, 152, 0, 0.12);
  color: var(--color-text);
  border: 1px solid rgba(255, 152, 0, 0.35);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  margin: var(--space-md) var(--space-xl) 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--font-size-sm);
}
.verify-link {
  color: var(--color-link);
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}
.verify-link:hover { text-decoration: underline; }

@media (max-width: 600px) {
  .verify-banner {
    flex-direction: column;
    align-items: flex-start;
    margin: var(--space-md);
  }
  .create-grid { grid-template-columns: 1fr; }
  .field-row { flex-direction: column; align-items: stretch; }
  .btn { width: 100%; }
}
</style>
