import { createHash } from "crypto";

type CsvRow = Record<string, string>;

export type BankingCsvTransaction = {
  transaction_date: string;
  type: "income" | "expense";
  classification: "business";
  category: string | null;
  description: string;
  amount: number;
  payment_method: string;
  source: "square_banking_csv";
  source_key: string;
  imported_from: string;
  money_destination: "Square";
  notes: string | null;
  reviewed: false;
  raw_payload: CsvRow;
};

export type BankingCsvImport = {
  transactions: BankingCsvTransaction[];
  skippedOld: number;
  skippedInvalid: number;
  headers: string[];
};

export function parseSquareBankingCsv(csvText: string, fileName: string): BankingCsvImport {
  const rows = parseCsv(csvText);
  const headers = rows.headers;
  let skippedOld = 0;
  let skippedInvalid = 0;
  const transactions: BankingCsvTransaction[] = [];

  for (const row of rows.records) {
    const transactionDate = normalizeDate(
      pick(row, ["date", "transaction date", "posted date", "activity date", "created at"])
    );
    const signedAmount = extractSignedAmount(row);

    if (!transactionDate || signedAmount === null || signedAmount === 0) {
      skippedInvalid += 1;
      continue;
    }
    if (transactionDate < "2026-01-01") {
      skippedOld += 1;
      continue;
    }

    const description =
      pick(row, ["description", "details", "memo", "name", "activity", "transaction type"]) ||
      "Square banking activity";
    const notes = [
      pick(row, ["status"]),
      pick(row, ["source"]),
      pick(row, ["transfer type", "card", "last 4"]),
    ]
      .filter(Boolean)
      .join(" / ");

    transactions.push({
      transaction_date: transactionDate,
      type: signedAmount >= 0 ? "income" : "expense",
      classification: "business",
      category: null,
      description,
      amount: Math.abs(Number(signedAmount.toFixed(2))),
      payment_method: "Square Banking",
      source: "square_banking_csv",
      source_key: buildSourceKey(row, transactionDate, signedAmount, description),
      imported_from: fileName || "Square Banking CSV",
      money_destination: "Square",
      notes: notes || null,
      reviewed: false,
      raw_payload: row,
    });
  }

  return { transactions, skippedOld, skippedInvalid, headers };
}

function parseCsv(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  const headers = (rows.shift() || []).map((header) => header.trim());
  const normalizedHeaders = headers.map(normalizeHeader);
  const records = rows.map((cells) =>
    normalizedHeaders.reduce<CsvRow>((record, header, index) => {
      if (header) record[header] = (cells[index] || "").trim();
      return record;
    }, {})
  );

  return { headers, records };
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pick(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value) return value.trim();
  }
  return "";
}

function extractSignedAmount(row: CsvRow) {
  const amount = parseMoney(pick(row, ["amount", "net amount", "total", "transaction amount"]));
  if (amount !== null) return amount;

  const credit = parseMoney(pick(row, ["credit", "money in", "inflow", "deposit"]));
  const debit = parseMoney(pick(row, ["debit", "money out", "outflow", "withdrawal"]));
  if (credit !== null || debit !== null) return (credit || 0) - (debit || 0);

  return null;
}

function parseMoney(value: string) {
  if (!value) return null;
  const isParenthesesNegative = value.includes("(") && value.includes(")");
  const parsed = Number(value.replace(/[$,\s()]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return isParenthesesNegative ? -Math.abs(parsed) : parsed;
}

function normalizeDate(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function buildSourceKey(row: CsvRow, date: string, amount: number, description: string) {
  const rawId = pick(row, ["id", "transaction id", "activity id", "reference id"]);
  if (rawId) return `square-banking-csv-${rawId}`;

  const hash = createHash("sha256")
    .update(JSON.stringify({ date, amount, description, row }))
    .digest("hex")
    .slice(0, 32);
  return `square-banking-csv-${hash}`;
}
