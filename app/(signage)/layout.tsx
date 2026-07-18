// Fullscreen dark signage chrome — deliberately NO AppShell/sidebar.
// Colors are the Orithon ink + cream tokens (globals.css --color-primary / --bg-canvas).
export default function SignageLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#15161a", color: "#F6F4EC" }}>{children}</div>;
}
