/**
 * PII safeguard applied to every piece of free text before it's sent to
 * Claude — document contents, user questions, anything not already a
 * structured query result. Belt-and-suspenders: this platform's own data
 * model never stores ID numbers (see WorkforceStat's aggregation-only
 * design), but uploaded document text or free-text questions are outside
 * that guarantee.
 */
const SA_ID_NUMBER = /\b\d{13}\b/g;
// Two alternatives rather than a `\b(?:\+27|0)` prefix: `\b` never matches
// immediately before `+` (neither side of that position is a word
// character), so a leading `+27` branch under one shared `\b` silently never
// matches.
const PHONE_NUMBER = /(?:\+27[ -]?\d{2}[ -]?\d{3}[ -]?\d{4}\b|\b0\d{2}[ -]?\d{3}[ -]?\d{4}\b)/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

export function redactPii(text: string): string {
  return text.replace(SA_ID_NUMBER, "[REDACTED_ID_NUMBER]").replace(PHONE_NUMBER, "[REDACTED_PHONE]").replace(EMAIL, "[REDACTED_EMAIL]");
}
