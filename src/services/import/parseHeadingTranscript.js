/**
 * Split a heading transcript into user and assistant turns.
 *
 * A turn starts at a line that is exactly `## User` or `## Assistant`.
 * An H1 title and any text before the first turn are dropped.
 * `###` sections, including tool blocks, stay inside the current turn.
 * A heading inside a fenced code block does not start a turn.
 *
 * This does not emit function_invocation, function_response, or file
 * messages. Tool labels in this format contain spaces, so they are not
 * function names, and the transcript has no tool results or files.
 */

const TURN = /^##[ \t]+(User|Assistant)[ \t]*$/i
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/

function openingFence(line) {
  const matched = FENCE.exec(line)
  if (!matched) return null
  return { char: matched[2][0], length: matched[2].length }
}

function closesFence(line, open) {
  const matched = FENCE.exec(line)
  if (!matched) return false
  const info = matched[3]
  return matched[2][0] === open.char && matched[2].length >= open.length && info.trim() === ''
}

export function parseHeadingTranscript(text) {
  if (typeof text !== 'string' || text.trim() === '') return []

  const messages = []
  let role = null
  const buf = []
  let fence = null

  function flush() {
    if (!role) {
      buf.length = 0
      return
    }
    const content = buf.join('\n').trim()
    buf.length = 0
    if (content) messages.push({ role, content })
  }

  for (const line of text.split(/\r?\n/)) {
    if (fence) {
      if (role) buf.push(line)
      if (closesFence(line, fence)) fence = null
      continue
    }

    const opener = openingFence(line)
    if (opener) {
      if (role) buf.push(line)
      fence = opener
      continue
    }

    const turn = TURN.exec(line)
    if (turn) {
      flush()
      role = turn[1].toLowerCase() === 'user' ? 'user' : 'assistant'
      continue
    }

    if (role) buf.push(line)
  }

  flush()
  return messages
}
