/**
  Deterministic PRNG based on string seed (e.g. subscription_id)
 */

export function stringHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

export function createPRNG(seedStr: string) {
  let state = stringHash(seedStr) || 123456789;
  
  return function next(): number {
    state |= 0;
    state = (state + 0x9e3779b9) | 0;
    let t = Math.imul(state ^ (state >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

export function getPlantPlacementParams(subscriptionId: string) {
  const prng = createPRNG(subscriptionId);
  const variantIndex = Math.floor(prng() * 3); // 3 silhouette variants per species
  const offsetX = (prng() - 0.5) * 8; // subtle sub-pixel jitter
  const offsetY = (prng() - 0.5) * 8;
  const windPhase = prng() * Math.PI * 2; // phase offset for sway
  return { variantIndex, offsetX, offsetY, windPhase };
}
