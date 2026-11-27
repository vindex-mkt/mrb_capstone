import WalletPaymentResult from "@/components/wallet/WalletPaymentResult";

type WalletPaymentResultPageProps = {
  searchParams: Promise<{ transaction_id?: string; state?: string }>;
};

export default async function WalletPaymentResultPage({ searchParams }: WalletPaymentResultPageProps) {
  const { transaction_id: transactionId, state } = await searchParams;
  return (
    <WalletPaymentResult
      transactionId={transactionId ?? null}
      returnState={state ?? null}
    />
  );
}
