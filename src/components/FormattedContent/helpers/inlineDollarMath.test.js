import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { looksLikeLatexInline, normalizeMathPrimes, replaceInlineDollarMath } from './inlineDollarMath.js'

test('prime-like characters become ASCII primes', () => {
  assert.equal(normalizeMathPrimes('a’'), "a'")
  assert.equal(normalizeMathPrimes('a‘'), "a'")
  assert.equal(normalizeMathPrimes('a′'), "a'")
  assert.equal(normalizeMathPrimes('a″'), "a''")
  assert.equal(normalizeMathPrimes('a‴'), "a'''")
})

test('comma-separated atoms and primes count as inline math', () => {
  assert.equal(looksLikeLatexInline("a'"), true)
  assert.equal(looksLikeLatexInline('a’'), true)
  assert.equal(looksLikeLatexInline("a, a'"), true)
  assert.equal(looksLikeLatexInline('a, a’'), true)
  assert.equal(looksLikeLatexInline("a,a'"), true)
  assert.equal(looksLikeLatexInline("foo, bar'"), true)
  assert.equal(looksLikeLatexInline('n'), true)
  assert.equal(looksLikeLatexInline('1,285.7'), true)
  assert.equal(looksLikeLatexInline('x_1'), true)
  assert.equal(looksLikeLatexInline('x_{ab}'), true)
  assert.equal(looksLikeLatexInline('a + b'), true)
  assert.equal(looksLikeLatexInline('S = 2'), true)
  assert.equal(looksLikeLatexInline('E(a, b)'), true)
  assert.equal(looksLikeLatexInline('E(a,b)'), true)
  assert.equal(looksLikeLatexInline("E(a, b')"), true)
  assert.equal(looksLikeLatexInline("E(a', b')"), true)
  assert.equal(looksLikeLatexInline('0°'), true)
  assert.equal(looksLikeLatexInline('135°'), true)
})

test('prose and currency spans stay literal', () => {
  assert.equal(looksLikeLatexInline('1000 dollars'), false)
  assert.equal(looksLikeLatexInline('1000 dollars and my friend has '), false)
  assert.equal(looksLikeLatexInline("a' b"), false)
  assert.equal(looksLikeLatexInline('4.6 billion** in revenue for full-year 2025, representing a nearly **12-fold increase** compared to roughly '), false)
  assert.equal(looksLikeLatexInline('380M–'), false)
  assert.equal(looksLikeLatexInline('70B+** range, with company estimates targeting a '), false)
  assert.equal(looksLikeLatexInline('20/month tier'), false)
  assert.equal(looksLikeLatexInline(''), false)
  assert.equal(looksLikeLatexInline("a,\nb'"), false)
})

test('degrees stay math so the word between them is not swallowed', () => {
  const rendered = []
  const out = replaceInlineDollarMath(
    "Alice's settings at $0°$ and $90°$, Bob's at $45°$ and $135°$",
    {
      onMath: ({ inner }) => {
        rendered.push(inner)
        return `{${inner}}`
      }
    }
  )
  assert.deepEqual(rendered, ['0°', '90°', '45°', '135°'])
  assert.equal(out, "Alice's settings at {0°} and {90°}, Bob's at {45°} and {135°}")
})

test('a prose hyphen or plus between currency amounts stays literal', () => {
  const samples = [
    'roughly **$4.6 billion** in revenue for full-year 2025, representing a nearly **12-fold increase** compared to roughly $380M–$400M in 2024.',
    'around **$16.8 billion** (up ~45% quarter-over-quarter), implying an ARR in the **$67B–$70B+** range, with company estimates targeting a $100B run rate',
    "($20/month tier), Anthropic's growth is overwhelmingly corporate and developer-focused. Over 1,000 enterprise accounts now spend more than $1 million annually on Claude."
  ]
  for (const sample of samples) {
    const out = replaceInlineDollarMath(sample, { onMath: () => 'MATH' })
    assert.equal(out, sample)
  }
})

test('a non-math dollar does not consume a later math span', () => {
  const rendered = []
  const out = replaceInlineDollarMath('$1000 dollars and my friend has $a, a’$', {
    onMath: ({ inner }) => {
      rendered.push(inner)
      return `[${inner}]`
    }
  })
  assert.deepEqual(rendered, ['a, a’'])
  assert.equal(out, '$1000 dollars and my friend has [a, a’]')
})

test('message formatting renders a primed pair and leaves currency text', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error'
  })
  try {
    const { applyFormatters, clearFormatters, registerFormatter } = await server.ssrLoadModule(
      '/src/components/FormattedContent/formatters.js'
    )
    const { default: markdownFormatter } = await server.ssrLoadModule(
      '/src/components/FormattedContent/plugins/markdown.js'
    )
    const { default: latexFormatter } = await server.ssrLoadModule(
      '/src/components/FormattedContent/plugins/latex.js'
    )

    clearFormatters()
    registerFormatter(markdownFormatter)
    registerFormatter(latexFormatter)

    const straight = await applyFormatters("Compare $a, a'$ and it costs $1000 dollars$.")
    const curly = await applyFormatters('Compare $a, a’$ and it costs $1000 dollars$.')

    for (const html of [straight, curly]) {
      assert.match(html, /class="katex"/)
      assert.match(html, /′/)
      assert.match(html, /\$1000 dollars\$/)
    }

    const chsh = await applyFormatters(
      "where $E(a, b)$ is the expectation, taken to be $\\pm 1$. " +
      "The correlator is $E(a,b) = -\\cos(\\theta_{ab})$, with Alice at $0°$ and $90°$, Bob at $45°$ and $135°$."
    )
    assert.equal(chsh.includes('katex-error'), false)
    assert.equal((chsh.match(/class="katex"/g) || []).length, 7)
    assert.equal(chsh.includes('$E(a, b)$'), false)
    assert.equal(chsh.includes('$0°$'), false)
    assert.match(chsh, /> and </)

    const revenue = await applyFormatters(
      'Anthropic reported roughly **$4.6 billion** in revenue for full-year 2025, representing a nearly **12-fold increase** compared to roughly $380M–$400M in 2024. ' +
      'Q3 revenue around **$16.8 billion** (up ~45% quarter-over-quarter), implying an ARR in the **$67B–$70B+** range, with company estimates targeting a $100B run rate. ' +
      "A substantial consumer subscription base ($20/month tier), Anthropic's growth is overwhelmingly corporate and developer-focused. Over 1,000 enterprise accounts now spend more than $1 million annually on Claude."
    )
    assert.equal(revenue.includes('katex'), false)
    assert.match(revenue, /<strong>\$4\.6 billion<\/strong>/)
    assert.match(revenue, /<strong>12-fold increase<\/strong>/)
    assert.match(revenue, /\$380M–\$400M/)
    assert.match(revenue, /<strong>\$16\.8 billion<\/strong>/)
    assert.match(revenue, /quarter-over-quarter/)
    assert.match(revenue, /<strong>\$67B–\$70B\+<\/strong>/)
    assert.match(revenue, /\$100B run rate/)
    assert.match(revenue, /\$20\/month tier/)
    assert.match(revenue, /developer-focused/)
    assert.match(revenue, /Over 1,000 enterprise accounts/)
    assert.match(revenue, /\$1 million/)
  } finally {
    await server.close()
  }
})
