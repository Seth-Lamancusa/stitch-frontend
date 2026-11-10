import assert from 'node:assert/strict';
import {
  activeContextWalk,
  branchRowKey,
  chooseBranchChild,
  contextChainMatches,
  missingVisibleHop,
  contextWalkIds,
  continuationIds,
  earlierParentIds,
  loadedDescendantIds,
  resolvedBranchParent,
  uniqueIds,
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

const stitchCenter = {
  id: 'm',
  parent_id: 'p',
  default_incoming: 'sp',
  stitch_parent_ids: ['sp'],
  child_ids: ['a'],
  stitch_child_ids: ['b'],
  default_outgoing: 'b',
  branch_child: 'b',
};
const loadedAroundStitch = {
  m: stitchCenter,
  a: messages.a,
  p: { id: 'p', parent_id: null },
};
assert.equal(missingVisibleHop(stitchCenter, loadedAroundStitch, 'down', 5), 'b');
assert.equal(missingVisibleHop(stitchCenter, loadedAroundStitch, 'up', 5), 'sp');
assert.equal(missingVisibleHop(stitchCenter, { ...loadedAroundStitch, b: messages.b, sp: { id: 'sp' } }, 'down', 5), null);
assert.equal(missingVisibleHop({ id: 'm', branch_parent: null, default_incoming: 'sp', parent_id: 'p' }, loadedAroundStitch, 'up', 5), null);
assert.equal(missingVisibleHop({ id: 'm', child_ids: ['a'], branch_child: 'a' }, { m: { id: 'm', child_ids: ['a'], branch_child: 'a' }, a: messages.a }, 'down', 5), null);
assert.equal(chooseBranchChild(messages.m, messages), 'c');
assert.equal(chooseBranchChild({ id: 'm', child_ids: [], stitch_child_ids: ['b'] }, messages), null);
assert.equal(chooseBranchChild({ id: 'm', child_ids: ['a'], stitch_child_ids: ['c'] }, { c: messages.c }), null);

assert.deepEqual(uniqueIds(['s', 's', '', null, 't', 's']), ['s', 't']);
assert.deepEqual(uniqueIds(undefined), []);
assert.deepEqual(earlierParentIds({ branch_parent: null, default_incoming: 'p', parent_id: 'p', stitch_parent_ids: ['s'] }), ['p', 's']);
assert.deepEqual(earlierParentIds({ branch_parent: null, stitch_parent_ids: ['s', 's'] }), ['s']);
assert.deepEqual(earlierParentIds({ branch_parent: undefined, parent_id: 'p' }), []);

assert.deepEqual(
  continuationIds(
    { default_outgoing: 'a', child_ids: ['a', 'c'], stitch_child_ids: ['b'] },
    (id) => id !== 'a'
  ),
  ['a', 'c', 'b']
);

assert.deepEqual(contextWalkIds(['b', 'a', 'b'], 'm'), ['b', 'a', 'b', 'm']);
assert.deepEqual(contextWalkIds([null, '', 'a'], 'm'), ['a', 'm']);
assert.equal(activeContextWalk(null), null);
assert.equal(activeContextWalk({ anchorId: 'm' }), null);
assert.deepEqual(activeContextWalk({ anchorId: 'm', ids: ['b', 'a', 'b', 'm'] }), ['b', 'a', 'b', 'm']);
assert.equal(branchRowKey('b', 0, false), 'b');
assert.equal(branchRowKey('b', 2, true), 'walk:2:b');

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
