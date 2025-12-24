// src/components/ModeToggle.jsx
export default function ModeToggle({ mode, onChange }) {
  const modes = [
    { id: "single", label: "Single" },
    { id: "sweep1D", label: "Sweep 1D" },
    { id: "sweep2D", label: "Sweep 2D" },
    { id: "scatter", label: "Scatter" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      {modes.map((m) => {
        const active = mode === m.id;
        const base =
          "px-3 py-2 rounded-md border text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500";
        const activeClasses =
          "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:border-indigo-500 dark:hover:bg-indigo-400";
        const inactiveClasses =
          "bg-white border-slate-300 text-slate-800 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700";
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            type="button"
            className={`${base} ${active ? activeClasses : inactiveClasses}`}
            aria-pressed={active}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
