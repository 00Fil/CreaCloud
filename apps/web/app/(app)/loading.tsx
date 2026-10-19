import { PageBody } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageBody>
      <div role="status" aria-live="polite" className="space-y-6">
        <span className="sr-only">Caricamento in corso…</span>
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </PageBody>
  );
}
