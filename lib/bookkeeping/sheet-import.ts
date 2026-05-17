export type SheetTransaction = {
  transaction_date: string | null;
  type: "income" | "expense" | "equity" | "tax" | "mileage" | "transfer";
  classification: "business" | "owner_contribution" | "owner_draw" | "sales_tax" | "ignore";
  category: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  source: string;
  source_key: string;
  imported_from: string;
  customer_name?: string | null;
  product_name?: string | null;
  gross_amount?: number | null;
  net_amount?: number | null;
  square_fee?: number | null;
  sales_tax_collected?: number | null;
  sales_tax_expected?: number | null;
  money_destination?: string | null;
  state?: string | null;
  should_collect_sales_tax?: boolean | null;
  mileage?: number | null;
  mileage_deduction?: number | null;
  receipt_status?: string | null;
  receipt_location?: string | null;
  notes?: string | null;
  raw_payload: Record<string, string>;
  reviewed: boolean;
};

const SHEET_ID = "1nk_qCZqhE7HGH7V5XpsrkZN5R5tXnE8L1zi5eCxDmwc";

function sheetCsvUrl(sheetName: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  const headers = rows[0] || [];
  return rows.slice(1).map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), values[index]?.trim() || ""])
    ) as Record<string, string>
  );
}

function money(value: string | null | undefined) {
  const cleaned = String(value || "").replace(/[$,]/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: string | null | undefined) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function dateValue(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function boolYes(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  return ["yes", "y", "true", "1"].includes(raw);
}

function hasAnyValue(row: Record<string, string>) {
  return Object.values(row).some((value) => value.trim());
}

function expenseRowToTransaction(row: Record<string, string>, index: number): SheetTransaction | null {
  if (!hasAnyValue(row)) return null;

  const expense = money(row.Expense);
  const ownerContribution = money(row["Owner Contribution"]);
  const mileage = money(row.Mileage);
  const mileageDeduction = money(row["Mileage Deduction ($)"]);
  const category = text(row.Category);
  const description = text(row.Description);

  if (!expense && !ownerContribution && !mileageDeduction && !mileage) return null;

  if (ownerContribution > 0) {
    return {
      transaction_date: dateValue(row.Date),
      type: "equity",
      classification: "owner_contribution",
      category: category || "Owner Contribution to business account",
      description: description || "Owner contribution",
      amount: ownerContribution,
      payment_method: text(row["Payment Method"]),
      source: "google_sheet",
      source_key: `google-expenses-${index}`,
      imported_from: "Expenses",
      notes: text(row.Notes),
      raw_payload: row,
      reviewed: true,
    };
  }

  if (mileageDeduction > 0 || mileage > 0) {
    return {
      transaction_date: dateValue(row.Date),
      type: "mileage",
      classification: "business",
      category: category || "Travel & Meals",
      description: description || "Mileage deduction",
      amount: mileageDeduction,
      payment_method: text(row["Payment Method"]),
      source: "google_sheet",
      source_key: `google-expenses-${index}`,
      imported_from: "Expenses",
      mileage,
      mileage_deduction: mileageDeduction,
      notes: text(row.Notes),
      raw_payload: row,
      reviewed: true,
    };
  }

  return {
    transaction_date: dateValue(row.Date),
    type: "expense",
    classification: "business",
    category,
    description,
    amount: expense,
    payment_method: text(row["Payment Method"]),
    source: "google_sheet",
    source_key: `google-expenses-${index}`,
    imported_from: "Expenses",
    receipt_status: text(row["receipt?"]),
    receipt_location: text(row["location of receipt"]),
    notes: text(row.Notes),
    raw_payload: row,
    reviewed: true,
  };
}

function salesRowToTransaction(row: Record<string, string>, index: number): SheetTransaction | null {
  if (!hasAnyValue(row)) return null;

  const netAmount = money(row["actual recieved"]);
  const grossAmount = money(row["Sale Price"]);

  if (!netAmount && !grossAmount) return null;

  return {
    transaction_date: dateValue(row.Date),
    type: "income",
    classification: "business",
    category: "Sales",
    description: text(row["Product Name"]) || "Sale",
    amount: netAmount || grossAmount,
    payment_method: text(row["Money went to"]),
    source: "google_sheet",
    source_key: `google-sales-${index}`,
    imported_from: "Sales",
    customer_name: text(row["Customer name"]),
    product_name: text(row["Product Name"]),
    gross_amount: grossAmount,
    net_amount: netAmount,
    square_fee: money(row["square fee"]),
    sales_tax_collected: money(row["sales tax collected"]),
    sales_tax_expected: money(row["Sales tax"]),
    money_destination: text(row["Money went to"]),
    state: text(row.state),
    should_collect_sales_tax: boolYes(row["should sales tax have been collected"]),
    notes: text(row.Notes),
    raw_payload: row,
    reviewed: true,
  };
}

async function fetchSheetRows(sheetName: string) {
  const response = await fetch(sheetCsvUrl(sheetName), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Google Sheet export failed for ${sheetName}: ${response.status}`);
  }
  return parseCsv(await response.text());
}

export async function fetchCurrentBookkeepingSheetTransactions() {
  const [expenseRows, salesRows] = await Promise.all([
    fetchSheetRows("Expenses"),
    fetchSheetRows("Sales"),
  ]);

  return [
    ...expenseRows.map(expenseRowToTransaction),
    ...salesRows.map(salesRowToTransaction),
  ].filter(Boolean) as SheetTransaction[];
}
