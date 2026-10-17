import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
  seller_id: string;
};

type CartStore = {
  items: CartItem[];
  isOpen: boolean;
  hasHydrated: boolean;
  cartOwnerId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  setIsOpen: (open: boolean) => void;
  setItems: (items: CartItem[]) => void;
  setCartOwnerId: (userId: string | null) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  getTotal: () => number;
  getItemCount: () => number;
};

const clampQuantity = (quantity: number, stock: number) =>
  Math.min(Math.max(Math.floor(quantity), 0), Math.max(Math.floor(stock), 0));

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      hasHydrated: false,
      cartOwnerId: null,
      addItem: (item) => {
        const stock = Math.max(Math.floor(item.stock), 0);
        if (stock === 0) return;

        set((state) => {
          const existingItem = state.items.find(({ id }) => id === item.id);
          if (existingItem) {
            return {
              items: state.items.map((currentItem) =>
                currentItem.id === item.id
                  ? {
                      ...item,
                      quantity: clampQuantity(existingItem.quantity + item.quantity, stock),
                    }
                  : currentItem,
              ),
              isOpen: true,
            };
          }

          const quantity = clampQuantity(item.quantity, stock);
          return {
            items: quantity > 0 ? [...state.items, { ...item, stock, quantity }] : state.items,
            isOpen: true,
          };
        });
      },
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter(({ id }) => id !== productId) })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.flatMap((item) => {
            if (item.id !== productId) return [item];
            const nextQuantity = clampQuantity(quantity, item.stock);
            return nextQuantity === 0 ? [] : [{ ...item, quantity: nextQuantity }];
          }),
        })),
      clearCart: () => set({ items: [] }),
      setIsOpen: (isOpen) => set({ isOpen }),
      setItems: (items) => set({ items }),
      setCartOwnerId: (cartOwnerId) => set({ cartOwnerId }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      getTotal: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
      getItemCount: () => get().items.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: "vindex-cart",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items, cartOwnerId: state.cartOwnerId }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);