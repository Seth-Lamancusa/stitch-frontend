<template>
  <InfoViewLayout
    pageTitle="How Stitch works"
    pageSubtitle="Concepts, documentation, bots, and the API"
    heroClass="how-hero"
    :showBetaBanner="false"
  >
    <section class="how-main">
      <div class="container">
        <!-- Tab Buttons -->
        <div class="tabs-container">
          <div class="tabs">
            <button 
              class="tab-button" 
              :class="{ active: activeTab === 'concepts' }"
              @click="activeTab = 'concepts'"
            >
              <span class="icon">📘</span>
              <span class="label">Concepts</span>
            </button>
            <button 
              class="tab-button" 
              :class="{ active: activeTab === 'docs' }"
              @click="activeTab = 'docs'"
            >
              <span class="icon">📚</span>
              <span class="label">Docs</span>
            </button>
            <button 
              class="tab-button" 
              :class="{ active: activeTab === 'api' }"
              @click="activeTab = 'api'"
            >
              <span class="icon">🧩</span>
              <span class="label">API Reference</span>
            </button>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="tab-content-wrapper">
          <div class="tab-content">
          <!-- Concepts Content -->
          <div v-if="activeTab === 'concepts'" class="content-section">
            <div class="doc-layout">
              <nav class="toc" v-if="tableOfContents.length">
                <div class="toc-title">Table of contents</div>
                <ul>
                  <li v-for="item in tableOfContents" :key="item.id" :class="item.level">
                    <a :href="'#' + item.id" @click.prevent="scrollTo(item.id)">{{ item.text }}</a>
                  </li>
                </ul>
              </nav>

              <div class="doc-content">
                <h2 id="conversational-structure">Conversational Structure</h2>
                <p>Stitch reimagines how conversations flow. Unlike traditional chat where messages follow a single linear path, Stitch allows conversations to branch into multiple directions from any message, creating a tree-like structure that mirrors how we actually think and discuss ideas.</p>
                
                <h3 id="branching-conversations">Branching Conversations</h3>
                <ul>
                  <li><strong>Every message can spawn new paths</strong> — Reply to any message and your response becomes a new branch in the conversation tree.</li>
                  <li><strong>Multiple perspectives, one place</strong> — Different people can reply to the same message, creating parallel discussions that remain organized and easy to follow.</li>
                </ul>
                
                <p>Popular messengers and social media apps already hint at this concept with their own "replies" and "threads" but limit the conversation depth and breadth. On Stitch, parallel conversations run parallel, and the only limit on the conversation structure is your own creativity.</p>

                <h3 id="message-organization">Message Organization</h3>
                <p>With conversations that branch and grow, Stitch provides tools to keep track of what matters to you:</p>
                
                <p><strong>Stay on top of what matters</strong></p>
                <ul>
                  <li><strong>Inbox</strong> — See the latest messages where you're a recipient. Like your messenger app.</li>
                  <li><strong>History</strong> — Browse all threads you started by creating the root message. Like your chatbot history.</li>
                </ul>
                
                <p><strong>Keep track of important ideas</strong></p>
                <ul>
                  <li><strong>Bookmarks</strong> — Save messages you want to return to. Flag important decisions, useful references, or ideas worth revisiting.</li>
                  <li><strong>Tags</strong> — Organize and categorize messages with tags. Anyone who can see a message can tag it, making organization a collaborative effort. Each tag shows who added it and when, and you can search messages by tags across all threads.</li>
                  <li><strong>Links</strong> — Connect related messages across different threads. Anyone who can see both messages can create a link between them. Build your own web of knowledge by linking concepts, follow-ups, or related discussions.</li>
                </ul>

                <h2 id="collaboration-features">Collaboration Features</h2>
                <p>Stitch brings flexible group dynamics to threaded conversations. You decide who participates in each branch, message by message, with granular control over visibility and collaborative enrichment.</p>
                
                <h3 id="dynamic-participation">Dynamic Participation</h3>
                <ul>
                  <li><strong>Add recipients to any message, anytime</strong> — Bring people into a conversation at any point, not just at the start.</li>
                  <li><strong>Message-specific membership</strong> — Different messages can have different participants. A conversation might start with your team, branch to include a client, and have technical sub-branches visible only to developers.</li>
                </ul>

                <h3 id="visibility-control">Visibility Control</h3>
                <p>Not all information is meant for all eyes. Stitch gives you granular control over who sees what in every message.</p>
                
                <h4 id="public-vs-private">Public vs. Private Messages</h4>
                <ul>
                  <li><strong>Public messages</strong> — Visible to anyone. Great for open discussions, shared knowledge, and transparent collaboration.</li>
                  <li><strong>Private messages</strong> — Only visible to the author and specified recipients. Use this for sensitive information, personal notes, or confidential discussions within a larger conversation.</li>
                </ul>
                
                <h4 id="recipient-visibility">Recipient Visibility</h4>
                <p>Stitch also controls who can see <em>who else</em> is in a conversation:</p>
                <ul>
                  <li><strong>CC (visible recipients)</strong> — Everyone who can see the message can also see these recipients. Standard transparent communication.</li>
                  <li><strong>BCC (hidden recipients)</strong> — Only visible to the person who added them, the recipient themselves, and the message author. Perfect for loops where privacy matters or when you want to notify someone without broadcasting their involvement.</li>
                </ul>
                
                <h4 id="visibility-rules">Visibility Rules</h4>
                <p>A message is visible to you if any of these apply:</p>
                <ul>
                  <li>You authored it</li>
                  <li>It's marked as public</li>
                  <li>You're listed as a recipient (either directly or added later)</li>
                </ul>
                
                <p>Visibility is evaluated per message. In a branching conversation, you might see some replies but not others, depending on your access to each individual message.</p>

                <h3 id="collaborative-enrichment">Collaborative Enrichment</h3>
                <p>Some operations on messages are collaborative — if you can see a message, you can enrich it:</p>
                <ul>
                  <li><strong>Tags</strong> — Add tags to help organize and find messages. Tags include metadata showing who added them and when.</li>
                  <li><strong>Links</strong> — Create connections between messages you can see, building relationships across threads.</li>
                  <li><strong>Recipients</strong> — Add people to conversations (with visibility controls for CC/BCC).</li>
                </ul>
                <p>This collaborative model means teams can work together to organize and structure conversations, not just the original author. The author controls the message content and publicity, while everyone with visibility can help organize and connect ideas.</p>

                <h2 id="ai-integration">AI Integration</h2>
                <p>Stitch makes collaborating with AI as natural as talking to a colleague. Bots participate as first-class members of your conversations.</p>
                
                <h3 id="how-ai-bots-work">How AI Bots Work</h3>
                <ul>
                  <li><strong>Mention to engage</strong> — Simply mention a bot (like <code>@chatgpt</code> or <code>@claude</code>) in your message, and it will receive a notification.</li>
                  <li><strong>Multiple perspectives</strong> — Prompt several bots at once to compare their responses side-by-side. Ask them to respond to each other for automatic AI discussions.</li>
                  <li><strong>Test your prompts</strong> — Test variations on your prompt as branches under the same context for reliable comparison.</li>
                  <li><strong>Leading AI models</strong> — Access ChatGPT, Claude, Grok, Gemini, DeepSeek, and more, all within the same conversation space.</li>
                </ul>
                
                <p>This makes Stitch ideal for brainstorming sessions, technical problem-solving, content creation, and any workflow where you want AI assistance without leaving your conversation.</p>

                <h2 id="practical-applications">Practical Applications</h2>
                <p>Stitch's structure enables workflows that traditional chat and email can't support, making it ideal for real-world collaboration.</p>
                
                <h3 id="collaborative-workflows">Collaborative Workflows</h3>
                <ul>
                  <li><strong>Parallel exploration</strong> — Split conversations to explore different approaches simultaneously, then merge insights in parent threads.</li>
                  <li><strong>Progressive disclosure</strong> — Start broad discussions, then branch into specialized sub-conversations with relevant experts or stakeholders.</li>
                  <li><strong>Mixed human-AI collaboration</strong> — Seamlessly alternate between human discussion and AI assistance within the same conversation flow.</li>
                  <li><strong>Persistent context</strong> — Every message retains its place in the conversation graph, so context is never lost even as discussions evolve and branch.</li>
                </ul>

                <h3 id="getting-started">Getting Started</h3>
                <p>Ready to experience conversation differently?</p>
                <ul>
                  <li><strong>Start a new thread</strong> — Every conversation begins with a root message. Set recipients, make it public or private, and begin.</li>
                  <li><strong>Reply to create branches</strong> — Click "Reply" on any message to create a new branch. The conversation tree grows organically.</li>
                  <li><strong>Mention bots</strong> — Type <code>@chatgpt</code>, <code>@claude</code>, or another bot name to bring AI into the discussion.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Docs Content -->
          <div v-if="activeTab === 'docs'" class="content-section">
            <div class="doc-layout">
              <nav class="toc" v-if="docsTableOfContents.length">
                <div class="toc-title">Table of contents</div>
                <ul>
                  <li v-for="item in docsTableOfContents" :key="item.id" :class="item.level">
                    <a :href="'#' + item.id" @click.prevent="scrollTo(item.id)">{{ item.text }}</a>
                  </li>
                </ul>
              </nav>

              <div class="doc-content docs-content">
                <div class="audience-note">
                  <p><strong>For developers</strong> — This section is for developers integrating directly with the Stitch API (select partners only). If you just want to understand the platform, see the <a href="#" class="link" @click.prevent="activeTab = 'concepts'">Concepts</a> tab.</p>
                </div>
                <div class="api-warning">
                  <p><strong>Warning:</strong> This API is not final. Names, payloads, and flows may change. For current spec, see API reference.</p>
                </div>

                <h2 id="messages">Messages</h2>
                <p>The Messages API is the core of Stitch's conversational system. Messages form a tree structure where any message can have multiple replies, creating branches in conversations. Messages can be public or private, with granular recipient control (CC/BCC). Anyone who can see a message can tag it, link it, or add recipients.</p>

                <h2 id="users-and-bots">Users and Bots</h2>
                <p>Stitch supports regular user accounts and managed users (bots). Regular users authenticate independently and have full capabilities. Bots are managed users with <code>is_bot=true</code> that authenticate via delegation from their managers. Bots receive notifications via signed webhooks when mentioned or added to conversations.</p>

      
              </div>
            </div>
          </div>

          <!-- API Reference Content -->
          <div v-if="activeTab === 'api'" class="content-section api-content">
            <h2>Available for select partners</h2>
            <p>
              The Stitch API is documented using OpenAPI/Swagger. Two documentation interfaces are available:
            </p>
            <ul>
              <li>
                <a href="https://api.stitch.fyi/v1/docs" target="_blank">Swagger UI</a> — Interactive API explorer where you can test endpoints directly in your browser. Best for exploring endpoints and trying out requests.
              </li>
              <li>
                <a href="https://api.stitch.fyi/v1/redoc" target="_blank">ReDoc</a> — Read-only API reference with a clean, readable format. Best for understanding the full API structure and response schemas.
              </li>
            </ul>
          </div>
          </div>
        </div>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';

const activeTab = ref('concepts'); // Default to Concepts
const tableOfContents = ref([]);
const docsTableOfContents = ref([]);
const route = useRoute();

onMounted(() => {
  if (route.query.tab) {
    activeTab.value = route.query.tab;
  }
  buildToc();
  buildDocsToc();
});

watch(activeTab, () => {
  // Rebuild TOC when switching tabs
  if (activeTab.value === 'concepts') {
    setTimeout(() => buildToc(), 50);
  } else if (activeTab.value === 'docs') {
    setTimeout(() => buildDocsToc(), 50);
  }
});

function buildToc() {
  const content = document.querySelector('.doc-content');
  if (!content) return;
  const headings = content.querySelectorAll('h2[id], h3[id]');
  tableOfContents.value = Array.from(headings).map((h) => ({
    id: h.id,
    text: h.textContent || '',
    level: h.tagName.toLowerCase(),
  }));
}

function buildDocsToc() {
  const content = document.querySelector('.docs-content');
  if (!content) return;
  const headings = content.querySelectorAll('h2[id], h3[id], h4[id]');
  docsTableOfContents.value = Array.from(headings).map((h) => ({
    id: h.id,
    text: h.textContent || '',
    level: h.tagName.toLowerCase(),
  }));
}

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      history.replaceState(null, '', `#${id}`);
    } catch (_) {}
  }
}
</script>

<style>
.how-main {
  padding: 2rem 0 4rem 0;
}

/* Tab Container */
.tabs-container {
  border-bottom: 2px solid var(--card-border, rgba(255, 255, 255, 0.1));
  margin-bottom: 0;
}

.tabs {
  display: flex;
  gap: 0;
  margin: 0;
  padding: 0;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: color .2s ease, border-color .2s ease, background-color .2s ease;
  position: relative;
  white-space: nowrap;
}

.tab-button:hover {
  color: var(--text-light);
  background: rgba(255, 255, 255, 0.02);
}

.tab-button.active {
  color: var(--color-primary, #4f8cff);
  border-bottom-color: var(--color-primary, #4f8cff);
  background: transparent;
}

.tab-button .icon {
  font-size: 1.25rem;
  line-height: 1;
}

.tab-button .label {
  font-size: 1rem;
}

/* Tab Content */
.tab-content-wrapper {
  border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
  border-top: none;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
  background: var(--card-background);
  padding: 2rem;
  margin-top: -1px;
}

.tab-content {
  min-height: 400px;
}

.content-section {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Docs Content Styles */
.doc-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.doc-content h2 { 
  color: var(--color-primary, #4f8cff); 
  margin: 2rem 0 .75rem 0; 
  font-size: 1.75rem;
  font-weight: 600;
  padding-top: 1rem;
  border-top: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
  scroll-margin-top: 80px;
}

.doc-content h2:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.doc-content h3 { 
  color: var(--text-light, #e5e7eb); 
  margin: 1.5rem 0 .5rem 0; 
  font-size: 1.25rem;
  font-weight: 600;
  scroll-margin-top: 80px;
}

.doc-content h4 {
  color: var(--text-light, #e5e7eb);
  margin: 1.25rem 0 .5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  scroll-margin-top: 80px;
}

.doc-content h5 {
  color: var(--text-light, #e5e7eb);
  margin: 1rem 0 .4rem 0;
  font-size: 1rem;
  font-weight: 600;
  scroll-margin-top: 80px;
}

.doc-content p { 
  color: var(--text-secondary); 
  line-height: 1.7;
  margin: .75rem 0;
}

.audience-note {
  background: var(--code-bg, rgba(79, 140, 255, 0.1));
  border-left: 3px solid var(--color-primary, #4f8cff);
  padding: 1rem 1.25rem;
  margin: 0 0 2rem 0;
  border-radius: 4px;
}

.audience-note p {
  margin: 0;
  color: var(--text-secondary);
}

.audience-note strong {
  color: var(--color-primary, #4f8cff);
}

.audience-note .link {
  color: var(--color-primary, #4f8cff);
  text-decoration: underline;
}

.audience-note .link:hover {
  opacity: 0.8;
}

.api-warning {
  background: rgba(251, 191, 36, 0.1);
  border-left: 3px solid rgba(251, 191, 36, 0.6);
  padding: 1rem 1.25rem;
  margin: 0 0 2rem 0;
  border-radius: 4px;
}

.api-warning p {
  margin: 0.5rem 0;
  color: var(--text-secondary);
}

.api-warning p:first-child {
  margin-top: 0;
}

.api-warning p:last-child {
  margin-bottom: 0;
}

.api-warning strong {
  color: rgba(251, 191, 36, 0.9);
}

.doc-content code {
  background: var(--code-bg, rgba(79, 140, 255, 0.1));
  color: var(--color-primary, #4f8cff);
  padding: .2rem .4rem;
  border-radius: 4px;
  font-size: .9em;
  font-family: 'Courier New', monospace;
}

.doc-content strong {
  color: var(--text-light, #e5e7eb);
  font-weight: 600;
}

.doc-content ul, 
.doc-content ol { 
  margin: .6rem 0 1rem 0; 
  padding-left: 1.25rem; 
  color: var(--text-secondary);
  line-height: 1.7;
  list-style-position: outside;
}

.doc-content li { 
  margin: .5rem 0; 
}

.doc-content li::marker { 
  color: var(--toc-link, #a3adc2); 
}

.doc-content em {
  color: var(--text-light, #e5e7eb);
  font-style: italic;
}

/* TOC (sticky sidebar) */
.toc { 
  position: sticky;
  top: 5.5rem;
  max-height: calc(100vh - 6.5rem);
  overflow-y: auto;
  border: 1px solid var(--toc-border, #d1d5db); 
  border-radius: 10px; 
  padding: .7rem .75rem; 
  background: var(--toc-bg, #0b1220); 
}

.toc-title { 
  font-weight: 700; 
  color: var(--toc-title, #e5e7eb); 
  margin-bottom: .25rem; 
  font-size: .9rem; 
  letter-spacing: .01em; 
}

.toc ul { 
  list-style: none; 
  padding: 0; 
  margin: 0; 
  display: grid; 
  gap: .12rem; 
}

.toc li.h2 a { 
  font-weight: 600; 
  font-size: .92rem; 
}

.toc li.h3 { 
  padding-left: .8rem; 
}

.toc li.h3 a { 
  font-size: .86rem; 
}

.toc li.h4 { 
  padding-left: 1.6rem; 
}

.toc li.h4 a { 
  font-size: .82rem; 
}

.toc li.h5 { 
  padding-left: 2.4rem; 
}

.toc li.h5 a { 
  font-size: .78rem; 
}

.toc a { 
  color: var(--toc-link, #a3adc2); 
  text-decoration: none; 
}

.toc a:hover { 
  color: var(--toc-link-hover, #cfd6e4); 
  text-decoration: underline; 
}

/* API Content Styles */
.api-content h2 { 
  color: var(--color-primary, #4f8cff); 
  margin: 1.25rem 0 .5rem 0; 
}

.api-content p, 
.api-content li { 
  color: var(--text-secondary); 
}

.api-content a {
  color: var(--color-primary, #4f8cff);
  text-decoration: underline;
}

/* Mobile */
@media (max-width: 992px) { 
  .tabs {
    flex-wrap: wrap;
  }
  
  .tab-button {
    flex: 1;
    min-width: 0;
    justify-content: center;
    padding: 0.875rem 1rem;
  }
  
  .tab-button .icon {
    font-size: 1.1rem;
  }
  
  .tab-button .label {
    font-size: 0.9rem;
  }
}

@media (max-width: 900px) {
  .doc-layout {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .doc-content h2 { 
    font-size: 1.5rem; 
  }
  
  .doc-content h3 { 
    font-size: 1.15rem; 
  }
  
  .doc-content h4 { 
    font-size: 1rem; 
  }
  
  .toc { 
    position: static; 
  }
}

@media (max-width: 600px) { 
  .tabs {
    flex-direction: column;
  }
  
  .tab-button {
    width: 100%;
    border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
    border-left: 3px solid transparent;
    justify-content: flex-start;
    padding: 1rem;
  }
  
  .tab-button.active {
    border-left-color: var(--color-primary, #4f8cff);
    border-bottom-color: var(--card-border, rgba(255, 255, 255, 0.1));
  }
  
  .tab-content-wrapper {
    border-top: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius);
    padding: 1.5rem;
  }
}
</style>
