import type { Skill, SkillId } from '@eugent/shared';
import { defaultSkill } from './default.js';
import { researchSkill } from './research.js';
import { codeSkill } from './code.js';

export const SKILLS: Record<SkillId, Skill> = {
  default: defaultSkill,
  research: researchSkill,
  code: codeSkill,
};

export function getSkill(id: SkillId): Skill {
  return SKILLS[id];
}
