import { create } from "zustand";
import type {
  TroutData,
  CameraState,
  QualityLevel,
} from "@/types";

interface TroutStore {
  // Trout data
  troutMap: Map<string, TroutData>;
  totalCount: number;
  isLoading: boolean;
  setTrouts: (trouts: TroutData[]) => void;
  addTrouts: (trouts: TroutData[]) => void;
  setTotalCount: (count: number) => void;
  setLoading: (loading: boolean) => void;

  // Camera
  camera: CameraState;
  setCamera: (camera: Partial<CameraState>) => void;

  // UI state
  selectedTrout: string | null;
  hoveredTrout: string | null;
  searchQuery: string;
  setSelectedTrout: (address: string | null) => void;
  setHoveredTrout: (address: string | null) => void;
  setSearchQuery: (query: string) => void;

  // Wallet state
  walletAddress: string | null;
  isVerified: boolean;
  jwtToken: string | null;
  setWallet: (address: string | null) => void;
  setVerified: (verified: boolean, token?: string) => void;

  // Device / quality
  quality: QualityLevel;
  setQuality: (quality: QualityLevel) => void;
}

export const useTroutStore = create<TroutStore>((set) => ({
  // Trout data
  troutMap: new Map(),
  totalCount: 0,
  isLoading: true,
  setTrouts: (trouts) =>
    set({
      troutMap: new Map(trouts.map((t) => [t.address, t])),
    }),
  addTrouts: (trouts) =>
    set((state) => {
      const next = new Map(state.troutMap);
      for (const t of trouts) {
        next.set(t.address, t);
      }
      return { troutMap: next };
    }),
  setTotalCount: (count) => set({ totalCount: count }),
  setLoading: (loading) => set({ isLoading: loading }),

  // Camera
  camera: {
    x: 0,
    y: 0,
    zoom: 0.3,
    targetX: 0,
    targetY: 0,
    targetZoom: 0.3,
  },
  setCamera: (partial) =>
    set((state) => ({ camera: { ...state.camera, ...partial } })),

  // UI state
  selectedTrout: null,
  hoveredTrout: null,
  searchQuery: "",
  setSelectedTrout: (address) => set({ selectedTrout: address }),
  setHoveredTrout: (address) => set({ hoveredTrout: address }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Wallet state
  walletAddress: null,
  isVerified: false,
  jwtToken: null,
  setWallet: (address) =>
    set({ walletAddress: address, isVerified: false, jwtToken: null }),
  setVerified: (verified, token) =>
    set({ isVerified: verified, jwtToken: token ?? null }),

  // Device / quality
  quality: "high",
  setQuality: (quality) => set({ quality }),
}));
