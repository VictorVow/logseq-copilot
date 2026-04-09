import { isPureBlockReference } from './blockReference';

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
