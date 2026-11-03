import MessageService from '../services/MessageService.js'
import UserService from '../services/UserService.js'
import { getAuthorUid, getAuthorUserTag } from './messageCompat.js'

const getMessageAuthorUid = (msg) => getAuthorUid(msg)

const getMessageAuthorTag = (msg) => {
  if (!msg) return null
  return normalizeUserTag(getAuthorUserTag(msg) || msg.author?.userTag)
}

const normalizeUserTag = (tag) => {
  if (!tag) return null
  return String(tag).trim().replace(/^@/, '')
}

const resolveRecipientUid = async (recipient, cache) => {
  // Returns UID or null when it can't be resolved
  if (!recipient) return null

  if (typeof recipient === 'string') {
    if (recipient.startsWith('uid:')) return recipient.slice(4)
    const userTag = normalizeUserTag(recipient)
    if (!userTag) return null
    if (cache.has(userTag)) return cache.get(userTag)
    const user = await UserService.getUserByTag(userTag)
    const uid = user?.uid || null
    cache.set(userTag, uid)
    return uid
  }

  if (typeof recipient === 'object') {
    if (recipient.uid) return recipient.uid
    const userTag = normalizeUserTag(recipient.user_tag || recipient.userTag)
    if (!userTag) return null
    if (cache.has(userTag)) return cache.get(userTag)
    const user = await UserService.getUserByTag(userTag)
    const uid = user?.uid || null
    cache.set(userTag, uid)
    return uid
  }

  return null
}

// Ids from an already-loaded list. A recipient is left off messages they authored.
export function messageIdsExcludingAuthor(messages, { uid = null, tag = null } = {}) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => {
      if (!message?.id) return false
      if (uid) return getMessageAuthorUid(message) !== uid
      if (tag) return getMessageAuthorTag(message) !== tag
      return true
    })
    .map((message) => message.id)
}

function recipientRecord(recipientInput, uid) {
  if (typeof recipientInput === 'string') {
    const isUid = recipientInput.startsWith('uid:')
    return {
      uid: uid || (isUid ? recipientInput.slice(4) : null),
      user_tag: isUid ? null : normalizeUserTag(recipientInput),
    }
  }
  if (!recipientInput || typeof recipientInput !== 'object') {
    return { uid: uid || null, user_tag: null }
  }
  return {
    ...recipientInput,
    uid: uid || recipientInput.uid || null,
    user_tag: normalizeUserTag(recipientInput.user_tag || recipientInput.userTag),
  }
}

/**
 * Adds recipients to the given messages. Skips a message when the recipient
 * authored it. Does not discover further messages. Callers pass the loaded
 * branch, including the message the grant started from.
 *
 * Returns one entry per message the write included, so the caller can show
 * the recipient on messages already loaded. The server still ignores a
 * duplicate edge.
 */
export async function addRecipientsToMessagesExcludingAuthored(messages, recipients) {
  const chain = (Array.isArray(messages) ? messages : []).filter(Boolean)
  const tagToUidCache = new Map()

  // Dedupe by resolvable identity to avoid multiple calls for identical recipients.
  const dedupedByUid = new Map() // uid -> recipient input
  const dedupedByTag = new Map() // tag -> recipient input
  const nonResolvedRecipients = [] // neither uid nor tag

  for (const r of recipients || []) {
    const resolvedTag =
      typeof r === 'string'
        ? normalizeUserTag(r)
        : normalizeUserTag(r?.user_tag ?? r?.userTag)

    try {
      const uid = await resolveRecipientUid(r, tagToUidCache)
      if (uid) {
        if (!dedupedByUid.has(uid)) dedupedByUid.set(uid, r)
      } else if (resolvedTag) {
        if (!dedupedByTag.has(resolvedTag)) dedupedByTag.set(resolvedTag, r)
      } else {
        nonResolvedRecipients.push(r)
      }
    } catch (_) {
      if (resolvedTag) {
        if (!dedupedByTag.has(resolvedTag)) dedupedByTag.set(resolvedTag, r)
      } else {
        nonResolvedRecipients.push(r)
      }
    }
  }

  const additions = []
  const record = (messageIds, recipientInput, uid) => {
    const recipient = recipientRecord(recipientInput, uid)
    for (const messageId of messageIds) {
      additions.push({ messageId, recipient })
    }
  }

  // 1) Handle resolvable recipients with explicit message_ids.
  for (const [uid, recipientInput] of dedupedByUid.entries()) {
    const targetMessageIds = messageIdsExcludingAuthor(chain, { uid })
    if (targetMessageIds.length === 0) continue
    await MessageService.addRecipientsToMessage(targetMessageIds, [recipientInput], false)
    record(targetMessageIds, recipientInput, uid)
  }

  // 2) Fallback for recipients where we can match by author tag.
  for (const [tag, recipientInput] of dedupedByTag.entries()) {
    const targetMessageIds = messageIdsExcludingAuthor(chain, { tag })
    if (targetMessageIds.length === 0) continue
    await MessageService.addRecipientsToMessage(targetMessageIds, [recipientInput], false)
    record(targetMessageIds, recipientInput, null)
  }

  // 3) Final fallback for recipients we cannot identify: grant to every given message.
  if (nonResolvedRecipients.length > 0) {
    const targetMessageIds = messageIdsExcludingAuthor(chain)
    if (targetMessageIds.length > 0) {
      await MessageService.addRecipientsToMessage(targetMessageIds, nonResolvedRecipients, false)
      for (const recipientInput of nonResolvedRecipients) {
        record(targetMessageIds, recipientInput, null)
      }
    }
  }

  return additions
}
