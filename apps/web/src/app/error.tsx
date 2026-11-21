"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StateCard } from "../components/ui/primitives";

/** Error boundary for any route segment: the header stays, the page offers a retry. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="px-4 py-20 sm:px-6">
      <StateCard
        headingLevel={1}
        role="alert"
        tone="danger"
        icon={<AlertTriangle size={30} aria-hidden="true" className="text-danger" />}
        title="Something went wrong on this page"
        actions={
          <>
            <button type="button" className="am-btn am-btn-primary" onClick={reset}>
              Try again
            </button>
            <Link href="/" className="am-btn">
              Go to the home page
            </Link>
          </>
        }
      >
        <p>
          An unexpected error stopped this page from rendering. Your data was not changed. Trying
          again often works.
        </p>
        {error.digest && <p className="mt-2 text-[12px]">Reference: {error.digest}</p>}
      </StateCard>
    </main>
  );
}
