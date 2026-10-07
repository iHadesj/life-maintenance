import type { Category, MotionPreference } from '../../db/types';
import { needsAttention, type MaintenanceStatus } from '../../services/cycle';
import { counterLabel } from '../../services/format';
import type { EvaluatedItem } from '../../services/health';
import { fuzzyMatch, searchItems } from '../../services/search';

/**
 * The terminal's grammar. Pure: given the system and what was typed, return
 * ranked suggestions. Every suggestion is a complete command line, so
 * autocomplete is simply "become the selected line".
 */

export type PaletteAction =
  | { type: 'complete'; itemId: string }
  | { type: 'open-item'; itemId: string }
  | { type: 'edit'; itemId: string }
  | { type: 'navigate'; to: string }
  | { type: 'create'; title?: string }
  | { type: 'show'; filter: 'all' | 'attention' | 'overdue' | 'stable' }
  | { type: 'search'; query: string }
  | { type: 'export' }
  | { type: 'import' }
  | { type: 'check' }
  | { type: 'new-area' }
  | { type: 'motion'; value: MotionPreference }
  | { type: 'help' }
  | { type: 'fill'; text: string };

export interface Suggestion {
  key: string;
  /** The full command line. */
  text: string;
  /** Length of the leading verb inside `text`. */
  verbLength: number;
  hint?: string;
  status?: MaintenanceStatus;
  /** Matched character indices in `text`. */
  indices: number[];
  action: PaletteAction;
}

export interface PaletteContext {
  /** Most urgent first. */
  evaluated: readonly EvaluatedItem[];
  categories: readonly Category[];
  categoryName: (id: string) => string;
}

const VERB_ALIASES: Record<string, string> = {
  done: 'complete',
  service: 'complete',
  serviced: 'complete',
  fix: 'complete',
  new: 'add',
  register: 'add',
  create: 'add',
  go: 'open',
  cd: 'open',
  goto: 'open',
  view: 'open',
  find: 'search',
  grep: 'search',
  ls: 'show',
  filter: 'show',
  list: 'show',
  backup: 'export',
  restore: 'import',
  check: 'system',
  scan: 'system',
  '?': 'help',
  man: 'help',
};

export const COMMAND_HELP: ReadonlyArray<{ usage: string; fill: string; description: string }> = [
  { usage: 'add <name>', fill: 'add ', description: 'register a new system' },
  { usage: 'complete <system>', fill: 'complete ', description: 'log a service now' },
  { usage: 'open <area | system | page>', fill: 'open ', description: 'go somewhere' },
  { usage: 'search <text>', fill: 'search ', description: 'find systems' },
  { usage: 'show <overdue | attention | stable | all>', fill: 'show ', description: 'filter the queue' },
  { usage: 'edit <system>', fill: 'edit ', description: 'change a system' },
  { usage: 'export data', fill: 'export data', description: 'download a JSON backup' },
  { usage: 'import data', fill: 'import data', description: 'load a JSON backup' },
  { usage: 'system check', fill: 'system check', description: 'rescan every cycle' },
  { usage: 'new area', fill: 'new area', description: 'create an area of life' },
  { usage: 'motion <system | full | reduced>', fill: 'motion ', description: 'animation preference' },
];

const PAGES: ReadonlyArray<{ word: string; to: string; hint: string }> = [
  { word: 'system', to: '#/', hint: 'health' },
  { word: 'queue', to: '#/queue', hint: 'maintenance' },
  { word: 'log', to: '#/log', hint: 'history' },
  { word: 'settings', to: '#/settings', hint: 'config' },
];

interface Candidate {
  key: string;
  text: string;
  verbLength: number;
  hint?: string;
  status?: MaintenanceStatus;
  priority: number;
  action: PaletteAction;
}

function line(verb: string, argument: string | null, rest: Omit<Candidate, 'text' | 'verbLength'>): Candidate {
  return { ...rest, text: argument ? `${verb} ${argument}` : verb, verbLength: verb.length };
}

function candidates(ctx: PaletteContext): Candidate[] {
  const out: Candidate[] = [];
  for (const { item, cycle } of ctx.evaluated) {
    const urgent = needsAttention(cycle.status);
    out.push(
      line('open', item.title, {
        key: `open-item:${item.id}`,
        hint: `${ctx.categoryName(item.categoryId).toUpperCase()}/`,
        status: cycle.status,
        priority: 30,
        action: { type: 'open-item', itemId: item.id },
      }),
      line('complete', item.title, {
        key: `complete:${item.id}`,
        hint: counterLabel(cycle),
        status: cycle.status,
        priority: urgent ? 45 : 8,
        action: { type: 'complete', itemId: item.id },
      }),
      line('edit', item.title, {
        key: `edit:${item.id}`,
        hint: 'edit',
        status: cycle.status,
        priority: 0,
        action: { type: 'edit', itemId: item.id },
      }),
    );
  }
  for (const category of ctx.categories) {
    out.push(
      line('open', `${category.name.toLowerCase()}/`, {
        key: `open-area:${category.id}`,
        hint: 'area',
        priority: 36,
        action: { type: 'navigate', to: `#/c/${encodeURIComponent(category.id)}` },
      }),
    );
  }
  for (const page of PAGES) {
    out.push(line('open', page.word, { key: `page:${page.word}`, hint: page.hint, priority: 24, action: { type: 'navigate', to: page.to } }));
  }
  for (const filter of ['overdue', 'attention', 'stable', 'all'] as const) {
    out.push(line('show', filter, { key: `show:${filter}`, hint: 'queue', priority: 14, action: { type: 'show', filter } }));
  }
  for (const value of ['system', 'full', 'reduced'] as const) {
    out.push(line('motion', value, { key: `motion:${value}`, hint: 'preference', priority: 0, action: { type: 'motion', value } }));
  }
  out.push(
    line('add', 'maintenance', { key: 'add', hint: 'register', priority: 20, action: { type: 'create' } }),
    { key: 'export', text: 'export data', verbLength: 6, hint: 'json backup', priority: 18, action: { type: 'export' } },
    { key: 'import', text: 'import data', verbLength: 6, hint: 'json backup', priority: 12, action: { type: 'import' } },
    { key: 'check', text: 'system check', verbLength: 6, hint: 'rescan', priority: 16, action: { type: 'check' } },
    { key: 'new-area', text: 'new area', verbLength: 3, hint: 'area', priority: 8, action: { type: 'new-area' } },
    { key: 'help', text: 'help', verbLength: 4, hint: 'commands', priority: 4, action: { type: 'help' } },
  );
  return out;
}

const finish = (c: Candidate, indices: number[] = []): Suggestion => ({
  key: c.key,
  text: c.text,
  verbLength: c.verbLength,
  hint: c.hint,
  status: c.status,
  indices,
  action: c.action,
});

export function defaultSuggestions(ctx: PaletteContext): Suggestion[] {
  const all = candidates(ctx);
  const pick = (key: string) => all.find((c) => c.key === key);
  const urgent = ctx.evaluated.find((e) => needsAttention(e.cycle.status));
  const keys = [
    urgent ? `complete:${urgent.item.id}` : null,
    'add',
    urgent ? 'show:attention' : 'show:all',
    'page:log',
    'check',
    'export',
    'help',
  ];
  return keys.flatMap((key) => {
    const c = key ? pick(key) : undefined;
    return c ? [finish(c)] : [];
  });
}

export function helpSuggestions(): Suggestion[] {
  return COMMAND_HELP.map((entry) => ({
    key: `help:${entry.usage}`,
    text: entry.usage,
    verbLength: entry.usage.indexOf(' ') > 0 ? entry.usage.indexOf(' ') : entry.usage.length,
    hint: entry.description,
    indices: [],
    action: { type: 'fill', text: entry.fill },
  }));
}

export interface SuggestResult {
  list: Suggestion[];
  /** Inline completion shown after the caret. */
  ghost: string;
}

export function suggest(input: string, ctx: PaletteContext, limit = 8): SuggestResult {
  const raw = input.replace(/^\s+/, '').replace(/\s+/g, ' ');
  if (!raw.trim()) return { list: defaultSuggestions(ctx), ghost: '' };

  const [first, ...restWords] = raw.split(' ');
  const verb = VERB_ALIASES[first.toLowerCase()] ?? first.toLowerCase();
  const rest = restWords.join(' ').trim();
  const query = [verb, ...restWords].join(' ').trim();

  const scored: Array<{ candidate: Candidate; score: number; indices: number[] }> = [];

  for (const candidate of candidates(ctx)) {
    const match = fuzzyMatch(query, candidate.text);
    if (match) scored.push({ candidate, score: match.score + candidate.priority, indices: match.indices });
  }

  if (verb === 'add' && rest) {
    scored.push({
      candidate: line('add', rest, { key: 'add:typed', hint: 'register', priority: 0, action: { type: 'create', title: rest } }),
      score: 1e6,
      indices: [],
    });
  }

  if (verb === 'search' && rest) {
    const results = searchItems(rest, ctx.evaluated, ctx.categoryName, 6);
    results.forEach((result, i) => {
      const { item, cycle } = result.entry;
      scored.push({
        candidate: line('open', item.title, {
          key: `search:${item.id}`,
          hint: counterLabel(cycle),
          status: cycle.status,
          priority: 0,
          action: { type: 'open-item', itemId: item.id },
        }),
        score: 1e6 - i,
        indices: result.titleIndices.map((index) => index + 5),
      });
    });
    scored.push({
      candidate: line('search', `"${rest}"`, { key: 'search:queue', hint: 'in queue', priority: 0, action: { type: 'search', query: rest } }),
      score: 1e6 - 10,
      indices: [],
    });
  }

  if (scored.length === 0) {
    const text = raw.trim();
    scored.push(
      { candidate: line('search', `"${text}"`, { key: 'fallback:search', hint: 'in queue', priority: 0, action: { type: 'search', query: text } }), score: 2, indices: [] },
      { candidate: line('add', text, { key: 'fallback:add', hint: 'register', priority: 0, action: { type: 'create', title: text } }), score: 1, indices: [] },
    );
  }

  const seen = new Set<string>();
  const list = scored
    .sort((a, b) => b.score - a.score)
    .filter(({ candidate }) => (seen.has(candidate.key) ? false : (seen.add(candidate.key), true)))
    .slice(0, limit)
    .map(({ candidate, indices }) => finish(candidate, indices));

  const top = list[0];
  const typed = raw;
  const ghost = top && top.text.toLowerCase().startsWith(typed.toLowerCase()) ? top.text.slice(typed.length) : '';
  return { list, ghost };
}
