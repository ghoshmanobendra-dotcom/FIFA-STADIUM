/**
 * Multilingual public-address announcement generator.
 *
 * Lets staff broadcast a consistent, clear message to a global crowd in many
 * languages at once. An operator picks a common scenario (or types a custom
 * message) and selects target languages; the service produces a polished base
 * announcement and translations for each language. This unifies the
 * multilingual-assistance and operational-intelligence capability areas.
 */
import { translate, LANGUAGES } from './translationService.js';

/** Ready-made, plain-language templates for the most common venue scenarios. */
export const SCENARIOS = {
  'gates-open':
    'Gates are now open. Please have your mobile ticket ready and follow signage to your gate.',
  delay:
    'Kickoff is delayed by a short period. Please remain in your seats; we will update you shortly. Thank you for your patience.',
  'weather-hold':
    'For your safety, play is temporarily paused due to weather. Please move to covered areas and await further instructions.',
  'lost-child':
    'A young supporter is being cared for at Guest Services. If you are missing a child, please go to the nearest Guest Services desk.',
  evacuation:
    'Please leave the stadium calmly using the nearest available exit. Follow the directions of stewards. Do not run.',
  'final-whistle':
    'Thank you for joining us. Please exit calmly; transit and shuttle services are running from the signposted areas.',
  accessibility:
    'Step-free routes and accessibility assistance are available. Please ask any steward in a purple vest for help.',
};

/**
 * @param {{ scenario?: string, message?: string, languages?: string[] }} input
 * @returns {Promise<object>}
 */
export async function announce({ scenario, message, languages }) {
  let base = '';
  if (typeof message === 'string' && message.trim()) {
    base = message.trim().slice(0, 500);
  } else if (scenario && SCENARIOS[scenario]) {
    base = SCENARIOS[scenario];
  } else {
    const err = new Error(
      `Provide a "message", or a known "scenario" (one of: ${Object.keys(SCENARIOS).join(', ')})`,
    );
    err.status = 400;
    throw err;
  }

  const requested =
    Array.isArray(languages) && languages.length
      ? languages.filter((l) => LANGUAGES.includes(l))
      : ['en', 'es', 'fr'];

  const targets = requested.length ? [...new Set(requested)] : ['en'];

  const translations = await Promise.all(
    targets.map(async (lang) => {
      const { text, source } = await translate({ text: base, target: lang });
      return { language: lang, text, source };
    }),
  );

  return {
    scenario: scenario && SCENARIOS[scenario] ? scenario : 'custom',
    base,
    languages: translations,
  };
}

export default { announce, SCENARIOS };
