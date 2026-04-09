import { RenderedProperty } from '../../../types/logseqBlock';

// Keys that, if they leak into the `getBlockProperties`/`getPageProperties`
// response from Logseq, are internal book-keeping rather than user-authored
// properties. We drop them so only user-defined properties show up in the
// sidebar. We keep this list narrow -- `getBlockProperties` is already
// supposed to return only user properties, so this is mostly defensive.
const SYSTEM_KEYS = new Set([
  'id',
  'uuid',
  'title',
  'name',
  'original-name',
  'originalName',
  'created-at',
  'createdAt',
  'updated-at',
  'updatedAt',
]);

// Any key carrying one of these prefixes is a Logseq-internal namespace
// (Datascript entity attributes, built-in property types) and is always
// dropped. We intentionally do NOT include a bare `:` here: Logseq DB
// graphs namespace *user* properties under `:user.property/…` and those
// must survive the filter.
const SYSTEM_PREFIXES = [
  'block/',
  ':block/',
  'logseq.',
  ':logseq.',
];

// Logseq 2.x DB graphs store user-authored properties under this
// namespace, with an 8-character per-property disambiguation hash
// appended to the name (e.g. `:user.property/Players-NSC8mdun`).
const USER_PROPERTY_PREFIX = ':user.property/';
const USER_PROPERTY_HASH_RE = /-[A-Za-z0-9]{8}$/;

const isSystemKey = (key: string): boolean => {
  if (SYSTEM_KEYS.has(key)) return true;
  // User properties on DB graphs always look like `:user.property/…`
  // and must not be treated as system keys even though they carry the
  // `:` namespace marker that other entity attributes use.
  if (key.startsWith(USER_PROPERTY_PREFIX)) return false;
  return SYSTEM_PREFIXES.some((prefix) => key.startsWith(prefix));
};

const humanize = (key: string): string => {
  // Strip the `:user.property/` namespace and the trailing disambiguation
  // hash so `:user.property/Videogametags-vMFHhjGd` renders as
  // `Videogametags` — the closest we can get to what the user typed in
  // Logseq without an extra per-property entity lookup.
  const bareKey = key.startsWith(USER_PROPERTY_PREFIX)
    ? key.slice(USER_PROPERTY_PREFIX.length).replace(USER_PROPERTY_HASH_RE, '')
    : key;
  const spaced = bareKey.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return bareKey;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Extract a displayable label from a Logseq entity reference (e.g. a
// property value that points at another page or block). Logseq's
// plugin API shapes these as objects with `title`, `originalName`,
// `original-name`, or `name` depending on version.
const extractRefLabel = (ref: Record<string, unknown>): string | null => {
  const candidates = [
    ref['title'],
    ref['originalName'],
    ref['original-name'],
    ref['name'],
    ref[':block/title'],
    ref[':block/original-name'],
    ref[':block/name'],
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
};

// Stringify a single property value into a displayable form. Arrays
// are flattened one level (each element stringified independently) so
// the caller can decide how to render multi-value properties.
const stringifyValue = (value: unknown): string[] => {
  if (value == null || value === '') {
    return ['Empty'];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'number') {
    return [String(value)];
  }
  if (typeof value === 'boolean') {
    return [value ? '\u2611' : '\u2610'];
  }
  if (Array.isArray(value)) {
    const flattened = value.flatMap((item) => stringifyValue(item));
    const nonEmpty = flattened.filter((s) => s !== 'Empty');
    return nonEmpty.length > 0 ? nonEmpty : ['Empty'];
  }
  if (typeof value === 'object') {
    const label = extractRefLabel(value as Record<string, unknown>);
    if (label) return [label];
    try {
      return [JSON.stringify(value)];
    } catch {
      return ['[unrenderable]'];
    }
  }
  return [String(value)];
};

export const normalizeProperties = (
  raw: Record<string, unknown> | null | undefined,
): RenderedProperty[] => {
  if (!raw || typeof raw !== 'object') return [];
  const result: RenderedProperty[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (isSystemKey(key)) continue;
    result.push({
      name: humanize(key),
      values: stringifyValue(value),
    });
  }
  return result;
};
