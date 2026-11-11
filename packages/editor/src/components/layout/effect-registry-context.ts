import React from 'react';
import type { EffectRegistry } from '@kubuild/core';

/**
 * The host's effect plugins (STORA-650), from `KubuildEditor`'s `effects` prop. Read by the
 * canvas (to play effects in preview), the inspector's Effects panel and the static-site
 * export. `undefined` means the host registered none: effects stay in the document untouched.
 */
export const EffectRegistryContext = React.createContext<EffectRegistry | undefined>(undefined);

export function useEffectRegistry(): EffectRegistry | undefined {
  return React.useContext(EffectRegistryContext);
}
