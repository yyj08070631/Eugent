import { describe, it, expect } from 'vitest';
import { resolveWithinWorkspace } from './workspace.js';

describe('resolveWithinWorkspace', () => {
  it('resolves relative path inside workspace', () => {
    expect(resolveWithinWorkspace('/w', 'a/b.txt')).toBe('/w/a/b.txt');
  });
  it('rejects .. escape', () => {
    expect(() => resolveWithinWorkspace('/w', '../etc/passwd')).toThrow('path_outside_workspace');
  });
  it('rejects absolute path that jumps out', () => {
    expect(() => resolveWithinWorkspace('/w', '/etc/passwd')).toThrow('path_outside_workspace');
  });
  it('allows absolute path that stays inside', () => {
    expect(resolveWithinWorkspace('/w', '/w/sub/x')).toBe('/w/sub/x');
  });
});
