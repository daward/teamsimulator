// src/components/AppShell.jsx
export default function AppShell({
  sidebarOpen,
  onToggleSidebar,
  sidebar,
  main,
}) {
  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside
        className={`transition-all duration-200 border-r border-slate-200 bg-white shadow-sm flex flex-col ${
          sidebarOpen ? "w-[360px]" : "w-10"
        }`}
      >
        <div className="px-2 py-2 border-b border-slate-200 flex items-center justify-between">
          {sidebarOpen && <span className="font-semibold text-sm">Controls</span>}
          <button
            onClick={onToggleSidebar}
            className="text-sm px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            type="button"
          >
            {sidebarOpen ? "≡" : "☰"}
          </button>
        </div>
        {sidebarOpen && (
          <div className="p-3 overflow-y-auto flex-1">{sidebar}</div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto p-4 bg-gray-400">
        <div className="max-w-[1400px] mx-auto">{main}</div>
      </main>
    </div>
  );
}
