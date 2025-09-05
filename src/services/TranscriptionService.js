import axios from 'axios';
import TokenManager from './TokenManager';

const apiBaseUrl = '/api';

const getAuthHeaders = () => {
  const token = TokenManager.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

class TranscriptionService {
  async transcribe(file, options = {}) {
    const form = new FormData();
    form.append('file', file);
    // speakers_expected is now required
    if (!options.speakers_expected || !Number.isInteger(options.speakers_expected) || options.speakers_expected <= 0) {
      throw new Error('speakers_expected is required and must be a positive integer');
    }
    form.append('speakers_expected', String(options.speakers_expected));

    const headers = {
      ...getAuthHeaders(),
    };

    const resp = await axios.post(`${apiBaseUrl}/transcribe`, form, { headers });
    if (!resp || !resp.data || !Array.isArray(resp.data.utterances)) {
      throw new Error('Unexpected transcription response');
    }
    return resp.data;
  }
}

export default new TranscriptionService();


