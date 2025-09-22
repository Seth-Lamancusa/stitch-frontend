<template>
  <InfoViewLayout
    pageTitle="Concepts"
    pageSubtitle="Core ideas that power Stitch"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="doc">
      <div class="container">
        <div class="doc-actions">
          <button class="copy-btn" @click="copyPage">{{ copied ? 'Copied!' : 'Copy page' }}</button>
        </div>

        <nav class="toc" v-if="tableOfContents.length">
          <div class="toc-title">Table of contents</div>
          <ul>
            <li v-for="item in tableOfContents" :key="item.id" :class="item.level">
              <a :href="'#' + item.id" @click.prevent="scrollTo(item.id)">{{ item.text }}</a>
            </li>
          </ul>
        </nav>

        <div class="doc-content">
            <h2 id="threads-and-replies">Threads and replies</h2>
            <p>Messages form a directed acyclic conversation graph via reply edges. Every message has an immutable id, an optional parent_id, and an optional set of child_ids.</p>
            <ul>
              <li>Root messages have no parent and start a thread.</li>
              <li>Reply edges link child → parent. Depth is unbounded; branches are expected.</li>
            </ul>

            <h2 id="visibility">Visibility</h2>
            <p>A message is visible to you if at least one rule applies:</p>
            <ul>
              <li>You are the author.</li>
              <li>It is marked public.</li>
              <li>You are a direct or indirect recipient via the receivers edge.</li>
            </ul>
            <p>Visibility is evaluated per message in a thread; you may see some replies without seeing others. Feed construction and thread expansion use these per-node checks.</p>

            <h2 id="recipients">Recipients</h2>
            <p>You may not be able to see all recipients.</p>
            <ul>
              <li><strong>CC (public=true)</strong>: visible to everyone who can see the message.</li>
              <li><strong>BCC (public=false)</strong>: visible only to the recipient and the addressor (adder) plus the author.</li>
            </ul>

            <h2 id="notifications">Notifications</h2>
            <p>You’ll get notified when you’re added as a recipient to a new or existing message.</p>
          </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';

const tableOfContents = ref([]);
const copied = ref(false);

onMounted(() => {
  buildToc();
});

function buildToc() {
  const container = document.querySelector('.doc .container');
  if (!container) return;
  const headings = container.querySelectorAll('h2[id]');
  tableOfContents.value = Array.from(headings).map((h) => ({
    id: h.id,
    text: h.textContent || '',
    level: h.tagName.toLowerCase(),
  }));
}

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    try {
      history.replaceState(null, '', `#${id}`);
    } catch (_) {}
  }
}

async function copyPage() {
  const content = document.querySelector('.doc .doc-content');
  if (!content) return;
  const text = content.innerText.trim();
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch (_) {}
}
</script>

<style>
.doc { padding: 1.5rem 0 3rem 0; }
.doc h2 { color: var(--color-primary, #4f8cff); margin: 1.25rem 0 .5rem 0; }
.doc p { color: var(--text-secondary); }

.doc-actions { display: flex; justify-content: flex-start; margin-bottom: .5rem; }
.copy-btn { cursor: pointer; border: 1px solid var(--border-color, #e5e7eb); background: var(--surface, #fff); color: var(--text, #111); padding: .3rem .55rem; border-radius: 6px; font-size: .82rem; line-height: 1.1; }

.toc { width: 40%; max-width: 520px; border: 1px solid var(--toc-border, #d1d5db); border-radius: 10px; padding: .7rem .75rem; margin: .25rem 0 .9rem 0; background: var(--toc-bg, #0b1220); }
.toc-title { font-weight: 700; color: var(--toc-title, #e5e7eb); margin-bottom: .25rem; font-size: .9rem; letter-spacing: .01em; }
.toc ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .12rem; }
.toc li.h2 a { font-weight: 600; font-size: .92rem; }
.toc li.h3 { padding-left: .8rem; }
.toc li.h3 a { font-size: .86rem; }
.toc a { color: var(--toc-link, #a3adc2); text-decoration: none; }
.toc a:hover { color: var(--toc-link-hover, #cfd6e4); text-decoration: underline; }

.doc-content { min-width: 0; }
.doc-content ul { margin: .4rem 0 .8rem 1.25rem; color: var(--text-secondary); }

@media (max-width: 900px) {
  .toc { width: 100%; }
}

.doc .code-ref { display: none; }

.links { display: none; }
.link { display: none; }
</style>
