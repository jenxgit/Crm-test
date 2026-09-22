// A small excel-like grid of free-text cells, stored as JSON (array of row arrays).
export type NotesGridValue = string[][];

const DEFAULT_ROWS = 4;
const DEFAULT_COLS = 3;

export function emptyGrid(): NotesGridValue {
  return Array.from({ length: DEFAULT_ROWS }, () => Array(DEFAULT_COLS).fill(""));
}

export function parseGrid(raw: string | null): NotesGridValue {
  if (!raw) return emptyGrid();
  try {
    const g = JSON.parse(raw);
    if (Array.isArray(g) && g.length > 0 && g.every((row) => Array.isArray(row))) return g;
  } catch {
    // fall through to default
  }
  return emptyGrid();
}

export default function NotesGrid({
  value,
  onChange,
  onCommit,
}: {
  value: NotesGridValue;
  onChange: (v: NotesGridValue) => void;
  onCommit: () => void;
}) {
  const setCell = (r: number, c: number, v: string) => {
    const next = value.map((row) => [...row]);
    next[r][c] = v;
    onChange(next);
  };

  const addRow = () => {
    onChange([...value, Array(value[0]?.length ?? DEFAULT_COLS).fill("")]);
    onCommit();
  };
  const addCol = () => {
    onChange(value.map((row) => [...row, ""]));
    onCommit();
  };

  return (
    <div>
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <tbody>
          {value.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c} style={{ border: "1px solid #E1E1DC", padding: 0 }}>
                  <input
                    value={v}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    onBlur={onCommit}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "none",
                      outline: "none",
                      padding: "6px 8px",
                      font: "inherit",
                      fontSize: 13,
                      background: "transparent",
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn btn-secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={addRow}>
          + Row
        </button>
        <button className="btn btn-secondary" style={{ padding: "2px 10px", fontSize: 12 }} onClick={addCol}>
          + Column
        </button>
      </div>
    </div>
  );
}
