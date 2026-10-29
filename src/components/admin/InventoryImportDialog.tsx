import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useValidateInventoryImport, useApplyInventoryImport } from "@/lib/queries/inventory";
import {
  parseImportFile,
  downloadInventoryTemplate,
  downloadImportErrorReport,
  isAcceptedImportFile,
  isLegacyXls,
  isWithinImportSizeLimit,
  MAX_IMPORT_FILE_MB,
  type TemplateVariant,
} from "@/lib/inventory-import-file";
import type { ImportMode, ImportRowPreview, ImportUnit } from "@/lib/actions/inventory";

type Step = "mode" | "upload" | "preview" | "summary";

// "6 per box · 10% off" / "not sold by the box"
const boxLabel = (size: number | null, discount: number) =>
  size ? `${size} per box${discount > 0 ? ` · ${discount}% off` : ""}` : "not sold by the box";

export function InventoryImportDialog({
  open,
  onOpenChange,
  variants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: TemplateVariant[];
}) {
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<ImportMode>("replace");
  // What the stock column counts. Boxes use each product's bottles-per-box setting.
  const [unit, setUnit] = useState<ImportUnit>("bottles");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportRowPreview[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState<{ rowsUpdated: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = useValidateInventoryImport();
  const apply = useApplyInventoryImport();

  const skuCount = variants.filter((v) => !!v.sku).length;

  const resetAll = () => {
    setStep("mode");
    setFileName(null);
    setPreview(null);
    setParseError(null);
    setSummary(null);
  };

  const resetUpload = () => {
    setFileName(null);
    setPreview(null);
    setParseError(null);
    setStep("upload");
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(resetAll, 200); // after the close animation
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    if (isLegacyXls(file)) {
      setParseError(
        'Old-style .xls isn\'t supported — open it in Excel/Sheets and "Save As" .xlsx or .csv, then upload that.',
      );
      return;
    }
    if (!isAcceptedImportFile(file)) {
      setParseError("Only .xlsx or .csv files are accepted.");
      return;
    }
    if (!isWithinImportSizeLimit(file)) {
      setParseError(`That file is larger than the ${MAX_IMPORT_FILE_MB}MB limit.`);
      return;
    }
    setFileName(file.name);
    const { rows, error } = await parseImportFile(file, mode, unit);
    if (error) {
      setParseError(error);
      return;
    }
    validate.mutate(
      { mode, unit, rows },
      {
        onSuccess: (result) => {
          setPreview(result.rows);
          setStep("preview");
        },
        onError: () => setParseError("Could not validate the file — please try again."),
      },
    );
  };

  const validRows = (preview ?? []).filter(
    (r): r is ImportRowPreview & { variantId: string } => r.status === "valid" && !!r.variantId,
  );
  const errorRows = (preview ?? []).filter((r) => r.status === "error");

  const handleConfirm = () => {
    apply.mutate(
      {
        mode,
        rows: validRows.map((r) => ({
          variantId: r.variantId,
          value: r.applyValue,
          skipStock: r.skipStock,
          boxSize: r.boxSizeToApply,
          boxDiscount: r.boxDiscountToApply,
        })),
        filename: fileName ?? undefined,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setSummary({ rowsUpdated: result.rowsUpdated });
          setStep("summary");
        },
        onError: () => toast.error("Could not complete the import. Nothing was changed."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Import Inventory</DialogTitle>
          <DialogDescription>
            {step === "mode" && "Choose how the spreadsheet values should be applied and counted."}
            {step === "upload" && `Upload a .xlsx or .csv file — matched by SKU.`}
            {step === "preview" && "Review before anything is changed."}
            {step === "summary" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "mode" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("replace")}
              className={`w-full text-left rounded-xl p-4 border-2 transition ${
                mode === "replace" ? "border-primary bg-primary/5" : "border-border bg-surface-2/40"
              }`}
            >
              <p className="font-bold text-sm">Replace stock</p>
              <p className="text-xs text-muted-foreground mt-1">
                The spreadsheet's "New Stock" figure becomes the exact new stock for each SKU. Use
                this after a physical stock count.
              </p>
            </button>
            <button
              onClick={() => setMode("adjust")}
              className={`w-full text-left rounded-xl p-4 border-2 transition ${
                mode === "adjust" ? "border-primary bg-primary/5" : "border-border bg-surface-2/40"
              }`}
            >
              <p className="font-bold text-sm">Adjust stock</p>
              <p className="text-xs text-muted-foreground mt-1">
                The spreadsheet's "Adjustment" figure is added to (or, if negative, subtracted from)
                whatever the current stock is. Use this for a new shipment or a correction.
              </p>
            </button>

            <div>
              <p className="text-xs font-bold mb-2">Count the stock figure in</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Count stock in">
                {(
                  [
                    { id: "bottles", title: "Bottles", hint: "Single bottles" },
                    { id: "boxes", title: "Boxes", hint: "× each product's bottles per box" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    role="radio"
                    aria-checked={unit === o.id}
                    onClick={() => setUnit(o.id)}
                    className={`rounded-xl border-2 p-3 text-left transition ${
                      unit === o.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface-2/40"
                    }`}
                  >
                    <p className="text-sm font-bold">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{o.hint}</p>
                  </button>
                ))}
              </div>
              {unit === "boxes" && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Stock is always stored in bottles. A product must have a box size (set on the
                  Products page, or via the Bottles per Box column in your file) to be counted in
                  boxes.
                </p>
              )}
            </div>

            <button
              onClick={() => downloadInventoryTemplate(variants, mode, unit)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-surface-2 px-4 py-2.5 text-xs font-bold hover:bg-surface-2/70"
            >
              <Download className="h-3.5 w-3.5" />
              Download {mode === "replace" ? "Replace" : "Adjust"} template — {unit} ({skuCount} SKU
              {skuCount === 1 ? "" : "s"})
            </button>
            {skuCount < variants.length && (
              <p className="text-[11px] text-muted-foreground text-center">
                {variants.length - skuCount} bottle size
                {variants.length - skuCount === 1 ? "" : "s"} without a SKU{" "}
                {variants.length - skuCount === 1 ? "isn't" : "aren't"} included — add one on the
                Products page to bring it into imports.
              </p>
            )}

            <DialogFooter>
              <button
                onClick={() => setStep("upload")}
                className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold w-full"
              >
                Continue
              </button>
            </DialogFooter>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
              }}
              className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-surface-2/40"
              }`}
            >
              {validate.isPending ? (
                <p className="text-sm text-muted-foreground">Validating {fileName}…</p>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">
                    Drag a file here, or click to choose one
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    .xlsx or .csv — max {MAX_IMPORT_FILE_MB}MB
                  </p>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Counting stock in <strong>{unit}</strong>. Optional columns:{" "}
              <strong>Bottles per Box</strong> (2–48, or 0 to stop selling by the box) and{" "}
              <strong>Box Discount %</strong> (10 = ten percent). They apply to the whole product,
              so use the same value on every size. Leave a cell blank to keep it as it is — a blank
              stock cell never sets stock to zero.
            </p>
            {parseError && (
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {parseError}
              </p>
            )}
            <button
              onClick={() => setStep("mode")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs">
              <span className="font-bold capitalize">{mode} mode</span> —{" "}
              {mode === "replace"
                ? "matched rows will be set to exactly the values shown below."
                : "matched rows will have the shown change applied to whatever their stock is at the moment you confirm."}
            </div>

            <div className="flex gap-4 text-xs">
              <span className="inline-flex items-center gap-1 text-primary font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> {validRows.length} valid
              </span>
              {errorRows.length > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive font-bold">
                  <AlertCircle className="h-3.5 w-3.5" /> {errorRows.length} error
                  {errorRows.length === 1 ? "" : "s"}
                </span>
              )}
              {validRows.some((r) => r.boxChanged) && (
                <span className="inline-flex items-center gap-1 font-bold">
                  {validRows.filter((r) => r.boxChanged).length} with box setting changes
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="text-left uppercase tracking-wider text-muted-foreground bg-surface-2/60 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Stock (bottles)</th>
                    <th className="px-3 py-2">Box</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-3 py-2 font-mono">{r.sku || "—"}</td>
                      <td className="px-3 py-2">
                        {r.productName ? (
                          <>
                            {r.productName} <span className="text-muted-foreground">{r.size}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "valid" ? (
                          <span
                            className={r.change === 0 ? "text-muted-foreground" : "font-semibold"}
                          >
                            {r.currentStock} → {r.newStock}{" "}
                            {r.change !== 0 && (
                              <span className={r.change! > 0 ? "text-primary" : "text-destructive"}>
                                ({r.change! > 0 ? "+" : ""}
                                {r.change})
                              </span>
                            )}
                            {r.stockNote && (
                              <span className="block text-[10px] font-normal text-muted-foreground">
                                {r.stockNote}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.variantId ? (
                          r.boxChanged ? (
                            <span className="font-semibold">
                              <span className="text-muted-foreground">
                                {boxLabel(r.currentBoxSize, r.currentBoxDiscount)}
                              </span>{" "}
                              → {boxLabel(r.newBoxSize, r.newBoxDiscount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {boxLabel(r.newBoxSize, r.newBoxDiscount)}
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "valid" ? (
                          <span className="text-primary">{r.message ?? "Valid"}</span>
                        ) : (
                          <span className="text-destructive">{r.message}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={resetUpload}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Choose a different file
              </button>
              {errorRows.length > 0 && (
                <button
                  onClick={() => downloadImportErrorReport(errorRows)}
                  className="text-xs font-bold text-destructive hover:underline"
                >
                  Download error report
                </button>
              )}
            </div>

            <DialogFooter>
              <button
                onClick={handleConfirm}
                disabled={validRows.length === 0 || apply.isPending}
                className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold w-full disabled:opacity-50"
              >
                {apply.isPending
                  ? "Applying…"
                  : `Confirm — apply ${validRows.length} change${validRows.length === 1 ? "" : "s"}`}
              </button>
            </DialogFooter>
          </div>
        )}

        {step === "summary" && summary && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <div>
              <p className="font-display font-bold text-lg">Inventory updated</p>
              <p className="text-sm text-muted-foreground mt-1">
                {summary.rowsUpdated} variant{summary.rowsUpdated === 1 ? "" : "s"} changed
                {errorRows.length > 0 &&
                  ` · ${errorRows.length} row${errorRows.length === 1 ? "" : "s"} skipped`}
                . Logged to inventory history.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={resetUpload}
                className="rounded-full bg-surface-2 px-4 py-2 text-xs font-bold"
              >
                Import another file
              </button>
              <button
                onClick={() => handleClose(false)}
                className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-bold"
              >
                <FileSpreadsheet className="h-3 w-3 inline mr-1" /> Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
