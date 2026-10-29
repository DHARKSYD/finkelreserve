import type ExcelJSNS from "exceljs";
import type { ImportMode, ImportUnit } from "@/lib/actions/inventory";
import type { ImportCell } from "@/lib/inventory-import-plan";
import { boxesAndLoose } from "@/lib/box";

// exceljs + papaparse are dynamically imported inside the functions below
// rather than statically at the top of the file — checking stock levels
// (the common reason to open the Inventory page) shouldn't cost downloading
// a ~1MB spreadsheet library; only actually opening the import dialog or
// clicking "Download Template" should pull it in.

// .xls (legacy binary Excel, pre-2007) is deliberately not supported: the
// only npm-published parser for it (`xlsx`) has two unpatched high-severity
// advisories — prototype pollution and ReDoS — in exactly the code path
// this feature would exercise (reading an untrusted uploaded file), and the
// fixed build is only distributed from SheetJS's own CDN, not npm. Given
// how rare a genuinely legacy .xls file is in 2026, dropping it is a better
// trade than shipping that dependency. Anyone with an old .xls can re-save
// it as .xlsx or .csv from Excel/Sheets/Numbers in a few seconds.
export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".csv"];
export const MAX_IMPORT_FILE_MB = 5;

export function isAcceptedImportFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isLegacyXls(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xls");
}

export function isWithinImportSizeLimit(file: File): boolean {
  return file.size <= MAX_IMPORT_FILE_MB * 1024 * 1024;
}

// Raw cell values — the SERVER (inventory-import-plan.ts) parses and validates them, so a blank
// cell can mean "leave this alone" rather than being turned into 0 here.
export type ParsedImportRow = {
  sku: string;
  value: ImportCell; // "New Stock" / "Adjustment" — in the unit the admin chose
  boxSize: ImportCell; // optional "Bottles per Box" column
  boxDiscount: ImportCell; // optional "Box Discount %" column
};

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");

type Candidate = { name: string; unit?: ImportUnit };
type FoundColumn = { header: string; unit: ImportUnit | null };

function findColumn(headers: string[], candidates: Candidate[]): FoundColumn | null {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.name);
    if (idx !== -1) return { header: headers[idx], unit: candidate.unit ?? null };
  }
  return null;
}

// Header names. The stock column may say which unit it counts in (that's what the template
// writes) — if it does, it must agree with the unit chosen in the dialog; the older plain
// "New Stock" / "Adjustment (+/-)" headers still work and simply take the chosen unit.
const STOCK_COLUMNS: Record<ImportMode, Candidate[]> = {
  replace: [
    { name: "new stock (bottles)", unit: "bottles" },
    { name: "new stock (boxes)", unit: "boxes" },
    { name: "new stock" },
    { name: "newstock" },
    { name: "stock" },
  ],
  adjust: [
    { name: "adjustment (bottles, +/-)", unit: "bottles" },
    { name: "adjustment (boxes, +/-)", unit: "boxes" },
    { name: "adjustment (+/-)" },
    { name: "adjustment(+/-)" },
    { name: "adjustment" },
    { name: "stock" },
  ],
};
const BOX_SIZE_COLUMNS: Candidate[] = [
  { name: "bottles per box" },
  { name: "box size" },
  { name: "bottles/box" },
];
const BOX_DISCOUNT_COLUMNS: Candidate[] = [
  { name: "box discount %" },
  { name: "box discount (%)" },
  { name: "box discount" },
];

// A blank cell stays null (= leave alone); numbers pass through; everything else is trimmed text
// for the server to judge.
function cellValue(raw: unknown): ImportCell {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  return text === "" ? null : text;
}

// ExcelJS cell values can be a primitive, a Date, or a rich object
// ({ formula, result }, { richText }, hyperlink, …) — this feature only
// expects plain text/number cells, so anything else is reduced to a string
// rather than passed through, which keeps downstream parsing simple.
function cellToPrimitive(value: ExcelJSNS.CellValue): string | number {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "");
  if (typeof value === "object" && "richText" in value) {
    return (value.richText as { text: string }[]).map((r) => r.text).join("");
  }
  return String(value);
}

async function readSheetAsRows(file: File): Promise<Record<string, unknown>[]> {
  const { default: ExcelJS } = await import("exceljs");
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cellToPrimitive(cell.value)).trim();
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const value = cellToPrimitive(cell.value);
      obj[key] = value;
      if (value !== "") hasValue = true;
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
}

async function readCsvAsRows(file: File): Promise<Record<string, unknown>[]> {
  const { default: Papa } = await import("papaparse");
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err: unknown) =>
        reject(err instanceof Error ? err : new Error("Could not parse CSV.")),
    });
  });
}

// Reads cell/field values only — never evaluates formulas — so a malicious
// upload can't get code execution out of this step (see "IMPORT SECURITY").
// This is the fast, client-side pass for preview UX; validateInventoryImport
// re-checks everything server-side before anything is treated as
// trustworthy.
export async function parseImportFile(
  file: File,
  mode: ImportMode,
  unit: ImportUnit,
): Promise<{ rows: ParsedImportRow[]; error: string | null }> {
  let json: Record<string, unknown>[];
  try {
    json = file.name.toLowerCase().endsWith(".csv")
      ? await readCsvAsRows(file)
      : await readSheetAsRows(file);
  } catch {
    return { rows: [], error: "Could not read that file — make sure it's a valid .xlsx or .csv." };
  }

  if (json.length === 0) return { rows: [], error: "The file has no data rows." };

  const headers = Object.keys(json[0]);
  const sku = findColumn(headers, [{ name: "sku" }]);
  const stock = findColumn(headers, STOCK_COLUMNS[mode]);
  const boxSize = findColumn(headers, BOX_SIZE_COLUMNS);
  const boxDiscount = findColumn(headers, BOX_DISCOUNT_COLUMNS);

  if (!sku) return { rows: [], error: 'Could not find a "SKU" column in this file.' };

  // The stock column is optional only if the file carries box settings — that lets one file
  // update bottles-per-box / discount without touching stock.
  if (!stock && !boxSize && !boxDiscount) {
    return {
      rows: [],
      error:
        mode === "replace"
          ? 'Could not find a "New Stock" column in this file.'
          : 'Could not find an "Adjustment" column in this file.',
    };
  }

  if (stock?.unit && stock.unit !== unit) {
    return {
      rows: [],
      error: `This file's stock column counts ${stock.unit}, but you chose to count in ${unit}. Go back and switch the unit, or download a fresh template.`,
    };
  }

  const rows: ParsedImportRow[] = json.map((r) => ({
    sku: String(r[sku.header] ?? "").trim(),
    value: stock ? cellValue(r[stock.header]) : null,
    boxSize: boxSize ? cellValue(r[boxSize.header]) : null,
    boxDiscount: boxDiscount ? cellValue(r[boxDiscount.header]) : null,
  }));

  return { rows, error: null };
}

// ─── Downloads (template + error report) ────────────────────────────────

async function downloadWorkbook(workbook: ExcelJSNS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type TemplateVariant = {
  sku: string | null;
  productName: string;
  size: string;
  stock: number; // bottles
  bottlesPerBox: number | null; // the product's box size, if sold by the box
  boxDiscountPercent: number;
};

// Mode- and unit-aware on purpose: Replace and Adjust mean different things for the same
// column, and bottles vs boxes change what the number is, so the header always names what the
// system will actually do with the value rather than one column trying to serve everything.
//
// The first sheet is the data (the only one the importer reads). Blank cells mean "leave alone".
export async function downloadInventoryTemplate(
  variants: TemplateVariant[],
  mode: ImportMode,
  unit: ImportUnit,
) {
  const { default: ExcelJS } = await import("exceljs");
  const withSku = variants.filter((v) => !!v.sku);
  const valueHeader = mode === "replace" ? `New Stock (${unit})` : `Adjustment (${unit}, +/-)`;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventory");
  sheet.columns = [
    { header: "SKU", key: "sku", width: 16 },
    { header: "Product", key: "product", width: 28 },
    { header: "Bottle Size", key: "size", width: 12 },
    { header: "Current Stock (bottles)", key: "current", width: 22 },
    { header: "Current Boxes", key: "boxes", width: 18 },
    { header: "Bottles per Box", key: "boxSize", width: 16 },
    { header: "Box Discount %", key: "boxDiscount", width: 16 },
    { header: valueHeader, key: "value", width: 24 },
  ];
  for (const v of withSku) {
    // Replace: start from the current figure so an untouched row is a no-op. In boxes that is only
    // possible when stock is a whole number of boxes; otherwise leave it blank (= unchanged)
    // rather than round away loose bottles.
    const boxes =
      v.bottlesPerBox && v.stock % v.bottlesPerBox === 0 ? v.stock / v.bottlesPerBox : "";
    const replaceValue = unit === "bottles" ? v.stock : boxes;
    sheet.addRow({
      sku: v.sku,
      product: v.productName,
      size: v.size,
      current: v.stock,
      boxes: v.bottlesPerBox ? boxesAndLoose(v.stock, v.bottlesPerBox) : "not sold by the box",
      boxSize: v.bottlesPerBox ?? "",
      boxDiscount: v.bottlesPerBox ? v.boxDiscountPercent : "",
      value: mode === "replace" ? replaceValue : 0,
    });
  }
  sheet.getRow(1).font = { bold: true };

  const help = workbook.addWorksheet("How to use");
  help.getColumn(1).width = 100;
  [
    "Edit the last three columns on the Inventory sheet, save, and upload it. Only the Inventory sheet is read.",
    `Stock column: "${valueHeader}" is counted in ${unit}${
      unit === "boxes"
        ? " — each box is the product's Bottles per Box (you can change that in the same row)"
        : ""
    }. ${mode === "replace" ? "It becomes the exact new stock." : "It is added to (or, if negative, taken from) current stock."}`,
    "Bottles per Box: how many bottles one box holds (2–48, usually 6). Enter 0 to stop selling the product by the box. It applies to the whole product, so use the same value on every size of it.",
    "Box Discount %: percent off the price of those bottles when a customer buys a box. Enter 10 for ten percent (not 0.1). 0 = no discount.",
    "Leave a cell blank to leave that value as it is — a blank stock cell never sets stock to zero.",
    "Current Stock, Current Boxes, Product and Bottle Size are for reference and are ignored on upload; rows are matched by SKU.",
  ].forEach((line) => help.addRow([line]));
  help.eachRow((row) => (row.alignment = { wrapText: true, vertical: "top" }));

  await downloadWorkbook(workbook, `inventory-${mode}-${unit}-template.xlsx`);
}

export async function downloadImportErrorReport(
  errorRows: { sku: string; message: string | null }[],
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Errors");
  sheet.columns = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Error", key: "error", width: 50 },
  ];
  for (const r of errorRows) sheet.addRow({ sku: r.sku, error: r.message ?? "" });
  sheet.getRow(1).font = { bold: true };

  await downloadWorkbook(workbook, "inventory-import-errors.xlsx");
}
