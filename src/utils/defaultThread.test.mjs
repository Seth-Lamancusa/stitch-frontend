import assert from 'node:assert/strict';
import { defaultThreadWrites } from './defaultThread.js';

const chain = [
  { id: 'a', child_ids: ['b'], default_outgoing: null },
  { id: 'b', parent_id: 'a', child_ids: ['c'], stitch_parent_ids: [], default_incoming: null, default_outgoing: null },
  { id: 'c', parent_id: 'b', default_incoming: null },
];

const everyone = () => true;
const nobody = () => false;

const both = defaultThreadWrites(chain, 'both', everyone);
assert.deepEqual(both.writes, [
  { messageId: 'a', field: 'default_outgoing', value: 'b' },
  { messageId: 'b', field: 'default_incoming', value: 'a' },
  { messageId: 'b', field: 'default_outgoing', value: 'c' },
  { messageId: 'c', field: 'default_incoming', value: 'b' },
]);

const outgoing = defaultThreadWrites(chain, 'outgoing', everyone);
assert.deepEqual(outgoing.writes.map((write) => write.field), ['default_outgoing', 'default_outgoing']);
assert.deepEqual(outgoing.writes.map((write) => [write.messageId, write.value]), [['a', 'b'], ['b', 'c']]);

const incoming = defaultThreadWrites(chain, 'incoming', everyone);
assert.deepEqual(incoming.writes.map((write) => [write.messageId, write.value]), [['b', 'a'], ['c', 'b']]);

const already = defaultThreadWrites([
  { id: 'a', child_ids: ['b'], default_outgoing: 'b' },
  { id: 'b', parent_id: 'a', default_incoming: 'a' },
], 'both', everyone);
assert.deepEqual(already.writes, []);
assert.equal(already.skipped.unchanged, 2);

const stitch = defaultThreadWrites([
  { id: 'a', stitch_child_ids: ['b'] },
  { id: 'b', stitch_parent_ids: ['a'] },
], 'both', everyone);
assert.deepEqual(stitch.writes, [
  { messageId: 'a', field: 'default_outgoing', value: 'b' },
  { messageId: 'b', field: 'default_incoming', value: 'a' },
]);

const unlinked = defaultThreadWrites([
  { id: 'a', child_ids: ['other'] },
  { id: 'b', parent_id: 'other' },
], 'both', everyone);
assert.deepEqual(unlinked.writes, []);
assert.equal(unlinked.skipped.unlinked, 2);

const blocked = defaultThreadWrites(chain, 'outgoing', nobody);
assert.deepEqual(blocked.writes, []);
assert.equal(blocked.skipped.permission, 2);

assert.deepEqual(defaultThreadWrites([chain[0]], 'both', everyone).writes, []);
