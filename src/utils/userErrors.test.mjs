import assert from 'node:assert/strict'
import { reportError, dismissPersistentError } from './userErrors.js'

function fakeStore() {
  const commits = []
  return {
    commits,
    commit(type, payload, options) {
      commits.push({ type, payload, options })
    },
  }
}

const toast = fakeStore()
reportError(toast, new Error('nope'), { message: 'Could not save' })
assert.equal(toast.commits.length, 1)
assert.equal(toast.commits[0].type, 'ui/SET_ERROR')
assert.equal(toast.commits[0].payload.message, 'Could not save')

const bar = fakeStore()
reportError(bar, 'offline', { persistent: true, code: 'thread_load_failed' })
assert.equal(bar.commits[0].type, 'ui/SET_PERSISTENT_ERROR')
assert.equal(bar.commits[0].payload.message, 'offline')
assert.equal(bar.commits[0].payload.code, 'thread_load_failed')

const clear = fakeStore()
dismissPersistentError(clear)
assert.equal(clear.commits[0].type, 'ui/CLEAR_PERSISTENT_ERROR')

const rooted = fakeStore()
reportError(rooted, 'offline', { persistent: true, root: true, message: 'Failed to load inbox messages' })
assert.deepEqual(rooted.commits[0].options, { root: true })
assert.equal(rooted.commits[0].payload.message, 'Failed to load inbox messages')
