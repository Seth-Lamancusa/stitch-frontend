import assert from 'node:assert/strict';
import test from 'node:test';
import { fenceLabelFromClass, fenceLabelFromInfo } from './fenceLabel.js';

test('a plain label is the first word after the opening ticks', () => {
  assert.equal(fenceLabelFromInfo('python'), 'python');
  assert.equal(fenceLabelFromInfo('js {1}'), 'js');
  assert.equal(fenceLabelFromInfo('  text  '), 'text');
});

test('a bracketed label keeps the brackets and the text inside them', () => {
  assert.equal(fenceLabelFromInfo('[json]'), '[json]');
  assert.equal(fenceLabelFromInfo('[A longer label] extra'), '[A longer label]');
});

test('a fence with no label stays blank', () => {
  assert.equal(fenceLabelFromInfo(''), '');
  assert.equal(fenceLabelFromInfo('   '), '');
  assert.equal(fenceLabelFromClass('hljs'), '');
});

test('a language class is a fallback label', () => {
  assert.equal(fenceLabelFromClass('language-python'), 'python');
  assert.equal(fenceLabelFromClass('hljs language-[note]'), '[note]');
});
