type SquareMoney = {
  amount?: number;
  currency?: string;
};

type SquarePayment = {
  id?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  source_type?: string;
  order_id?: string;
  note?: string;
  receipt_number?: string;
  receipt_url?: string;
  buyer_email_address?: string;
  total_money?: SquareMoney;
  approved_money?: SquareMoney;
  tip_money?: SquareMoney;
  tax_money?: SquareMoney;
  processing_fee?: Array<{
    amount_money?: SquareMoney;
  }>;
};

type SquareLocation = {
  id?: string;
  name?: string;
  status?: string;
};

export type SquareBookkeepingTransaction = {
  transaction_date: string;
  type: "income";
  classification: "business";
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  source: "square";
  source_key: string;
  imported_from: string;
  gross_amount: number;
  net_amount: number;
  square_fee: number;
  sales_tax_collected: number | null;
  money_destination: string;
  receipt_status: string | null;
  receipt_location: string | null;
  notes: string | null;
  reviewed: false;
  raw_payload: SquarePayment;
};

export type SquareBookkeepingPull = {
  transactions: SquareBookkeepingTransaction[];
  locations: string[];
  warning: string | null;
};

const DEFAULT_API_VERSION = "2026-04-16";
const MAX_PAYMENT_PAGES = 250;

function squareApiBase() {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function centsToDollars(value?: number) {
  return Number(((value || 0) / 100).toFixed(2));
}

function requireSquareEnv() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!accessToken) throw new Error("Missing SQUARE_ACCESS_TOKEN.");

  return {
    accessToken,
    apiVersion: process.env.SQUARE_API_VERSION || DEFAULT_API_VERSION,
    fallbackLocationId: process.env.SQUARE_LOCATION_ID || "",
    bookkeepingLocationIds: (
      process.env.SQUARE_BOOKKEEPING_LOCATION_IDS ||
      process.env.SQUARE_BOOKKEEPING_LOCATION_ID ||
      ""
    )
      .split(",")
      .map((locationId) => locationId.trim())
      .filter(Boolean),
  };
}

export async function fetchSquareBookkeepingTransactions() {
  const { accessToken, apiVersion, fallbackLocationId, bookkeepingLocationIds } = requireSquareEnv();
  const { locationIds, warning } = await resolveLocationIds({
    accessToken,
    apiVersion,
    fallbackLocationId,
    bookkeepingLocationIds,
  });
  const imported: SquareBookkeepingTransaction[] = [];

  for (const locationId of locationIds) {
    imported.push(...(await fetchPaymentsForLocation({ accessToken, apiVersion, locationId })));
  }

  return { transactions: imported, locations: locationIds, warning };
}

async function resolveLocationIds({
  accessToken,
  apiVersion,
  fallbackLocationId,
  bookkeepingLocationIds,
}: {
  accessToken: string;
  apiVersion: string;
  fallbackLocationId: string;
  bookkeepingLocationIds: string[];
}) {
  if (bookkeepingLocationIds.length > 0) {
    return { locationIds: bookkeepingLocationIds, warning: null };
  }

  const response = await fetch(`${squareApiBase()}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": apiVersion,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    const locationIds = ((payload.locations || []) as SquareLocation[])
      .filter((location) => location.id && location.status !== "INACTIVE")
      .map((location) => location.id as string);

    if (locationIds.length > 0) return { locationIds, warning: null };
  }

  if (fallbackLocationId) {
    const detail = Array.isArray(payload?.errors)
      ? payload.errors.map((error: { detail?: string }) => error.detail).filter(Boolean).join(" ")
      : "";
    return {
      locationIds: [fallbackLocationId],
      warning:
        "Could not list all Square locations, so only SQUARE_LOCATION_ID was pulled. " +
        `${detail || "Add MERCHANT_PROFILE_READ permission or set SQUARE_BOOKKEEPING_LOCATION_IDS."}`,
    };
  }

  throw new Error("Could not find Square locations. Set SQUARE_BOOKKEEPING_LOCATION_IDS or SQUARE_LOCATION_ID.");
}

async function fetchPaymentsForLocation({
  accessToken,
  apiVersion,
  locationId,
}: {
  accessToken: string;
  apiVersion: string;
  locationId: string;
}) {
  const imported: SquareBookkeepingTransaction[] = [];
  let cursor: string | undefined;
  let page = 0;

  const beginTime = new Date("2026-01-01T00:00:00.000Z");
  const endTime = new Date();

  do {
    const params = new URLSearchParams({
      location_id: locationId,
      begin_time: beginTime.toISOString(),
      end_time: endTime.toISOString(),
      limit: "100",
      sort_order: "DESC",
    });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`${squareApiBase()}/v2/payments?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": apiVersion,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(payload?.errors)
        ? payload.errors.map((error: { detail?: string }) => error.detail).filter(Boolean).join(" ")
        : "";
      throw new Error(`Square payment pull failed: ${detail || response.statusText}`);
    }

    for (const payment of (payload.payments || []) as SquarePayment[]) {
      const mapped = mapSquarePayment(payment);
      if (mapped) imported.push(mapped);
    }

    cursor = payload.cursor;
    page += 1;
  } while (cursor && page < MAX_PAYMENT_PAGES);

  if (cursor) {
    throw new Error(
      `Square returned more than ${MAX_PAYMENT_PAGES * 100} payments for 2026. Narrow the import window before pulling more.`
    );
  }

  return imported;
}

function mapSquarePayment(payment: SquarePayment): SquareBookkeepingTransaction | null {
  if (!payment.id || !payment.created_at || payment.status !== "COMPLETED") return null;

  const grossAmount = centsToDollars(payment.total_money?.amount || payment.approved_money?.amount);
  if (grossAmount <= 0) return null;

  const squareFee = centsToDollars(
    payment.processing_fee?.reduce((total, fee) => total + (fee.amount_money?.amount || 0), 0)
  );
  const netAmount = Number((grossAmount - squareFee).toFixed(2));
  const taxAmount = payment.tax_money?.amount ? centsToDollars(payment.tax_money.amount) : null;
  const receiptParts = [payment.receipt_number, payment.receipt_url].filter(Boolean);

  return {
    transaction_date: payment.created_at.slice(0, 10),
    type: "income",
    classification: "business",
    category: "Sales",
    description: payment.note || `Square payment ${payment.id}`,
    amount: netAmount || grossAmount,
    payment_method: payment.source_type ? `Square ${payment.source_type}` : "Square",
    source: "square",
    source_key: `square-payment-${payment.id}`,
    imported_from: "Square Payments",
    gross_amount: grossAmount,
    net_amount: netAmount || grossAmount,
    square_fee: squareFee,
    sales_tax_collected: taxAmount,
    money_destination: "Square",
    receipt_status: receiptParts.length > 0 ? "available" : null,
    receipt_location: payment.receipt_url || null,
    notes: payment.buyer_email_address ? `Buyer email: ${payment.buyer_email_address}` : null,
    reviewed: false,
    raw_payload: payment,
  };
}
