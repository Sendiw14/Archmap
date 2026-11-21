/** App-like routes (demo, analyses): no footer, full-height content. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      {children}
    </main>
  );
}
