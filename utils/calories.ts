// utils/calories.ts
// Estimate calories from a run using MET based on speed.
// MET table (very rough): walk 4, jog 7.5, run 9.8, fast 11, very fast 12.5
export function estimateRunCalories(weightKg: number, distanceMeters: number, durationSec: number): number {
  if (durationSec <= 0 || distanceMeters <= 0 || weightKg <= 0) return 0;
  const speedKmh = (distanceMeters / 1000) / (durationSec / 3600);
  let MET = 7.5; // default jog
  if (speedKmh < 6) MET = 4.0;
  else if (speedKmh < 9) MET = 7.5;
  else if (speedKmh < 12) MET = 9.8;
  else if (speedKmh < 15) MET = 11.0;
  else MET = 12.5;
  const hours = durationSec / 3600;
  return Math.round(MET * weightKg * hours);
}
