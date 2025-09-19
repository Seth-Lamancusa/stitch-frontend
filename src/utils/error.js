export function normalizeError(input, fallbackMessage) {
  if (!input) return { code: null, message: fallbackMessage || 'An error occurred' };
  if (typeof input === 'string') return { code: null, message: input };
  if (input instanceof Error) {
    return { code: input.message || null, message: mapCodeToMessage(input.message) || input.message || fallbackMessage || 'An error occurred' };
  }
  // HTTP style error
  const status = input.response?.status;
  const serverCode = input.response?.data?.code || input.code || null;
  const serverMessage = input.response?.data?.detail || input.response?.data?.message || input.message;
  const code = serverCode || (status ? `HTTP_${status}` : null);
  const message = serverMessage || mapCodeToMessage(serverCode) || fallbackMessage || 'An error occurred';
  return { code, message };
}

function mapCodeToMessage(code) {
  if (!code) return null;
  const mapping = {
    user_tag_conflict: 'That tag is already taken',
    user_tag_in_use: 'That tag is already taken',
    email_conflict: 'That email is already in use',
    phone_conflict: 'That phone number is already in use',
    multiple_emails_not_allowed: 'Only one email is allowed per account',
    multiple_phones_not_allowed: 'Only one phone number is allowed per account',
    multiple_endpoints_not_allowed: 'Only one endpoint is allowed per account',
  };
  return mapping[code] || null;
}


