import { describe, it, expect } from 'vitest';
import { SKILLS, getSkill } from './index.js';

describe('SKILLS registry', () => {
  it('has default / research / code', () => {
    expect(Object.keys(SKILLS).sort()).toEqual(['code', 'default', 'research']);
  });
  it('default allowlist covers all v1 tools', () => {
    expect(SKILLS.default.toolAllowlist).toContain('file_write');
    expect(SKILLS.default.toolAllowlist).toContain('shell');
  });
  it('research restricts to web + file_write', () => {
    expect(SKILLS.research.toolAllowlist.sort()).toEqual(['file_write', 'web_fetch', 'web_search']);
  });
  it('code restricts to code-related tools', () => {
    expect(SKILLS.code.toolAllowlist).not.toContain('web_search');
  });
  it('getSkill returns the right skill', () => {
    expect(getSkill('research').id).toBe('research');
  });
});
