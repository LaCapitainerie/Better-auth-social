import { BetterFetch, type BetterAuthClientPlugin } from 'better-auth/client';
import { User } from 'better-auth/types';
import { atom } from 'nanostores';
import { socialNetwork } from './index.js';
import { FriendRequest } from './types.js';

// Types pour les options de fetch (compatibles avec better-fetch)
type FetchOptions = {
  method?: 'GET' | 'POST';
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  [key: string]: any;
};

type ServerResponse<T> = Promise<{
  data: T;
  loading: boolean;
  error: Error | null;
}>

export const socialNetworkClient = () => {
  // Création des atoms pour stocker les données
  const friendsAtom = atom<Awaited<ServerResponse<User[]>>>({
    data: [],
    loading: false,
    error: null,
  });

  return {
    id: "social-network",
    $InferServerPlugin: {} as ReturnType<typeof socialNetwork>,
    
    getAtoms: ($fetch: any) => {
      return {
        friends: friendsAtom,
      };
    },

    getActions: ($fetch: BetterFetch) => {
      return {

        // Friend actions
        listFriends: async (
          data?: Partial<{ limit: number; page: number }>,
          fetchOptions?: FetchOptions
        ): ServerResponse<User[]> => {
          friendsAtom.set({ ...friendsAtom.get(), loading: true, error: null });
          try {

            const res = await $fetch('/social/friends/list', {
              method: 'GET',
              query: data,
              ...fetchOptions,
            });

            if (res.error) {
              friendsAtom.set({
                data: friendsAtom.get().data,
                loading: false,
                error: new Error(res.error.message),
              });
              throw res.error;
            }

            const friends = res.data as { friends: User[] };

            friendsAtom.set({
              data: friends.friends,
              loading: false,
              error: null,
            });
            return {
              data: friends.friends,
              loading: false,
              error: null,
            };
          } catch (error) {
            const err = error instanceof Error ? error : new Error('Failed to fetch friends');
            friendsAtom.set({
              ...friendsAtom.get(),
              loading: false,
              error: err,
            });
            throw error;
          }
        },
      };
    },

    // atomListeners est optionnel et peut être omis si non nécessaire
  } satisfies BetterAuthClientPlugin;
};