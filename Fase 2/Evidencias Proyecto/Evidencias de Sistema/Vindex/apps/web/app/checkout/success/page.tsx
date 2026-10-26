import CheckoutSuccess from "@/components/checkout/CheckoutSuccess";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{ order_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const { order_id: orderId } = await searchParams;
  return <CheckoutSuccess orderId={orderId ?? null} />;
}
