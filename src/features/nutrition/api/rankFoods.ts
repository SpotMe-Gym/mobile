/**
 * Puts search results in the order a person expects. Open Food Facts matches loosely (any
 * word, in names, categories and labels) and its database is crowd-sourced, so raw results
 * mix the right product with near-misses, duplicates and entries with broken numbers.
 *
 * Each result gets a score: how much of the query its name covers comes first, then how
 * little else the name says ("Petto di pollo" before "Insalata con petto di pollo e…"), then
 * whether it's sold in the user's country, how often it's scanned, and how complete it is.
 */
import type { FoodRef } from '@/features/nutrition/nutritionStore';

export interface Candidate {
  ref: FoodRef;
  /** How many people scanned it (popularity), when known. */
  scans?: number;
  /** "en:italy", "en:france", … */
  countries?: readonly string[];
}

/** Words that say nothing about the food. */
const STOP = new Set([
  'di', 'de', 'del', 'della', 'dei', 'al', 'alla', 'allo', 'ai', 'con', 'e', 'ed', 'il', 'la', 'lo', 'le', 'i',
  'gli', 'in', 'da', 'per', 'the', 'of', 'and', 'with', 'a', 'an', 'in', 'au', 'aux', 'du', 'des', 'et', 'le', 'les',
  'mit', 'und', 'von', 'el', 'los', 'las', 'y',
]); // prettier-ignore

/** Lower case, no accents, no punctuation. */
export const normalise = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();

export const tokens = (text: string) =>
  normalise(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w));

/** A query word matches a name word when one starts with the other ("yogurt" ~ "yogurts"). */
const wordMatches = (query: string, word: string) =>
  word === query ||
  (query.length >= 3 && word.startsWith(query)) ||
  (word.length >= 4 && query.startsWith(word));

/** ISO country code → Open Food Facts country tag, for the countries we can name. */
const COUNTRY_TAGS: Record<string, string> = {
  it: 'en:italy', fr: 'en:france', de: 'en:germany', es: 'en:spain', gb: 'en:united-kingdom',
  us: 'en:united-states', ch: 'en:switzerland', at: 'en:austria', be: 'en:belgium', nl: 'en:netherlands',
  pt: 'en:portugal', ie: 'en:ireland', ca: 'en:canada', au: 'en:australia', al: 'en:albania',
  gr: 'en:greece', pl: 'en:poland', se: 'en:sweden', dk: 'en:denmark', no: 'en:norway', fi: 'en:finland',
  ro: 'en:romania', hr: 'en:croatia', si: 'en:slovenia', cz: 'en:czech-republic', hu: 'en:hungary',
}; // prettier-ignore
export const countryTag = (code: string | undefined) => (code ? COUNTRY_TAGS[code.toLowerCase()] : undefined);

/** Numbers that can't be right for 100 g of anything: a typo in the database. */
export function plausible(ref: FoodRef): boolean {
  const m = ref.per100;
  if (!m) return false;
  if (m.kcal < 0 || m.kcal > 950) return false;
  if (m.protein < 0 || m.carbs < 0 || m.fat < 0) return false;
  if (m.protein + m.carbs + m.fat > 105) return false;
  // Energy far from what the macros add up to (4/4/9 kcal per gram) is a wrong entry too.
  const fromMacros = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  if (fromMacros > 40 && (m.kcal < fromMacros * 0.5 || m.kcal > fromMacros * 1.6 + 30)) return false;
  return true;
}

export function scoreFood(
  query: string,
  c: Candidate,
  country?: string,
): { score: number; coverage: number } {
  const q = tokens(query);
  const nameWords = tokens(c.ref.name);
  const brandWords = tokens(c.ref.brand ?? '');
  if (q.length === 0) return { score: 0, coverage: 0 };

  let inName = 0;
  let inBrand = 0;
  for (const word of q) {
    if (nameWords.some((w) => wordMatches(word, w))) inName++;
    else if (brandWords.some((w) => wordMatches(word, w))) inBrand++;
  }
  const coverage = (inName + inBrand) / q.length;
  const extra = Math.max(0, nameWords.length - inName);
  const qn = normalise(query);
  const nn = normalise(c.ref.name);

  let score = 60 * coverage;
  score += inBrand > 0 ? 6 : 0; // "nutella ferrero": the brand was asked for
  if (nn === qn) score += 25;
  else if (nn.startsWith(qn)) score += 14;
  else if (nn.includes(qn)) score += 8;
  score -= Math.min(18, extra * 3.5);
  const tag = countryTag(country);
  if (tag && c.countries?.includes(tag)) score += 8;
  score += Math.min(10, 3.5 * Math.log10(1 + (c.scans ?? 0)));
  if (c.ref.imageUrl) score += 2;
  const m = c.ref.per100;
  if (m && m.protein + m.carbs + m.fat > 0) score += 3;
  if (c.ref.servingSize) score += 1;
  return { score, coverage };
}

/**
 * The results worth showing, best first: implausible entries and results that match none of
 * the words are dropped (when anything better exists), duplicates are merged.
 */
export function rankFoods(query: string, candidates: readonly Candidate[], country?: string): FoodRef[] {
  const scored = candidates
    .filter((c) => plausible(c.ref))
    .map((c, index) => ({ c, index, ...scoreFood(query, c, country) }));
  const anyMatch = scored.some((s) => s.coverage > 0);
  const allWords = scored.filter((s) => s.coverage >= 1).length;
  const kept = scored.filter((s) =>
    // With enough full matches, partial ones are noise; otherwise keep anything that matches.
    allWords >= 5 ? s.coverage >= 1 : anyMatch ? s.coverage > 0 : true,
  );
  // The service's own order breaks ties.
  kept.sort((a, b) => b.score - a.score || a.index - b.index);

  const seen = new Set<string>();
  const out: FoodRef[] = [];
  for (const { c } of kept) {
    const key = `${normalise(c.ref.name)}|${normalise(c.ref.brand ?? '')}|${c.ref.per100?.kcal ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c.ref);
  }
  return out;
}
