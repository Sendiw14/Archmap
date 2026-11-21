import Link from "next/link";
import { Compass } from "lucide-react";
import { SiteFooter } from "../components/site-footer";
import { StateCard } from "../components/ui/primitives";
import { DEFAULT_LIMITS } from "@archmap/contracts";
import { formatHours } from "../lib/format";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <main id="main" tabIndex={-1} className="px-4 py-20 outline-none sm:px-6">
        <StateCard
          headingLevel={1}
          icon={<Compass size={30} aria-hidden="true" />}
          title="This page does not exist"
          actions={
            <>
              <Link href="/" className="am-btn am-btn-primary">
                Go to the home page
              </Link>
              <Link href="/demo" className="am-btn">
                Open the demo
              </Link>
              <Link href="/docs" className="am-btn">
                Read the docs
              </Link>
            </>
          }
        >
          <p>
            The address may be mistyped, or the page may have moved. Analysis links also stop
            working {formatHours(DEFAULT_LIMITS.retentionHours)} after the analysis.
          </p>
        </StateCard>
      </main>
      <SiteFooter />
    </>
  );
}
