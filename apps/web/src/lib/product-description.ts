const FEATURES_DELIMITER = "\n\n---\n";

export function parseProductDescription(desc: string | null): {
  description: string;
  features: string[];
} {
  if (!desc?.trim()) return { description: "", features: [] };
  const idx = desc.indexOf(FEATURES_DELIMITER);
  if (idx === -1) {
    return { description: desc.trim(), features: [] };
  }
  const description = desc.slice(0, idx).trim();
  const features = desc
    .slice(idx + FEATURES_DELIMITER.length)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return { description, features };
}
