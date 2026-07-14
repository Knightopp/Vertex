import { create } from "zustand";

interface UIState {
  isSidebarExpanded: boolean;
  activeModal: string | null;
  searchQuery: string;
  isSearchActive: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isSidebarExpanded: false,
  activeModal: null,
  searchQuery: "",
  isSearchActive: false,

  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  setSidebarExpanded: (expanded: boolean) => set({ isSidebarExpanded: expanded }),
  
  openModal: (modalId: string) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSearchActive: (active: boolean) => set({ isSearchActive: active }),
}));
