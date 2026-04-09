import { normalizeProperties } from './blockProperties';

describe('normalizeProperties', () => {
  test('returns empty array for null/undefined/empty input', () => {
    expect(normalizeProperties(null)).toEqual([]);
    expect(normalizeProperties(undefined)).toEqual([]);
    expect(normalizeProperties({})).toEqual([]);
  });

  test('drops system keys and keeps user-defined ones', () => {
    const result = normalizeProperties({
      id: 1,
      uuid: 'abc',
      'created-at': 123,
      'updated-at': 456,
      title: 'Page Title',
      name: 'page-title',
      'release-status': 'Released',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Release status');
  });

  test('drops keys with logseq namespace prefixes', () => {
    const result = normalizeProperties({
      ':block/title': 'foo',
      ':logseq.property/order': 1,
      'logseq.property.something': 'bar',
      'block/uuid': 'xyz',
      owned: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Owned');
  });

  test('humanizes hyphenated and underscored keys', () => {
    const result = normalizeProperties({
      'release-status': 'Empty',
      videogame_tags: ['RPG'],
    });
    expect(result.map((p) => p.name)).toEqual([
      'Release status',
      'Videogame tags',
    ]);
  });

  test('stringifies string and number values', () => {
    const result = normalizeProperties({
      foo: 'bar',
      rating: 9,
    });
    expect(result[0].values).toEqual(['bar']);
    expect(result[1].values).toEqual(['9']);
  });

  test('renders booleans as checkbox glyphs', () => {
    const result = normalizeProperties({
      owned: true,
      finished: false,
    });
    expect(result[0].values).toEqual(['\u2611']);
    expect(result[1].values).toEqual(['\u2610']);
  });

  test('renders null/empty values as "Empty"', () => {
    const result = normalizeProperties({
      status: null,
      note: '',
    });
    expect(result[0].values).toEqual(['Empty']);
    expect(result[1].values).toEqual(['Empty']);
  });

  test('flattens arrays into values without joining', () => {
    const result = normalizeProperties({
      tags: ['RPG', 'Adventure', 'Turn-based'],
    });
    expect(result[0].values).toEqual(['RPG', 'Adventure', 'Turn-based']);
  });

  test('drops "Empty" placeholders from non-empty arrays', () => {
    const result = normalizeProperties({
      tags: ['RPG', null, 'Adventure'],
    });
    expect(result[0].values).toEqual(['RPG', 'Adventure']);
  });

  test('returns ["Empty"] for arrays where every entry is empty', () => {
    const result = normalizeProperties({
      tags: [null, '', undefined],
    });
    expect(result[0].values).toEqual(['Empty']);
  });

  test('resolves entity refs by title', () => {
    const result = normalizeProperties({
      platform: { id: 42, title: 'Steam' },
    });
    expect(result[0].values).toEqual(['Steam']);
  });

  test('prefers title over originalName over name on entity refs', () => {
    expect(
      normalizeProperties({
        p: { title: 'A', originalName: 'B', name: 'c' },
      })[0].values,
    ).toEqual(['A']);
    expect(
      normalizeProperties({
        p: { originalName: 'B', name: 'c' },
      })[0].values,
    ).toEqual(['B']);
    expect(
      normalizeProperties({
        p: { name: 'c' },
      })[0].values,
    ).toEqual(['c']);
  });

  test('resolves arrays of entity refs in order', () => {
    const result = normalizeProperties({
      tags: [
        { id: 1, title: 'RPG' },
        { id: 2, title: 'Adventure' },
      ],
    });
    expect(result[0].values).toEqual(['RPG', 'Adventure']);
  });

  test('falls back to JSON stringification for unknown object shapes', () => {
    const result = normalizeProperties({
      weird: { shape: 42, other: 'stuff' },
    });
    expect(result[0].values).toHaveLength(1);
    expect(result[0].values[0]).toContain('42');
  });

  test('preserves insertion order of input keys', () => {
    const result = normalizeProperties({
      alpha: 'A',
      beta: 'B',
      gamma: 'C',
    });
    expect(result.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});
