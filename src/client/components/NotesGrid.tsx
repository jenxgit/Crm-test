import { useLayoutEffect, useRef, useState } from "react";

// A small excel-like grid for tour notes, stored as JSON (array of rows of cells).
// A cell is its text plus an optional fill (bg) and text colour (fg).
export type NoteCell = { t: string; bg?: string; fg?: string };
export type NotesGridValue = NoteCell[][];

const DEFAULT_ROWS = 4;
const DEFAULT_COLS = 3;

const blank = (): NoteCell => ({ t: "" });

// Small set of primary colours: a fill and a text colour per cell.
const FILLS = [
  { name: "Yellow", value: "#FFE94D" },
  { name: "Red", value: "#F4877F" },
  { name: "Blue", value: "#8CC4F5" },
  { name: "Green", value: "#8FD694" },
];
const TEXTS = [
  { name: "Red", value: "#D32F2F" },
  { name: "Blue", value: "#1565C0" },
  { name: "Green", value: "#2E7D32" },
];

export function emptyGrid(): NotesGridValue {
  return Array.from({ length: DEFAULT_ROWS }, () => Array.from({ length: DEFAULT_COLS }, blank));
}

// Accepts the original format (rows of plain strings) as well as rows of cell objects.
export function parseGrid(raw: string | null): NotesGridValue {
  if (!raw) return emptyGrid();
  try {
    const g = JSON.parse(raw);
    // Spreadsheet format ({ sheets: [...] }): show its first sheet's text and colours here, so
    // switching back to this simple grid never looks like the notes vanished.
    if (g && !Array.isArray(g) && Array.isArray(g.sheets) && g.sheets.length > 0) {
      const cells: { r: number; c: number; v: { v?: unknown; m?: unknown; bg?: string; fc?: string } | null }[] =
        g.sheets[0].celldata ?? [];
      const rows = Math.max(DEFAULT_ROWS, ...cells.map((x) => x.r + 1));
      const colsN = Math.max(DEFAULT_COLS, ...cells.map((x) => x.c + 1));
      const grid: NotesGridValue = Array.from({ length: rows }, () => Array.from({ length: colsN }, blank));
      for (const x of cells) {
        if (!x.v) continue;
        grid[x.r][x.c] = { t: String(x.v.m ?? x.v.v ?? ""), bg: x.v.bg, fg: x.v.fc };
      }
      return grid;
    }
    if (Array.isArray(g) && g.length > 0 && g.every((row) => Array.isArray(row))) {
      return g.map((row: unknown[]) =>
        row.map((c) => {
          if (typeof c === "string") return { t: c };
          const o = (c ?? {}) as Partial<NoteCell>;
          return { t: typeof o.t === "string" ? o.t : "", bg: o.bg, fg: o.fg };
        }),
      );
    }
  } catch {
    // fall through to default
  }
  return emptyGrid();
}

// Wraps long text instead of scrolling it sideways, growing to fit.
function CellInput({
  cell,
  onText,
  onFocus,
  onPaste,
  onCommit,
}: {
  cell: NoteCell;
  onText: (t: string) => void;
  onFocus: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onCommit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [cell.t]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={cell.t}
      onChange={(e) => onText(e.target.value)}
      onFocus={onFocus}
      onPaste={onPaste}
      onBlur={onCommit}
      onKeyDown={(e) => {
        // Enter finishes the cell, like a spreadsheet; Shift+Enter adds a line break.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        border: "none",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        padding: "6px 8px",
        font: "inherit",
        fontSize: 13,
        lineHeight: 1.35,
        background: "transparent",
        color: cell.fg ?? "inherit",
      }}
    />
  );
}

export default function NotesGrid({
  value,
  onChange,
  onCommit,
}: {
  value: NotesGridValue;
  onChange: (v: NotesGridValue) => void;
  // Called with the new grid when a change should be saved straight away, or with no
  // argument after typing finishes (the parent then saves its current grid).
  onCommit: (next?: NotesGridValue) => void;
}) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [wholeRow, setWholeRow] = useState(false);

  const cols = Math.max(1, ...value.map((row) => row.length));
  // Rows can end up ragged; read through this so a short row never breaks the grid.
  const at = (r: number, c: number): NoteCell => value[r]?.[c] ?? blank();

  const apply = (next: NotesGridValue) => {
    onChange(next);
    onCommit(next);
  };

  const setText = (r: number, c: number, t: string) => {
    const next = value.map((row) => row.map((cell) => ({ ...cell })));
    while (next[r].length <= c) next[r].push(blank());
    next[r][c].t = t;
    onChange(next);
  };

  const addRow = () => apply([...value, Array.from({ length: cols }, blank)]);
  const addCol = () => apply(value.map((row) => [...row, blank()]));
  const deleteRow = (r: number) => apply(value.length > 1 ? value.filter((_, i) => i !== r) : [Array.from({ length: cols }, blank)]);
  const deleteCol = (c: number) =>
    apply(cols > 1 ? value.map((row) => row.filter((_, i) => i !== c)) : value.map(() => [blank()]));

  // Set or clear a colour on the focused cell (or its whole row).
  const colour = (key: "bg" | "fg", v: string | undefined) => {
    if (!active) return;
    apply(
      value.map((row, r) =>
        row.map((cell, c) => {
          if (r !== active.r || (!wholeRow && c !== active.c)) return cell;
          const out = { ...cell };
          if (v) out[key] = v;
          else delete out[key];
          return out;
        }),
      ),
    );
  };

  // Pasting a copied Excel range fills cells from the focused one, growing the grid as needed.
  const paste = (r: number, c: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return; // plain text: let the cell take it normally
    e.preventDefault();
    const rows = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    const next = value.map((row) => row.map((cell) => ({ ...cell })));
    rows.forEach((line, i) => {
      while (next.length <= r + i) next.push(Array.from({ length: cols }, blank));
      line.forEach((t, j) => {
        while (next[r + i].length <= c + j) next[r + i].push(blank());
        next[r + i][c + j].t = t;
      });
    });
    const width = Math.max(...next.map((row) => row.length));
    apply(next.map((row) => [...row, ...Array.from({ length: width - row.length }, blank)]));
  };

  const swatch = (color: string, title: string, onPick: () => void, text?: boolean) => (
    <button
      key={title}
      title={title}
      // mouseDown keeps the focused cell focused, so the colour lands on the cell you were in.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      disabled={!active}
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        border: "1px solid #B9BBC6",
        background: text ? "#FFFFFF" : color,
        color: text ? color : undefined,
        fontWeight: 700,
        fontSize: 13,
        lineHeight: "18px",
        padding: 0,
        cursor: active ? "pointer" : "not-allowed",
        opacity: active ? 1 : 0.45,
      }}
    >
      {text ? "A" : ""}
    </button>
  );

  const small = { padding: "2px 10px", fontSize: 12 } as const;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 10, fontSize: 12 }}>
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          Fill
          {FILLS.map((f) => swatch(f.value, f.name, () => colour("bg", f.value)))}
          <button
            className="btn btn-secondary"
            style={{ ...small, padding: "0 6px" }}
            disabled={!active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => colour("bg", undefined)}
          >
            none
          </button>
        </span>
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          Text
          {TEXTS.map((t) => swatch(t.value, t.name, () => colour("fg", t.value), true))}
          <button
            className="btn btn-secondary"
            style={{ ...small, padding: "0 6px" }}
            disabled={!active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => colour("fg", undefined)}
          >
            none
          </button>
        </span>
        <label style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={wholeRow} onChange={(e) => setWholeRow(e.target.checked)} />
          Whole row
        </label>
        <span className="muted">Click a cell, then pick a colour. You can paste a range copied from Excel.</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} style={{ textAlign: "center", padding: 0, height: 18, fontWeight: 400 }}>
                  <button
                    title="Delete this column"
                    className="btn btn-secondary"
                    style={{ padding: "0 6px", fontSize: 10, lineHeight: "14px", opacity: 0.6 }}
                    onClick={() => deleteCol(c)}
                  >
                    × col
                  </button>
                </th>
              ))}
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {value.map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => {
                  const cell = at(r, c);
                  return (
                    <td
                      key={c}
                      style={{
                        border: "1px solid #E1E1DC",
                        padding: 0,
                        verticalAlign: "top",
                        background: cell.bg,
                        outline: active?.r === r && active?.c === c ? "2px solid #0B6E6E" : undefined,
                        outlineOffset: -2,
                      }}
                    >
                      <CellInput
                        cell={cell}
                        onText={(t) => setText(r, c, t)}
                        onFocus={() => setActive({ r, c })}
                        onPaste={(e) => paste(r, c, e)}
                        onCommit={() => onCommit()}
                      />
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", padding: 0, verticalAlign: "top" }}>
                  <button
                    title="Delete this row"
                    className="btn btn-secondary"
                    style={{ padding: "0 6px", fontSize: 12, marginTop: 4, opacity: 0.6 }}
                    onClick={() => deleteRow(r)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-secondary" style={small} onClick={addRow}>
          + Row
        </button>
        <button className="btn btn-secondary" style={small} onClick={addCol}>
          + Column
        </button>
      </div>
    </div>
  );
}
