<template>
  <div class="whitelist-application">
    <!-- Progress Bar -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress" :style="{ width: `${progressPercentage}%` }"></div>
      </div>
      <div class="progress-text">Step {{ currentStep }} of {{ totalSteps }}</div>
    </div>

    <!-- Form Steps -->
    <div class="form-steps">
      <div v-for="(step, index) in steps" :key="index" v-show="currentStep === index + 1" class="form-step">
        <div class="question-header">
          <h3>{{ step.question }}</h3>
          <span v-if="step.optional" class="optional-badge">Optional</span>
          <span v-else class="required-badge">Required</span>
        </div>
        <div v-if="step.context" class="question-context">{{ step.context }}</div>
        
        <div class="form-group">
          <textarea
            v-model="step.answer"
            :placeholder="step.placeholder"
            rows="6"
            @focus="handleFocus"
            @blur="handleBlur"
          ></textarea>
          <div class="char-count" :class="{ 'near-limit': step.answer.length > step.maxLength * 0.9 }">
            {{ step.answer.length }}/{{ step.maxLength }}
          </div>
        </div>

        <div class="form-navigation">
          <button 
            v-if="currentStep > 1" 
            @click="prevStep" 
            class="btn-secondary"
            :disabled="submitting"
          >
            Back
          </button>
          <div class="nav-right">
            <button 
              v-if="currentStep < totalSteps" 
              @click="nextStep" 
              class="btn-primary"
              :disabled="!isStepValid(index + 1) || submitting"
            >
              Next
            </button>
            <button 
              v-else 
              @click="submitApplication" 
              class="btn-primary"
              :disabled="!isFormValid || submitting"
            >
              {{ submitting ? 'Submitting...' : 'Submit' }}
            </button>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="submitError" class="error-message">
          {{ submitError }}
        </div>
      </div>
    </div>

    <!-- Success Message -->
    <div v-if="submitted" class="success-message">
      <h3>Application Submitted!</h3>
      <p>Thank you for your application. We'll review it and get back to you soon.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import UserService from '../services/UserService.js';

const currentStep = ref(1);
const submitted = ref(false);
const submitting = ref(false);
const submitError = ref('');

const steps = ref([
  {
    question: "Who are you?",
    context: "Tell us about yourself. What do you identify with? What makes you unique?",
    placeholder: "Name, experiences, interests, accomplishments, beliefs, etc. What makes you you?",
    answer: "",
    maxLength: 1000,
    optional: true,
    key: "who_are_you"
  },
  {
    question: "What do you do?",
    context: "What is your occuptaion? You a student? What else do you do?",
    placeholder: "For fun, for work, for play, for learning, for living, etc. What's your lifestyle, in practice?",
    answer: "",
    maxLength: 1000,
    optional: true,
    key: "what_do_you_do"
  },
  {
    question: "Connections",
    context: "What people or communities do you have connections with?",
    placeholder: "Academics, artists, creators, entrepreneurs, politicians, athletes, your buddies from high school, etc.",
    answer: "",
    maxLength: 1000,
    optional: true,
    key: "connections"
  },
  {
    question: "Contact Info",
    context: "How can we reach you?",
    placeholder: "Email, phone number, GPS coordinates for a carrier pigeon, etc.",
    answer: "",
    maxLength: 500,
    optional: false,
    key: "contact_info"
  }
]);

const totalSteps = computed(() => steps.value.length);

const progressPercentage = computed(() => {
  return (currentStep.value / totalSteps.value) * 100;
});

const isStepValid = (stepNumber) => {
  const step = steps.value[stepNumber - 1];
  if (!step.optional && !step.answer.trim()) {
    return false;
  }
  return step.answer.length <= step.maxLength;
};

const isFormValid = computed(() => {
  return steps.value.every((step) => {
    if (step.optional) {
      return true; // Optional questions don't need validation
    }
    return step.answer.trim().length > 0;
  });
});

const nextStep = () => {
  if (currentStep.value < totalSteps.value) {
    currentStep.value++;
  }
};

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
};

const submitApplication = async () => {
  if (!isFormValid.value || submitting.value) {
    return;
  }

  submitting.value = true;
  submitError.value = '';

  try {
    // Build the application data object
    const applicationData = {};
    steps.value.forEach(step => {
      applicationData[step.key] = step.answer.trim();
    });

    console.log('Submitting application:', applicationData);
    
    const response = await UserService.submitWaitlistApplication(applicationData);
    
    if (response.success) {
      submitted.value = true;
      console.log('Application submitted successfully:', response.application_id);
    } else {
      throw new Error(response.message || 'Submission failed');
    }
  } catch (error) {
    console.error('Error submitting application:', error);
    submitError.value = error.response?.data?.detail || error.message || 'Failed to submit application. Please try again.';
  } finally {
    submitting.value = false;
  }
};

const handleFocus = (event) => {
  event.target.style.background = 'var(--card-background)';
};

const handleBlur = (event) => {
  event.target.style.background = 'var(--background-dark)';
};
</script>

<style>
.whitelist-application {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  background: rgba(30, 30, 30, 0.55);
  backdrop-filter: blur(10px);
  border-radius: var(--border-radius-lg);
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.progress-container {
  margin-bottom: 2rem;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  transition: width 0.3s ease;
  border-radius: 3px;
}

.progress-text {
  text-align: right;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.form-steps {
  margin-bottom: 2rem;
}

.form-step {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.question-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.question-header h3 {
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.5rem;
}

.question-context {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  line-height: 1.5;
}

.form-group {
  position: relative;
  margin-bottom: 1.5rem;
}

textarea {
  width: 100%;
  padding: 1rem;
  background: var(--background-dark);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--border-radius-md);
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  line-height: 1.5;
  resize: vertical;
  transition: all 0.3s ease;
}

textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.2);
}

.char-count {
  position: absolute;
  bottom: 0.5rem;
  right: 1rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}

.char-count.near-limit {
  color: var(--accent-color);
}

.form-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
}

.nav-right {
  margin-left: auto;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--border-radius-md);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 100px;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.optional-badge,
.required-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.optional-badge {
  background: rgba(147, 51, 234, 0.2);
  color: var(--accent-color);
}

.required-badge {
  background: rgba(16, 163, 127, 0.2);
  color: var(--primary-color);
}

.success-message {
  text-align: center;
  padding: 2rem;
  background: rgba(16, 163, 127, 0.1);
  border-radius: var(--border-radius-md);
  border: 1px solid rgba(16, 163, 127, 0.2);
}

.success-message h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.success-message p {
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(234, 68, 53, 0.1);
  border-radius: var(--border-radius-md);
  border: 1px solid rgba(234, 68, 53, 0.2);
  color: #ea4435;
  text-align: center;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .whitelist-application {
    padding: 1rem;
  }
  
  .question-header h3 {
    font-size: 1.3rem;
  }
  
  .question-context {
    font-size: 1rem;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress,
  .form-step,
  .btn-primary,
  .btn-secondary {
    transition: none;
  }
  
  .form-step {
    animation: none;
  }
}
</style> 