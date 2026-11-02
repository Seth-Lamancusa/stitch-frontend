import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHeadingTranscript } from './parseHeadingTranscript.js'

const SAMPLE = `# Stitch frontend cursor import

## User

Is there still an active import from cursor path in the stitch frontend

## Assistant

I'll look through the stitch frontend for any still-active imports.

### Tool Ripgrep Raw Search

\`\`\`
{"pattern":"cursor","path":"/home/seth/code/stitch"}
\`\`\`

### Tool Glob File Search

\`\`\`
{"globPattern":"**/*.{js,vue}"}
\`\`\`

## Assistant

The Cursor import endpoint is no longer used.
`

test('splits user and assistant turns and keeps tool sections in the assistant', () => {
  const messages = parseHeadingTranscript(SAMPLE)
  assert.deepEqual(messages.map((message) => message.role), ['user', 'assistant', 'assistant'])
  assert.equal(messages[0].content, 'Is there still an active import from cursor path in the stitch frontend')
  assert.match(messages[1].content, /^I'll look through the stitch frontend/)
  assert.match(messages[1].content, /### Tool Ripgrep Raw Search/)
  assert.match(messages[1].content, /### Tool Glob File Search/)
  assert.equal(messages[2].content, 'The Cursor import endpoint is no longer used.')
  assert.equal(messages.some((message) => message.content.includes('# Stitch frontend cursor import')), false)
})

test('a heading inside a fence stays in the current turn', () => {
  const text = `## Assistant

See this example:

\`\`\`
## User

not a turn
\`\`\`

Still the assistant.
`
  const messages = parseHeadingTranscript(text)
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'assistant')
  assert.match(messages[0].content, /## User/)
  assert.match(messages[0].content, /Still the assistant\./)
})

test('empty input and a title with no turns produce no messages', () => {
  assert.deepEqual(parseHeadingTranscript(''), [])
  assert.deepEqual(parseHeadingTranscript('# Just a title\n\nSome notes.'), [])
})
