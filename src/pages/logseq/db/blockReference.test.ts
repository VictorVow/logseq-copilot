import {
  isPureBlockReference,
  collectBlockReferenceUuids,
  resolveBlockReferences,
  blockReferenceLabel,
} from './blockReference';

describe('isPureBlockReference', () => {
  test('matches a bare block reference', () => {
    expect(
      isPureBlockReference('[[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]'),
    ).toBe(true);
  });

  test('tolerates surrounding whitespace', () => {
    expect(
      isPureBlockReference('  [[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]  '),
    ).toBe(true);
  });

  test('matches case-insensitively', () => {
    expect(
      isPureBlockReference('[[632093E1-E4E6-4C84-AE91-1F468CFB7FBB]]'),
    ).toBe(true);
  });

  test('rejects a reference with extra text before or after', () => {
    expect(
      isPureBlockReference('see [[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]'),
    ).toBe(false);
    expect(
      isPureBlockReference(
        '[[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]] and more',
      ),
    ).toBe(false);
  });

  test('rejects two references on the same line', () => {
    expect(
      isPureBlockReference(
        '[[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]] [[a11b2c3d-e4f5-4789-abcd-ef0123456789]]',
      ),
    ).toBe(false);
  });

  test('rejects a resolved page reference (title text, not uuid)', () => {
    expect(isPureBlockReference('[[Stolen Realm]]')).toBe(false);
  });

  test('rejects plain text', () => {
    expect(isPureBlockReference('Stolen Realm')).toBe(false);
  });

  test('rejects nullish and empty input', () => {
    expect(isPureBlockReference(undefined)).toBe(false);
    expect(isPureBlockReference(null)).toBe(false);
    expect(isPureBlockReference('')).toBe(false);
  });
});

describe('collectBlockReferenceUuids', () => {
  test('returns empty array for nullish / non-string / empty input', () => {
    expect(collectBlockReferenceUuids(null)).toEqual([]);
    expect(collectBlockReferenceUuids(undefined)).toEqual([]);
    expect(collectBlockReferenceUuids('')).toEqual([]);
  });

  test('returns empty array when there are no references', () => {
    expect(collectBlockReferenceUuids('just plain text')).toEqual([]);
    expect(collectBlockReferenceUuids('see [[Stolen Realm]]')).toEqual([]);
  });

  test('extracts a single `((uuid))` block reference', () => {
    expect(
      collectBlockReferenceUuids('see ((632093e1-e4e6-4c84-ae91-1f468cfb7fbb))'),
    ).toEqual(['632093e1-e4e6-4c84-ae91-1f468cfb7fbb']);
  });

  test('extracts a single `[[uuid]]` block reference', () => {
    expect(
      collectBlockReferenceUuids('see [[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]'),
    ).toEqual(['632093e1-e4e6-4c84-ae91-1f468cfb7fbb']);
  });

  test('dedupes repeated references to the same uuid', () => {
    expect(
      collectBlockReferenceUuids(
        '((632093e1-e4e6-4c84-ae91-1f468cfb7fbb)) and ' +
          '((632093e1-e4e6-4c84-ae91-1f468cfb7fbb)) again',
      ),
    ).toEqual(['632093e1-e4e6-4c84-ae91-1f468cfb7fbb']);
  });

  test('collects both `((uuid))` and `[[uuid]]` syntaxes from the same string', () => {
    expect(
      collectBlockReferenceUuids(
        'block ((632093e1-e4e6-4c84-ae91-1f468cfb7fbb)) and ' +
          'page [[647b02b4-979e-4e7e-8a91-5a5237186f39]]',
      ).sort(),
    ).toEqual(
      [
        '632093e1-e4e6-4c84-ae91-1f468cfb7fbb',
        '647b02b4-979e-4e7e-8a91-5a5237186f39',
      ].sort(),
    );
  });

  test('lowercases uuids so refMap lookups are case-insensitive', () => {
    expect(
      collectBlockReferenceUuids('((632093E1-E4E6-4C84-AE91-1F468CFB7FBB))'),
    ).toEqual(['632093e1-e4e6-4c84-ae91-1f468cfb7fbb']);
  });
});

describe('resolveBlockReferences', () => {
  const refMap = new Map<string, string>([
    ['632093e1-e4e6-4c84-ae91-1f468cfb7fbb', 'Stolen Realm review'],
    ['647b02b4-979e-4e7e-8a91-5a5237186f39', 'Pros and cons'],
  ]);

  test('returns the original content when there is nothing to replace', () => {
    expect(resolveBlockReferences('plain text', refMap)).toBe('plain text');
    expect(resolveBlockReferences('', refMap)).toBe('');
  });

  test('substitutes a `((uuid))` reference with its label', () => {
    expect(
      resolveBlockReferences(
        'enjoy ((632093e1-e4e6-4c84-ae91-1f468cfb7fbb)) for combat',
        refMap,
      ),
    ).toBe('enjoy Stolen Realm review for combat');
  });

  test('substitutes a `[[uuid]]` reference with its label', () => {
    expect(
      resolveBlockReferences(
        'see [[647b02b4-979e-4e7e-8a91-5a5237186f39]]',
        refMap,
      ),
    ).toBe('see Pros and cons');
  });

  test('leaves unknown uuids untouched so the user still sees the raw ref', () => {
    const content = 'ghost ((deadbeef-dead-beef-dead-beefdeadbeef))';
    expect(resolveBlockReferences(content, refMap)).toBe(content);
  });

  test('handles multiple refs in a single content string', () => {
    expect(
      resolveBlockReferences(
        '((632093e1-e4e6-4c84-ae91-1f468cfb7fbb)) vs ' +
          '((647b02b4-979e-4e7e-8a91-5a5237186f39))',
        refMap,
      ),
    ).toBe('Stolen Realm review vs Pros and cons');
  });

  test('matches uppercase uuids against the lowercased refMap', () => {
    expect(
      resolveBlockReferences(
        '((632093E1-E4E6-4C84-AE91-1F468CFB7FBB))',
        refMap,
      ),
    ).toBe('Stolen Realm review');
  });
});

describe('blockReferenceLabel', () => {
  test('returns empty string for nullish / non-string input', () => {
    expect(blockReferenceLabel(null)).toBe('');
    expect(blockReferenceLabel(undefined)).toBe('');
    expect(blockReferenceLabel('')).toBe('');
  });

  test('takes the first non-empty trimmed line', () => {
    expect(blockReferenceLabel('Stolen Realm')).toBe('Stolen Realm');
    expect(blockReferenceLabel('  Stolen Realm  ')).toBe('Stolen Realm');
    expect(blockReferenceLabel('Stolen Realm\nmore text')).toBe('Stolen Realm');
  });

  test('skips leading blank lines', () => {
    expect(blockReferenceLabel('\n\n  actual label\nsecond')).toBe(
      'actual label',
    );
  });

  test('truncates overly long first lines with an ellipsis', () => {
    const long = 'x'.repeat(120);
    const result = blockReferenceLabel(long);
    expect(result).toHaveLength(80);
    expect(result.endsWith('\u2026')).toBe(true);
  });

  test('leaves short content untouched', () => {
    const short = 'short label';
    expect(blockReferenceLabel(short)).toBe(short);
  });
});
