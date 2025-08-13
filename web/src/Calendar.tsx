import { useMemo, useState } from "react";

type Props = {
  value?: string | null;        
  onChange: (v: string) => void;
  onClose?: () => void;
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Calendar({ value, onChange, onClose }: Props) {
  const initial = value ? new Date(value) : new Date();
  const [cursor, setCursor] = useState<Date>(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);

    start.setDate(first.getDate() - first.getDay());
    const days: { date: Date; inMonth: boolean; today: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        date: d,
        inMonth: d.getMonth() === cursor.getMonth(),
        today: ymd(d) === ymd(new Date()),
      });
    }
    return days;
  }, [cursor]);

  const panelStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    boxShadow: "0 24px 48px -24px rgba(2,6,23,.35)",
  };

  const headerBtnStyle: React.CSSProperties = {
    background: "transparent",
    color: "var(--text)",
  };

  const weekdayStyle: React.CSSProperties = { color: "var(--muted)" };

  return (
    <div
      className="absolute z-50 mt-2 w-72 rounded-xl p-3"
      style={panelStyle}
      role="dialog"
      aria-label="Calendar"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          className="px-2 py-1 rounded-lg hover:bg-[var(--chip-bg)]"
          style={headerBtnStyle}
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-sm font-medium">
          {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button
          className="px-2 py-1 rounded-lg hover:bg-[var(--chip-bg)]"
          style={headerBtnStyle}
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center py-1" style={weekdayStyle}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth, today }) => {
          const k = ymd(date);
          const selected = value && k === value;

          let bg = "transparent";
          let color = inMonth ? "var(--text)" : "var(--muted)";
          let border = "1px solid transparent";

          if (selected) {
            bg = "var(--primary)";
            color = "#fff";
          } else if (today) {

            bg = "color-mix(in oklab, var(--primary) 12%, var(--chip-bg))";
            color = "var(--text)";
            border = "1px solid var(--border)";
          }

          return (
            <button
              key={k}
              onClick={() => {
                onChange(k);
                onClose?.();
              }}
              className="h-9 rounded-lg text-sm transition-colors hover:bg-[var(--chip-bg)] focus:outline-none"
              style={{ background: bg, color, border }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
