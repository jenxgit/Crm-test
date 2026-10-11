import { useEffect, useRef } from "react";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { parseGrid } from "./NotesGrid";

// Spreadsheet-style notes (prototype). Stored in the tour's notes field as
// { v: 2, sheets: [{ name, celldata, config, ... }] }. The older simple grid is converted into the
// first sheet the first time, colours included.

const ROWS = 40;
const COLS = 14;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySheet = any;

function initialSheets(raw: string | null): AnySheet[] {
  try {
    const parsed = JSON.parse(raw ?? "");
    if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) return parsed.sheets;
  } catch {
    // not the spreadsheet format; convert the simple grid below
  }
  const celldata: AnySheet[] = [];
  parseGrid(raw).forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell.t && !cell.bg && !cell.fg) return;
      celldata.push({
        r,
        c,
        v: { v: cell.t, m: cell.t, ct: { fa: "General", t: "g" }, ...(cell.bg ? { bg: cell.bg } : {}), ...(cell.fg ? { fc: cell.fg } : {}) },
      });
    }),
  );
  return [{ name: "Notes", id: "notes", order: 0, status: 1, row: ROWS, column: COLS, celldata, config: {} }];
}

export default function NotesSheet({ raw, onSave }: { raw: string | null; onSave: (json: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const initial = useRef<AnySheet[] | null>(null);
  if (initial.current === null) initial.current = initialSheets(raw);

  // Saves are debounced so a burst of edits becomes one request, and flushed when leaving.
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const lastSent = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = () => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next !== null && next !== lastSent.current) {
      lastSent.current = next;
      onSaveRef.current(next);
    }
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: 560, width: "100%", position: "relative" }}>
      <Workbook
        ref={ref}
        data={initial.current}
        onChange={(sheets: AnySheet[]) => {
          const out = sheets.map((s) => ({
            name: s.name,
            id: s.id,
            order: s.order,
            status: s.status,
            row: s.row,
            column: s.column,
            config: s.config,
            celldata: ref.current && s.data ? ref.current.dataToCelldata(s.data) : (s.celldata ?? []),
          }));
          pending.current = JSON.stringify({ v: 2, sheets: out });
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 1000);
        }}
      />
    </div>
  );
}
