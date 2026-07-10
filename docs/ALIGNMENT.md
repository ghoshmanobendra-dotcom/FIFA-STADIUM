# Problem-Statement Alignment

> **Challenge:** _Build a GenAI-enabled solution that enhances stadium operations
> and the overall tournament experience for **fans, organizers, volunteers, or
> venue staff**. The solution must leverage Generative AI to improve
> **navigation, crowd management, accessibility, transportation, sustainability,
> multilingual assistance, operational intelligence, or real-time decision
> support** during the FIFA World Cup 2026._

StadiumIQ 2026 implements **every** named capability area and serves **every**
named audience — as working, testable features, not slideware. This mapping is
also exposed as a machine-readable contract at **`GET /api/capabilities`** and
asserted by `test/capabilities.test.js`.

## Capability area → feature

| GenAI capability area (from the brief) | Feature                                           | Endpoint                                                              |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Navigation                             | In-stadium wayfinding                             | `POST /api/navigate`                                                  |
| Crowd management                       | Crowd & operational intelligence                  | `GET /api/crowd/:venueId`                                             |
| Accessibility                          | Accessible (step-free) routing + concierge        | `POST /api/navigate`, `POST /api/concierge`                           |
| Transportation                         | Green travel & match-day plan                     | `POST /api/sustainability/footprint`, `GET /api/plan/:venueId`        |
| Sustainability                         | Carbon-footprint comparison                       | `POST /api/sustainability/footprint`                                  |
| Multilingual assistance                | Concierge, translation, PA announcements          | `POST /api/concierge`, `POST /api/translate`, `POST /api/announce`    |
| Operational intelligence               | Crowd snapshot, PA announcements, shift briefings | `GET /api/crowd/:venueId`, `POST /api/announce`, `POST /api/briefing` |
| Real-time decision support             | Incident triage                                   | `POST /api/incident`                                                  |

## Audience / persona → feature

| Persona (from the brief) | Served by                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| **Fans**                 | Concierge, wayfinding, green travel, match-day plan, translation          |
| **Organizers**           | Crowd intelligence, incident triage, announcements, footprint             |
| **Volunteers**           | Shift briefing, announcements, wayfinding, translation                    |
| **Venue staff**          | Incident triage, crowd intelligence, announcements, briefing, translation |

## How GenAI is leveraged (not bolted on)

Every feature composes a grounded prompt and returns a natural-language result
through the single AI gateway (`aiService.generate`). The model is used where
language _matters_ — friendly directions, calm incident briefs, encouraging
sustainability nudges, multilingual announcements — while deterministic logic
(routing, priority matrices, footprint maths) stays auditable. When no API key
is present, every feature degrades to a deterministic engine, so the alignment
holds even offline.

## FIFA World Cup 2026 specificity

Grounded in real tournament data: all **16 host venues** across the USA, Canada
and Mexico, the **48-team / 104-match** format, the opening match at Estadio
Azteca and the final at MetLife Stadium, plus per-venue amenities, wayfinding
maps, fixtures and travel-emission factors.
