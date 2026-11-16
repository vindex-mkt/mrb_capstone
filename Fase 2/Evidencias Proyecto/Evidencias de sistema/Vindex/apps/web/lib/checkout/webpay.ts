import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  TransactionDetail,
  WebpayPlus,
} from "transbank-sdk";
import { isRecord } from "./record";

export { isRecord } from "./record";

export const RETURN_TOKEN_COOKIE = "vindex_webpay_return_token";
export const CANCEL_TOKEN_COOKIE = "vindex_webpay_cancel_token";

export const createAdvertisingTransaction = () => {
  const environment = process.env.TRANSBANK_ENV?.trim().toLowerCase();
  const apiKey = process.env.TRANSBANK_API_KEY;
  const mallCommerceCode = process.env.TRANSBANK_COMMERCE_CODE;
  const childCommerceCode1 = process.env.TRANSBANK_CHILD_COMMERCE_CODE_1;
  const childCommerceCode2 = process.env.TRANSBANK_CHILD_COMMERCE_CODE_2;

  if (
    !["integration", "sandbox"].includes(environment ?? "")
    || apiKey !== IntegrationApiKeys.WEBPAY
    || mallCommerceCode !== IntegrationCommerceCodes.WEBPAY_PLUS_MALL
    || childCommerceCode1 !== IntegrationCommerceCodes.WEBPAY_PLUS_MALL_CHILD1
    || childCommerceCode2 !== IntegrationCommerceCodes.WEBPAY_PLUS_MALL_CHILD2
  ) {
    throw new Error("La publicidad solo puede cobrarse con las credenciales de integración de Transbank.");
  }

  return WebpayPlus.Transaction.buildForIntegration(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    apiKey,
  );
};

export const createMallTransaction = () => {
  assertIntegrationMallCredentials();
  const mallCommerceCode = process.env.TRANSBANK_COMMERCE_CODE!;
  const apiKey = process.env.TRANSBANK_API_KEY!;

  return WebpayPlus.MallTransaction.buildForIntegration(mallCommerceCode, apiKey);
};

export const assertIntegrationMallCredentials = () => {
  const environment = process.env.TRANSBANK_ENV?.trim().toLowerCase();
  const apiKey = process.env.TRANSBANK_API_KEY;
  const mallCommerceCode = process.env.TRANSBANK_COMMERCE_CODE;
  const childCommerceCode1 = process.env.TRANSBANK_CHILD_COMMERCE_CODE_1;
  const childCommerceCode2 = process.env.TRANSBANK_CHILD_COMMERCE_CODE_2;

  if (
    !["integration", "sandbox"].includes(environment ?? "")
    || mallCommerceCode !== IntegrationCommerceCodes.WEBPAY_PLUS_MALL
    || apiKey !== IntegrationApiKeys.WEBPAY
    || childCommerceCode1 !== IntegrationCommerceCodes.WEBPAY_PLUS_MALL_CHILD1
    || childCommerceCode2 !== IntegrationCommerceCodes.WEBPAY_PLUS_MALL_CHILD2
  ) {
    throw new Error("La configuración de Webpay debe usar exclusivamente las credenciales de integración de Transbank.");
  }
};

export const getTestChildCommerceCodes = () => [
  process.env.TRANSBANK_CHILD_COMMERCE_CODE_1!,
  process.env.TRANSBANK_CHILD_COMMERCE_CODE_2!,
];

export const createMallDetails = (details: readonly {
  amount: number;
  commerceCode: string;
  buyOrder: string;
}[]) => details.map((detail) => new TransactionDetail(
  detail.amount,
  detail.commerceCode,
  detail.buyOrder,
));

export const getPublicOrigin = (requestUrl: string) => {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredOrigin && process.env.NODE_ENV === "production") {
    throw new Error("Falta configurar NEXT_PUBLIC_SITE_URL para el retorno de Webpay.");
  }

  const url = new URL(configuredOrigin ?? requestUrl);
  if (
    !["http:", "https:"].includes(url.protocol)
    || url.username.length > 0
    || url.password.length > 0
    || (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("La URL pública configurada para Webpay no es válida.");
  }

  return url.origin;
};

export const isValidIntegrationRedirect = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).origin === Environment.Integration;
  } catch {
    return false;
  }
};
