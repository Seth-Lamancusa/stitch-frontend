<script setup>
import { ref, onMounted, watch } from 'vue';
import ApiKeysService from '@/services/ApiKeysService';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);

const loading = ref(false);
const errorMessage = ref('');
const keys = ref([]);
const creating = ref(false);
const newKeyLabel = ref('');
const newKeyScopes = ref('');
const createdKeyToken = ref('');

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

onMounted(() => { if (props.isOpen) loadKeys(); });

watch(() => props.isOpen, (open) => {
  if (open) loadKeys();
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
</style>


