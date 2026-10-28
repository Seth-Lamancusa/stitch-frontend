import { contentText } from './messageCompat.js'

const TEXT_TYPES = new Set(['message', 'note', 'document', 'annotation'])
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/

export function splitParagraphs(content) {
  if (typeof content !== 'string' || content.trim() === '') return []
  const parts = []
  const buf = []
  let fence = null
  let math = null

  function flush() {
    const text = buf.join('').replace(/^[\r\n]+|[\r\n]+$/g, '')
    buf.length = 0
    if (text.trim() === '') return
    parts.push({ representations: [{ type: 'text', content: text }] })
  }

  for (const line of content.split(/(?<=\n)/)) {
    const body = line.replace(/[\r\n]+$/, '')
    if (fence) {
      buf.push(line)
      if (isClosingFence(body, fence)) fence = null
      continue
    }
    if (math) {
      buf.push(line)
      math = advanceMath(body, math)
      continue
    }
    const opener = openingFence(body)
    if (opener) {
      buf.push(line)
      fence = opener
      continue
    }
    if (body.trim() === '') {
      if (buf.length) flush()
      continue
    }
    buf.push(line)
    math = advanceMath(body, null)
  }

  if (buf.length) flush()
  return parts
}

function fenceMatch(body) {
  const matched = FENCE.exec(body)
  if (!matched) return null
  return { char: matched[2][0], length: matched[2].length, info: matched[3] }
}

function openingFence(body) {
  const matched = fenceMatch(body)
  if (!matched) return null
  return { char: matched.char, length: matched.length }
}

function isClosingFence(body, open) {
  const matched = fenceMatch(body)
  if (!matched) return false
  return matched.char === open.char && matched.length >= open.length && matched.info.trim() === ''
}

function escaped(text, index) {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function advanceMath(text, state) {
  let index = 0
  while (index < text.length) {
    if (!state) {
      if (text.startsWith('$$', index) && !escaped(text, index)) {
        state = '$$'
        index += 2
        continue
      }
      if (text.startsWith('\\[', index)) {
        state = 'bracket'
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (state === '$$') {
      if (text.startsWith('$$', index) && !escaped(text, index)) {
        state = null
        index += 2
        continue
      }
      index += 1
      continue
    }
    if (text.startsWith('\\]', index)) {
      state = null
      index += 2
      continue
    }
    index += 1
  }
  return state
}

export function displayParts(message) {
  if (!message) return null
  const type = message.type || 'message'
  if (!TEXT_TYPES.has(type)) return null
  if (!Array.isArray(message.parts) || message.parts.length === 0) return null
  return message.parts
}

export function partText(part) {
  const representations = Array.isArray(part?.representations) ? part.representations : []
  const texts = representations
    .filter((item) => item && item.type === 'text' && typeof item.content === 'string')
    .map((item) => item.content)
  if (texts.length) return texts.join('\n\n')

  const file = representations.find((item) => item?.type === 'file')
  if (file) {
    const name = file.content?.filename
    return typeof name === 'string' && name ? name : 'File'
  }
  const call = representations.find((item) => item?.type === 'function_invocation')
  if (call) {
    const name = call.content?.name
    return typeof name === 'string' && name ? name : 'Function call'
  }
  if (representations.some((item) => item?.type === 'function_response')) return 'Function response'
  return ''
}

export function annotationRefs(message) {
  const raw = message?.annotations
  if (!Array.isArray(raw)) return []
  const refs = []
  for (const item of raw) {
    if (!item || typeof item.id !== 'string' || !item.id) continue
    const ref = { id: item.id }
    if (Number.isInteger(item.part) && item.part >= 0) ref.part = item.part
    refs.push(ref)
  }
  return refs
}

export function refsForPart(refs, index) {
  return (refs || []).filter((ref) => ref.part === index)
}

function createdTime(value) {
  if (value == null || value === '') return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

// Earlier annotations first. Refs without a created time keep their current order
// until that time is known, then they slot in.
export function orderAnnotationRefs(refs, createdAt) {
  const list = refs || []
  const lookup = typeof createdAt === 'function' ? createdAt : () => null
  return list
    .map((ref, index) => ({ ref, index, time: createdTime(lookup(ref)) }))
    .sort((a, b) => {
      if (a.time != null && b.time != null && a.time !== b.time) return a.time - b.time
      return a.index - b.index
    })
    .map((item) => item.ref)
}

export function wholeMessageRefs(refs) {
  return (refs || []).filter((ref) => ref.part == null)
}

export function withoutAnnotation(annotations, annotationId) {
  if (!Array.isArray(annotations)) return annotations
  return annotations.filter((item) => item && item.id !== annotationId)
}

export function previewLine(content, limit = 96) {
  const flat = contentText(content).replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat
  return `${flat.slice(0, limit - 1).trimEnd()}…`
}
