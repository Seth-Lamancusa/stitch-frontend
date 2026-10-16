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

/**
 * Adds recipients to the origin message + visible ancestors, but skips adding
 * a recipient to any message in the ancestor chain where that recipient is
 * the message author.
 */
export async function addRecipientsToAncestorsExcludingAuthoredMessages({
  originMessageId,
  recipients,
  addToAncestors,
  maxDepth = 100,
}) {
  if (!addToAncestors) {
    return MessageService.addRecipientsToMessage(originMessageId, recipients, false)
  }

  const resp = await MessageService.traverseFrom(originMessageId, {
    up_depth: maxDepth,
    down_depth: 0,
    get_replies: true,
    get_children: false,
    edge_type: 'replies',
  })
  const data = resp?.data || {}
  const chain = [data.origin, ...(Array.isArray(data.messages) ? data.messages : [])].filter(Boolean)

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

  // 1) Handle resolvable recipients with explicit message_ids.
  for (const [uid, recipientInput] of dedupedByUid.entries()) {
    const targetMessageIds = chain
      .filter((m) => getMessageAuthorUid(m) !== uid)
      .map((m) => m.id)

    if (targetMessageIds.length === 0) continue
    await MessageService.addRecipientsToMessage(targetMessageIds, [recipientInput], false)
  }

  // 2) Fallback for recipients where we can match by author tag.
  for (const [tag, recipientInput] of dedupedByTag.entries()) {
    const targetMessageIds = chain
      .filter((m) => getMessageAuthorTag(m) !== tag)
      .map((m) => m.id)

    if (targetMessageIds.length === 0) continue
    await MessageService.addRecipientsToMessage(targetMessageIds, [recipientInput], false)
  }

  // 3) Final fallback for recipients we cannot identify: grant to all traversed ancestors.
  if (nonResolvedRecipients.length > 0) {
    const targetMessageIds = chain.map((m) => m.id)
    if (targetMessageIds.length > 0) {
      await MessageService.addRecipientsToMessage(targetMessageIds, nonResolvedRecipients, false)
    }
  }
}
