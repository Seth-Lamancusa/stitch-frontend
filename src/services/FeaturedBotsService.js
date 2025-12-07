// Lightweight service to provide featured bots to the UI.
// The mock list only contains user_tags; display names (and UIDs) are
// resolved from the backend so the source of truth lives on USERS.
//
// Returned shape: { uid: string|null, display_name: string, user_tag: string, advanced: boolean }
import UserService from './UserService.js';

// Ordered list of featured bot tags.
const FEATURED_BOT_TAGS = ['claude-sonnet-4-5', 'gpt-5-1', 'gemini-2-5-pro', 'grok-4-1-fast-reasoning', 'deepseek-reasoner'];

// Which of the featured bots should be considered "advanced" in the UI.
const ADVANCED_TAGS = new Set(['gpt-5-pro']);

async function resolveBotForTag(tag) {
  try {
    // Search by tag; backend supports searching by @user_tag.
    const results = await UserService.searchUsers(`@${tag}`, 1);
    const users = Array.isArray(results) ? results : [];

    const normalizedTag = String(tag || '').toLowerCase();
    const user =
      users.find(
        (u) =>
          u &&
          typeof u.user_tag === 'string' &&
          u.user_tag.toLowerCase() === normalizedTag,
      ) || users[0] || null;

    if (user) {
      const uid = user.uid || user._key || null;
      const displayName =
        user.display_name || user.displayName || user.user_tag || tag;

      return {
        uid,
        display_name: displayName,
        user_tag: user.user_tag || tag,
        advanced: ADVANCED_TAGS.has(normalizedTag),
      };
    }
  } catch (_err) {
    // Fall through to local fallback.
  }

  // Fallback: no matching user returned from backend; still surface the card
  // using the tag as both label and identifier (uid left null).
  const normalizedTag = String(tag || '').toLowerCase();
  return {
    uid: null,
    display_name: tag,
    user_tag: tag,
    advanced: ADVANCED_TAGS.has(normalizedTag),
  };
}

const FeaturedBotsService = {
  async listFeaturedBots() {
    // Resolve each featured bot tag into a user-backed bot card.
    const bots = [];
    for (const tag of FEATURED_BOT_TAGS) {
      // Resolve sequentially to keep behaviour simple/predictable for now;
      // this list is small (handful of featured bots).
      // If needed, this can be parallelised with Promise.all.
      // eslint-disable-next-line no-await-in-loop
      const bot = await resolveBotForTag(tag);
      bots.push(bot);
    }
    return bots;
  }
};

export default FeaturedBotsService;


