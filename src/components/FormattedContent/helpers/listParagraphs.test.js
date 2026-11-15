import assert from 'node:assert/strict'
import test from 'node:test'
import markdownit from 'markdown-it'
import { createServer } from 'vite'
import { separateParagraphsAfterLists } from './listParagraphs.js'

const md = markdownit({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true
})

function render(source) {
  return md.render(separateParagraphsAfterLists(source))
}

test('a paragraph on the next line after the last bullet leaves the list', () => {
  const html = render('- item one\n- item two\nThis is a paragraph.')
  assert.match(html, /<\/ul>\s*<p>This is a paragraph\.<\/p>/)
  assert.doesNotMatch(html, /item two<br/)
})

test('several lines of that paragraph stay outside the list', () => {
  const html = render('- item\nFirst line\nSecond line')
  assert.match(html, /<\/ul>\s*<p>First line<br>\nSecond line<\/p>/)
})

test('an indented wrap stays with the bullet, and the next unindented line does not', () => {
  const html = render('- item\n  still the bullet\nAfter the list')
  assert.match(html, /<li>item<br>\nstill the bullet<\/li>/)
  assert.match(html, /<\/ul>\s*<p>After the list<\/p>/)
})

test('a line between two bullets lines up as a paragraph', () => {
  const html = render('- one\nbetween\n- two')
  assert.match(html, /<\/ul>\s*<p>between<\/p>\s*<ul>\s*<li>two<\/li>\s*<\/ul>/)
  assert.doesNotMatch(html, /one<br/)
})

test('several lines between bullets stay together as one paragraph', () => {
  const html = render('- one\nline a\nline b\n- two')
  assert.match(html, /<\/ul>\s*<p>line a<br>\nline b<\/p>\s*<ul>/)
})

test('an indented wrap stays with its bullet when another bullet follows', () => {
  const html = render('- one\n  still one\n- two')
  assert.match(html, /<li>one<br>\nstill one<\/li>\s*<li>two<\/li>/)
  assert.equal((html.match(/<ul>/g) || []).length, 1)
})

test('a blank line after a list is left as a paragraph break', () => {
  const source = '- item\n\nAlready outside'
  assert.equal(separateParagraphsAfterLists(source), source)
  assert.match(render(source), /<\/ul>\s*<p>Already outside<\/p>/)
})

test('ordered lists and task lists close the same way', () => {
  assert.match(render('1. one\n2. two\nDone'), /<\/ol>\s*<p>Done<\/p>/)
  assert.match(render('- [ ] todo\n- [x] done\nNext'), /<\/ul>\s*<p>Next<\/p>/)
})

test('a nested bullet keeps an indented follow-up, and a column-0 line steps out', () => {
  const html = render('- outer\n  - inner\n  still outer\noutside')
  assert.match(html, /<li>inner<\/li>/)
  assert.match(html, /<p>still outer<\/p>\s*<\/li>/)
  assert.match(html, /<\/ul>\s*<p>outside<\/p>/)
  assert.doesNotMatch(html, /outside<\/li>/)
})

test('list markers inside a fence do not keep the following paragraph in the list', () => {
  const source = '- item\n  ```\n  - not a bullet\n  ```\n  still the item\noutside'
  const html = render(source)
  assert.match(html, /<code>- not a bullet\n<\/code>/)
  assert.match(html, /still the item/)
  assert.match(html, /<p>outside<\/p>/)
  assert.doesNotMatch(html, /outside<\/li>|outside<br>/)
})

test('the adjustment is idempotent and preserves CRLF', () => {
  const source = '- item\r\nParagraph'
  const once = separateParagraphsAfterLists(source)
  assert.equal(once, '- item\r\n\r\nParagraph')
  assert.equal(separateParagraphsAfterLists(once), once)
})

test('the markdown formatter renders the paragraph outside the list', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error'
  })
  try {
    const { default: markdownFormatter } = await server.ssrLoadModule(
      '/src/components/FormattedContent/plugins/markdown.js'
    )
    const html = await markdownFormatter.process('- item one\n- item two\nBack to the margin.', {
      protectedZones: new Map()
    })
    assert.match(html, /<\/ul>\s*<p>Back to the margin\.<\/p>/)
    assert.doesNotMatch(html, /item two<br/)
  } finally {
    await server.close()
  }
})
