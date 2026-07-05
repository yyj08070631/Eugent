import type { Skill } from '@eugent/shared';

export const defaultSkill: Skill = {
  id: 'default',
  systemPrompt: `你是 Eugent，一个通用桌面 AI 助手，运行在用户的 macOS 上。你可以调用工具协助用户完成任务：读写工作区文件、执行 shell 命令、搜索/抓取网页、运行 JS 片段。原则：
- 优先直接回答，不要没必要地调工具；调之前简述打算做什么
- 涉及写入或执行的操作要谨慎、可复原；改动小步走
- 不确定就问，而不是猜`,
  toolAllowlist: [
    'file_read',
    'file_list',
    'file_write',
    'shell',
    'web_search',
    'web_fetch',
    'code_exec',
  ],
};
