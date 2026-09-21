import type { OtaExecution } from './ota';

// One current version per target. A retry supersedes its earlier attempt.
export function otaVersionDistribution(task: { targetSelector: { deviceIds: readonly string[] }; executions: readonly Pick<OtaExecution, 'deviceId' | 'fromVersion' | 'toVersion' | 'status'>[] }): { version: string; count: number }[] {
  const latest = new Map(task.executions.map(item => [item.deviceId, item]));
  const counts = new Map<string, number>();
  for (const id of task.targetSelector.deviceIds) {
    const execution = latest.get(id);
    const version = execution ? (execution.status === 'succeeded' ? execution.toVersion : execution.fromVersion) : '未采集';
    counts.set(version, (counts.get(version) ?? 0) + 1);
  }
  return [...counts].map(([version, count]) => ({ version, count })).sort((a, b) => a.version.localeCompare(b.version));
}
