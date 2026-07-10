/**
 * Multilingual AI fan concierge.
 *
 * Answers free-text fan questions grounded in the venue knowledge base. Uses
 * retrieval-augmented prompting: the most relevant knowledge entries are
 * injected into the model prompt so answers stay accurate and on-topic, and
 * the same retrieved entries power the offline fallback.
 */
import { generate } from './aiService.js';
import { searchKnowledge, getVenue, tournament } from './knowledgeBase.js';
import { LANGUAGES, languageName } from './translationService.js';

const SYSTEM_PROMPT = [
  'You are the official StadiumIQ fan concierge for the FIFA World Cup 2026.',
  'Answer concisely (2-4 sentences), warmly and accurately.',
  'Only use the CONTEXT provided; if it does not cover the question, say so and',
  'suggest visiting Guest Services. Always reply in the requested language.',
].join(' ');

/**
 * @param {{ question: string, language?: string, venueId?: string }} input
 * @returns {Promise<{ answer: string, language: string, topics: string[], venue: object|null, source: string }>}
 */
export async function ask({ question, language = 'en', venueId }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const venue = venueId ? getVenue(venueId) : null;
  const matches = searchKnowledge(question);
  const topics = matches.map((m) => m.entry.topic);

  const contextBlocks = matches.map((m) => `- (${m.entry.topic}) ${m.entry.answer}`);
  if (venue) {
    contextBlocks.unshift(
      `- (venue) ${venue.name} in ${venue.city}, ${venue.country}. ` +
        `Capacity ${venue.capacity}. Amenities: ${venue.amenities.join(', ')}.`,
    );
  }
  const context = contextBlocks.length
    ? contextBlocks.join('\n')
    : 'No specific match found in the knowledge base.';

  const prompt = [
    `TOURNAMENT: ${tournament.name} (${tournament.dates}).`,
    `CONTEXT:\n${context}`,
    `FAN QUESTION: ${question}`,
    `Reply in ${languageName(lang)} (code: ${lang}).`,
  ].join('\n\n');

  const { text, source } = await generate({
    system: SYSTEM_PROMPT,
    prompt,
    fallback: () => offlineAnswer(matches, lang, venue),
  });

  return { answer: text, language: lang, topics, venue, source };
}

/**
 * Deterministic answer assembled directly from retrieved knowledge entries.
 * @param {Array<{ entry: object }>} matches
 * @param {string} lang
 * @param {object|null} venue
 */
function offlineAnswer(matches, lang, venue) {
  const prefix = venue ? `At ${venue.name}: ` : '';
  if (matches.length === 0) {
    const fallback =
      "I don't have that detail yet. Please ask a steward in a purple vest or visit Guest Services near the main gate.";
    return prefix + translateStub(fallback, lang);
  }
  const body = matches
    .slice(0, 2)
    .map((m) => m.entry.answer)
    .join(' ');
  return prefix + translateStub(body, lang);
}

/**
 * Lightweight language framing for the offline engine. Real translation is
 * handled by the model when configured; offline we annotate the language so the
 * response is still clearly labelled rather than silently English-only.
 * @param {string} text
 * @param {string} lang
 */
function translateStub(text, lang) {
  if (lang === 'en') return text;
  return `[${languageName(lang)}] ${text}`;
}

export default { ask };
