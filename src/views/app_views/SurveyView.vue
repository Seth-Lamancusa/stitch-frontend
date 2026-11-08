<template>
  <div class="survey-page">
    <form v-if="survey && !survey.submitted" class="card" @submit.prevent="submit">
      <p class="kicker">Stitch beta</p>
      <h1>Weekly survey</h1>
      <p class="week">{{ survey.week }}</p>
      <p class="note">{{ tierNote }}</p>
      <label v-for="question in survey.questions" :key="question.id" class="field">
        <span>{{ question.prompt }}</span>
        <textarea v-model="answers[question.id]" rows="4" :name="question.id" required></textarea>
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" class="primary" :disabled="busy">Submit</button>
      </div>
    </form>

    <section v-else-if="survey && survey.submitted" class="card">
      <p class="kicker">Stitch beta</p>
      <h1>Survey submitted</h1>
      <p class="week">{{ survey.week }}</p>
      <p class="note">Thanks. This week's answers are in.</p>
      <div v-for="question in survey.questions" :key="question.id" class="answer">
        <h2>{{ question.prompt }}</h2>
        <p>{{ survey.answers[question.id] }}</p>
      </div>
    </section>

    <section v-else class="card">
      <p class="kicker">Stitch beta</p>
      <h1>Weekly survey</h1>
      <p v-if="!ready" class="note">Loading…</p>
      <template v-else-if="!user">
        <p class="note">Sign in to open this survey. The link only works for the tester it was sent to.</p>
        <LoginButton />
      </template>
      <p v-else class="note">{{ error || "This survey isn't on your account." }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import LoginButton from '@/components/buttons/LoginButton.vue'
import apiClient from '@/services/apiClient'

const route = useRoute()
const store = useStore()
const user = computed(() => store.getters['auth/user'])
const ready = computed(() => store.getters['auth/authReady'])
const survey = ref(null)
const answers = reactive({})
const error = ref('')
const busy = ref(false)

const tierNote = computed(() => {
  if (survey.value?.tier === 'committed') {
    return 'This one counts toward your Committed tier.'
  }
  return 'This one is optional on the Uncommitted tier.'
})

const load = async () => {
  if (!user.value) {
    survey.value = null
    return
  }
  error.value = ''
  try {
    const response = await apiClient.get(`/beta/surveys/${route.params.week}`)
    survey.value = response.data
    for (const question of response.data.questions || []) {
      if (answers[question.id] == null) answers[question.id] = ''
    }
  } catch (err) {
    survey.value = null
    const status = err?.response?.status
    if (status === 400) error.value = "This link doesn't point at a survey."
    else if (status !== 404) error.value = 'The survey could not be opened.'
  }
}

const submit = async () => {
  busy.value = true
  error.value = ''
  try {
    const response = await apiClient.post(`/beta/surveys/${route.params.week}`, { answers })
    survey.value = response.data
  } catch (err) {
    if (err?.response?.status === 400) error.value = 'Answer each question.'
    else error.value = 'The survey could not be submitted.'
  } finally {
    busy.value = false
  }
}

watch([user, () => route.params.week, ready], () => {
  if (ready.value) load()
}, { immediate: true })
</script>

<style scoped>
.survey-page {
  height: 100%;
  overflow: auto;
  padding: 32px 16px 64px;
}
.card {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.kicker {
  margin: 0 0 8px;
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}
h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 500;
  color: var(--color-text);
}
.week, .note {
  color: var(--color-text-secondary);
}
.field {
  display: block;
  margin-top: 16px;
}
.field span, .answer h2 {
  display: block;
  margin-bottom: 6px;
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 500;
}
textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  resize: vertical;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.error {
  color: var(--color-error);
  margin-top: 12px;
}
.answer {
  margin-top: 16px;
}
.answer p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--color-text);
}
</style>
