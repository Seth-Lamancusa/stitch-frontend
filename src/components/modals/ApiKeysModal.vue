<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useStore } from 'vuex';
import { useAuthentication } from '@/composables/useAuthentication';
import ApiKeysService from '@/services/ApiKeysService';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);

const store = useStore();
const user = computed(() => store.getters['auth/user']);
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
const secretBusy = ref(false);
const secretError = ref('');
const generatedSecret = ref('');
const hasJustRevealedSecret = ref(false);

const isEndpointVerified = computed(() => !!((user.value?.contacts || []).some(c => c.type === 'endpoint' && c.verified)));
const hasSavedEndpoint = computed(() => !!((user.value?.contacts || []).find(c => c.type === 'endpoint')?.value));
const hasEndpointSigningSecret = computed(() => !!(user.value?.has_endpoint_signing_secret));

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

async function loadKeys() {
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

onMounted(() => { if (props.isOpen) { loadKeys(); resetDevForm(); } });

watch(() => props.isOpen, (open) => {
  if (open) { loadKeys(); resetDevForm(); }
});

async function createKey() {
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
}

async function saveEndpoint() {
  try {
    const originalEndpoint = (user.value?.contacts || []).find(c => c.type === 'endpoint')?.value || '';
    const next = (endpoint.value || '').trim();
    if (next === originalEndpoint) return;
    const payload = { endpoint: next || null };
    await store.dispatch('auth/updateProfile', payload);
    resetDevForm();
  } catch (e) {
    endpointVerificationMessage.value = e.message || 'Failed to update endpoint';
  }
}

async function verifyEndpointFlow() {
  endpointVerificationMessage.value = '';
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
          <h3>API Keys</h3>
          <button class="close-button" @click="emit('close')">×</button>
        </div>
        <div class="modal-content">
          <div v-if="errorMessage" class="error">{{ errorMessage }}</div>
          <div class="create-box">
            <div class="row header small">Create New Key</div>
            <div class="create-grid">
              <label>Label</label>
              <input placeholder="Optional label" v-model="newKeyLabel" />
              <label>Scopes cap</label>
              <input placeholder="e.g. msg.read msg.write" v-model="newKeyScopes" />
              <div></div>
              <div class="actions">
                <button class="primary" :disabled="creating" @click="createKey">{{ creating ? 'Creating…' : 'Create Key' }}</button>
              </div>
            </div>
            <div v-if="createdKeyToken" class="new-key-warning">
              <div class="note">Copy your new API key now. It will not be shown again.</div>
              <div class="mono token">{{ createdKeyToken }}</div>
            </div>
          </div>

          <div class="create-box">
            <div class="row header small">Webhook Endpoint</div>
            <div class="create-grid">
              <label for="endpointUrl">Endpoint URL</label>
              <div class="endpoint-control">
                <input id="endpointUrl" placeholder="https://bot.example.com/hook" v-model="endpoint" />
                <span v-if="isEndpointVerified" class="status-badge ok">Verified</span>
                <button class="secondary" @click="saveEndpoint">Save</button>
              </div>

              <label>Verification</label>
              <div class="endpoint-verify">
                <button class="secondary" @click="verifyEndpointFlow" :disabled="verifyingEndpoint || !endpoint">{{ verifyingEndpoint ? 'Verifying…' : 'Verify' }}</button>
                <span class="verify-tip">We POST a nonce to your endpoint; it must echo it back as JSON {nonce:"..."} or plaintext.</span>
              </div>
              <div class="verification-message" v-if="endpointVerificationMessage">{{ endpointVerificationMessage }}</div>

              <label>Signing Secret</label>
              <div class="endpoint-secret">
                <button class="primary" @click="setOrRotateSigningSecret" :disabled="secretBusy || !isEndpointVerified">
                  <span v-if="secretBusy" class="spinner small"></span>
                  {{ secretBusy ? 'Saving…' : (hasSavedEndpoint ? 'Rotate Secret' : 'Create Secret') }}
                </button>
                <span v-if="hasEndpointSigningSecret" class="verified-badge" title="Signing secret exists">✓</span>
                <span class="field-hint" v-if="!isEndpointVerified">Verify endpoint to enable</span>
              </div>

              <div v-if="hasJustRevealedSecret" class="reveal-once">
                <div class="note">Copy your secret now (shown once):</div>
                <div class="reveal-actions">
                  <button class="secondary" @click="copyRevealedSecret">Copy</button>
                  <button class="secondary" @click="dismissRevealedSecret">Dismiss</button>
                </div>
                <input readonly :value="generatedSecret" class="mono" />
                <div class="field-hint">This value is write-only and cannot be viewed again after dismissal.</div>
                <div class="field-hint">Requests will include headers X-Stitch-Timestamp and X-Stitch-Signature.</div>
                <div class="error" v-if="secretError">{{ secretError }}</div>
              </div>
            </div>
          </div>
          <div class="table">
            <div class="row header">
              <div>Label</div>
              <div>Scopes</div>
              <div>Created</div>
              <div>Last used</div>
              <div></div>
            </div>
            <div v-if="loading" class="row"><div>Loading…</div></div>
            <div v-else-if="!keys.length" class="row"><div>No active keys</div></div>
            <div v-else v-for="k in keys" :key="k.cred_id" class="row">
              <div>{{ k.label || '—' }}</div>
              <div class="mono">{{ k.scopes_cap || '—' }}</div>
              <div class="mono">{{ k.created_at?.slice(0,19).replace('T',' ') }}</div>
              <div class="mono">{{ k.last_used_at ? k.last_used_at.slice(0,19).replace('T',' ') : '—' }}</div>
              <div class="actions">
                <button class="danger" :disabled="loading" @click="revoke(k.cred_id)">Revoke</button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="button-group">
            <button class="cancel-btn" @click="emit('close')">Close</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
  
</template>

<style scoped>
.fade-enter-active,.fade-leave-active{ transition: opacity var(--transition-fast); }
.fade-enter-from,.fade-leave-to{ opacity:0; }
.modal-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.75); display:flex; align-items:center; justify-content:center; z-index:var(--z-index-modal); backdrop-filter: blur(2px); }
.modal-container{ background:var(--color-surface); border-radius:var(--radius-md); width:92%; max-width:720px; max-height:82vh; box-shadow:var(--color-card-shadow); overflow:hidden; display:flex; flex-direction:column; }
.modal-header{ display:flex; justify-content:space-between; align-items:center; padding:var(--space-md) var(--space-lg); border-bottom:1px solid var(--color-border); }
.modal-header h3{ margin:0; color:var(--color-text); font-size:var(--font-size-lg); font-weight:600; }
.close-button{ background:none; border:none; font-size:var(--font-size-xl); cursor:pointer; color:var(--color-text); opacity:.7; height:24px; width:24px; display:flex; align-items:center; justify-content:center; padding:0; }
.close-button:hover{ opacity:1; }
.modal-content{ padding:var(--space-lg); overflow-y:auto; flex:1; }
.error{ color: var(--color-error); margin-bottom: 8px; }
.create-box{ border:1px solid var(--color-border); border-radius:8px; padding:12px; margin-bottom:12px; }
.create-grid{ display:grid; grid-template-columns: 120px 1fr; gap:8px 12px; align-items:center; }
.create-grid input{ width:100%; padding:6px 8px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-input-background); color:var(--color-text); }
.endpoint-control{ display:flex; align-items:center; gap:8px; }
.endpoint-control .secondary{ padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); cursor:pointer; }
.endpoint-verify{ display:flex; align-items:center; gap:8px; }
.endpoint-verify .secondary{ padding:6px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); cursor:pointer; }
.endpoint-secret{ display:flex; align-items:center; gap:8px; }
.endpoint-secret .primary{ background: var(--color-primary); color: var(--color-text-inverse); border:none; padding:6px 10px; border-radius:6px; cursor:pointer; }
.verified-badge { color: var(--color-success, #10b981); margin-left: 6px; font-size: 14px; }
.status-badge{ font-size:11px; padding:2px 6px; border-radius:10px; border:1px solid var(--color-border); color: var(--color-text-secondary); }
.status-badge.ok{ background: rgba(16,185,129,.12); color: var(--color-success, #10b981); border-color: rgba(16,185,129,.35); }
.verify-tip{ font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.verification-message{ font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.reveal-once{ display:flex; flex-direction:column; gap:6px; grid-column: 1 / -1; }
.spinner.small{ width:12px; height:12px; border:2px solid rgba(0,0,0,0.3); border-top-color: var(--color-text-inverse); border-radius:50%; animation: spin 1s linear infinite; display:inline-block; margin-right:4px; vertical-align: middle; }
.row.header.small{ font-weight:600; border-bottom:1px solid var(--color-border); padding-bottom:6px; margin-bottom:10px; }
.table{ display:grid; grid-auto-rows:minmax(32px,auto); row-gap:8px; }
.row{ display:grid; grid-template-columns: 1.2fr 1.2fr 1fr 1fr auto; align-items:center; gap:12px; padding:8px 4px; border-bottom:1px dashed var(--color-border); }
.row.header{ font-weight:600; border-bottom:1px solid var(--color-border); }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px; }
.new-key-warning{ margin-top:10px; background: rgba(16,185,129,.08); border:1px solid rgba(16,185,129,.35); padding:8px; border-radius:6px; }
.new-key-warning .note{ font-size:12px; margin-bottom:6px; color: var(--color-text-secondary); }
.token{ word-break: break-all; }
.actions .danger{ background:transparent; color: var(--color-error); border:1px solid var(--color-border); padding:6px 10px; border-radius:6px; cursor:pointer; }
.actions .primary{ background: var(--color-primary); color: var(--color-text-inverse); border:none; padding:6px 10px; border-radius:6px; cursor:pointer; }
.modal-footer{ display:flex; padding:var(--space-md) var(--space-lg); border-top:1px solid var(--color-border); }
.button-group{ display:flex; gap:var(--space-md); margin-left:auto; }
.cancel-btn{ background-color: transparent; color: var(--color-text); padding: var(--space-xs) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; font-size: var(--font-size-sm); font-weight: 500; }

@media (max-width: 600px){
  .create-grid{ grid-template-columns: 1fr; }
  .endpoint-control{ flex-direction: column; align-items: stretch; }
  .endpoint-verify{ flex-direction: column; align-items: flex-start; }
  .endpoint-secret{ flex-direction: column; align-items: flex-start; }
}
</style>


