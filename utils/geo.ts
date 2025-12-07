// Haversine distance in meters
export function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aHarv = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return R * c;
}

export function metersToKm(m: number) {
  return m / 1000;
}

export function paceMinPerKm(seconds: number, meters: number) {
  if (meters <= 0) return { min: 0, sec: 0 };
  const secPerKm = seconds / metersToKm(meters);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return { min, sec };
}
