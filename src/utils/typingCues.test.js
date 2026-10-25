import { authorsAt, sweepEntries, typingLabel, TYPING_TTL_MS } from './typingCues.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const gpt = { uid: 'bot-gpt', user_tag: 'gpt', display_name: 'GPT' }
const claude = { uid: 'bot-claude', user_tag: 'claude', display_name: 'Claude' }

test('label lists one author, two authors, then a count', () => {
  assert.equal(typingLabel([gpt]), '@gpt is typing')
  assert.equal(typingLabel([claude, gpt]), '@claude, @gpt are typing')
  assert.equal(typingLabel([gpt, claude, { uid: 'c', user_tag: 'qwen' }]), '@gpt +2 are typing')
})

test('sweep drops a cue that was not refreshed inside the ttl', () => {
  const entries = {
    'bot-gpt\0msg': { author: gpt, targetMessageId: 'msg', at: 0 }
  }
  assert.deepEqual(sweepEntries(entries, TYPING_TTL_MS - 1), entries)
  assert.deepEqual(sweepEntries(entries, TYPING_TTL_MS), {})
})

test('authorsAt only returns cues for that message', () => {
  const entries = {
    'bot-gpt\0msg': { author: gpt, targetMessageId: 'msg', at: 1 },
    'bot-claude\0other': { author: claude, targetMessageId: 'other', at: 1 }
  }
  assert.deepEqual(authorsAt(entries, 'msg'), [gpt])
  assert.equal(authorsAt(entries, 'missing').length, 0)
})
