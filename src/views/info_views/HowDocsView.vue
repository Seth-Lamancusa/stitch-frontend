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
            <h2 id="branching-conversations">Branching Conversations</h2>
            <p>Stitch reimagines how conversations flow. Unlike traditional chat where messages follow a single linear path, Stitch allows conversations to branch into multiple directions from any message.</p>
            
            <h3 id="how-it-works">How It Works</h3>
            <ul>
              <li><strong>Every message can spawn new paths</strong> — Reply to any message and your response becomes a new branch in the conversation tree.</li>
              <li><strong>Multiple perspectives, one place</strong> — Different people can reply to the same message, creating parallel discussions that remain organized and easy to follow.</li>
              <li><strong>Navigate with purpose</strong> — Jump between branches, follow specific threads of discussion, or view the entire conversation graph to see how ideas connect.</li>
            </ul>
            
            <p>This structure mirrors how we actually think and discuss ideas — not in straight lines, but as networks of interconnected thoughts. Whether you're brainstorming, debugging, or exploring a topic from multiple angles, branching conversations keep everything coherent.</p>

            <h2 id="group-messaging">Group Messaging</h2>
            <p>Stitch brings flexible group dynamics to threaded conversations. You decide who participates in each branch, message by message.</p>
            
            <h3 id="dynamic-participation">Dynamic Participation</h3>
            <ul>
              <li><strong>Add recipients anytime</strong> — Bring people into a conversation at any point, not just at the start. They'll see the context and can jump right in.</li>
              <li><strong>Thread-specific membership</strong> — Different branches can have different participants. A conversation might start with your team, branch to include a client, and have technical sub-branches visible only to developers.</li>
              <li><strong>Always stay informed</strong> — When you're added as a recipient, you receive a notification and can see the full conversation history leading up to that point.</li>
            </ul>

            <h2 id="ai-integration">AI Responses</h2>
            <p>Stitch makes collaborating with AI as natural as talking to a colleague. Bots participate as first-class members of your conversations.</p>
            
            <h3 id="how-ai-bots-work">How AI Bots Work</h3>
            <ul>
              <li><strong>Mention to engage</strong> — Simply mention a bot (like <code>@chatgpt</code> or <code>@claude</code>) in your message, and it will automatically respond in the same thread.</li>
              <li><strong>Full conversation context</strong> — Bots see the entire thread history, so their responses are informed by everything that came before.</li>
              <li><strong>Multiple perspectives</strong> — Prompt several bots at once to compare their responses side-by-side. Ask them to respond to each other for rich AI discussions.</li>
              <li><strong>Leading AI models</strong> — Access ChatGPT, Claude, Grok, Gemini, and more, all within the same conversation space.</li>
            </ul>
            
            <p>This makes Stitch ideal for brainstorming sessions, technical problem-solving, content creation, and any workflow where you want AI assistance without leaving your conversation.</p>

            <h2 id="visibility-control">Visibility Control</h2>
            <p>Not all information is meant for all eyes. Stitch gives you granular control over who sees what in every message.</p>
            
            <h3 id="public-vs-private">Public vs. Private Messages</h3>
            <ul>
              <li><strong>Public messages</strong> — Visible to anyone with access to the thread. Great for open discussions, shared knowledge, and transparent collaboration.</li>
              <li><strong>Private messages</strong> — Only visible to the author and specified recipients. Use this for sensitive information, personal notes, or confidential discussions within a larger conversation.</li>
            </ul>
            
            <h3 id="recipient-visibility">Recipient Visibility</h3>
            <p>Stitch also controls who can see <em>who else</em> is in a conversation:</p>
            <ul>
              <li><strong>CC (visible recipients)</strong> — Everyone who can see the message can also see these recipients. Standard transparent communication.</li>
              <li><strong>BCC (hidden recipients)</strong> — Only visible to the person who added them, the recipient themselves, and the message author. Perfect for loops where privacy matters or when you want to notify someone without broadcasting their involvement.</li>
            </ul>
            
            <h3 id="visibility-rules">Visibility Rules</h3>
            <p>A message is visible to you if any of these apply:</p>
            <ul>
              <li>You authored it</li>
              <li>It's marked as public</li>
              <li>You're listed as a recipient (either directly or added later)</li>
            </ul>
            
            <p><strong>Important:</strong> Visibility is evaluated per message. In a branching conversation, you might see some replies but not others, depending on your access to each individual message. This ensures sensitive information stays contained while keeping related discussions connected.</p>

            <h2 id="message-organization">Message Organization</h2>
            <p>With conversations that branch and grow, Stitch provides tools to keep track of what matters to you.</p>
            
            <ul>
              <li><strong>Inbox</strong> — See all messages where you're a recipient and haven't read yet. Your personal notification center.</li>
              <li><strong>Bookmarks</strong> — Save messages you want to return to. Flag important decisions, useful references, or ideas worth revisiting.</li>
              <li><strong>Links</strong> — Connect related messages across different threads. Build your own web of knowledge by linking concepts, follow-ups, or related discussions.</li>
              <li><strong>History</strong> — Browse all messages you can access, sorted by recency or organized by thread.</li>
            </ul>

            <h2 id="collaborative-workflows">Collaborative Workflows</h2>
            <p>Stitch's structure enables workflows that traditional chat and email can't support:</p>
            
            <ul>
              <li><strong>Parallel exploration</strong> — Split conversations to explore different approaches simultaneously, then merge insights in parent threads.</li>
              <li><strong>Progressive disclosure</strong> — Start broad discussions, then branch into specialized sub-conversations with relevant experts or stakeholders.</li>
              <li><strong>Mixed human-AI collaboration</strong> — Seamlessly alternate between human discussion and AI assistance within the same conversation flow.</li>
              <li><strong>Persistent context</strong> — Every message retains its place in the conversation graph, so context is never lost even as discussions evolve and branch.</li>
            </ul>

            <h2 id="getting-started">Getting Started</h2>
            <p>Ready to experience conversation differently?</p>
            <ul>
              <li><strong>Start a new thread</strong> — Every conversation begins with a root message. Set recipients, make it public or private, and begin.</li>
              <li><strong>Reply to create branches</strong> — Click "Reply" on any message to create a new branch. The conversation tree grows organically.</li>
              <li><strong>Mention bots</strong> — Type <code>@chatgpt</code>, <code>@claude</code>, or another bot name to bring AI into the discussion.</li>
              <li><strong>Control visibility</strong> — When adding recipients, choose whether they're visible to others (CC) or hidden (BCC).</li>
              <li><strong>Navigate the graph</strong> — Use the graph view to visualize the entire conversation structure and jump between branches.</li>
            </ul>
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
  const headings = container.querySelectorAll('h2[id], h3[id]');
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
.doc h2 { 
  color: var(--color-primary, #4f8cff); 
  margin: 2rem 0 .75rem 0; 
  font-size: 1.75rem;
  font-weight: 600;
  padding-top: 1rem;
  border-top: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
}
.doc h2:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
.doc h3 { 
  color: var(--text-light, #e5e7eb); 
  margin: 1.5rem 0 .5rem 0; 
  font-size: 1.25rem;
  font-weight: 600;
}
.doc p { 
  color: var(--text-secondary); 
  line-height: 1.7;
  margin: .75rem 0;
}
.doc code {
  background: var(--code-bg, rgba(79, 140, 255, 0.1));
  color: var(--color-primary, #4f8cff);
  padding: .2rem .4rem;
  border-radius: 4px;
  font-size: .9em;
  font-family: 'Courier New', monospace;
}
.doc strong {
  color: var(--text-light, #e5e7eb);
  font-weight: 600;
}

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
.doc-content ul { 
  margin: .6rem 0 1rem 1.25rem; 
  color: var(--text-secondary);
  line-height: 1.7;
}
.doc-content li {
  margin: .5rem 0;
}
.doc-content em {
  color: var(--text-light, #e5e7eb);
  font-style: italic;
}

@media (max-width: 900px) {
  .toc { width: 100%; }
  .doc h2 { font-size: 1.5rem; }
  .doc h3 { font-size: 1.15rem; }
}

.doc .code-ref { display: none; }

.links { display: none; }
.link { display: none; }
</style>
