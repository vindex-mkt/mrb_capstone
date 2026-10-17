import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export { formatProductPrice } from "../formatters";
import { formatAuctionBid, type AuctionBid, type AuctionProduct, type ProductListing } from "../product-utils";
export type { ProductListing } from "../product-utils";
export { getActiveDiscountPrice, getDiscountLabel, getProductImage } from "../product-utils";

export type StoreListing = {
	id: number;
	name: string;
	slug: string;
	logo_url: string | null;
	average_rating: number | null;
	total_reviews: number;
};

async function createSupabaseServerClient() {
	const cookieStore = await cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll: () => cookieStore.getAll(),
				setAll: (cookiesToSet) => {
					try {
						cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
					} catch {
						// Server components cannot write cookies during rendering.
					}
				},
			},
		},
	);
}

const logQueryError = (section: string, message: string) => {
	console.error(`No se pudieron cargar ${section}: ${message}`);
};

export async function getFeaturedProducts(): Promise<ProductListing[]> {
	const supabase = await createSupabaseServerClient();
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.eq("is_featured", true)
		.gt("featured_until", now)
		.eq("status", true)
		.gt("stock", 0)
		.limit(6);

	if (error) {
		logQueryError("los productos destacados", error.message);
		return [];
	}

	return (data ?? []) as ProductListing[];
}

export async function getDailyDeals(): Promise<ProductListing[]> {
	const supabase = await createSupabaseServerClient();
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.not("discount_price", "is", null)
		.gt("offer_ends_at", now)
		.eq("status", true)
		.gt("stock", 0)
		.order("offer_ends_at", { ascending: true });

	if (error) {
		logQueryError("las ofertas", error.message);
		return [];
	}

	return (data ?? []) as ProductListing[];
}

export async function getLatestProducts(): Promise<ProductListing[]> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.eq("status", true)
		.gt("stock", 0)
		.order("created_at", { ascending: false })
		.limit(8);

	if (error) {
		logQueryError("las últimas publicaciones", error.message);
		return [];
	}

	return (data ?? []) as ProductListing[];
}

export async function getAllPublishedProducts(): Promise<ProductListing[]> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("products")
		.select("*")
		.eq("status", true)
		.gt("stock", 0)
		.order("created_at", { ascending: false });

	if (error) {
		logQueryError("las publicaciones", error.message);
		return [];
	}

	return (data ?? []) as ProductListing[];
}

export async function getProductById(productId: number): Promise<ProductListing | null> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("products")
		.select(`
			*,
			seller:profiles!fk_products_profiles (
				id,
				full_name
			)
		`)
		.eq("id", productId)
		.single();

	if (error) {
		logQueryError("el producto", error.message);
		return null;
	}

	return data as ProductListing | null;
}

export async function getProductStoreName(product: ProductListing): Promise<string | null> {
	if (!product.store_id) return null;

	const supabase = await createSupabaseServerClient();
	const { data } = await supabase
		.from("stores")
		.select("name")
		.eq("id", product.store_id)
		.maybeSingle();

	return typeof data?.name === "string" ? data.name : null;
}

export async function getPopularStores(): Promise<StoreListing[]> {
	const supabase = await createSupabaseServerClient();
	const { data: stores, error: storesError } = await supabase
		.from("stores")
		.select("id, name, slug, logo_url")
		.order("created_at", { ascending: false })
		.limit(4);

	if (storesError) {
		logQueryError("las tiendas", storesError.message);
		return [];
	}
	if (!stores?.length) return [];

	const { data: ratings, error: ratingsError } = await supabase
		.from("store_ratings")
		.select("store_id, average_rating, total_reviews")
		.in("store_id", stores.map((store) => store.id));

	if (ratingsError) {
		logQueryError("las calificaciones de tiendas", ratingsError.message);
		return stores.map((store) => ({ ...store, average_rating: null, total_reviews: 0 })) as StoreListing[];
	}

	return stores.map((store) => {
		const rating = ratings?.find((entry) => entry.store_id === store.id);
		return {
			...store,
			average_rating: rating?.average_rating ?? null,
			total_reviews: Number(rating?.total_reviews ?? 0),
		};
	}) as StoreListing[];
}

export async function getProductBySlug(slug: string): Promise<ProductListing | null> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("products")
		.select(`
			*,
			seller:profiles!fk_products_profiles (
				id,
				full_name
			)
		`)
		.eq("slug", slug)
		.single();

	if (error) {
		logQueryError("el producto", error.message);
		return null;
	}

	return data as ProductListing | null;
}

export async function getActiveAuctions(): Promise<AuctionProduct[]> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("products")
		.select(`
			*,
			seller:profiles!fk_products_profiles (
				id,
				full_name
			)
		`)
		.eq("sale_type", "auction")
		.eq("status", true)
		.gt("stock", 0)
		.gt("auction_ends_at", new Date().toISOString())
		.order("auction_ends_at", { ascending: true });

	if (error) {
		logQueryError("las subastas activas", error.message);
		throw new Error(`No se pudieron cargar las subastas activas: ${error.message}`);
	}

	return (data ?? []) as AuctionProduct[];
}

export async function getAuctionById(productId: number): Promise<AuctionProduct | null> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("products")
		.select(`
			*,
			seller:profiles!fk_products_profiles (
				id,
				full_name
			)
		`)
		.eq("id", productId)
		.eq("sale_type", "auction")
		.maybeSingle();

	if (error) {
		logQueryError("la subasta", error.message);
		throw new Error(`No se pudo cargar la subasta: ${error.message}`);
	}

	return data as AuctionProduct | null;
}

export async function getAuctionBids(productId: number): Promise<AuctionBid[]> {
	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("bids")
		.select(`
			id,
			product_id,
			bidder_id,
			amount,
			created_at,
			profiles:profiles!fk_bids_profiles (
				full_name
			)
		`)
		.eq("product_id", productId)
		.order("created_at", { ascending: false })
		.limit(20);

	if (error) {
		logQueryError("las pujas de la subasta", error.message);
		throw new Error(`No se pudieron cargar las pujas: ${error.message}`);
	}

	return (data ?? []).flatMap((row) => {
		const bid = formatAuctionBid(row);
		if (!bid) {
			console.error("Se omitió una puja inicial con formato inválido:", row);
			return [];
		}
		return [bid];
	});
}

export async function getAuctionWinnerName(winnerId: string | null): Promise<string | null> {
	if (!winnerId) return null;

	const supabase = await createSupabaseServerClient();
	const { data, error } = await supabase
		.from("profiles")
		.select("full_name")
		.eq("id", winnerId)
		.maybeSingle();

	if (error) {
		logQueryError("el perfil del ganador", error.message);
		throw new Error(`No se pudo cargar el perfil del ganador: ${error.message}`);
	}

	return data?.full_name ?? null;
}
