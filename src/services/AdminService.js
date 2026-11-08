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

/**
 * @param {string} listName - platform_waitlist, platform_beta, api_waitlist, or api_beta
 * @param {{ offset?: number, limit?: number }} [page]
 * @returns {Promise<{ list: string, total: number, offset: number, limit: number, rows: Array }>}
 */
export function getAdmissionList(listName, page = {}) {
  const offset = Number.isFinite(page.offset) ? page.offset : 0;
  const limit = Number.isFinite(page.limit) ? page.limit : 50;
  return apiClient
    .get('/admin/admissions', { params: { list: listName, offset, limit } })
    .then((res) => res.data || { list: listName, total: 0, offset, limit, rows: [] });
}

/**
 * Open the gate for one address on the list the admin is viewing.
 * Platform lists open registration. API lists grant API access. API beta also
 * marks the address as an API tester.
 * @param {string} listName
 * @param {string} email
 * @returns {Promise<{ email: string, label: string|null, requested_at: string|null, note: string|null, registration_open: boolean, api_allowed: boolean }>}
 */
export function admitAdmission(listName, email) {
  return apiClient
    .post('/admin/admissions', { list: listName, email })
    .then((res) => res.data);
}
