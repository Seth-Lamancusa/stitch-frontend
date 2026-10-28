export function actionById(actions, id) {
  return (actions || []).find((action) => action.id === id) || null
}

export function visibleAction(action) {
  if (!action) return false
  if (action.condition && !action.condition()) return false
  return true
}

export function compactHeaderActions(actions) {
  return ['copy-text']
    .map((id) => actionById(actions, id))
    .filter(visibleAction)
}

export function compactToolbarActions(actions) {
  return ['reply', 'prompt', 'save']
    .map((id) => actionById(actions, id))
    .filter(visibleAction)
}

export function compactOverflowFromMenu(menuActions) {
  return (menuActions || []).filter(visibleAction)
}

export function extraCompactMoreActions({
  existingTags = [],
  existingChannels = [],
  isPublic = false,
  canToggleVisibility = false,
  isUserRecipient = false,
  isMessageUnread = false,
  isTogglingReadStatus = false,
  isAutoMarkingAsRead = false,
  canDelete = false,
  canAddSubject = false,
  hasSubject = false,
  isAddingSubject = false,
  openTagsModal,
  openChannelsModal,
  toggleVisibility,
  toggleReadStatus,
  deleteMessage,
  startAddingSubject
} = {}) {
  const extras = [
    {
      id: 'tags',
      emoji: '🏷️',
      text: `Tags (${existingTags.length})`,
      handler: openTagsModal
    },
    {
      id: 'channels',
      emoji: '📡',
      text: `Channels (${existingChannels.length})`,
      handler: openChannelsModal
    },
    {
      id: 'visibility',
      emoji: '🌍',
      text: isPublic ? 'Public' : 'Private',
      handler: toggleVisibility,
      disabled: () => !canToggleVisibility
    }
  ]

  if (isUserRecipient) {
    extras.push({
      id: 'read-status',
      emoji: isMessageUnread ? '✉️' : '📭',
      text: isAutoMarkingAsRead
        ? 'Marking read…'
        : (isMessageUnread ? 'Mark as read' : 'Mark as unread'),
      handler: toggleReadStatus,
      disabled: () => isTogglingReadStatus || isAutoMarkingAsRead,
      loading: () => isTogglingReadStatus || isAutoMarkingAsRead
    })
  }

  if (canDelete) {
    extras.push({
      id: 'delete',
      emoji: '🗑️',
      text: 'Delete',
      handler: deleteMessage
    })
  }

  if (canAddSubject && !hasSubject && !isAddingSubject) {
    extras.push({
      id: 'add-subject',
      emoji: '✏️',
      text: 'Add subject',
      handler: startAddingSubject
    })
  }

  return extras
}
