/**
 * Volunteer & staff shift-briefing generator.
 *
 * The problem statement explicitly names **volunteers** and **venue staff** as
 * audiences. This feature serves them directly: given a role (and optionally a
 * venue, zone and shift), it produces a concise, GenAI-authored briefing —
 * duties, key locations, escalation path, and a few crowd-facing phrases — so a
 * volunteer can be effective from minute one. Deterministic offline fallback
 * keeps it working with no model configured.
 */
import { generate } from './aiService.js';
import { getVenue } from './knowledgeBase.js';

/** Volunteer / staff roles and their core remit. */
export const ROLES = {
  steward: {
    label: 'Crowd steward',
    duties: [
      'Welcome fans, check tickets and direct people to their gate and seat.',
      'Watch for crowd build-up and keep gangways and exits clear.',
    ],
    escalation: 'Report any crowd-surge or safety concern to the control room immediately.',
  },
  'guest-services': {
    label: 'Guest services',
    duties: [
      'Answer questions, hand out accessibility kits, and reunite lost children.',
      'Register children at the Family Services desk on arrival.',
    ],
    escalation: 'Escalate lost-person and medical cases to security and medical teams.',
  },
  medical: {
    label: 'Medical responder',
    duties: [
      'Staff the first-aid station; keep AEDs and stretcher routes ready.',
      'Respond to medical calls and coordinate ambulance access.',
    ],
    escalation: 'Trigger a P1 medical response for any life-threatening incident.',
  },
  'accessibility-host': {
    label: 'Accessibility host',
    duties: [
      'Guide guests along step-free routes and to accessible seating.',
      'Support sensory-room users and offer companion assistance.',
    ],
    escalation: 'Call accessibility services for any access barrier you cannot resolve.',
  },
  'transport-marshal': {
    label: 'Transport marshal',
    duties: [
      'Direct fans to shuttles, transit and signposted rideshare pick-up.',
      'Keep pedestrian and vehicle flows separated at peak egress.',
    ],
    escalation: 'Report transit-hub congestion to operations for staggered egress.',
  },
  'sustainability-steward': {
    label: 'Sustainability steward',
    duties: [
      'Guide fans to recycling, compost and free water-refill stations.',
      'Encourage reusable bottles and low-carbon travel choices.',
    ],
    escalation: 'Flag overflowing waste stations to facilities for collection.',
  },
};

export const PHRASES = {
  en: 'Welcome! How can I help?',
  es: '¡Bienvenido! ¿Cómo puedo ayudar?',
  fr: 'Bienvenue ! Comment puis-je aider ?',
};

/**
 * @param {{ role: string, venueId?: string, zone?: string, shift?: string }} input
 * @returns {Promise<object>}
 */
export async function brief({ role, venueId, zone, shift }) {
  const roleDef = ROLES[role];
  if (!roleDef) {
    const err = new Error(`"role" must be one of: ${Object.keys(ROLES).join(', ')}`);
    err.status = 400;
    throw err;
  }
  const venue = venueId ? getVenue(venueId) : null;

  const { text, source } = await generate({
    system:
      'You are a shift supervisor briefing a World Cup volunteer. Write a short, ' +
      'friendly, well-structured briefing (5-7 sentences) covering their duties, ' +
      'key locations, escalation path and one welcoming phrase. Be practical.',
    prompt:
      `Role: ${roleDef.label}. ${venue ? `Venue: ${venue.name} (${venue.city}). ` : ''}` +
      `${zone ? `Zone: ${zone}. ` : ''}${shift ? `Shift: ${shift}. ` : ''}` +
      `Duties: ${roleDef.duties.join(' ')} Escalation: ${roleDef.escalation} ` +
      `${venue ? `Amenities on site: ${venue.amenities.join(', ')}.` : ''}`,
    fallback: () => offlineBriefing(roleDef, venue, zone, shift),
  });

  return {
    role,
    roleLabel: roleDef.label,
    venue: venue ? { id: venue.id, name: venue.name } : null,
    zone: zone || null,
    shift: shift || null,
    duties: roleDef.duties,
    escalation: roleDef.escalation,
    phrases: PHRASES,
    briefing: text,
    source,
  };
}

function offlineBriefing(roleDef, venue, zone, shift) {
  const where = venue ? ` at ${venue.name}` : '';
  const z = zone ? ` in ${zone}` : '';
  const s = shift ? ` for the ${shift} shift` : '';
  return (
    `Welcome to your ${roleDef.label} role${where}${z}${s}. ` +
    `${roleDef.duties.join(' ')} ${roleDef.escalation} ` +
    `Greet fans warmly — try "${PHRASES.en}" / "${PHRASES.es}". ` +
    `Ask any supervisor in a purple vest if you need help.`
  );
}

export default { brief, ROLES, PHRASES };
