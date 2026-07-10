/**
 * Multilingual assistance utilities.
 *
 * The World Cup draws a global audience, so language support is a first-class
 * concern. This module owns the supported-language list plus a model-backed
 * translation helper with a safe offline passthrough.
 */
import { generate } from './aiService.js';

/** Supported UI + assistance languages (ISO 639-1). */
export const LANGUAGES = ['en', 'es', 'fr', 'pt', 'de', 'ar', 'ja', 'ko', 'zh', 'hi'];

const NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  de: 'German',
  ar: 'Arabic',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  hi: 'Hindi',
};

/** Right-to-left languages, surfaced so the UI can set `dir="rtl"`. */
export const RTL_LANGUAGES = ['ar'];

/** @param {string} code */
export function languageName(code) {
  return NAMES[code] || code;
}

/** @param {string} code */
export function isSupported(code) {
  return LANGUAGES.includes(code);
}

/**
 * Translate arbitrary text into a target language.
 * @param {{ text: string, target: string }} input
 * @returns {Promise<{ text: string, target: string, source: string }>}
 */
export async function translate({ text, target }) {
  const lang = isSupported(target) ? target : 'en';
  if (lang === 'en') {
    // No-op for English; avoids an unnecessary model round-trip.
    return { text, target: lang, source: 'offline' };
  }

  const { text: translated, source } = await generate({
    system:
      'You are a professional translator for a live sports venue. Translate the ' +
      "user's text faithfully and idiomatically. Return only the translation.",
    prompt: `Translate into ${languageName(lang)}:\n\n${text}`,
    fallback: () => `[${languageName(lang)}] ${text}`,
    maxTokens: 512,
  });

  return { text: translated, target: lang, source };
}

export default { LANGUAGES, RTL_LANGUAGES, languageName, isSupported, translate };
