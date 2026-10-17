export const ANTI_SNIPING_WINDOW_MS = 210_000;

export type ProductListing = {
	id: number;
	name: string | null;
	slug: string | null;
	description: string | null;
	price: number | null;
	sale_type: string | null;
	discount_price: number | null;
	stock: number | null;
	images: string[] | null;
	seller_id: string;
	seller?: { id: string; full_name: string | null } | null;
	store_id: number | null;
	store_category_id?: number | null;
	condition: string | null;
	status: boolean | null;
	shipping_available: boolean | null;
	is_featured: boolean | null;
	featured_until: string | null;
	offer_ends_at: string | null;
	created_at: string;
	starting_price?: number | null;
	current_bid?: number | null;
	bid_increment?: number | null;
	auction_ends_at?: string | null;
	winner_id?: string | null;
};

export type AuctionProduct = ProductListing & {
	starting_price: number | null;
	current_bid: number | null;
	bid_increment: number | null;
	auction_ends_at: string | null;
	winner_id: string | null;
};

export type AuctionBidLimits = {
	minimum: number;
	maximum: number;
};

export const getAuctionBidLimits = (
	product: Pick<AuctionProduct, "starting_price" | "current_bid" | "bid_increment">,
): AuctionBidLimits | null => {
	const startingPrice = product.starting_price;
	const referenceAmount = product.current_bid ?? product.starting_price;
	const increment = product.bid_increment;
	if (
		typeof startingPrice !== "number" ||
		!Number.isSafeInteger(startingPrice) ||
		startingPrice <= 0 ||
		typeof referenceAmount !== "number" ||
		!Number.isSafeInteger(referenceAmount) ||
		referenceAmount <= 0 ||
		typeof increment !== "number" ||
		!Number.isSafeInteger(increment) ||
		increment <= 0 ||
		increment > Math.floor(startingPrice * 0.5)
	) {
		return null;
	}

	const minimum = product.current_bid === null
		? referenceAmount
		: referenceAmount + increment;
	const maximum = Math.floor(referenceAmount * 1.5);
	if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) {
		return null;
	}

	return { minimum, maximum };
};

export type AuctionBid = {
	id: string;
	product_id: number;
	bidder_id: string;
	amount: number;
	created_at: string;
	bidder_name: string;
};

export const parseFiniteNumber = (value: unknown): number | null => {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const parseSafeInteger = (value: unknown): number | null => {
	const parsed = parseFiniteNumber(value);
	return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
};

export const formatAuctionBid = (value: unknown): AuctionBid | null => {
	if (typeof value !== "object" || value === null) return null;

	const row = value as Record<string, unknown>;
	const id = typeof row.id === "string" || typeof row.id === "number"
		? String(row.id)
		: "";
	const productId = parseSafeInteger(row.product_id);
	const amount = parseFiniteNumber(row.amount);
	const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
	const bidderName =
		typeof profile === "object" &&
		profile !== null &&
		"full_name" in profile &&
		typeof profile.full_name === "string" &&
		profile.full_name.trim()
			? profile.full_name.trim()
			: "Postor Anónimo";
	if (
		!id ||
		productId === null ||
		amount === null ||
		typeof row.bidder_id !== "string" ||
		typeof row.created_at !== "string" ||
		!Number.isFinite(new Date(row.created_at).getTime())
	) {
		return null;
	}

	return {
		id,
		product_id: productId,
		bidder_id: row.bidder_id,
		amount,
		created_at: row.created_at,
		bidder_name: bidderName,
	};
};

export const formatAuctionAmount = (amount: number | null) =>
	amount === null || !Number.isFinite(amount)
		? "Precio no disponible"
		: new Intl.NumberFormat("es-CL", {
				style: "currency",
				currency: "CLP",
				maximumFractionDigits: 0,
			}).format(amount);

export const getActiveDiscountPrice = (product: ProductListing) =>
	product.discount_price !== null &&
	product.offer_ends_at !== null &&
	new Date(product.offer_ends_at).getTime() > Date.now()
		? product.discount_price
		: null;

export const getDiscountLabel = (product: ProductListing) => {
	const activeDiscountPrice = getActiveDiscountPrice(product);
	if (!product.price || activeDiscountPrice === null) return undefined;
	const percentage = Math.round(((product.price - activeDiscountPrice) / product.price) * 100);
	return `-${percentage}%`;
};

export const getProductImage = (product: Pick<ProductListing, "images">) =>
	product.images?.[0] ?? "https://picsum.photos/seed/vindex-product/600/600";