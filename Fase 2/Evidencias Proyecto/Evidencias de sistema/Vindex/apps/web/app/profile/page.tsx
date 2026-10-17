"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, ShoppingBag, Store, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ToastProvider";
import { CHILE_LOCATIONS } from "@/lib/chile-locations";
import SellerStores from "@/components/profile/SellerStores";
import BuyerPurchases from "@/components/profile/BuyerPurchases";
import SellerPickupOrders from "@/components/profile/SellerPickupOrders";

type SellerProduct = {
  id: number;
  name: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  images: string[] | null;
  discount_price: number | null;
  offer_ends_at: string | null;
  sale_type: string | null;
  starting_price: number | null;
  current_bid: number | null;
  bid_increment: number | null;
  auction_ends_at: string | null;
  created_at: string;
};

type ProductDraft = {
  name: string;
  description: string;
  price: string;
  stock: string;
  discountPrice: string;
  offerDurationHours: string;
  renewOffer: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  // Estado para alternar entre perfil de Comprador y Vendedor
  const [activeRole, setActiveRole] = useState<"buyer" | "seller">("buyer");

  // Estados de datos personales
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [sellerProductsLoading, setSellerProductsLoading] = useState(true);
  const [sellerProductsError, setSellerProductsError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [productSaveMessage, setProductSaveMessage] = useState<string | null>(null);
  const [productSaveError, setProductSaveError] = useState<string | null>(null);

  // Estados de dirección
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [commune, setCommune] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [references, setReferences] = useState("");
  const cities = CHILE_LOCATIONS.find((location) => location.region === region)?.cities ?? [];
  const communes = cities.find((location) => location.name === city)?.communes ?? [];

  useEffect(() => {
    let isCurrent = true;

    const loadProfile = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!isCurrent) return;

      if (error || !user) {
        router.replace("/login");
        return;
      }

      const metadata = user.user_metadata ?? {};
      const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
      const nameParts = fullName.split(/\s+/);

      const { data: profile, error: addressError } = await supabase
        .from("profiles")
        .select("region, city, commune, street, street_number, references")
        .eq("id", user.id)
        .maybeSingle();

      if (!isCurrent) return;

      setEmail(user.email ?? "");
      setFirstName(typeof metadata.first_name === "string" ? metadata.first_name : nameParts[0] ?? "");
      setLastName(typeof metadata.last_name === "string" ? metadata.last_name : nameParts.slice(1).join(" "));
      if (addressError) {
        setProfileError(`No se pudo cargar tu dirección: ${addressError.message}`);
      } else {
        const profileRegion = typeof profile?.region === "string" ? profile.region : "";
        const metadataRegion = typeof metadata.region === "string" ? metadata.region : "";
        const findRegion = (value: string) => CHILE_LOCATIONS.find((location) =>
          location.region === value
          || (location.region === "Región Metropolitana" && ["Metropolitana", "Región Metropolitana de Santiago"].includes(value)),
        );
        const selectedRegion = findRegion(profileRegion) ?? findRegion(metadataRegion);
        const profileCity = typeof profile?.city === "string" ? profile.city : "";
        const metadataCity = typeof metadata.city === "string" ? metadata.city : typeof metadata.ciudad === "string" ? metadata.ciudad : "";
        const savedCity = selectedRegion?.cities.find((location) => location.name === (profileCity || metadataCity))?.name ?? "";
        const profileCommune = typeof profile?.commune === "string" ? profile.commune : "";
        const metadataCommune = typeof metadata.comuna === "string" ? metadata.comuna : "";
        const savedCommune = selectedRegion?.cities.find((location) => location.name === savedCity)
          ?.communes.find((value) => value === (profileCommune || metadataCommune)) ?? "";

        setRegion(selectedRegion?.region ?? "");
        setCity(savedCity);
        setCommune(savedCommune);
        setStreet(typeof profile?.street === "string" ? profile.street : typeof metadata.street === "string" ? metadata.street : typeof metadata.calle === "string" ? metadata.calle : "");
        setStreetNumber(typeof profile?.street_number === "string" ? profile.street_number : "");
        setReferences(typeof profile?.references === "string" ? profile.references : typeof metadata.references === "string" ? metadata.references : typeof metadata.observacion === "string" ? metadata.observacion : "");
      }

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, description, price, stock, images, discount_price, offer_ends_at, sale_type, starting_price, current_bid, bid_increment, auction_ends_at, created_at")
        .eq("seller_id", user.id)
        .eq("status", true)
        .order("created_at", { ascending: false });

      if (!isCurrent) return;
      if (productsError) {
        setSellerProductsError(productsError.message);
      } else {
        setSellerProducts((products ?? []) as SellerProduct[]);
      }
      setSellerProductsLoading(false);
      setProfileLoading(false);
    };

    void loadProfile();

    return () => {
      isCurrent = false;
    };
  }, [router, supabase]);

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileSaving(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: updatedProfile, error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          region,
          city,
          commune,
          street: street.trim(),
          street_number: streetNumber.trim(),
          references: references.trim(),
        })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (profileUpdateError) throw profileUpdateError;
      if (!updatedProfile) {
        throw new Error("No se encontró un perfil para guardar la dirección.");
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: [firstName, lastName].filter(Boolean).join(" "),
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (metadataError) {
        showToast(`La dirección se guardó, pero no se pudieron actualizar los datos personales: ${metadataError.message}`, "error");
        return;
      }

      setProfileError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      showToast(`No se pudo guardar tu perfil: ${message}`, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const startEditingProduct = (product: SellerProduct) => {
    const offerIsExpired = !product.offer_ends_at || new Date(product.offer_ends_at).getTime() <= Date.now();
    setEditingProductId(product.id);
    setProductSaveError(null);
    setProductSaveMessage(null);
    setProductDraft({
      name: product.name ?? "",
      description: product.description ?? "",
      price: (product.sale_type === "auction" ? product.starting_price : product.price) === null
        ? ""
        : String(product.sale_type === "auction" ? product.starting_price : product.price),
      stock: product.stock === null ? "0" : String(product.stock),
      discountPrice: product.discount_price === null ? "" : String(product.discount_price),
      offerDurationHours: "24",
      renewOffer: offerIsExpired,
    });
  };

  const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>, product: SellerProduct) => {
    event.preventDefault();
    if (!productDraft) return;

    setProductSaveError(null);
    setProductSaveMessage(null);
    const parsedPrice = Number(productDraft.price);
    const parsedStock = Number(productDraft.stock);
    const isAuction = product.sale_type === "auction";
    const parsedDiscountPrice = !isAuction && productDraft.discountPrice.trim()
      ? Number(productDraft.discountPrice)
      : null;

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedStock) || parsedStock < 0) {
      setProductSaveError("Ingresa un precio y un stock válidos.");
      return;
    }

    if (parsedDiscountPrice !== null && (!Number.isFinite(parsedDiscountPrice) || parsedDiscountPrice >= parsedPrice)) {
      setProductSaveError("El precio de oferta debe ser estrictamente menor que el precio normal.");
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/login");
      return;
    }

    setSavingProductId(product.id);
    const offerEndsAt = isAuction || parsedDiscountPrice === null
      ? null
      : productDraft.renewOffer || !product.offer_ends_at
        ? new Date(Date.now() + Number(productDraft.offerDurationHours) * 60 * 60 * 1000).toISOString()
        : product.offer_ends_at;

    const { error } = await supabase
      .from("products")
      .update({
        name: productDraft.name.trim(),
        description: productDraft.description.trim() || null,
        price: isAuction ? null : parsedPrice,
        stock: parsedStock,
        discount_price: parsedDiscountPrice,
        offer_ends_at: offerEndsAt,
        ...(isAuction ? { starting_price: parsedPrice } : {}),
      })
      .eq("id", product.id)
      .eq("seller_id", user.id);

    setSavingProductId(null);
    if (error) {
      setProductSaveError(error.message);
      return;
    }

    setSellerProducts((currentProducts) => currentProducts.map((currentProduct) => currentProduct.id === product.id
      ? {
          ...currentProduct,
          name: productDraft.name.trim(),
          description: productDraft.description.trim() || null,
            price: isAuction ? null : parsedPrice,
          stock: parsedStock,
          discount_price: parsedDiscountPrice,
          offer_ends_at: offerEndsAt,
            ...(isAuction ? { starting_price: parsedPrice } : {}),
        }
      : currentProduct));
    setProductSaveMessage("Los cambios del producto se guardaron.");
    setEditingProductId(null);
    setProductDraft(null);
  };

  const handleDeleteProduct = async (product: SellerProduct) => {
    if (!window.confirm(`¿Quieres retirar "${product.name ?? "este producto"}" de tus publicaciones activas?`)) {
      return;
    }

    setProductSaveError(null);
    setProductSaveMessage(null);
    setDeletingProductId(product.id);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .update({ status: false })
        .eq("id", product.id)
        .eq("seller_id", user.id)
        .eq("status", true)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("No se encontró una publicación activa que puedas retirar.");
      }

      setSellerProducts((currentProducts) => currentProducts.filter(({ id }) => id !== product.id));
      if (editingProductId === product.id) {
        setEditingProductId(null);
        setProductDraft(null);
      }
      setProductSaveMessage("El producto se retiró de tus publicaciones activas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error("No se pudo retirar el producto:", message);
      setProductSaveError(`No se pudo retirar el producto: ${message}`);
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <div className="container-site max-w-5xl py-8 sm:py-12">
      <div className="mb-6">
        <p className="eyebrow">Tu espacio Vindex</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">Mi cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra tus datos, compras y publicaciones desde un solo lugar.
        </p>
      </div>

      {profileLoading ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando tu perfil...</p>
      ) : (
        <>
          <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="Resumen de cuenta">
            <div className="flex min-w-0 items-center gap-4">
              <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                {`${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || <UserRound className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-foreground">
                  {[firstName, lastName].filter(Boolean).join(" ") || "Tu perfil"}
                </h2>
                <p className="truncate text-sm text-muted-foreground">{email}</p>
              </div>
            </div>
            <div role="group" aria-label="Cambiar tipo de perfil" className="flex rounded-xl bg-muted p-1">
              <button
                type="button"
                aria-pressed={activeRole === "buyer"}
                onClick={() => setActiveRole("buyer")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none ${
                  activeRole === "buyer" ? "bg-surface text-brand-700 shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                Comprador
              </button>
              <button
                type="button"
                aria-pressed={activeRole === "seller"}
                onClick={() => setActiveRole("seller")}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-none ${
                  activeRole === "seller" ? "bg-surface text-brand-700 shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Store className="h-4 w-4" />
                Vendedor
              </button>
            </div>
          </section>

          {profileError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{profileError}</p>}

          {/* MODO COMPRADOR: Datos de Usuario y Dirección */}
          {activeRole === "buyer" && (
            <Tabs defaultValue="account" className="space-y-5">
              <TabsList aria-label="Secciones del perfil comprador" className="grid !h-14 w-full grid-cols-2 items-stretch rounded-xl border border-border bg-surface p-1 pb-3">
                <TabsTrigger value="account" className="h-auto min-h-10 gap-2 rounded-lg after:hidden data-active:bg-brand-50 data-active:text-brand-700">
                  <UserRound className="h-4 w-4" />
                  Datos y despacho
                </TabsTrigger>
                <TabsTrigger value="purchases" className="h-auto min-h-10 gap-2 rounded-lg after:hidden data-active:bg-brand-50 data-active:text-brand-700">
                  <ShoppingBag className="h-4 w-4" />
                  Mis compras
                </TabsTrigger>
              </TabsList>
              <TabsContent value="account" className="space-y-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Información Personal */}
              <Card className="border-border bg-surface">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Datos Personales</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Modifica tu información básica de contacto en la plataforma.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Dirección de Envío */}
              <Card className="border-border bg-surface">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Dirección de Despacho</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Utilizada para el cálculo de envíos y entregas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="region">Región</Label>
                      <Select
                        id="region"
                        value={region}
                        onChange={(event) => {
                          setRegion(event.target.value);
                          setCity("");
                          setCommune("");
                        }}
                        required
                      >
                        <option value="">Selecciona una región</option>
                        {CHILE_LOCATIONS.map((location) => (
                          <option key={location.region} value={location.region}>{location.region}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Provincia</Label>
                      <Select
                        id="city"
                        value={city}
                        onChange={(event) => {
                          setCity(event.target.value);
                          setCommune("");
                        }}
                        disabled={!region}
                        required
                      >
                        <option value="">Selecciona una provincia</option>
                        {cities.map((location) => (
                          <option key={location.name} value={location.name}>{location.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commune">Comuna</Label>
                      <Select
                        id="commune"
                        value={commune}
                        onChange={(event) => setCommune(event.target.value)}
                        disabled={!city}
                        required
                      >
                        <option value="">Selecciona una comuna</option>
                        {communes.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="street">Calle</Label>
                      <Input
                        id="street"
                        autoComplete="address-line1"
                        placeholder="Av. Providencia"
                        value={street}
                        onChange={(event) => setStreet(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street-number">Número</Label>
                      <Input
                        id="street-number"
                        autoComplete="address-line2"
                        placeholder="1234, depto. 402"
                        value={streetNumber}
                        onChange={(event) => setStreetNumber(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="references">Referencias (opcional)</Label>
                    <Textarea
                      id="references"
                      placeholder="Dejar en conserjería, timbre no funciona, etc."
                      value={references}
                      onChange={(event) => setReferences(event.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="bg-brand-600 text-white hover:bg-brand-700" disabled={profileSaving}>
                    {profileSaving ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </CardContent>
              </Card>
            </form>
              </TabsContent>
              <TabsContent value="purchases">
                <BuyerPurchases />
              </TabsContent>
            </Tabs>
          )}

          {/* Perfil vendedor */}
          {activeRole === "seller" && (
            <Tabs defaultValue="orders" className="space-y-5">
              <TabsList aria-label="Secciones del perfil vendedor" className="grid !h-14 w-full grid-cols-3 items-stretch rounded-xl border border-border bg-surface p-1 pb-3">
                <TabsTrigger value="orders" className="h-auto min-h-10 gap-2 rounded-lg after:hidden data-active:bg-brand-50 data-active:text-brand-700">
                  <Truck className="h-4 w-4" />
                  Pedidos
                </TabsTrigger>
                <TabsTrigger value="products" className="h-auto min-h-10 gap-2 rounded-lg after:hidden data-active:bg-brand-50 data-active:text-brand-700">
                  <Package className="h-4 w-4" />
                  Productos
                </TabsTrigger>
                <TabsTrigger value="store" className="h-auto min-h-10 gap-2 rounded-lg after:hidden data-active:bg-brand-50 data-active:text-brand-700">
                  <Store className="h-4 w-4" />
                  Mi tienda
                </TabsTrigger>
              </TabsList>
              <TabsContent value="orders">
                <SellerPickupOrders />
              </TabsContent>
              <TabsContent value="products">
              <Card className="border-border bg-surface">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Mis productos publicados</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Edita la información y administra las ofertas de tus publicaciones activas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {productSaveError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{productSaveError}</p>}
                  {productSaveMessage && <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{productSaveMessage}</p>}
                  {sellerProductsError && <p role="alert" className="text-sm text-red-700">No se pudieron cargar tus productos: {sellerProductsError}</p>}
                  {sellerProductsLoading ? (
                    <p role="status" className="text-sm text-muted-foreground">Cargando tus productos...</p>
                  ) : sellerProducts.length === 0 && !sellerProductsError ? (
                    <div className="rounded-md border border-dashed border-border p-6 text-center">
                      <p className="text-sm text-muted-foreground">Aún no tienes productos publicados.</p>
                      <a href="/vender" className="btn btn-primary mt-4">Publicar un producto</a>
                    </div>
                  ) : (
                    sellerProducts.map((product) => {
                      const isAuction = product.sale_type === "auction";
                      const displayedPrice = isAuction
                        ? product.current_bid ?? product.starting_price
                        : product.price;
                      const activeOffer = product.discount_price !== null && product.offer_ends_at !== null && new Date(product.offer_ends_at).getTime() > Date.now();
                      const invalidDraftDiscount = !isAuction && productDraft?.discountPrice.trim() !== "" && productDraft !== null && (
                        !Number.isFinite(Number(productDraft.discountPrice)) || Number(productDraft.discountPrice) >= Number(productDraft.price)
                      );

                      return (
                        <article key={product.id} className="rounded-md border border-border p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <img
                              src={product.images?.[0] ?? "https://picsum.photos/seed/vindex-product/240/240"}
                              alt={product.name ?? "Producto"}
                              className="aspect-square w-full rounded-md bg-muted object-cover sm:w-24"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold text-foreground">{product.name ?? "Producto sin nombre"}</h3>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {isAuction ? "Puja actual / inicial: " : ""}
                                    {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(displayedPrice ?? 0)}
                                    <span className="mx-2">·</span>Stock: {product.stock ?? 0}
                                  </p>
                                  {isAuction && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      <Badge variant="secondary">Subasta</Badge>
                                      <span className="ml-2">Incremento: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(product.bid_increment ?? 0)}</span>
                                      {product.auction_ends_at && <span> · Cierra {new Date(product.auction_ends_at).toLocaleString("es-CL")}</span>}
                                    </p>
                                  )}
                                  {activeOffer && (
                                    <p className="mt-1 text-sm text-accent-600">
                                      Oferta {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(product.discount_price!)} hasta {new Date(product.offer_ends_at!).toLocaleString("es-CL")}
                                    </p>
                                  )}
                                </div>
                                {editingProductId !== product.id && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" onClick={() => startEditingProduct(product)}>
                                      Editar producto
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      onClick={() => void handleDeleteProduct(product)}
                                      disabled={deletingProductId === product.id}
                                    >
                                      {deletingProductId === product.id ? "Retirando..." : "Eliminar"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {product.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
                            </div>
                          </div>

                          {editingProductId === product.id && productDraft && (
                            <form onSubmit={(event) => void handleSaveProduct(event, product)} className="mt-5 space-y-4 border-t border-border pt-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                  <Label htmlFor={`product-name-${product.id}`}>Nombre</Label>
                                  <Input id={`product-name-${product.id}`} value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} required maxLength={160} />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                  <Label htmlFor={`product-description-${product.id}`}>Descripción</Label>
                                  <Textarea id={`product-description-${product.id}`} value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} rows={3} />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`product-price-${product.id}`}>{isAuction ? "Precio inicial de subasta" : "Precio normal"}</Label>
                                  <Input id={`product-price-${product.id}`} type="number" min="0" step="any" value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`product-stock-${product.id}`}>Stock</Label>
                                  <Input id={`product-stock-${product.id}`} type="number" min="0" step="any" value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: event.target.value })} required />
                                </div>
                                {!isAuction && <div className="space-y-2 sm:col-span-2">
                                  <Label htmlFor={`product-discount-${product.id}`}>Precio de oferta (opcional)</Label>
                                  <Input id={`product-discount-${product.id}`} type="number" min="0" step="any" value={productDraft.discountPrice} aria-invalid={Boolean(invalidDraftDiscount)} onChange={(event) => setProductDraft({ ...productDraft, discountPrice: event.target.value })} />
                                  {invalidDraftDiscount && <p className="text-sm text-red-700">Debe ser estrictamente menor que el precio normal.</p>}
                                </div>}
                              </div>

                              {!isAuction && (
                              <div className="space-y-3 rounded-md bg-muted/50 p-3">
                                <label className="flex items-center gap-2 text-sm text-foreground">
                                  <input type="checkbox" checked={productDraft.renewOffer} onChange={(event) => setProductDraft({ ...productDraft, renewOffer: event.target.checked })} className="h-4 w-4 accent-brand-600" />
                                  Crear o renovar la oferta desde ahora
                                </label>
                                <div className="space-y-2">
                                  <Label htmlFor={`offer-duration-${product.id}`}>Duración de la oferta</Label>
                                  <select id={`offer-duration-${product.id}`} value={productDraft.offerDurationHours} onChange={(event) => setProductDraft({ ...productDraft, offerDurationHours: event.target.value })} disabled={!productDraft.renewOffer} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="24">24 horas</option>
                                    <option value="48">48 horas</option>
                                    <option value="168">7 días</option>
                                  </select>
                                </div>
                              </div>
                              )}

                              <div className="flex flex-wrap justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => { setEditingProductId(null); setProductDraft(null); setProductSaveError(null); }}>
                                  Cancelar
                                </Button>
                                <Button type="submit" disabled={savingProductId === product.id || Boolean(invalidDraftDiscount)}>
                                  {savingProductId === product.id ? "Guardando..." : "Guardar cambios"}
                                </Button>
                              </div>
                            </form>
                          )}
                        </article>
                      );
                    })
                  )}
                </CardContent>
              </Card>
              </TabsContent>
              <TabsContent value="store">
                <SellerStores />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}