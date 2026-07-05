import type { Skill } from '@eugent/shared';

export const researchSkill: Skill = {
  id: 'research',
  systemPrompt: `你在做研究调研任务。工作方式：
- 用 web_search 拿一批候选来源；从不同角度多搜几次
- 对关键来源用 web_fetch 拉正文交叉验证
- 结论要有引用（列出来源 URL）
- 需要落地成文档时用 file_write 保存
- 不要凭记忆输出未验证事实`,
  toolAllowlist: ['web_search', 'web_fetch', 'file_write'],
};
