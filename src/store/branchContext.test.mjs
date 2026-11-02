import assert from 'node:assert/strict';
import {
  chooseBranchChild,
  contextChainMatches,
  continuationIds,
  earlierParentIds,
  loadedDescendantIds,
  resolvedBranchParent,
} from './branchContext.js';

const messages = {
  a: { id: 'a', timestamp: '2026-01-01T00:00:00Z' },
  b: { id: 'b', timestamp: '2026-01-02T00:00:00Z' },
  c: { id: 'c', timestamp: '2026-01-03T00:00:00Z' },
  m: {
    id: 'm',
    child_ids: ['a', 'c'],
    stitch_child_ids: ['b'],
    reply_order: ['a', 'c'],
    timestamp: '2026-01-04T00:00:00Z',
  },
};

assert.equal(resolvedBranchParent({ branch_parent: null, default_incoming: 'p', parent_id: 'q' }), null);
assert.equal(resolvedBranchParent({ default_incoming: 'p', parent_id: 'q' }), 'p');
assert.equal(resolvedBranchParent({ parent_id: 'q' }), 'q');
assert.equal(resolvedBranchParent({ branch_parent: 's', parent_id: 'q' }), 's');

assert.equal(chooseBranchChild({ ...messages.m, default_outgoing: 'b' }, messages), 'b');
assert.equal(chooseBranchChild(messages.m, messages), 'c');

assert.deepEqual(earlierParentIds({ branch_parent: null, default_incoming: 'p', parent_id: 'p', stitch_parent_ids: ['s'] }), ['p', 's']);
assert.deepEqual(earlierParentIds({ branch_parent: undefined, parent_id: 'p' }), []);

assert.deepEqual(
  continuationIds(
    { default_outgoing: 'a', child_ids: ['a', 'c'], stitch_child_ids: ['b'] },
    (id) => id !== 'a'
  ),
  ['a', 'c', 'b']
);

assert.equal(contextChainMatches(['c0', 'c1', 'm'], ['c0', 'c1'], 'm'), true);
assert.equal(contextChainMatches(['c0', 'm', 'child'], ['c0'], 'm'), false);
assert.equal(contextChainMatches(['c0', 'm'], ['c0', 'c1'], 'm'), false);

const graph = {
  m: { id: 'm', child_ids: ['child', 'c0'], branch_child: 'child', stitch_child_ids: ['stitch'] },
  child: { id: 'child', child_ids: ['grand'] },
  grand: { id: 'grand' },
  stitch: { id: 'stitch' },
  c0: { id: 'c0', child_ids: ['side'] },
  side: { id: 'side' },
};
assert.deepEqual(loadedDescendantIds(graph, 'm', ['c0', 'm']).sort(), ['child', 'grand', 'stitch']);

console.log('branch context ok');
