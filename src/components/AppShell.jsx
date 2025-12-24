// src/components/AppShell.jsx
export default function AppShell({
  sidebarOpen,
  onToggleSidebar,
  darkMode,
  onToggleDarkMode,
  sidebar,
  main,
}) {
  const collapsed = !sidebarOpen;

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside
        className={`transition-all duration-200 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col overflow-visible ${
          sidebarOpen ? "w-[360px]" : "w-12 min-w-[48px]"
        }`}
      >
        <div className="px-2 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          {sidebarOpen && <span className="font-semibold text-sm">Controls</span>}
          <div className={`flex ${collapsed ? "flex-col items-center gap-1" : "gap-2"}`}>
            {!collapsed && (
              <button
                onClick={onToggleDarkMode}
                className="text-sm px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
                title="Toggle dark mode"
                type="button"
              >
                {darkMode ? "☀" : "🌙"}
              </button>
            )}
            <button
              onClick={onToggleSidebar}
              className="text-sm px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              type="button"
            >
              {sidebarOpen ? "≡" : "☰"}
            </button>
          </div>
        </div>
        {sidebarOpen && (
          <div className="p-3 overflow-y-auto flex-1">{sidebar}</div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto p-4 bg-slate-200 dark:bg-slate-900">
        <div className="max-w-[1400px] mx-auto">{main}</div>
      </main>
    </div>
  );
}
