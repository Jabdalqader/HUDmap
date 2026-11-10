/** Fits the teammates' modules to the shapes the HUD uses. Returns null if a module doesn't fit. */

export function asLive(mod) {
  const live = mod.live ?? mod.default ?? mod;
  return typeof live?.sendTelemetry === 'function' ? live : null;
}

export function asSim(mod) {
  const sim = mod.sim ?? mod.default ?? mod;
  return typeof sim?.getPosition === 'function' && typeof sim?.getBackground === 'function' ? sim : null;
}

/** T1.2 exposes toggleVoice() and a conversation with sendContextualUpdate(). */
export function asVoice(mod) {
  if (typeof mod.toggleVoice !== 'function') return null;
  const conversation = () => mod.convo ?? mod.getConversation?.();
  return {
    toggle: () => mod.toggleVoice(),
    sendContext: (text) => conversation()?.sendContextualUpdate?.(text),
    onText: (callback) => (mod.onAgentText ?? mod.onText)?.(callback),
    get listening() {
      return Boolean(mod.isListening?.());
    },
  };
}
