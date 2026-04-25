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
      {{ resolvedDisplayName }}
    </span>
    <span 
      v-for="badge in resolvedBadges" 
      :key="badge.key"
      class="user-display__badge"
      :tabindex="badge.tooltip ? 0 : -1"
      role="img"
      :aria-label="badge.tooltip || badge.ariaLabel || badge.label"
      @mouseenter="($event) => onBadgeEnter($event, badge)"
      @mouseleave="onBadgeLeave"
      @focus="($event) => onBadgeEnter($event, badge)"
      @blur="onBadgeLeave"
    >
      {{ badge.content }}
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

  <Teleport to="body">
    <div
      v-if="tooltip.visible"
      class="user-display-tooltip"
      :style="tooltip.style"
      role="tooltip"
    >
      {{ tooltip.text }}
    </div>
  </Teleport>
</template>

<script setup>
  import { computed, reactive, onBeforeUnmount } from 'vue';

  const props = defineProps({
    title: {
      type: String,
      default: undefined
    },
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
  isImported: {
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

  const tooltip = reactive({
    visible: false,
    text: '',
    style: {}
  });

  const hideTooltip = () => {
    tooltip.visible = false;
  };

  const showTooltipForRect = (rect, text) => {
    if (!rect || !text) return;

    const margin = 8;
    const preferredAbove = rect.top > 28;
    const top = preferredAbove ? rect.top - 8 : rect.bottom + 8;
    const leftRaw = rect.left + rect.width / 2;
    const left = Math.min(Math.max(margin, leftRaw), window.innerWidth - margin);

    tooltip.text = text;
    tooltip.visible = true;
    tooltip.style = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      transform: preferredAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      zIndex: 'var(--z-index-tooltip, 300)'
    };
  };

  const onBadgeEnter = (event, badge) => {
    try {
      const target = event?.currentTarget || event?.target;
      if (!target?.getBoundingClientRect) return;
      const text = badge?.tooltip;
      if (!text) return;
      const rect = target.getBoundingClientRect();
      showTooltipForRect(rect, text);
    } catch {
      // no-op
    }
  };

  const onBadgeLeave = () => {
    hideTooltip();
  };

  window.addEventListener('scroll', onBadgeLeave, true);
  window.addEventListener('resize', onBadgeLeave);
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onBadgeLeave, true);
    window.removeEventListener('resize', onBadgeLeave);
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
      ariaLabel: 'Bot',
      tooltip: props.title || 'No version available'
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
  { 
    'user-display__name--current': props.isCurrentUser,
    'user-display__name--imported': props.isImported
  }
]);

const tagClasses = computed(() => [
  props.tagClass
]);
</script>

<style>
.user-display-tooltip {
  background: var(--color-surface, #222);
  color: var(--color-text, #fff);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  max-width: 260px;
  white-space: normal;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  border: 1px solid var(--color-border, #444);
  font-weight: 500;
  text-align: center;
}
</style>

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

.user-display__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  cursor: help;
  outline: none;
}

.user-display__badge:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
  border-radius: 4px;
}

.user-display__name--current {
  color: var(--color-primary);
}

.user-display__name--imported {
  font-style: italic;
  font-weight: 500;
}

.user-display__tag {
  font-size: 0.85em;
  color: var(--color-text-secondary);
  line-height: 1.2;
  white-space: nowrap;
}

.user-display-tooltip {
  background: var(--color-surface, #111);
  color: var(--color-text, #fff);
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  max-width: 260px;
  white-space: normal;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
  pointer-events: none;
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
