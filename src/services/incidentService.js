/**
 * Real-time incident triage & decision support.
 *
 * A control-room operator logs an incident (type, zone, severity, free-text
 * detail) and instantly gets a structured recommendation: computed priority,
 * which team to dispatch, concrete next actions, and whether wider escalation
 * is warranted. The deterministic engine encodes a defensible severity/priority
 * matrix so recommendations are consistent and auditable; the model layer adds
 * natural-language framing on top.
 */
import { generate } from './aiService.js';
import { getVenue } from './knowledgeBase.js';

export const INCIDENT_TYPES = [
  'medical',
  'crowd-surge',
  'lost-person',
  'security',
  'fire',
  'weather',
  'infrastructure',
  'accessibility',
];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

/** Map an incident type to the responding team + baseline urgency weight. */
const RESPONSE = {
  medical: { team: 'Medical / paramedics', weight: 3 },
  'crowd-surge': { team: 'Crowd safety stewards', weight: 3 },
  'lost-person': { team: 'Guest services & security', weight: 2 },
  security: { team: 'Security & law enforcement', weight: 3 },
  fire: { team: 'Fire & evacuation', weight: 4 },
  weather: { team: 'Operations control', weight: 2 },
  infrastructure: { team: 'Facilities & engineering', weight: 2 },
  accessibility: { team: 'Accessibility services', weight: 2 },
};

const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * @param {{ venueId?: string, type: string, severity: string, zone?: string, detail?: string }} input
 * @returns {Promise<object>}
 */
export async function triage({ venueId, type, severity, zone, detail }) {
  if (!INCIDENT_TYPES.includes(type)) {
    const err = new Error(`"type" must be one of: ${INCIDENT_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (!SEVERITIES.includes(severity)) {
    const err = new Error(`"severity" must be one of: ${SEVERITIES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const venue = venueId ? getVenue(venueId) : null;
  const response = RESPONSE[type];
  const score = response.weight + SEVERITY_WEIGHT[severity];

  // Priority P1 (most urgent) .. P4, derived from combined weight.
  const priority = score >= 7 ? 'P1' : score >= 5 ? 'P2' : score >= 4 ? 'P3' : 'P4';
  const escalate = priority === 'P1' || severity === 'critical' || type === 'fire';
  const targetResponseMins = { P1: 2, P2: 5, P3: 10, P4: 20 }[priority];

  const actions = baseActions(type, severity, zone, escalate);

  const { text, source } = await generate({
    system:
      'You are a calm stadium incident commander. Given a triaged incident, ' +
      'write a 2-3 sentence action brief for responders. Be specific, ' +
      'prioritised and reassuring. Do not invent facts beyond what is provided.',
    prompt:
      `${venue ? `Venue: ${venue.name}. ` : ''}Incident: ${type} (${severity}) ` +
      `in ${zone || 'unspecified zone'}. Priority ${priority}, dispatch ${response.team}. ` +
      `Detail: ${detail || 'none'}. Suggested actions: ${actions.join('; ')}.`,
    fallback: () =>
      `${priority} — dispatch ${response.team} to ${zone || 'the reported location'} ` +
      `within ${targetResponseMins} min. ${actions.join(' ')}` +
      (escalate ? ' Notify the duty operations manager immediately.' : ''),
    cacheable: false,
  });

  return {
    venue: venue ? { id: venue.id, name: venue.name } : null,
    type,
    severity,
    zone: zone || null,
    priority,
    dispatchTeam: response.team,
    targetResponseMinutes: targetResponseMins,
    escalate,
    actions,
    brief: text,
    source,
  };
}

/**
 * Map an incident type to standard base instructions.
 * @param {string} type
 * @param {string} severity
 * @param {string|null} zone
 * @param {boolean} escalate
 * @returns {string[]}
 */
function baseActions(type, severity, zone, escalate) {
  const at = zone ? `at ${zone}` : 'at the location';
  const common = {
    medical: [
      `Send paramedics with an AED ${at}.`,
      'Clear a path for a stretcher and keep bystanders back.',
    ],
    'crowd-surge': [
      `Open additional flow lanes ${at} and pause inbound movement.`,
      'Use PA to calm and redirect the crowd.',
    ],
    'lost-person': [
      'Broadcast a description to all stewards.',
      'Direct the reporting party to the nearest Guest Services desk.',
    ],
    security: [`Contain and isolate the area ${at}.`, 'Coordinate with on-site law enforcement.'],
    fire: [
      `Initiate zonal evacuation ${at}.`,
      'Confirm fire service is en route and hold nearby lifts.',
    ],
    weather: [
      'Move fans under cover and monitor alerts.',
      'Prepare a possible play-suspension message.',
    ],
    infrastructure: [
      `Cordon the affected area ${at}.`,
      'Dispatch engineering to assess and make safe.',
    ],
    accessibility: [
      `Send accessibility services ${at}.`,
      'Offer step-free routing and companion assistance.',
    ],
  }[type];

  const actions = [...common];
  if (severity === 'critical' || escalate) {
    actions.push('Log a timestamped incident record and brief the control room.');
  }
  return actions;
}

export default { triage, INCIDENT_TYPES, SEVERITIES };
