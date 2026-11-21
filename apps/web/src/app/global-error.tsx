"use client";

/** Last-resort boundary: replaces the root layout, so it brings its own html, body and minimal styling. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          color: "#151b2b",
          background: "#fff",
        }}
      >
        <main style={{ maxWidth: 560, margin: "15vh auto", padding: "0 20px" }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.2 }}>ARCHMAP hit an unexpected error</h1>
          <p style={{ color: "#526079", lineHeight: 1.6 }}>
            The page could not be shown. Nothing was changed. Try again, or go back to the home
            page.
          </p>
          <p style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 8,
                border: "1px solid #3452d1",
                background: "#3452d1",
                color: "#fff",
                fontSize: 15,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 18px",
                color: "#3452d1",
              }}
            >
              Home page
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
