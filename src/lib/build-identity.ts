import type { BuildIdentity } from '../generated/typings';

export function formatBuildValue(value: string): string {
  return value === '' || value === 'unknown' ? '未知' : value;
}

export function formatBuildTimestamp(value: string): string {
  const timestamp = Number(value);

  return Number.isFinite(timestamp)
    ? new Date(timestamp * 1_000).toLocaleString('zh-CN', {
        hour12: false,
      })
    : formatBuildValue(value);
}

export function formatBuildChannel(identity: BuildIdentity): string {
  const labels: Record<BuildIdentity['runtimeChannel'], string> = {
    debug: '调试运行',
    'local-dmg': '本地 DMG 构建',
    'ci-artifact': '内部 CI artifact',
    installed: '已安装应用',
    'mounted-dmg': '已挂载 DMG',
  };

  return `${labels[identity.runtimeChannel]} / ${identity.targetTriple}`;
}
