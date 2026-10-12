/// <reference lib="webworker" />
import * as XLSX from "xlsx";

// Large workbooks freeze the page if parsed/rendered in full on the main thread.
// Parse here, and render only a capped window of each sheet.
const MAX_ROWS = 1500;
const MAX_COLS = 60;

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    const wb = XLSX.read(e.data, {
      type: "array",
      dense: true,
      sheetRows: MAX_ROWS,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      cellDates: false,
      bookVBA: false,
    });
    const sheets = wb.SheetNames.map((name) => {
      const ws = wb.Sheets[name];
      const full = ws["!fullref"] || ws["!ref"];
      let truncated = false;
      let totalRows = 0;
      let totalCols = 0;
      if (full) {
        const fr = XLSX.utils.decode_range(full);
        totalRows = fr.e.r - fr.s.r + 1;
        totalCols = fr.e.c - fr.s.c + 1;
      }
      if (ws["!ref"]) {
        const r = XLSX.utils.decode_range(ws["!ref"]);
        if (r.e.c - r.s.c + 1 > MAX_COLS) { r.e.c = r.s.c + MAX_COLS - 1; truncated = true; }
        ws["!ref"] = XLSX.utils.encode_range(r);
      }
      if (totalRows > MAX_ROWS) truncated = true;
      const html = ws["!ref"] ? XLSX.utils.sheet_to_html(ws, { header: "", footer: "" }) : "<p>This sheet is empty.</p>";
      return { name, html, truncated, totalRows, totalCols };
    });
    (self as unknown as Worker).postMessage({ ok: true, sheets, maxRows: MAX_ROWS, maxCols: MAX_COLS });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
