import { SiteFooter } from "../../components/site-footer";

/** Marketing, docs and policy pages carry the footer. App-like routes (workspace, demo) do not. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
