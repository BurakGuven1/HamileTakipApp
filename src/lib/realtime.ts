let channelSequence = 0;

export function createRealtimeChannelName(scope: string, resourceId: string) {
  channelSequence = (channelSequence + 1) % Number.MAX_SAFE_INTEGER;

  return `${scope}:${resourceId}:${Date.now().toString(36)}:${channelSequence.toString(36)}`;
}
