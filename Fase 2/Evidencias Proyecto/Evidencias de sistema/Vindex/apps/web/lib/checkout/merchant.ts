export const MAX_CART_MERCHANTS = 2;

export const MAX_CART_MERCHANTS_MESSAGE =
  "Por limitaciones del ambiente de pruebas de Transbank, actualmente solo puedes comprar productos de hasta dos vendedores diferentes en una misma compra.";

export type MerchantIdentity = {
  store_id?: number | null;
  seller_id?: string | null;
};

export const getMerchantKey = (merchant: MerchantIdentity): string | null => {
  if (merchant.store_id === undefined) return null;
  if (typeof merchant.store_id === "number" && Number.isSafeInteger(merchant.store_id) && merchant.store_id > 0) {
    return `store:${merchant.store_id}`;
  }

  if (merchant.store_id !== null) return null;
  if (typeof merchant.seller_id === "string" && merchant.seller_id.trim().length > 0) {
    return `seller:${merchant.seller_id}`;
  }

  return null;
};

export const canAddMerchantToCart = <T extends MerchantIdentity>(
  items: readonly T[],
  candidate: MerchantIdentity,
) => {
  const candidateKey = getMerchantKey(candidate);
  const itemKeys = items.map(getMerchantKey);

  if (!candidateKey || itemKeys.some((key) => key === null)) return false;
  return new Set([...itemKeys, candidateKey]).size <= MAX_CART_MERCHANTS;
};
