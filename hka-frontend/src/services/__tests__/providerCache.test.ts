import { describe, it, expect } from 'vitest';
import { mergeRpcUrls } from '../providerCache';

describe('mergeRpcUrls', () => {
  it('merges in order main -> extras -> defaults', () => {
    const out = mergeRpcUrls(['a'], ['b','c'], ['d']);
    expect(out).toEqual(['a','b','c','d']);
  });
  it('deduplicates preserving first occurrence', () => {
    const out = mergeRpcUrls(['a','b'], ['b','c','a'], ['c','d']);
    expect(out).toEqual(['a','b','c','d']);
  });
  it('trims and filters blanks in extras handled upstream (simulate)', () => {
    const out = mergeRpcUrls(['a'], ['','b','  '], ['c']);
    expect(out).toEqual(['a','b','c']);
  });
  it('throws when all empty', () => {
    expect(() => mergeRpcUrls([], [], [])).toThrow();
  });
  it('allows only defaults', () => {
    const out = mergeRpcUrls([], [], ['x']);
    expect(out).toEqual(['x']);
  });
});
