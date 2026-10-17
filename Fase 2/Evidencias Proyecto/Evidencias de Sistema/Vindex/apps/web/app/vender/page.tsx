"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, CreditCard, ImagePlus, Sparkles, UploadCloud, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

type SelectedImage = {
	file: File;
	previewUrl: string;
};

type ProductCategory = { id: number; name: string };
type OwnedStore = { id: number; name: string };
type StoreCategory = { id: number; name: string };

const numberInputClassName = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const SelectedImageList = memo(function SelectedImageList({
	images,
	onRemove,
}: {
	images: SelectedImage[];
	onRemove: (previewUrl: string) => void;
}) {
	return (
		<ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
			{images.map((image) => (
				<li key={image.previewUrl} className="relative aspect-square overflow-hidden rounded-md border border-border">
					<img src={image.previewUrl} alt={image.file.name} decoding="async" className="h-full w-full object-cover" />
					<button type="button" aria-label={`Quitar ${image.file.name}`} title="Quitar imagen" onClick={() => onRemove(image.previewUrl)} className="absolute right-1 top-1 rounded-full bg-surface p-1 text-foreground shadow hover:text-brand-700">
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</li>
			))}
		</ul>
	);
});

const ProductImagePreview = memo(function ProductImagePreview({ images }: { images: SelectedImage[] }) {
	const [selectedIndex, setSelectedIndex] = useState(0);

	useEffect(() => {
		setSelectedIndex(0);
	}, [images.length]);

	const safeImages = images.length > 0 ? images : [];
	const currentImage = safeImages[selectedIndex] ?? null;

	const goToPrevious = () => {
		if (safeImages.length === 0) return;
		setSelectedIndex((current) => (current === 0 ? safeImages.length - 1 : current - 1));
	};

	const goToNext = () => {
		if (safeImages.length === 0) return;
		setSelectedIndex((current) => (current === safeImages.length - 1 ? 0 : current + 1));
	};

	return (
		<>
			<div className="relative aspect-4/3 overflow-hidden rounded-lg bg-muted">
				{currentImage ? (
					<>
						<img src={currentImage.previewUrl} alt={currentImage.file.name} decoding="async" className="h-full w-full object-cover" />
						{safeImages.length > 1 && (
							<>
								<button
									type="button"
									aria-label="Ver imagen anterior"
									onClick={goToPrevious}
									className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/85 text-foreground shadow-sm backdrop-blur"
								>
									<span aria-hidden="true">←</span>
								</button>
								<button
									type="button"
									aria-label="Ver imagen siguiente"
									onClick={goToNext}
									className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/85 text-foreground shadow-sm backdrop-blur"
								>
									<span aria-hidden="true">→</span>
								</button>
							</>
						)}
					</>
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
						<ImagePlus className="h-8 w-8" aria-hidden="true" />
						<span className="text-sm">Vista previa de imagen</span>
					</div>
				)}
			</div>
			{safeImages.length > 1 && (
				<div className="mt-2 grid grid-cols-4 gap-2">
					{safeImages.map((image, index) => (
						<button
							key={image.previewUrl}
							type="button"
							aria-label={`Seleccionar imagen ${index + 1}`}
							onClick={() => setSelectedIndex(index)}
							className={`aspect-square overflow-hidden rounded-md border ${
								selectedIndex === index ? "border-brand-500 ring-2 ring-brand-200" : "border-border"
							}`}
						>
							<img src={image.previewUrl} alt={image.file.name} decoding="async" className="h-full w-full object-cover" />
						</button>
					))}
				</div>
			)}
		</>
	);
});

const convertImageToWebp = async (file: File): Promise<Blob> => {
	const bitmap = await createImageBitmap(file);
	try {
		const scale = Math.min(1, 1200 / bitmap.width, 1200 / bitmap.height);
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext("2d");
		if (!context) throw new Error("No se pudo iniciar Canvas para procesar la imagen.");
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la imagen a WebP.")),
				"image/webp",
				0.8,
			);
		});
	} finally {
		bitmap.close();
	}
};

const uploadProductImages = async (
	supabase: ReturnType<typeof createClient>,
	files: File[],
	userId: string,
	productId: number,
	onImageError: (message: string) => void,
): Promise<string[]> => {
	const imageUrls: string[] = [];

	for (const file of files) {
		try {
			const webpImage = await convertImageToWebp(file);
			const filePath = `${userId}/${productId || "temp"}/${crypto.randomUUID()}.webp`;
			const { error } = await supabase.storage
				.from("product-images")
				.upload(filePath, webpImage, { contentType: "image/webp" });

			if (error) throw new Error(error.message);
			imageUrls.push(supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl);
		} catch (error) {
			const reason = error instanceof Error ? error.message : "Error desconocido";
			onImageError(`${file.name}: ${reason}`);
		}
	}

	return imageUrls;
};

const toSlug = (value: string) =>
	value
		.trim()
		.toLocaleLowerCase("es")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const createSlugSuffix = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
	}

	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

export default function SellProductPage() {
	const router = useRouter();
	const [supabase] = useState(createClient);
	const [authorized, setAuthorized] = useState(false);
	const [name, setName] = useState("");
	const [slugSuffix, setSlugSuffix] = useState("");
	const [description, setDescription] = useState("");
	const [price, setPrice] = useState("");
	const [startingPrice, setStartingPrice] = useState("");
	const [bidIncrement, setBidIncrement] = useState("5000");
	const [auctionDurationHours, setAuctionDurationHours] = useState("24");
	const [discountPrice, setDiscountPrice] = useState("");
	const [offerDurationHours, setOfferDurationHours] = useState("24");
	const [customOfferDurationHours, setCustomOfferDurationHours] = useState("24");
	const [featuredDurationDays, setFeaturedDurationDays] = useState("7");
	const [stock, setStock] = useState("1");
	const [condition, setCondition] = useState("Nuevo");
	const [categoryId, setCategoryId] = useState("");
	const [categories, setCategories] = useState<ProductCategory[]>([]);
	const [categoriesLoading, setCategoriesLoading] = useState(true);
	const [categoriesError, setCategoriesError] = useState<string | null>(null);
	const [storeId, setStoreId] = useState("");
	const [storeCategoryId, setStoreCategoryId] = useState("");
	const [stores, setStores] = useState<OwnedStore[]>([]);
	const [storesLoading, setStoresLoading] = useState(true);
	const [storesError, setStoresError] = useState<string | null>(null);
	const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([]);
	const [storeCategoriesLoading, setStoreCategoriesLoading] = useState(false);
	const [storeCategoriesError, setStoreCategoriesError] = useState<string | null>(null);
	const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
	const [isDraggingImages, setIsDraggingImages] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const imagePreviewUrls = useRef(new Set<string>());
	const [isAuction, setIsAuction] = useState(false);
	const [showFeaturedInfo, setShowFeaturedInfo] = useState(false);
	const [shippingAvailable, setShippingAvailable] = useState(true);
	const [isPublished, setIsPublished] = useState(true);
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const slug = name.trim() && slugSuffix ? `${toSlug(name)}-${slugSuffix}` : "";
	const activePrice = isAuction ? startingPrice : price;
	const formattedPrice = activePrice
		? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(activePrice))
		: "Precio por definir";
	const invalidPrice = !isAuction && (
		price.trim() === "" || !Number.isFinite(Number(price)) || Number(price) < 0
	);
	const parsedStartingPrice = Number(startingPrice);
	const parsedBidIncrement = Number(bidIncrement);
	const maximumBidIncrement = Number.isSafeInteger(parsedStartingPrice) && parsedStartingPrice > 0
		? Math.floor(parsedStartingPrice * 0.5)
		: null;
	const invalidAuctionTerms = isAuction && (
		startingPrice.trim() === "" ||
		!Number.isSafeInteger(parsedStartingPrice) ||
		parsedStartingPrice <= 0 ||
		!Number.isSafeInteger(parsedBidIncrement) ||
		parsedBidIncrement <= 0 ||
		maximumBidIncrement === null ||
		parsedBidIncrement > maximumBidIncrement ||
		!["0.08333333333333333", "24", "48", "168", "336"].includes(auctionDurationHours)
	);
	const invalidStock = stock.trim() === "" ||
		!Number.isSafeInteger(Number(stock)) ||
		Number(stock) < (isAuction ? 1 : 0);
	const invalidDiscountPrice = !isAuction && discountPrice.trim() !== "" && (
		!Number.isFinite(Number(discountPrice)) || Number(discountPrice) >= Number(price)
	);
	const invalidOfferDuration = !isAuction && discountPrice.trim() !== "" && (
		offerDurationHours === "custom"
			? !Number.isSafeInteger(Number(customOfferDurationHours)) || Number(customOfferDurationHours) < 1
			: !["24", "48", "168"].includes(offerDurationHours)
	);
	const parsedOfferDurationHours = offerDurationHours === "custom"
		? Number(customOfferDurationHours)
		: Number(offerDurationHours);

	useEffect(() => {
		let isCurrent = true;

		const verifySession = async () => {
			const { data: { user }, error } = await supabase.auth.getUser();

			if (!isCurrent) return;
			if (error || !user) {
				router.replace("/login?next=%2Fvender");
				return;
			}

			const requestedStoreId = new URLSearchParams(window.location.search).get("storeId");
			const { data: storeRows, error: storeError } = await supabase
				.from("stores")
				.select("id, name")
				.eq("owner_id", user.id)
				.order("name", { ascending: true });
			if (!isCurrent) return;
			if (storeError) setStoresError(storeError.message);
			else {
				setStores((storeRows ?? []) as OwnedStore[]);
				if (requestedStoreId) {
					const requestedStore = storeRows?.find((store) => String(store.id) === requestedStoreId);
					if (requestedStore) setStoreId(String(requestedStore.id));
					else setStoresError("La tienda indicada no existe o no te pertenece.");
				}
			}
			setStoresLoading(false);
			setAuthorized(true);
		};

		void verifySession();

		return () => {
			isCurrent = false;
		};
	}, [router, supabase]);

	useEffect(() => {
		let isCurrent = true;
		setStoreCategoryId("");
		setStoreCategories([]);
		setStoreCategoriesError(null);

		if (!storeId) {
			setStoreCategoriesLoading(false);
			return () => {
				isCurrent = false;
			};
		}

		setStoreCategoriesLoading(true);
		const loadStoreCategories = async () => {
			const { data, error } = await supabase
				.from("store_categories")
				.select("id, name")
				.eq("store_id", Number(storeId))
				.order("name", { ascending: true });
			if (!isCurrent) return;
			if (error) setStoreCategoriesError(error.message);
			else setStoreCategories((data ?? []) as StoreCategory[]);
			setStoreCategoriesLoading(false);
		};
		void loadStoreCategories();
		return () => {
			isCurrent = false;
		};
	}, [storeId, supabase]);

	useEffect(() => {
		if (!authorized) return;
		let isCurrent = true;

		const loadCategories = async () => {
			const { data, error } = await supabase
				.from("categories")
				.select("id, name")
				.order("name", { ascending: true });

			if (!isCurrent) return;
			if (error) setCategoriesError(error.message);
			else setCategories((data ?? []) as ProductCategory[]);
			setCategoriesLoading(false);
		};

		void loadCategories();
		return () => {
			isCurrent = false;
		};
	}, [authorized, supabase]);

	useEffect(() => () => {
		imagePreviewUrls.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
		imagePreviewUrls.current.clear();
	}, []);

	const addImages = (files: FileList | File[]) => {
		const remainingSlots = Math.max(0, 5 - selectedImages.length);
		const images = Array.from(files)
			.filter((file) => file.type.startsWith("image/"))
			.slice(0, remainingSlots)
			.map((file) => {
				const previewUrl = URL.createObjectURL(file);
				imagePreviewUrls.current.add(previewUrl);
				return { file, previewUrl };
			});

		setSelectedImages((currentImages) => [...currentImages, ...images]);
	};

	const removeImage = useCallback((previewUrl: string) => {
		URL.revokeObjectURL(previewUrl);
		imagePreviewUrls.current.delete(previewUrl);
		setSelectedImages((currentImages) => currentImages.filter((image) => image.previewUrl !== previewUrl));
	}, []);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);
		setSuccessMessage(null);

		if (invalidPrice) {
			setErrorMessage("Ingresa un precio válido para la publicación.");
			return;
		}

		if (invalidAuctionTerms) {
			setErrorMessage(
				maximumBidIncrement !== null && parsedBidIncrement > maximumBidIncrement
					? `El incremento mínimo no puede superar ${new Intl.NumberFormat("es-CL").format(maximumBidIncrement)} CLP (50% del precio inicial).`
					: "Ingresa un precio inicial y un incremento positivos en pesos enteros, y una duración válida para la subasta.",
			);
			return;
		}

		if (invalidStock) {
			setErrorMessage(isAuction
				? "Una subasta debe tener al menos una unidad disponible."
				: "Ingresa una cantidad de stock válida.");
			return;
		}

		if (invalidDiscountPrice) {
			setErrorMessage("El precio de oferta debe ser estrictamente menor que el precio normal.");
			return;
		}

		if (invalidOfferDuration) {
			setErrorMessage("Ingresa una duración de oferta personalizada válida (al menos 1 hora).");
			return;
		}

		setSaving(true);

		try {
			const { data: { user }, error: authError } = await supabase.auth.getUser();
			if (authError || !user) {
				router.replace("/login?next=%2Fvender");
				return;
			}

			const productSlug = slug || `${toSlug(name)}-${createSlugSuffix()}`;
			const now = new Date();
			const parsedDiscountPrice = !isAuction && discountPrice.trim() ? Number(discountPrice) : null;
			const { data: product, error: productError } = await supabase.from("products").insert({
				seller_id: user.id,
				store_id: storeId ? Number(storeId) : null,
				store_category_id: storeId && storeCategoryId ? Number(storeCategoryId) : null,
				category_id: categoryId ? Number(categoryId) : null,
				name: name.trim(),
				slug: productSlug,
				description: description.trim() || null,
				price: isAuction ? null : Number(price),
				discount_price: parsedDiscountPrice,
				offer_ends_at: parsedDiscountPrice !== null
					? new Date(now.getTime() + parsedOfferDurationHours * 60 * 60 * 1000).toISOString()
					: null,
				is_featured: false,
				featured_until: null,
				stock: Number(stock),
				condition,
				status: isPublished,
				images: [],
				sale_type: isAuction ? "auction" : "direct",
				is_auction: isAuction,
				starting_price: isAuction ? Number(startingPrice) : null,
				current_bid: null,
				bid_increment: isAuction ? Number(bidIncrement) : null,
				auction_ends_at: isAuction
					? new Date(now.getTime() + Number(auctionDurationHours) * 60 * 60 * 1000).toISOString()
					: null,
				winner_id: null,
				shipping_available: shippingAvailable,
			}).select("id").single();

			if (productError) throw new Error(productError.message);

			const imageErrors: string[] = [];
			const imageUrls = await uploadProductImages(
				supabase,
				selectedImages.map(({ file }) => file),
				user.id,
				product.id,
				(message) => imageErrors.push(message),
			);

			if (imageUrls.length > 0) {
				const { error: imagesUpdateError } = await supabase
					.from("products")
					.update({ images: imageUrls })
					.eq("id", product.id);
				if (imagesUpdateError) imageErrors.push(`No se pudieron guardar las URLs en el producto: ${imagesUpdateError.message}`);
			}

			setSuccessMessage(imageErrors.length > 0
				? "El producto se publicó, pero algunas imágenes no pudieron procesarse."
				: "El producto se publicó correctamente.");
			if (imageErrors.length > 0) setErrorMessage(imageErrors.join(" "));
			setName("");
			setSlugSuffix(createSlugSuffix());
			setDescription("");
			setPrice("");
			setStartingPrice("");
			setBidIncrement("5000");
			setAuctionDurationHours("24");
			setDiscountPrice("");
			setOfferDurationHours("24");
			setCustomOfferDurationHours("24");
			setFeaturedDurationDays("7");
			setStock("1");
			setCondition("Nuevo");
			setCategoryId("");
			setStoreId("");
			setStoreCategoryId("");
			selectedImages.forEach(({ previewUrl }) => {
				URL.revokeObjectURL(previewUrl);
				imagePreviewUrls.current.delete(previewUrl);
			});
			setSelectedImages([]);
			setIsAuction(false);
			setShippingAvailable(true);
			setIsPublished(true);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "No se pudo publicar el producto.");
		} finally {
			setSaving(false);
		}
	};

	if (!authorized) {
		return (
			<main className="container-site py-12">
				<p role="status" className="text-sm text-muted-foreground">Verificando sesión...</p>
			</main>
		);
	}

	return (
		<main className="container-site py-10">
			<div className="mb-6">
				<h1 className="text-3xl font-bold text-foreground">Vender un producto</h1>
				<p className="mt-2 text-sm text-muted-foreground">Completa la información y revisa cómo aparecerá tu publicación.</p>
			</div>

			{errorMessage && <p role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
			{successMessage && <p role="status" className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</p>}

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
				<section aria-labelledby="product-form-title" className="min-w-0">
					<Card>
						<CardHeader>
							<CardTitle id="product-form-title">Información del producto</CardTitle>
							<CardDescription>Completa los datos de la publicación.</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-5">
								<fieldset className="space-y-2">
									<legend className="text-sm font-medium text-foreground">Tipo de publicación</legend>
									<div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
										<Button type="button" variant={!isAuction ? "default" : "ghost"} aria-pressed={!isAuction} onClick={() => setIsAuction(false)} className="w-full">Venta</Button>
										<Button type="button" variant={isAuction ? "default" : "ghost"} aria-pressed={isAuction} onClick={() => { setIsAuction(true); setDiscountPrice(""); }} className="w-full">Subasta</Button>
									</div>
								</fieldset>
								<div className="space-y-2">
									<Label htmlFor="name">Nombre</Label>
									<Input
										id="name"
										value={name}
										onChange={(event) => {
											setName(event.target.value);
											if (event.target.value.trim() && !slugSuffix) setSlugSuffix(createSlugSuffix());
										}}
										maxLength={160}
										required
									/>
								</div>
                                {/*
								<div className="space-y-2">
									<Label htmlFor="slug">Slug automático</Label>
									<Input id="slug" value={slug} readOnly aria-describedby="slug-help" />
									<p id="slug-help" className="text-xs text-muted-foreground">Se genera con el nombre y un sufijo único.</p>
								</div>
                                */}
								<div className="space-y-2">
									<Label htmlFor="description">Descripción</Label>
									<Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									{isAuction ? (
										<div className="space-y-2">
											<Label htmlFor="startingPrice">Precio inicial de la subasta (CLP)</Label>
											<Input id="startingPrice" className={numberInputClassName} type="number" min="1" step="1" value={startingPrice} onChange={(event) => setStartingPrice(event.target.value)} required />
										</div>
									) : (
										<div className="space-y-2">
											<Label htmlFor="price">Precio (CLP)</Label>
											<Input id="price" className={numberInputClassName} type="number" min="0" step="1" value={price} onChange={(event) => setPrice(event.target.value)} required />
										</div>
									)}
									<div className="space-y-2">
										<Label htmlFor="stock">Stock</Label>
										<Input id="stock" className={numberInputClassName} type="number" min={isAuction ? "1" : "0"} step="1" value={stock} onChange={(event) => setStock(event.target.value)} required />
									</div>
								</div>

								{isAuction && (
									<div className="space-y-4 rounded-md border border-border p-4">
										<div>
											<h2 className="text-sm font-semibold text-foreground">Condiciones de la subasta</h2>
											<p className="mt-1 text-xs text-muted-foreground">
												El precio inicial, el incremento y el vencimiento se guardan en los campos propios de la subasta.
											</p>
										</div>
										<div className="grid gap-4 sm:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="bidIncrement">Incremento mínimo (CLP)</Label>
												<Input id="bidIncrement" className={numberInputClassName} type="number" min="1" max={maximumBidIncrement ?? undefined} step="1" value={bidIncrement} onChange={(event) => setBidIncrement(event.target.value)} required />
												<p className="text-xs text-muted-foreground">
													El incremento no puede superar el 50% del precio inicial
													{maximumBidIncrement === null ? "." : ` (${new Intl.NumberFormat("es-CL").format(maximumBidIncrement)} CLP).`}
												</p>
											</div>
											<div className="space-y-2">
												<Label htmlFor="auctionDuration">Duración de la subasta</Label>
												<select id="auctionDuration" value={auctionDurationHours} onChange={(event) => setAuctionDurationHours(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
													<option value="0.08333333333333333">5 minutos</option>
													<option value="24">24 horas</option>
													<option value="48">48 horas</option>
													<option value="168">7 días</option>
													<option value="336">14 días</option>
												</select>
											</div>
										</div>
									</div>
								)}

								<Tabs key={isAuction ? "auction" : "direct"} defaultValue={isAuction ? "featured" : "offer"} className="w-full rounded-md border border-border p-4">
									<TabsList className={`grid w-full ${isAuction ? "grid-cols-1" : "grid-cols-2"}`}>
										{!isAuction && <TabsTrigger value="offer">Ofertas</TabsTrigger>}
										<TabsTrigger value="featured">Destacados</TabsTrigger>
									</TabsList>
									{!isAuction && <TabsContent value="offer" className="space-y-4 pt-4">
										<div className="space-y-2">
											<Label htmlFor="discountPrice">Precio de oferta (opcional)</Label>
											<Input
												id="discountPrice"
												className={numberInputClassName}
												type="number"
												min="0"
												step="any"
												value={discountPrice}
												aria-invalid={invalidDiscountPrice}
												onChange={(event) => setDiscountPrice(event.target.value)}
											/>
											{invalidDiscountPrice ? (
												<p role="alert" className="text-sm text-red-700">Debe ser menor que {formattedPrice}.</p>
											) : (
												<p className="text-xs text-muted-foreground">El precio normal se mostrará tachado durante la oferta.</p>
											)}
										</div>
										<div className="space-y-2">
											<Label htmlFor="offerDuration">Duración de la oferta</Label>
											<select id="offerDuration" value={offerDurationHours} onChange={(event) => setOfferDurationHours(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
												<option value="24">24 horas</option>
												<option value="48">48 horas</option>
												<option value="168">7 días</option>
												<option value="custom">Personalizada</option>
											</select>
											{offerDurationHours === "custom" && (
												<div className="space-y-2">
													<Label htmlFor="customOfferDuration">Duración personalizada (horas)</Label>
													<Input id="customOfferDuration" className={numberInputClassName} type="number" min="1" step="1" value={customOfferDurationHours} onChange={(event) => setCustomOfferDurationHours(event.target.value)} required />
												</div>
											)}
										</div>
									</TabsContent>}
									<TabsContent value="featured" className="space-y-4 pt-4">
										<div className="flex items-center justify-between gap-2">
											<div>
												<h2 className="text-sm font-semibold text-foreground">Promoción pagada</h2>
												<p className="text-xs text-muted-foreground">Elige cuánto tiempo destacar el producto.</p>
											</div>
											<Button type="button" variant="ghost" size="icon" aria-label="Cómo funcionan los destacados" onClick={() => setShowFeaturedInfo(true)}>
												<CircleHelp className="h-4 w-4" aria-hidden="true" />
											</Button>
										</div>
										<div className="space-y-2">
											<Label htmlFor="featuredDuration">Duración del destacado</Label>
											<select id="featuredDuration" value={featuredDurationDays} onChange={(event) => setFeaturedDurationDays(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
												<option value="1">1 día</option>
												<option value="3">3 días</option>
												<option value="7">7 días</option>
												<option value="14">14 días</option>
											</select>
										</div>
										<Button type="button" disabled className="w-full">
											<CreditCard className="h-4 w-4" aria-hidden="true" />
											Comprar destacado
										</Button>
										<p id="featured-payment-status" className="text-xs text-muted-foreground">El pago de publicidad aún no está habilitado. El producto no se activará como destacado hasta completar una compra.</p>
									</TabsContent>
								</Tabs>

								<div className="space-y-2">
									<Label htmlFor="condition">Estado del producto</Label>
									<select id="condition" value={condition} onChange={(event) => setCondition(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
										<option>Nuevo</option>
										<option>Como nuevo</option>
										<option>Usado - buen estado</option>
										<option>Usado - aceptable</option>
                                        <option>Para piezas</option>
									</select>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="categoryId">Categoría</Label>
										<select id="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
											<option value="">{categoriesLoading ? "Cargando categorías..." : categoriesError ? "No se pudieron cargar" : categories.length ? "Selecciona una categoría" : "No hay categorías disponibles"}</option>
											{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
										</select>
										{categoriesError && <p role="alert" className="text-xs text-red-700">{categoriesError}</p>}
									</div>
									<div className="space-y-2">
										<Label htmlFor="storeId">¿Publicar en una de mis tiendas? (opcional)</Label>
										<select id="storeId" value={storeId} onChange={(event) => setStoreId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
											<option value="">{storesLoading ? "Cargando tus tiendas..." : "Sin tienda"}</option>
											{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
										</select>
										{storesError && <p role="alert" className="text-xs text-red-700">No se pudieron cargar tus tiendas: {storesError}</p>}
									</div>
									{storeId && (
										<div className="space-y-2">
											<Label htmlFor="storeCategoryId">Categoría de la tienda (opcional)</Label>
											<select id="storeCategoryId" value={storeCategoryId} onChange={(event) => setStoreCategoryId(event.target.value)} disabled={storeCategoriesLoading || Boolean(storeCategoriesError)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:opacity-50">
												<option value="">{storeCategoriesLoading ? "Cargando categorías..." : storeCategories.length > 0 ? "Sin categoría propia" : "No hay categorías propias"}</option>
												{storeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
											</select>
											{storeCategoriesError && <p role="alert" className="text-xs text-red-700">No se pudieron cargar las categorías: {storeCategoriesError}</p>}
										</div>
									)}
								</div>

								<div className="space-y-2">
									<Label>Imágenes del producto</Label>
									<div
										className={`rounded-lg border border-dashed p-5 text-center transition ${isDraggingImages ? "border-brand-500 bg-brand-50" : "border-border bg-muted/40"}`}
										onDragOver={(event) => {
											event.preventDefault();
											setIsDraggingImages(true);
										}}
										onDragLeave={() => setIsDraggingImages(false)}
										onDrop={(event) => {
											event.preventDefault();
											setIsDraggingImages(false);
											addImages(event.dataTransfer.files);
										}}
									>
										<UploadCloud className="mx-auto mb-2 h-6 w-6 text-brand-700" aria-hidden="true" />
										<p className="text-sm font-medium text-foreground">Arrastra imágenes aquí</p>
										<p className="mt-1 text-xs text-muted-foreground">Hasta 5 imágenes. Se guardarán en el almacenamiento de productos.</p>
										<input
											ref={imageInputRef}
											id="images"
											type="file"
											accept="image/*"
											multiple
											className="sr-only"
											onChange={(event) => {
												if (event.target.files) addImages(event.target.files);
												event.target.value = "";
											}}
										/>
										<Button type="button" variant="outline" className="mt-3" onClick={() => imageInputRef.current?.click()}>
											<ImagePlus className="h-4 w-4" aria-hidden="true" />
											Seleccionar imágenes
										</Button>
									</div>
									{selectedImages.length > 0 && (
										<SelectedImageList images={selectedImages} onRemove={removeImage} />
									)}
								</div>

								<div className="space-y-3">
									<label className="flex items-center gap-2 text-sm text-foreground">
										<input type="checkbox" checked={shippingAvailable} onChange={(event) => setShippingAvailable(event.target.checked)} className="h-4 w-4 accent-brand-600" />
										Envío disponible
									</label>
                                    {/*
									<label className="flex items-center gap-2 text-sm text-foreground">
										<input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} className="h-4 w-4 accent-brand-600" />
										Publicar inmediatamente
									</label>
                                    */}
								</div>

								<div className="flex justify-end">
									<Button type="submit" disabled={saving}>
										{saving ? "Guardando producto..." : "Publicar producto"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</section>

				<aside aria-labelledby="preview-title" className="min-w-0 lg:sticky lg:top-28">
					<Card>
						<CardHeader>
							<CardTitle id="preview-title">Vista previa</CardTitle>
							<CardDescription></CardDescription>
						</CardHeader>
						<CardContent>
							<ProductImagePreview images={selectedImages} />
							<div className="mt-5 space-y-3">
								<div className="flex flex-wrap gap-2">
									<span className="badge badge-soft">{isAuction ? "Subasta" : "Venta"}</span>
									{condition && <span className="badge bg-muted text-muted-foreground">{condition}</span>}
								</div>
								<h2 className="wrap-break-word text-xl font-bold text-foreground">{name.trim() || "Nombre del producto"}</h2>
								<p className="whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">{description.trim() || "La descripción del producto aparecerá aquí."}</p>
								<div className="flex flex-wrap items-baseline gap-2">
									{isAuction ? (
										<div>
											<p className="text-xs text-muted-foreground">Precio inicial</p>
											<p className="text-2xl font-extrabold text-foreground">{formattedPrice}</p>
											<p className="mt-1 text-sm text-muted-foreground">
												Incremento: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(bidIncrement) || 0)}
											</p>
										</div>
									) : discountPrice && !invalidDiscountPrice ? (
										<>
											<p className="text-2xl font-extrabold text-foreground">
												{new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(discountPrice))}
											</p>
											<p className="text-sm text-muted-foreground line-through">{formattedPrice}</p>
										</>
									) : (
										<p className="text-2xl font-extrabold text-foreground">{formattedPrice}</p>
									)}
								</div>
								<div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
									<span>Stock: {stock || "0"}</span>
									<span>{shippingAvailable ? "Envío disponible" : "Sin envío"}</span>
								</div>
								{slug && <p className="break-all border-t border-border pt-3 text-xs text-muted-foreground">/{slug}</p>}
							</div>
						</CardContent>
					</Card>
				</aside>
			</div>
			<Dialog.Root open={showFeaturedInfo} onOpenChange={setShowFeaturedInfo}>
				<Dialog.Portal>
					<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
					<Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-border bg-surface p-6 text-foreground shadow-xl">
						<div className="flex items-start gap-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
							<div className="space-y-1">
								<Dialog.Title className="text-lg font-semibold">¿Cómo funcionan los destacados?</Dialog.Title>
								<Dialog.Description className="text-sm text-muted-foreground">Es publicidad pagada para dar mayor visibilidad a tu producto.</Dialog.Description>
							</div>
						</div>
						<ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
							<li>El producto aparece en la página principal durante el periodo contratado.</li>
							<li>La promoción comienza una vez completado el pago.</li>
						</ul>
						<p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">El pago de destacados todavía no está disponible, por lo que no se realizará ningún cobro ni activación.</p>
						<div className="flex justify-end">
							<Dialog.Close render={<Button type="button" variant="outline">Cerrar</Button>} />
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</main>
	);
}
