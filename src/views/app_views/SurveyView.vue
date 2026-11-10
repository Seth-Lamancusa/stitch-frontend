<template>
  <div class="survey-page">
    <form v-if="survey && !survey.submitted" class="card" @submit.prevent="submit">
      <p class="kicker">Stitch beta</p>
      <h1>Weekly survey</h1>
      <p class="week">{{ survey.date }}</p>
      <p v-if="tierNote" class="note">{{ tierNote }}</p>

      <div v-for="question in survey.questions" :key="question.id" class="field">
        <div class="prompt">
          <span>{{ question.prompt }}</span>
          <span v-if="question.required" class="required-indicator" title="Required">*</span>
        </div>

        <!-- Checkboxes type -->
        <template v-if="question.type === 'checkboxes'">
          <div class="checkbox-group">
            <label
              v-for="option in question.options"
              :key="option"
              class="checkbox-option"
            >
              <input
                type="checkbox"
                :value="option"
                v-model="answers[question.id].selected"
              />
              <span class="option-label">{{ option }}</span>
            </label>
          </div>
          <div v-if="question.text_prompt" class="subfield">
            <label :for="question.id + '-text'" class="subfield-label">
              {{ question.text_prompt }}
            </label>
            <textarea
              :id="question.id + '-text'"
              v-model="answers[question.id].text"
              rows="3"
              placeholder="Tell us more…"
            ></textarea>
          </div>
        </template>

        <!-- Rating type -->
        <template v-else-if="question.type === 'rating'">
          <div class="rating-wrapper">
            <div class="rating-group">
              <label
                v-for="val in [1, 2, 3, 4, 5]"
                :key="val"
                class="rating-option"
                :class="{ selected: answers[question.id] === val }"
              >
                <input
                  type="radio"
                  :name="question.id"
                  :value="val"
                  v-model="answers[question.id]"
                />
                <span class="rating-num">{{ val }}</span>
              </label>
            </div>
            <div v-if="question.min_label || question.max_label" class="rating-labels">
              <span class="label-min">1 = {{ question.min_label }}</span>
              <span class="label-max">5 = {{ question.max_label }}</span>
            </div>
          </div>
        </template>

        <!-- Rating group / matrix type -->
        <template v-else-if="question.type === 'rating_group'">
          <div class="matrix-container">
            <div v-if="question.min_label || question.max_label" class="matrix-legend">
              <span class="label-min">1 = {{ question.min_label }}</span>
              <span class="label-max">5 = {{ question.max_label }}</span>
            </div>
            <div
              v-for="item in question.items"
              :key="item.id"
              class="matrix-row"
            >
              <div class="matrix-item-label">{{ item.label }}</div>
              <div class="rating-group matrix-rating">
                <label
                  v-for="val in [1, 2, 3, 4, 5]"
                  :key="val"
                  class="rating-option"
                  :class="{ selected: answers[question.id]?.[item.id] === val }"
                >
                  <input
                    type="radio"
                    :name="`${question.id}-${item.id}`"
                    :value="val"
                    v-model="answers[question.id][item.id]"
                  />
                  <span class="rating-num">{{ val }}</span>
                </label>
              </div>
            </div>
          </div>
        </template>

        <!-- Select one (radio) type -->
        <template v-else-if="question.type === 'select_one'">
          <div class="radio-group">
            <label
              v-for="option in question.options"
              :key="option"
              class="radio-option"
            >
              <input
                type="radio"
                :name="question.id"
                :value="option"
                v-model="answers[question.id]"
              />
              <span class="option-label">{{ option }}</span>
            </label>
          </div>
        </template>

        <!-- Default: Textarea -->
        <template v-else>
          <textarea
            v-model="answers[question.id]"
            rows="3"
            :name="question.id"
            :required="question.required"
            :placeholder="question.placeholder || 'Your response…'"
          ></textarea>
        </template>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="submit" class="primary" :disabled="busy">Submit</button>
      </div>
    </form>

    <section v-else-if="survey && survey.submitted" class="card">
      <p class="kicker">Stitch beta</p>
      <h1>Survey submitted</h1>
      <p class="week">{{ survey.date }}</p>
      <p class="note">Thanks. This week's answers are in.</p>
      <div v-for="question in survey.questions" :key="question.id" class="answer">
        <h2>{{ question.prompt }}</h2>

        <!-- Checkbox answers -->
        <template v-if="isCheckboxAnswer(survey.answers?.[question.id])">
          <ul v-if="survey.answers[question.id].selected?.length" class="selected-list">
            <li v-for="item in survey.answers[question.id].selected" :key="item">
              {{ item }}
            </li>
          </ul>
          <p v-else-if="!survey.answers[question.id].text" class="empty-answer">None selected</p>
          <p v-if="survey.answers[question.id].text" class="answer-text">
            {{ survey.answers[question.id].text }}
          </p>
        </template>

        <!-- Rating group answers -->
        <template v-else-if="question.type === 'rating_group'">
          <div class="submitted-matrix">
            <div
              v-for="item in question.items"
              :key="item.id"
              class="submitted-matrix-row"
            >
              <span class="item-name">{{ item.label }}:</span>
              <span class="item-score">
                {{ survey.answers?.[question.id]?.[item.id] != null ? `${survey.answers[question.id][item.id]} / 5` : 'Not rated' }}
              </span>
            </div>
          </div>
        </template>

        <!-- Rating answer -->
        <template v-else-if="question.type === 'rating'">
          <p class="answer-text score-text">
            <strong>{{ survey.answers?.[question.id] != null ? `${survey.answers[question.id]} / 5` : 'Not rated' }}</strong>
            <span v-if="survey.answers?.[question.id] && (question.min_label || question.max_label)" class="score-context">
              (1: {{ question.min_label }}, 5: {{ question.max_label }})
            </span>
          </p>
        </template>

        <!-- Array fallback -->
        <template v-else-if="Array.isArray(survey.answers?.[question.id])">
          <ul class="selected-list">
            <li v-for="item in survey.answers[question.id]" :key="item">{{ item }}</li>
          </ul>
        </template>

        <!-- Text / fallback -->
        <template v-else>
          <p v-if="survey.answers?.[question.id]" class="answer-text">{{ survey.answers[question.id] }}</p>
          <p v-else class="empty-answer">No response provided</p>
        </template>
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
  return ''
})

const isCheckboxAnswer = (ans) => {
  return ans != null && typeof ans === 'object' && !Array.isArray(ans) && ('selected' in ans || 'text' in ans)
}

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
      if (answers[question.id] == null) {
        if (question.type === 'checkboxes') {
          answers[question.id] = { selected: [], text: '' }
        } else if (question.type === 'rating_group') {
          const group = {}
          for (const item of question.items || []) {
            group[item.id] = null
          }
          answers[question.id] = group
        } else if (question.type === 'rating') {
          answers[question.id] = null
        } else {
          answers[question.id] = ''
        }
      }
    }
  } catch (err) {
    survey.value = null
    const status = err?.response?.status
    if (status === 400) error.value = "This link doesn't point at a survey."
    else if (status !== 404) error.value = 'The survey could not be opened.'
  }
}

const submit = async () => {
  for (const question of survey.value?.questions || []) {
    if (question.required) {
      const val = answers[question.id]
      if (question.type === 'checkboxes') {
        const hasSelected = Array.isArray(val?.selected) && val.selected.length > 0
        const hasText = Boolean(val?.text && String(val.text).trim())
        if (!hasSelected && !hasText) {
          error.value = `Please answer "${question.prompt}" (select at least one option or enter details).`
          return
        }
      } else if (question.type === 'rating_group') {
        for (const item of question.items || []) {
          const itemVal = val?.[item.id]
          if (itemVal == null || itemVal === '') {
            error.value = `Please rate "${item.label}" under "${question.prompt}".`
            return
          }
        }
      } else if (question.type === 'rating') {
        if (val == null || val === '') {
          error.value = `Please provide a rating for "${question.prompt}".`
          return
        }
      } else if (!val || !String(val).trim()) {
        error.value = `Please complete the required field: "${question.prompt}".`
        return
      }
    }
  }

  busy.value = true
  error.value = ''
  try {
    const response = await apiClient.post(`/beta/surveys/${route.params.week}`, { answers })
    survey.value = response.data
  } catch (err) {
    if (err?.response?.status === 400) error.value = 'Please complete the required questions.'
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
  max-width: 600px;
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
  margin-top: 24px;
}
.prompt, .answer h2 {
  display: block;
  margin-bottom: 8px;
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 500;
}
.required-indicator {
  color: var(--color-error);
  margin-left: 4px;
}
.checkbox-group, .radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.checkbox-option, .radio-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 0.95rem;
  color: var(--color-text);
}
.checkbox-option input[type="checkbox"],
.radio-option input[type="radio"] {
  cursor: pointer;
  width: 17px;
  height: 17px;
  accent-color: var(--color-primary);
}
.option-label {
  line-height: 1.4;
}
.subfield {
  margin-top: 14px;
}
.subfield-label {
  display: block;
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
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
.rating-wrapper {
  margin-top: 8px;
}
.rating-group {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.rating-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
.rating-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.rating-option input[type="radio"] {
  display: none;
}
.rating-option:hover {
  background: var(--color-hover-overlay, rgba(255, 255, 255, 0.05));
}
.rating-option.selected {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
}
.matrix-container {
  margin-top: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  overflow: hidden;
}
.matrix-legend {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  background: var(--color-hover-overlay, rgba(255, 255, 255, 0.03));
  border-bottom: 1px solid var(--color-border);
}
.matrix-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}
.matrix-row:last-child {
  border-bottom: none;
}
.matrix-item-label {
  font-size: 0.95rem;
  color: var(--color-text);
  font-weight: 500;
}
.matrix-rating {
  margin-top: 4px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 28px;
}
.primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.error {
  color: var(--color-error);
  margin-top: 14px;
}
.answer {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.answer:first-of-type {
  border-top: none;
  padding-top: 0;
}
.selected-list {
  margin: 6px 0 10px 20px;
  padding: 0;
  color: var(--color-text);
}
.selected-list li {
  margin-bottom: 4px;
}
.empty-answer {
  color: var(--color-text-secondary);
  font-style: italic;
  margin: 4px 0;
}
.answer-text {
  margin: 6px 0 0;
  white-space: pre-wrap;
  color: var(--color-text);
}
.submitted-matrix {
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.submitted-matrix-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--color-hover-overlay, rgba(255, 255, 255, 0.03));
  border-radius: var(--radius-sm);
  font-size: 0.92rem;
}
.item-name {
  color: var(--color-text);
}
.item-score {
  font-weight: 600;
  color: var(--color-primary);
}
.score-text {
  display: flex;
  align-items: center;
  gap: 8px;
}
.score-context {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}
</style>
