import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { PageBody } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageBody>
      <EmptyState
        icon={SearchX}
        title="Pagina non trovata"
        description="Forse l’elemento è stato eliminato o il collegamento non è più valido."
        action={
          <Button asChild>
            <Link href="/">Torna a Oggi</Link>
          </Button>
        }
      />
    </PageBody>
  );
}
