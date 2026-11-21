import { DocsNav } from "../../../components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-8 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <DocsNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
