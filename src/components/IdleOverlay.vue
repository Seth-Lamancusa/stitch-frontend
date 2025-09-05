<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import WebSocketService from '@/services/ws/WebSocketService';

const store = useStore();

const isOpen = computed(() => store.getters['ui/isIdle']);
const user = computed(() => store.getters['auth/user']);
const isEmailVerified = computed(() => !!(user.value?.is_email_verified));
const isPhoneVerified = computed(() => !!(user.value?.is_phone_verified));
const isEndpointVerified = computed(() => !!((user.value?.contacts || []).some(c => c.type === 'endpoint' && c.verified)));

// Mirror fields from ProfileEditModal
const email = ref('');
const phoneNumber = ref('');
const notifyPrefs = ref({ email: false, phone: false, endpoint: false });

const busy = ref(false);
const error = ref('');

function resetFields() {
  const u = user.value || {};
  email.value = u.email || '';
  phoneNumber.value = u.phone_number || '';
  const contacts = (u.contacts || []);
  notifyPrefs.value = {
    email: !!contacts.find(c => c.type==='email' && c.notify),
    phone: !!contacts.find(c => c.type==='phone' && c.notify),
    endpoint: !!contacts.find(c => c.type==='endpoint' && c.notify)
  };
}

resetFields();

async function saveContactPrefs() {
  const payload = {};
  try {
    // Include changed email/phone
    if (user.value?.email !== email.value) payload.email = email.value || null;
    if (user.value?.phone_number !== phoneNumber.value) payload.phone_number = phoneNumber.value || null;
    // Include notify prefs
    payload.notify = { ...notifyPrefs.value };
    await store.dispatch('auth/updateProfile', payload);
    resetFields();
  } catch (e) {
    error.value = e.message || 'Failed to save contact preferences';
    setTimeout(() => { error.value = ''; }, 2500);
  }
}

async function refreshAndReconnect() {
  try {
    busy.value = true;
    error.value = '';
    // Save any edits first (best-effort)
    await saveContactPrefs();

    // Reconnect WS with current token
    const token = localStorage.getItem('auth_token');
    if (token) {
      await WebSocketService.connectUser(token);
    }

    // Mirror page load per route
    const path = window.location.pathname || '';
    if (path.startsWith('/messages/')) {
      const id = path.split('/').pop();
      if (id) {
        await store.dispatch('messages/loadMessageRadius', { messageId: id, radius: 5, get_replies: true });
      }
    } else if (path.startsWith('/inbox')) {
      await store.dispatch('messages/fetchUserMessages', { page: 1 });
    } else if (path.startsWith('/public')) {
      await store.dispatch('messages/fetchMessages', { mode: 'public' });
    }

    // Refresh unread count
    await store.dispatch('messages/fetchUnreadMessageCount');

    // Exit idle
    await store.dispatch('ui/exitIdle');
  } catch (e) {
    error.value = e.message || 'Refresh failed. Please try again.';
  } finally {
    busy.value = false;
  }
}

function dismiss() {
  store.dispatch('ui/exitIdle');
}
</script>

<template>
  <transition name="fade">
    <div v-if="isOpen" class="idle-overlay">
      <div class="idle-modal" @click.stop>
        <h3>Session inactive. Message notifs going to email / SMS.</h3>

        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" placeholder="you@example.com" />
          <div class="hint">Must be verified to enable notifications.</div>
        </div>

        <div class="form-group">
          <label>Phone</label>
          <input v-model="phoneNumber" type="tel" placeholder="(555) 123-4567" />
        </div>

        <div class="form-group">
          <label>Notify</label>
          <div class="toggles">
            <label :class="{ disabled: !isEmailVerified }"><input type="checkbox" v-model="notifyPrefs.email" :disabled="!isEmailVerified" /> Email</label>
            <label :class="{ disabled: !isPhoneVerified || !isEmailVerified }"><input type="checkbox" v-model="notifyPrefs.phone" :disabled="!isPhoneVerified || !isEmailVerified" /> Phone</label>
            <label :class="{ disabled: !isEndpointVerified || !isEmailVerified }"><input type="checkbox" v-model="notifyPrefs.endpoint" :disabled="!isEndpointVerified || !isEmailVerified" /> Endpoint</label>
          </div>
        </div>

        <div v-if="error" class="error">{{ error }}</div>

        <div class="actions">
          <button class="refresh" @click="refreshAndReconnect" :disabled="busy">
            <span v-if="busy">Refreshing…</span>
            <span v-else>Refresh & reconnect</span>
          </button>
          <button class="close" @click="dismiss" :disabled="busy">Close</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,.fade-leave-active{ transition: opacity 150ms ease; }
.fade-enter-from,.fade-leave-to{ opacity:0; }
.idle-overlay{
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display:flex; align-items:center; justify-content:center; z-index: 9999;
}
.idle-modal{
  width: 92%; max-width: 520px; background: var(--color-surface);
  border:1px solid var(--color-border); border-radius: 10px; padding: 16px; color: var(--color-text);
}
.form-group{ margin: 10px 0; }
label{ font-size: 12px; font-weight: 600; color: var(--color-text-secondary); display:block; margin-bottom: 4px; }
input{ width:100%; padding:8px 10px; border:1px solid var(--color-border); border-radius:8px; background: var(--color-input-background); color: var(--color-text); }
.hint{ font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }
.toggles{ display:flex; gap: 12px; }
.actions{ display:flex; gap: 10px; justify-content:flex-end; margin-top: 14px; }
.refresh{ background: var(--color-primary); color: var(--color-text-inverse); border:none; border-radius:8px; padding:8px 14px; cursor:pointer; }
.close{ background: transparent; color: var(--color-text); border:1px solid var(--color-border); border-radius:8px; padding:8px 14px; cursor:pointer; }
.error{ color: var(--color-error); font-size: 12px; margin-top: 6px; }
</style>


