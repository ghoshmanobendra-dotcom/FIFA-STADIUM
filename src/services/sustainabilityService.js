/**
 * Sustainability & transportation decision support.
 *
 * Given a travel distance, party size and candidate travel modes, computes the
 * match-day carbon footprint per option, ranks them, and quantifies the saving
 * versus driving solo. A generative layer turns the numbers into a short,
 * encouraging nudge; the offline engine produces the same guidance from the
 * ranked data so it always works.
 */
import { generate } from './aiService.js';
import { emissionModes, sustainabilityTips, getEmissionMode } from './knowledgeBase.js';

const SOLO_CAR = 'car';

/**
 * @param {{ distanceKm: number, partySize?: number, modes?: string[] }} input
 * @returns {Promise<object>}
 */
export async function footprint({ distanceKm, partySize = 1, modes }) {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km <= 0 || km > 20_000) {
    const err = new Error('"distanceKm" must be a positive number of kilometres');
    err.status = 400;
    throw err;
  }
  const party = Number.isInteger(partySize) && partySize > 0 ? Math.min(partySize, 60) : 1;

  const selected = (modes && modes.length ? modes : emissionModes.map((m) => m.id))
    .map((id) => getEmissionMode(id))
    .filter(Boolean);

  if (selected.length === 0) {
    const err = new Error('No valid travel modes supplied');
    err.status = 400;
    throw err;
  }

  const options = selected
    .map((mode) => {
      // Per-vehicle modes scale with the vehicle, not the party; per-passenger
      // modes scale with the number of travellers.
      const perVehicle = mode.id === SOLO_CAR;
      const totalGrams = perVehicle ? mode.gramsCO2ePerKm * km : mode.gramsCO2ePerKm * km * party;
      return {
        mode: mode.id,
        label: mode.label,
        gramsCO2ePerKm: mode.gramsCO2ePerKm,
        totalKgCO2e: Number((totalGrams / 1000).toFixed(2)),
      };
    })
    .sort((a, b) => a.totalKgCO2e - b.totalKgCO2e);

  const greenest = options[0];
  const baseline = options.find((o) => o.mode === SOLO_CAR) || options[options.length - 1];
  const savingKg = Number((baseline.totalKgCO2e - greenest.totalKgCO2e).toFixed(2));
  const savingPct =
    baseline.totalKgCO2e > 0 ? Math.round((savingKg / baseline.totalKgCO2e) * 100) : 0;

  const { text, source } = await generate({
    system:
      'You are a friendly sustainability coach for World Cup fans. In 2-3 ' +
      'sentences, encourage the greenest travel choice using the numbers given. ' +
      'Be warm, concrete and non-preachy.',
    prompt:
      `Distance ${km} km, party of ${party}. Options (kg CO2e): ` +
      options.map((o) => `${o.label}=${o.totalKgCO2e}`).join(', ') +
      `. Greenest: ${greenest.label}. Saving vs baseline: ${savingKg} kg (${savingPct}%).`,
    fallback: () =>
      `Travelling by ${greenest.label.toLowerCase()} for this ${km} km trip emits about ` +
      `${greenest.totalKgCO2e} kg CO₂e — roughly ${savingKg} kg (${savingPct}%) less than driving. ` +
      sustainabilityTips[0],
  });

  return {
    distanceKm: km,
    partySize: party,
    options,
    greenest: greenest.mode,
    savingKg,
    savingPct,
    tips: sustainabilityTips,
    advice: text,
    source,
  };
}

export default { footprint };
