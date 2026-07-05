import type { Skill } from '@eugent/shared';

export const codeSkill: Skill = {
  id: 'code',
  systemPrompt: `你在做代码任务。工作方式：
- 动手改代码前先 file_list / file_read 摸清相关上下文
- 给出最小复现或最小改动，不做无关重构
- 需要跑测试或安装依赖时用 shell，但小步跑、看输出再决定下一步
- 用 code_exec 快速验证纯计算逻辑`,
  toolAllowlist: ['file_read', 'file_list', 'file_write', 'shell', 'code_exec'],
};
