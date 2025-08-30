// Lightweight service to fetch featured bots. Falls back to mocked data.
// Shape: { uid: string, display_name: string, user_tag: string, advanced: boolean }

async function fetchFeaturedBotsFromApi() {
  try {
    const response = await fetch('/featured_bots', { credentials: 'include' });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (_err) {
    // Silently fall back to mock
  }
  return null;
}

const FeaturedBotsService = {
  async listFeaturedBots() {
    const apiBots = await fetchFeaturedBotsFromApi();
    if (Array.isArray(apiBots)) {
      return apiBots.map((b) => ({
        uid: b.uid,
        display_name: b.display_name,
        user_tag: b.user_tag,
        advanced: Boolean(b.advanced)
      }));
    }
    return MOCK_FEATURED_BOTS;
  }
};

export default FeaturedBotsService;


