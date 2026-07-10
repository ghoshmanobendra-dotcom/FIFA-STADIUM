# Accessibility Statement

Accessibility is a core requirement for StadiumIQ 2026 — the platform exists in
part to help disabled fans navigate a stadium, so the tool itself must be
usable by everyone. We target **WCAG 2.1 Level AA**.

## Verified automatically

The `e2e/a11y.mjs` suite drives every feature panel in a real headless browser
and runs [`axe-core`](https://github.com/dequelabs/axe-core) against each
rendered state, in **both light and dark themes**, asserting **zero
violations** for the `wcag2a, wcag2aa, wcag21a, wcag21aa` rule sets. Run it with:

```bash
npm run test:e2e
```

## Design decisions

- **Semantic structure** — landmark elements (`header`, `nav`, `main`,
  `footer`), a logical heading hierarchy, and a "skip to main content" link.
- **Keyboard support** — the feature switcher implements the ARIA Tabs pattern
  with roving `tabindex` and Left/Right arrow navigation; all controls are
  reachable and operable by keyboard with a visible focus indicator.
- **Screen readers** — every input has an associated `<label>`; results render
  in `aria-live` regions (assertive for incident triage) with `aria-busy`
  toggled during requests; each result carries the correct `lang`/`dir` so
  translated and right-to-left (Arabic) content is announced properly.
- **Colour & contrast** — all text meets AA contrast in both themes; colour is
  never the sole signal (status also carries text labels). Verified by axe.
- **The route map** — the wayfinding SVG has `role="img"` and a descriptive
  `aria-label`, and is always accompanied by an equivalent text description of
  the directions.
- **User preferences** — honours `prefers-reduced-motion`,
  `prefers-contrast: more`, and `forced-colors` (Windows High Contrast).
- **Accessible content, not just UI** — first-class **step-free routing**,
  sensory-room and companion-seat information, and multilingual assistance are
  product features, not add-ons.

## Known limitations

The interface copy (labels, buttons) is presented in English; AI-generated
_answers_, translations, and announcements are available in 10 languages.
