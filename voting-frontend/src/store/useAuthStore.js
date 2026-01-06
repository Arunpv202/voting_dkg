import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createJSONStorage } from 'zustand/middleware';

const useAuthStore = create(
    persist(
        (set) => ({
            walletAddress: null,
            authorityId: null,
            role: null,
            electionId: null,

            setWalletAddress: (address) => set({ walletAddress: address }),
            setAuthorityId: (id) => set({ authorityId: id }),
            setRole: (role) => set({ role }),
            setElectionId: (id) => set({ electionId: id }),

            clearAuth: () => set({ walletAddress: null, authorityId: null, role: null, electionId: null }),
        }),
        {
            name: 'auth-storage', // unique name
            storage: createJSONStorage(() => sessionStorage), // Use Session Storage for Tab Isolation
        }
    )
);

export default useAuthStore;
