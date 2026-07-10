/**
 * Input hardening for GenAI prompts.
 *
 * Any free-text that will be embedded in a model prompt passes through here.
 * This is a defence-in-depth control against prompt-injection and prompt
 * "smuggling": we strip control characters, collapse pathological whitespace,
 * and neutralise the most common instruction-override phrases so untrusted fan
 * input cannot easily hijack the system prompt. It is deliberately conservative
 * (it never blocks a request) and complements — does not replace — keeping user
 * text in the user role, separate from system instructions.
 */

// Strip ASCII control characters (but keep tab/newline/carriage-return, which
// are collapsed into single spaces below). Control chars are matched
// deliberately here — that is the whole point of the sanitiser.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Common jailbreak / role-override markers. Matched case-insensitively and
// replaced with a neutral token so the intent is defused but the text stays
// readable for logging and offline matching.
const OVERRIDE_PATTERNS = [
  /ignore (all|any|previous|prior|the above)[^.\n]*instructions/gi,
  /disregard (all|any|previous|prior|the above)[^.\n]*/gi,
  /you are now\b/gi,
  /system prompt/gi,
  /\bBEGIN\s+SYSTEM\b/gi,
  /<\s*\/?\s*(system|assistant|user)\s*>/gi,
];

/**
 * Sanitise free-text for safe inclusion in a prompt.
 * @param {string} input
 * @param {number} [maxLength=500]
 * @returns {string}
 */
export function sanitizePrompt(input, maxLength = 500) {
  let text = String(input ?? '');
  text = text.replace(CONTROL_CHARS, ' ');
  for (const pattern of OVERRIDE_PATTERNS) {
    text = text.replace(pattern, '[filtered]');
  }
  // Collapse runs of whitespace (including newlines used to fake structure).
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLength) text = text.slice(0, maxLength);
  return text;
}

export default { sanitizePrompt };
