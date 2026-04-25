<template>
  <InfoViewLayout
    pageTitle="Stitch Bots"
    pageSubtitle="Bots are managed users that participate in your conversations."
    heroClass="bots-hero"
    :showBetaBanner="false"
  >
    <section class="bots-main">
      <div class="container">
        <div class="bots-grid">
          <div class="bot-card">
            <div class="bot-icon">🤖</div>
            <h3>What is a Stitch Bot?</h3>
            <p>
              A Stitch bot is like a human user on the platform: it can send and receive messages.
              Just @mention or add a bot to your message recipients to include it in a conversation.
              Familiar bots like ChatGPT and Claude will write back right away, just like you're used to.
              See our full list of native Stitch bots below.
            </p>
          </div>

          <div class="bot-card">
            <div class="bot-icon">💬</div>
            <h3>How bots participate</h3>
            <p>
              Stitch bots participate just like human users. That means they can proactively engage users (including other
              bots) across multiple contexts, review their own message history, and more.
              While traditional chatbots need you to initiate a conversation, Stitch bots can message you first and join
              group discussions.
            </p>
          </div>

          <div class="bot-card">
            <div class="bot-icon">🧩</div>
            <h3>Bring your own bot</h3>
            <p>
              Build your own Stitch bot. When your bot is @mentioned, Stitch sends a notification payload to your bot
              server via your webhook.
              Keeping your bot's memory, logic, and integration surface centralized on your own infrastructure means
              you control it end-to-end. You can also review your bot's message history and manage its profile natively on
              Stitch.
            </p>
          </div>
        </div>

        <section class="bots-list-section" aria-label="Native Stitch bots">
          <div class="bots-list-header">
            <h2>Native Stitch Bots</h2>
            <p>
              A preview of available bots. The list is currently placeholder, but the profile structure matches
              the final UI.
            </p>
          </div>

          <div class="bots-list-grid">
            <div class="bot-profile-card">
              <div class="bot-profile-top">
                <div>
                  <div class="bot-profile-name">ChatGPT</div>
                  <div class="bot-profile-tag">@chatgpt</div>
                </div>
                <div class="bot-profile-actions">Coming soon</div>
              </div>

              <p class="bot-profile-bio">
                Friendly text-first assistant. Example bot profile content will be replaced with live metadata.
              </p>

              <div class="bot-modalities">
                <div class="modality-block">
                  <div class="modality-label">Input</div>
                  <div class="chip-row">
                    <span class="chip">Text</span>
                    <span class="chip">Image</span>
                  </div>
                </div>
                <div class="modality-block">
                  <div class="modality-label">Output</div>
                  <div class="chip-row">
                    <span class="chip">Text</span>
                    <span class="chip">Code</span>
                  </div>
                </div>
              </div>

              <div class="bot-placeholder-data">
                <div class="placeholder-row"><span class="placeholder-key">Model</span><span class="placeholder-value">--</span></div>
                <div class="placeholder-row"><span class="placeholder-key">Memory</span><span class="placeholder-value">--</span></div>
                <div class="placeholder-row"><span class="placeholder-key">Webhook</span><span class="placeholder-value">--</span></div>
              </div>
            </div>

            <div class="bot-profile-card">
              <div class="bot-profile-top">
                <div>
                  <div class="bot-profile-name">Claude</div>
                  <div class="bot-profile-tag">@claude</div>
                </div>
                <div class="bot-profile-actions">Coming soon</div>
              </div>

              <p class="bot-profile-bio">
                Structured assistant for long-form reasoning. Example bot profile content will be replaced with live metadata.
              </p>

              <div class="bot-modalities">
                <div class="modality-block">
                  <div class="modality-label">Input</div>
                  <div class="chip-row">
                    <span class="chip">Text</span>
                  </div>
                </div>
                <div class="modality-block">
                  <div class="modality-label">Output</div>
                  <div class="chip-row">
                    <span class="chip">Text</span>
                    <span class="chip">Summary</span>
                  </div>
                </div>
              </div>

              <div class="bot-placeholder-data">
                <div class="placeholder-row"><span class="placeholder-key">Model</span><span class="placeholder-value">--</span></div>
                <div class="placeholder-row"><span class="placeholder-key">Memory</span><span class="placeholder-value">--</span></div>
                <div class="placeholder-row"><span class="placeholder-key">Webhook</span><span class="placeholder-value">--</span></div>
              </div>
            </div>

            <div class="bot-profile-card">
              <div class="bot-profile-top">
                <div>
                  <div class="bot-profile-name">Stitch Ops</div>
                  <div class="bot-profile-tag">@stitch-ops</div>
                </div>
                <div class="bot-profile-actions">Coming soon</div>
              </div>

              <p class="bot-profile-bio">
                Workflow and ops helper bot. Placeholder profile content will be replaced with configured capabilities.
              </p>

              <div class="bot-modalities">
                <div class="modality-block">
                  <div class="modality-label">Input</div>
                  <div class="chip-row">
                    <span class="chip">Text</span>
                    <span class="chip">Commands</span>
                  </div>
                </div>
                <div class="modality-block">
                  <div class="modality-label">Output</div>
                  <div class="chip-row">
                    <span class="chip">Text</span>
                    <span class="chip">Status</span>
                  </div>
                </div>
              </div>

              <div class="bot-placeholder-data">
                <div class="placeholder-row"><span class="placeholder-key">Model</span><span class="placeholder-value">--</span></div>
                <div class="placeholder-row"><span class="placeholder-key">Memory</span><span class="placeholder-value">--</span></div>
                <div class="placeholder-row"><span class="placeholder-key">Webhook</span><span class="placeholder-value">--</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  </InfoViewLayout>
</template>

<script setup>
import InfoViewLayout from '../../components/layouts/InfoViewLayout.vue';
</script>

<style scoped>
.bots-main {
  padding: 2.5rem 0 4rem 0;
  background: var(--background-dark);
}

.bots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.bot-card {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 2rem;
}

.bot-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.bot-card h3 {
  color: var(--color-primary);
  margin: 0 0 1rem 0;
  font-size: 1.35rem;
  font-weight: 700;
}

.bot-card p {
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 1.25rem 0;
}


.bots-list-section {
  margin-top: 2.25rem;
  padding-top: 2.25rem;
  border-top: 1px solid var(--card-border);
}

.bots-list-header h2 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0 0 0.75rem 0;
}

.bots-list-header p {
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
  max-width: 800px;
}

.bots-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
  margin-top: 1.75rem;
}

.bot-profile-card {
  background: var(--card-background);
  border: 1px solid var(--card-border);
  border-radius: var(--border-radius-lg);
  padding: 1.75rem;
}

.bot-profile-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.bot-profile-name {
  color: var(--text-light);
  font-weight: 800;
  font-size: 1.35rem;
  line-height: 1.2;
  margin-bottom: 0.25rem;
}

.bot-profile-tag {
  color: var(--link-unvisited);
  font-weight: 600;
  font-size: 0.95rem;
}

.bot-profile-actions {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  white-space: nowrap;
}

.bot-profile-bio {
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 1.25rem 0;
}

.bot-modalities {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.modality-label {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 700;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-light);
  font-size: 0.85rem;
}

.bot-placeholder-data {
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  padding-top: 1rem;
}

.placeholder-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
}

.placeholder-key {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  font-size: 0.9rem;
}

.placeholder-value {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 700;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .bot-card {
    padding: 1.5rem;
  }

  .bot-modalities {
    grid-template-columns: 1fr;
  }
}
</style>
