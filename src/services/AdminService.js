import apiClient from './apiClient';

/**
 * Admin-only API calls. Requires user to have admin scope; backend returns 403 otherwise.
 */

/**
 * @param {Object} [params]
 * @param {string} [params.from_date] - Start date YYYY-MM-DD
 * @param {string} [params.to_date] - End date YYYY-MM-DD
 * @param {number} [params.limit] - Max rows (default from backend)
 * @returns {Promise<Array<{ day: string, user_uid: string|null, message_count: number }>>}
 */
export function getMessagesPerDay(params = {}) {
  return apiClient
    .get('/admin/metrics/messages-per-day', { params })
    .then((res) => (res.data && Array.isArray(res.data) ? res.data : []));
}
