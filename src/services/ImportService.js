import apiClient from './apiClient';

class ImportService {
  /**
   * Import turns as quotes. The current user is the author.
   * Other speakers are display names on import_info.
   * Requires messages.write and messages.quote. Posts to /messages/import/quote.
   * @param {Array} messages - { content, isMe, speakerName, originalTimestamp, sourcePlatform }
   * @param {Array} recipients
   * @param {boolean} isPublic
   * @param {Object} options - { sourcePlatform }
   */
  async importQuoteConversation(messages, recipients = [], isPublic = true, options = {}) {
    const endpoint = '/messages/import/quote';

    const payload = (messages || []).map(m => {
      if (!m || !m.content || !m.content.trim()) {
        throw new Error('Empty message content is not allowed');
      }

      const base = {
        content: m.content,
        public: isPublic,
        recipients: Array.isArray(recipients) ? recipients : [],
        files: []
      };

      if (!m.isMe) {
        base.import_info = {
          display_name: (m.speakerName || '').trim() || 'Imported Speaker'
        };

        const rawOriginalTimestamp = (m.originalTimestamp || '').trim();
        if (rawOriginalTimestamp) {
          base.import_info.original_timestamp = rawOriginalTimestamp;
        }

        const sourcePlatform = (options.sourcePlatform || m.sourcePlatform || '').trim();
        if (sourcePlatform) {
          base.import_info.source_platform = sourcePlatform;
        }
      }

      return base;
    });

    try {
      // Each turn is its own create. The next turn replies to the last one that landed.
      const results = [];
      let parentId = null;
      for (const item of payload) {
        const body = parentId ? { ...item, parent_id: parentId } : item;
        const response = await apiClient.post(`${endpoint}`, body, { headers: {} });
        const data = response.data;
        const first = Array.isArray(data) ? (data[0] || null) : data;
        results.push(first);
        if (first && first.success && first.message && first.message.id) {
          parentId = first.message.id;
        }
      }
      const successful = results.filter(r => r && r.success && r.message);
      const totalRequested = payload.length;
      const messageCount = successful.length;
      const partial_success = messageCount < totalRequested;
      const thread_id = successful.length > 0 ? successful[0].message.id : null;

      return {
        success: messageCount > 0,
        thread_id,
        message_count: messageCount,
        total_requested: totalRequested,
        partial_success
      };
    } catch (error) {
      console.error('[ImportService] ImportQuoteConversation failed:', error);
      throw error;
    }
  }
}

const importService = new ImportService();
export default importService;
