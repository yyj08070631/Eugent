import { useEffect, useState, type ReactElement } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.js';
import { Button } from '../components/ui/button.js';
import { useSettings } from '../stores/settings.js';
import type { ModelId } from '@eugent/shared';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceUntilKey?: boolean;
}

export function SettingsDrawer({ open, onOpenChange, forceUntilKey }: Props): ReactElement {
  const { data, refresh, update, test } = useSettings();
  const [key, setKey] = useState('');
  const [model, setModel] = useState<ModelId>('deepseek-v4-pro');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (data) setModel(data.selectedModel);
  }, [data]);

  async function save(): Promise<void> {
    await update({ selectedModel: model, ...(key ? { apiKey: key } : {}) });
    setStatus('已保存');
    setKey('');
  }

  async function runTest(): Promise<void> {
    setStatus('测试中…');
    // 若输入框里有新 key 但没保存，先保存再测（避免 no_api_key 假失败）
    if (key) {
      await update({ apiKey: key });
      setKey('');
    }
    const r = await test();
    setStatus(r.ok ? '连通性 OK' : `失败：${r.error ?? 'unknown'}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (forceUntilKey && !data?.hasApiKey && !v) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">模型</label>
            <select
              className="w-full h-9 border rounded-md px-2 bg-transparent"
              value={model}
              onChange={(e) => setModel(e.target.value as ModelId)}
            >
              <option value="deepseek-v4-pro">DeepSeek V4 Pro（默认）</option>
              <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">
              DeepSeek API Key {data?.hasApiKey ? '（已保存，留空不更新）' : ''}
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full h-9 border rounded-md px-2 bg-transparent"
              placeholder="sk-..."
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void save()}>保存</Button>
            <Button
              variant="outline"
              onClick={() => void runTest()}
              disabled={!data?.hasApiKey && !key}
            >
              测试连通性
            </Button>
            <span className="text-sm text-neutral-500 self-center">{status}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
