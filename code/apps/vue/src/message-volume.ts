import type { DeviceMessage } from './device-events';

export function recordedMessagesInRange(messages: DeviceMessage[], from: number, to: number): DeviceMessage[] {
  return messages.filter(message => {
    if (message.id.startsWith('msg_seed_')) return false;
    const at = Date.parse(message.occurredAt);
    return Number.isFinite(at) && at >= from && at < to;
  });
}

export function recordedCount(messages: DeviceMessage[], deviceId: string, from: number, to: number): number {
  return recordedMessagesInRange(messages, from, to).filter(message => message.deviceId === deviceId).length;
}
