/**
 * Minimal, hand-authored OpenAPI 3.1 description of the public API. Serving a
 * machine-readable contract makes the platform easy to integrate with and
 * demonstrates API discipline. Kept as a plain object to avoid a build step.
 */
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'StadiumIQ 2026 API',
    version: '1.0.0',
    description: 'GenAI stadium operations & fan-experience API for the FIFA World Cup 2026.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api' }],
  paths: {
    '/health': { get: { summary: 'Liveness + AI mode', responses: ok() } },
    '/metrics': { get: { summary: 'Runtime AI/usage metrics', responses: ok() } },
    '/tournament': { get: { summary: 'Tournament metadata + languages', responses: ok() } },
    '/venues': { get: { summary: 'List all host venues', responses: ok() } },
    '/venues/{id}': {
      get: {
        summary: 'Venue detail + wayfinding nodes',
        parameters: [pathParam('id')],
        responses: ok(),
      },
    },
    '/matches': { get: { summary: 'List sample fixtures', responses: ok() } },
    '/concierge': {
      post: { summary: 'Multilingual fan Q&A', requestBody: body(['question']), responses: ok() },
    },
    '/navigate': {
      post: {
        summary: 'In-stadium wayfinding',
        requestBody: body(['venueId', 'from', 'to']),
        responses: ok(),
      },
    },
    '/crowd/{venueId}': {
      get: { summary: 'Crowd & ops snapshot', parameters: [pathParam('venueId')], responses: ok() },
    },
    '/translate': {
      post: { summary: 'Translate text', requestBody: body(['text', 'target']), responses: ok() },
    },
    '/sustainability/footprint': {
      post: {
        summary: 'Travel carbon footprint',
        requestBody: body(['distanceKm']),
        responses: ok(),
      },
    },
    '/incident': {
      post: {
        summary: 'Real-time incident triage',
        requestBody: body(['type', 'severity']),
        responses: ok(),
      },
    },
    '/announce': {
      post: { summary: 'Multilingual PA announcement', requestBody: body([]), responses: ok() },
    },
    '/briefing': {
      post: {
        summary: 'Volunteer & staff shift briefing',
        requestBody: body(['role']),
        responses: ok(),
      },
    },
    '/capabilities': {
      get: { summary: 'Capability → GenAI area → persona alignment map', responses: ok() },
    },
    '/plan/{venueId}': {
      get: { summary: 'AI match-day plan', parameters: [pathParam('venueId')], responses: ok() },
    },
  },
};

function ok() {
  return { 200: { description: 'Success' }, 400: { description: 'Invalid request' } };
}
function pathParam(name) {
  return { name, in: 'path', required: true, schema: { type: 'string' } };
}
function body(required) {
  return {
    required: required.length > 0,
    content: {
      'application/json': {
        schema: { type: 'object', required, additionalProperties: true },
      },
    },
  };
}

export default openapi;
