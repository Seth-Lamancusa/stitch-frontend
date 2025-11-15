<script setup>
import { ref, watch, computed } from 'vue';
import { useStore } from 'vuex';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);
const store = useStore();

const displayName = ref('');
const userTag = ref('');
const endpoints = ref('');
const isBusy = ref(false);
const errorMessage = ref('');

watch(() => props.isOpen, (o) => {
  if (o) {
    displayName.value = '';
    userTag.value = '';
    endpoints.value = '';
    errorMessage.value = '';
    isBusy.value = false;
  }
});

const canSubmit = computed(() => !!displayName.value.trim() && !!userTag.value.trim() && !isBusy.value);

const close = () => emit('close');

const onCreate = async () => {
  if (!canSubmit.value) return;
  try {
    isBusy.value = true;
    errorMessage.value = '';
    const ep = endpoints.value && endpoints.value.trim() ? [endpoints.value.trim()] : [];
    const result = await store.dispatch('auth/createManagedUser', {
      display_name: displayName.value.trim(),
      user_tag: userTag.value.trim(),
      endpoints: ep,
      scopes: 'msg.read msg.write ws',
      private: false
    });
    try { await store.dispatch('ui/setSuccess', 'Managed user created'); } catch (_) {}
    try {
      const newUid = (result && (result.uid || result._key)) || null;
      if (newUid) {
        await store.dispatch('auth/switchPrincipal', { managedUid: newUid });
      }
    } catch (_) {}
    emit('close');
  } catch (e) {
    errorMessage.value = e?.message || 'Failed to create managed user';
  } finally {
    isBusy.value = false;
  }
};
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-card">
        <div class="header">
          <h3>Create Managed User</h3>
          <button class="close" @click="close">×</button>
        </div>
        <div class="body">
          <div class="field">
            <label>Display name</label>
            <input v-model="displayName" type="text" placeholder="e.g. Acme Bot" />
          </div>
          <div class="field">
            <label>User tag</label>
            <input v-model="userTag" type="text" placeholder="e.g. acmebot" />
          </div>
          <div class="field">
            <label>Endpoints (optional)</label>
            <input v-model="endpoints" type="text" placeholder="e.g. https://bot.example.com/hook" />
          </div>
        </div>
        <div class="footer">
          <div class="error" v-if="errorMessage">{{ errorMessage }}</div>
          <button class="btn" @click="close">Close</button>
          <button class="btn primary" :disabled="!canSubmit || isBusy" @click="onCreate">{{ isBusy ? 'Creating…' : 'Create' }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,.fade-leave-active{ transition: opacity 0.15s ease; }
.fade-enter-from,.fade-leave-to{ opacity: 0; }
.modal-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-card{ width: 92%; max-width: 460px; background: var(--color-surface,#111); color: var(--color-text,#fff); border:1px solid var(--color-border,#2a2a2a); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.header{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--color-border,#2a2a2a); }
.header h3{ margin:0; font-size:16px; }
.close{ background:transparent; border:1px solid var(--color-border,#2a2a2a); color: var(--color-text,#fff); border-radius:6px; padding: 2px 8px; cursor:pointer; }
.body{ padding: 14px; display:grid; gap:10px; }
.field{ display:grid; gap:6px; }
label{ font-size:12px; color: var(--color-text,#fff); opacity:0.9; }
input{ background: var(--color-input-background,#000); color: var(--color-text,#fff); border:1px solid var(--color-border,#2a2a2a); border-radius: 8px; padding: 8px 10px; }
.hint{ font-size: 12px; color: var(--color-text-secondary,#aaa); }
.footer{ display:flex; justify-content:flex-end; gap:10px; padding:12px 14px; border-top:1px solid var(--color-border,#2a2a2a); }
.btn{ background:transparent; color: var(--color-text,#fff); border:1px solid var(--color-border,#2a2a2a); border-radius:6px; padding:6px 10px; cursor:pointer; }
.btn.primary{ background: #fff; border-color: var(--color-border,#2a2a2a); color: #000; }
.btn:disabled{ opacity:0.6; cursor:not-allowed; }
.error{ margin-right:auto; color: var(--color-error, #ef4444); font-size: 12px; }
</style>

