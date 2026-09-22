// Saves when the cell loses focus (or Enter is pressed), only if the value changed.
export default function EditCell({
  value,
  width,
  type,
  onSave,
}: {
  value: string | null;
  width: number;
  type?: string;
  onSave: (v: string) => void;
}) {
  return (
    <input
      key={value ?? ""}
      type={type ?? "text"}
      defaultValue={value ?? ""}
      onBlur={(e) => {
        if (e.target.value !== (value ?? "")) onSave(e.target.value);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      style={{ width, font: "inherit", fontSize: 13, padding: "3px 5px", border: "1px solid #D9DAE2", borderRadius: 4, background: "#fff" }}
    />
  );
}
