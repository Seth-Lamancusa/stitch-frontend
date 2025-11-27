// Lightweight service to fetch featured bots. Falls back to mocked data.
// Shape: { uid: string, display_name: string, user_tag: string, advanced: boolean }
import axios from 'axios';
const MOCK_FEATURED_BOTS = [
  { uid: '39daf2ca', display_name: 'Claude', user_tag: 'claude', advanced: false, input_modalities: 'txt, pdf', output_modalities: 'txt', foundation_provider: 'Anthropic' },
  { uid: '2ae49e27', display_name: 'ChatGPT', user_tag: 'chatgpt', advanced: false, input_modalities: 'txt, png', output_modalities: 'txt, png', foundation_provider: 'OpenAI' },
  { uid: '3de72cc9', display_name: 'Grok', user_tag: 'grok', advanced: false, input_modalities: 'txt, web', output_modalities: 'txt', foundation_provider: 'xAI' },
  { uid: 'a113e0dc', display_name: 'GPT-5', user_tag: 'gpt-5', advanced: true, input_modalities: 'txt, mp3', output_modalities: 'txt, mp3', foundation_provider: 'OpenAI' },
  { uid: '3230dcc9', display_name: 'Gemini', user_tag: 'gemini', advanced: false, input_modalities: 'txt, png, pdf', output_modalities: 'txt, png', foundation_provider: 'Google' }
];

async function fetchFeaturedBotsFromApi() {
  try {
    const response = await axios.get('/featured_bots', { withCredentials: true });
    const data = response && response.data ? response.data : null;
    if (Array.isArray(data)) return data;
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
        advanced: Boolean(b.advanced),
        input_modalities: b.input_modalities || null,
        output_modalities: b.output_modalities || null,
        foundation_provider: b.foundation_provider || null
      }));
    }
    return MOCK_FEATURED_BOTS;
  }
};

export default FeaturedBotsService;


