const EARTH_RADIUS_M = 6_371_000;

const rad = (deg: number): number => (deg * Math.PI) / 180;

export function haversine(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const phi1 = rad(lat1);
  const phi2 = rad(lat2);
  const dPhi = rad(lat2 - lat1);
  const dLambda = rad(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}