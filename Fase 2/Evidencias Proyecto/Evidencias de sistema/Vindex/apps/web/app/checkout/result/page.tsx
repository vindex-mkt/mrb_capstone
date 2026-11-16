import WebpayResult from "@/components/checkout/WebpayResult";

type WebpayResultPageProps = {
  searchParams: Promise<{ order_id?: string; state?: string; resume?: string }>;
};

export default async function WebpayResultPage({ searchParams }: WebpayResultPageProps) {
  const { order_id: orderId, state, resume } = await searchParams;
  return <WebpayResult orderId={orderId ?? null} returnState={state ?? null} resumePayment={resume === "1"} />;
}
