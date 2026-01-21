<template>
  <component
    :is="tag"
    class="user-display"
    :class="wrapperClasses"
  >
    <slot name="prefix" />
    <span
      class="user-display__name"
      :class="nameClasses"
    >
      {{ displayNameWithBadges }}
    </span>
    <span
      v-if="shouldShowTag"
      class="user-display__tag"
      :class="tagClasses"
    >
      {{ formattedTag }}
    </span>
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  displayName: {
    type: [String, Number],
    default: ''
  },
  userTag: {
    type: [String, Number],
    default: ''
  },
  fallback: {
    type: String,
    default: 'Unknown'
  },
  showTag: {
    type: Boolean,
    default: true
  },
  isCurrentUser: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'message', 'header', 'menu', 'recipient', 'inline', 'badge'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg'].includes(value)
  },
  tag: {
    type: String,
    default: 'span'
  },
  nameClass: {
    type: [String, Array, Object],
    default: ''
  },
  tagClass: {
    type: [String, Array, Object],
    default: ''
  },
  wrapperClass: {
    type: [String, Array, Object],
    default: ''
  },
  uppercaseTag: {
    type: Boolean,
    default: false
  },
  isBot: {
    type: Boolean,
    default: false
  },
  badges: {
    type: Array,
    default: () => []
  },
  showAutoBadges: {
    type: Boolean,
    default: true
  }
});

const normalizeBadge = (badge, index) => {
  if (!badge && badge !== 0) return null;
  if (typeof badge === 'string' || typeof badge === 'number') {
    const text = String(badge);
    return {
      key: `badge-${index}-${text}`,
      label: text,
      content: text
    };
  }

  if (typeof badge === 'object') {
    const key =
      badge.key ||
      badge.id ||
      badge.label ||
      badge.text ||
      badge.icon ||
      `badge-${index}`;
    const content = badge.icon ?? badge.content ?? badge.text ?? badge.label ?? '';
    return {
      key,
      label: badge.label || badge.title || badge.ariaLabel || content || 'Badge',
      content,
      ariaLabel: badge.ariaLabel || badge.label || badge.title || content || 'Badge',
      class: badge.class || ''
    };
  }

  return null;
};

const normalizedTag = computed(() => {
  const raw =
    props.userTag ||
    props.user?.user_tag ||
    props.user?.userTag ||
    '';
  const value = String(raw || '').trim().replace(/^@+/, '');
  return value;
});

const isBotUser = computed(() => {
  return props.isBot || props.user?.is_bot === true || props.user?.isBot === true;
});

const resolvedBadges = computed(() => {
  const manualBadges = Array.isArray(props.badges)
    ? props.badges
        .map((badge, index) => normalizeBadge(badge, index))
        .filter(Boolean)
    : [];

  const hasBotBadge = manualBadges.some((badge) => badge.key === 'bot');

  if (props.showAutoBadges && isBotUser.value && !hasBotBadge) {
    manualBadges.push({
      key: 'bot',
      label: 'Bot',
      content: '🤖',
      ariaLabel: 'Bot'
    });
  }

  return manualBadges;
});

const resolvedDisplayName = computed(() => {
  const fromProps = String(props.displayName ?? '').trim();
  if (fromProps) return fromProps;
  const fromUser = String(props.user?.display_name ?? props.user?.displayName ?? '').trim();
  if (fromUser) return fromUser;
  if (normalizedTag.value) return `@${normalizedTag.value}`;
  return props.fallback;
});

const displayNameWithBadges = computed(() => {
  const baseName = resolvedDisplayName.value;
  if (resolvedBadges.value.length === 0) return baseName;
  
  // Append all badge content directly to the name text, with a preceding space
  const badgeText = resolvedBadges.value.map(b => b.content).join('');
  return `${baseName} ${badgeText}`;
});

const shouldShowTag = computed(() => props.showTag && !!normalizedTag.value);

const formattedTag = computed(() => {
  if (!normalizedTag.value) return '';
  const tagValue = props.uppercaseTag ? normalizedTag.value.toUpperCase() : normalizedTag.value;
  return `@${tagValue}`;
});

const wrapperClasses = computed(() => [
  props.wrapperClass,
  `user-display--variant-${props.variant}`,
  `user-display--size-${props.size}`,
  {
    'user-display--has-tag': shouldShowTag.value,
    'user-display--has-badges': resolvedBadges.value.length > 0
  }
]);

const nameClasses = computed(() => [
  props.nameClass,
  { 'user-display__name--current': props.isCurrentUser }
]);

const tagClasses = computed(() => [
  props.tagClass
]);
</script>

<style scoped>
.user-display {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.user-display__name {
  font-weight: 600;
  line-height: 1.2;
}

.user-display__name--current {
  color: var(--color-primary);
}

.user-display__tag {
  font-size: 0.85em;
  color: var(--color-text-secondary);
  line-height: 1.2;
  white-space: nowrap;
}


.user-display--variant-message .user-display__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-display--variant-recipient .user-display__name {
  font-weight: 500;
}

.user-display--variant-header .user-display,
.user-display--variant-menu .user-display {
  gap: 0.25rem;
}

.user-display--size-xs .user-display__name {
  font-size: 0.8rem;
}

.user-display--size-sm .user-display__name {
  font-size: 0.9rem;
}

.user-display--size-lg .user-display__name {
  font-size: 1.05rem;
}

</style>

