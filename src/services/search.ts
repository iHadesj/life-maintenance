import type { EvaluatedItem } from './health';

/** Lowercase, accents stripped — "Manutenção" matches "manutencao". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

interface MappedText {
  text: string;
  /** map[i] = index in the original string of normalized char i */
  map: number[];
}

function normalizeWithMap(value: string): MappedText {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const normalized = normalizeText(value[i]);
    for (const ch of normalized) {
      text += ch;
      map.push(i);
    }
  }
  return { text, map };
}

export interface FuzzyMatch {
  score: number;
  /** Indices in the original target string, for highlighting. */
  indices: number[];
}

const BOUNDARY = /[\s\-_/.()]/;

/**
 * Substring matches win (boundary and prefix bonuses); otherwise a
 * subsequence match with adjacency bonuses, so "pwrev" finds "Password review".
 */
export function fuzzyMatch(query: string, target: string, allowSubsequence = true): FuzzyMatch | null {
  const q = normalizeText(query).replace(/\s+/g, ' ').trim();
  if (!q) return { score: 0, indices: [] };
  const { text, map } = normalizeWithMap(target);

  const at = text.indexOf(q);
  if (at >= 0) {
    const boundary = at === 0 || BOUNDARY.test(text[at - 1]);
    const score = 1000 - at * 2 + (boundary ? 300 : 0) + (at === 0 ? 200 : 0) + q.length * 10 - text.length;
    const indices = new Set<number>();
    for (let i = at; i < at + q.length; i++) indices.add(map[i]);
    return { score, indices: [...indices] };
  }

  if (!allowSubsequence) return null;

  const chars = q.replace(/\s/g, '');
  let from = 0;
  let prev = -2;
  let score = 0;
  const indices: number[] = [];
  for (const ch of chars) {
    const pos = text.indexOf(ch, from);
    if (pos < 0) return null;
    score += pos === prev + 1 ? 12 : 2;
    if (pos === 0 || BOUNDARY.test(text[pos - 1])) score += 8;
    score -= Math.min(6, pos - from);
    indices.push(map[pos]);
    prev = pos;
    from = pos + 1;
  }
  return { score: score - text.length * 0.1, indices: [...new Set(indices)] };
}

export interface ItemSearchResult {
  entry: EvaluatedItem;
  score: number;
  titleIndices: number[];
}

export function searchItems(
  query: string,
  items: readonly EvaluatedItem[],
  categoryName: (id: string) => string,
  limit = 24,
): ItemSearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const results: ItemSearchResult[] = [];

  for (const entry of items) {
    const { item } = entry;
    const title = fuzzyMatch(q, item.title);
    const category = fuzzyMatch(q, categoryName(item.categoryId), false);
    const description = item.description ? fuzzyMatch(q, item.description, false) : null;
    const notes = item.notes ? fuzzyMatch(q, item.notes, false) : null;

    const score = Math.max(
      title ? title.score : -Infinity,
      category ? category.score * 0.6 : -Infinity,
      description ? description.score * 0.5 : -Infinity,
      notes ? notes.score * 0.4 : -Infinity,
    );
    if (score === -Infinity) continue;
    results.push({ entry, score, titleIndices: title?.indices ?? [] });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
