import { useMemo, useState } from "react";

type Props = {
  value?: string | null;              // "YYYY-MM-DD"
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
  const [cursor, setCursor] = useState<Date>(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    // começa no domingo
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

  return (
    <div
      className="
        absolute z-50 mt-2 w-72 rounded-xl border
        border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900 shadow-xl p-3
      "
      role="dialog"
      aria-label="Calendar"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label="Previous month"
        >‹</button>
        <div className="text-sm font-medium">
          {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button
          className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label="Next month"
        >›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-slate-500 mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map(({ date, inMonth, today }) => {
          const k = ymd(date);
          const selected = value && k === value;
          return (
            <button
              key={k}
              onClick={() => { onChange(k); onClose?.(); }}
              className={`
                h-9 rounded-lg text-sm
                ${selected
                  ? "bg-indigo-600 text-white"
                  : today
                    ? "bg-slate-100 dark:bg-slate-800"
                    : inMonth
                      ? "hover:bg-slate-100 dark:hover:bg-slate-800"
                      : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
