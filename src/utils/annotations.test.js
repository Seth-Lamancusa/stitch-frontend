import assert from 'node:assert/strict'
import test from 'node:test'
import {
  annotationRefs,
  displayParts,
  partText,
  previewLine,
  refsForPart,
  splitParagraphs,
  wholeMessageRefs,
  withoutAnnotation
} from './annotations.js'

test('fenced code and display math keep internal blank lines', () => {
  const fenced = splitParagraphs('Intro\n\n```python\ndef f():\n\n    return 1\n```\n\nAfter')
  assert.deepEqual(fenced.map((part) => part.representations[0].content), [
    'Intro',
    '```python\ndef f():\n\n    return 1\n```',
    'After'
  ])

  const math = splitParagraphs('Before\n\n$$\na\n\nb\n$$\n\nAfter')
  assert.deepEqual(math.map((part) => part.representations[0].content), [
    'Before',
    '$$\na\n\nb\n$$',
    'After'
  ])

  const brackets = splitParagraphs('Before\n\n\\[\na\n\nb\n\\]\n\nAfter')
  assert.deepEqual(brackets.map((part) => part.representations[0].content), [
    'Before',
    '\\[\na\n\nb\n\\]',
    'After'
  ])
})

test('blank lines split paragraphs and a single break stays inside', () => {
  const parts = splitParagraphs('One paragraph.\nstill one\n\nTwo.')
  assert.equal(parts.length, 2)
  assert.equal(parts[0].representations[0].content, 'One paragraph.\nstill one')
  assert.equal(parts[1].representations[0].content, 'Two.')
})

test('empty paragraphs are not parts', () => {
  assert.deepEqual(splitParagraphs('  \n\n  '), [])
  assert.equal(splitParagraphs('Only').length, 1)
})

test('stored parts are shown and a missing array stays one block', () => {
  const stored = [{ representations: [{ type: 'text', content: 'kept' }] }]
  assert.equal(displayParts({ type: 'message', content: 'a\n\nb', parts: stored }), stored)
  assert.equal(displayParts({ type: 'message', content: 'a\n\nb' }), null)
  assert.equal(displayParts({ type: 'file', content: 'a\n\nb', parts: stored }), null)
  assert.equal(displayParts({ type: 'message', content: 'hello', parts: [] }), null)
})

test('annotation refs keep a part index and drop a missing one', () => {
  const refs = annotationRefs({
    annotations: [
      { id: 'a', part: 1 },
      { id: 'b' },
      { id: '', part: 0 },
      { id: 'c', part: true }
    ]
  })
  assert.deepEqual(refs, [{ id: 'a', part: 1 }, { id: 'b' }, { id: 'c' }])
  assert.deepEqual(refsForPart(refs, 1), [{ id: 'a', part: 1 }])
  assert.deepEqual(wholeMessageRefs(refs).map((ref) => ref.id), ['b', 'c'])
})

test('part text prefers text representations', () => {
  assert.equal(partText({
    representations: [
      { type: 'text', content: 'See the file.' },
      { type: 'file', content: { filename: 'notes.txt' } }
    ]
  }), 'See the file.')
  assert.equal(partText({
    representations: [{ type: 'file', content: { filename: 'notes.txt' } }]
  }), 'notes.txt')
})

test('preview collapses whitespace', () => {
  assert.equal(previewLine('wording\n\nis ambiguous', 80), 'wording is ambiguous')
})

test('withoutAnnotation drops one ref and leaves the rest', () => {
  const annotations = [{ id: 'a', part: 0 }, { id: 'b' }]
  assert.deepEqual(withoutAnnotation(annotations, 'a'), [{ id: 'b' }])
  assert.equal(withoutAnnotation(null, 'a'), null)
})
