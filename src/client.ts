import { type BetterAuthClientPlugin } from 'better-auth/client';
import { socialNetwork } from './index.js';

export const socialNetworkClient = () => {
  return {
    id: "social-network",
    $InferServerPlugin: {} as ReturnType<typeof socialNetwork>,
  } satisfies BetterAuthClientPlugin;
};