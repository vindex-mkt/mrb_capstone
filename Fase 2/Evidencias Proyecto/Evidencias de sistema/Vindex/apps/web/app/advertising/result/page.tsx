import AdvertisingResult from "@/components/checkout/AdvertisingResult";

type AdvertisingResultPageProps = {
  searchParams: Promise<{ transaction_id?: string }>;
};

export default async function AdvertisingResultPage({ searchParams }: AdvertisingResultPageProps) {
  const { transaction_id: transactionId } = await searchParams;
  return <AdvertisingResult transactionId={transactionId ?? null} />;
}
