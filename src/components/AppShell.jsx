// src/components/AppShell.jsx
export default function AppShell({
  sidebarOpen,
  onToggleSidebar,
  sidebar,
  main,
}) {
  return (
    <div
      style={{
        fontFamily: "system-ui",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: sidebarOpen ? 380 : 40,
          transition: "width 0.2s ease",
          borderRight: "1px solid #ddd",
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "6px 8px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "space-between" : "center",
          }}
        >
          {sidebarOpen && <strong>Controls</strong>}
          <button
            onClick={onToggleSidebar}
            style={{ fontSize: 12, padding: "2px 6px" }}
          >
            {sidebarOpen ? "⟨" : "⟩"}
          </button>
        </div>

        {sidebarOpen && (
          <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
            {sidebar}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>{main}</div>
    </div>
  );
}
