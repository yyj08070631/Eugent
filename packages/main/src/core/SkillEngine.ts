import type { SkillId, Skill } from '@eugent/shared';
import { SKILLS } from '../skills/index.js';
import type { ModelManager } from './ModelManager.js';

export interface SkillSelection {
  skill: Skill;
  cleanedInput: string;
  source: 'slash' | 'classifier' | 'fallback';
}

const KNOWN_SKILLS: SkillId[] = ['default', 'research', 'code'];

export class SkillEngine {
  constructor(private model: ModelManager) {}

  async select(userInput: string): Promise<SkillSelection> {
    const trimmed = userInput.trimStart();
    for (const id of KNOWN_SKILLS) {
      const prefix = `/${id} `;
      if (trimmed.startsWith(prefix)) {
        return {
          skill: SKILLS[id],
          cleanedInput: trimmed.slice(prefix.length),
          source: 'slash',
        };
      }
    }

    try {
      let buf = '';
      for await (const c of this.model.chatStream({
        model: 'deepseek-v4-flash',
        thinking: 'off', // 显式关；ModelManager 默认已 off，此处显式以防重构改默认
        messages: [
          {
            role: 'system',
            content:
              'Classify the user input into one of: default, research, code. Return ONLY a JSON object like {"skill":"..."}.',
          },
          { role: 'user', content: userInput },
        ],
      })) {
        if (c.type === 'token') buf += c.delta;
      }
      const parsed = JSON.parse(buf) as { skill?: string };
      const id = parsed.skill;
      if (id && (KNOWN_SKILLS as string[]).includes(id)) {
        return { skill: SKILLS[id as SkillId], cleanedInput: userInput, source: 'classifier' };
      }
    } catch {
      // fall through
    }
    return { skill: SKILLS.default, cleanedInput: userInput, source: 'fallback' };
  }
}
