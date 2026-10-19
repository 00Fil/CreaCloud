"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { trapDialogFocus } from "@/lib/ui/dialog";

import { buttonClass, cn } from "../ui";

type SheetApi = { close: () => void };
const SheetContext = createContext<SheetApi | null>(null);

/** Il pannello che contiene il componente, se c'è: i moduli lo chiudono dopo un salvataggio riuscito. */
export function useSheet() {
  return useContext(SheetContext);
}

type Variant = Parameters<typeof buttonClass>[0];
type Size = Parameters<typeof buttonClass>[1];

function Panel({
  open,
  onClose,
  title,
  description,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      aria-describedby={description ? `${id}-d` : undefined}
      onKeyDown={trapDialogFocus}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "ux-sheet m-0 flex-col border-0 bg-surface p-0 text-ink shadow-2xl open:flex",
        // telefono: pannello dal basso; da tablet in su: pannello laterale a destra
        "inset-x-0 bottom-0 top-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl",
        "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-none sm:rounded-none sm:rounded-l-3xl",
        wide ? "sm:w-[min(760px,100vw)]" : "sm:w-[min(540px,100vw)]",
      )}
    >
      {open && (
        <SheetContext.Provider value={{ close: onClose }}>
          <header className="flex items-start gap-3 border-b px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/15 sm:hidden"
            />
            <div className="min-w-0 flex-1">
              <h2 id={`${id}-t`} className="text-2xl leading-tight">
                {title}
              </h2>
              {description && (
                <p id={`${id}-d`} className="mt-1 text-sm text-ink-soft">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              autoFocus
              aria-label="Chiudi pannello"
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-7 [&>form]:!border-0 [&>form]:!p-0">
            {children}
          </div>
        </SheetContext.Provider>
      )}
    </dialog>
  );
}

/**
 * Un pulsante che apre un pannello laterale (dal basso su telefono) con un modulo
 * o un dettaglio. Sostituisce le sezioni a scomparsa annidate nelle pagine.
 */
export function Sheet({
  trigger,
  title,
  description,
  children,
  variant = "outline",
  size = "sm",
  triggerClassName,
  triggerLabel,
  wide,
  defaultOpen = false,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  triggerClassName?: string;
  /** nome accessibile quando il pulsante mostra solo un'icona */
  triggerLabel?: string;
  wide?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        data-pressable="true"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? buttonClass(variant, size)}
      >
        {trigger}
      </button>
      <Panel
        open={open}
        onClose={close}
        title={title}
        description={description}
        wide={wide}
      >
        {children}
      </Panel>
    </>
  );
}

/** Pannello aperto da un parametro dell'indirizzo (es. ?lezione=…): chiudendolo si torna a `closeHref`. */
export function RouteSheet({
  title,
  description,
  closeHref,
  children,
  wide,
}: {
  title: ReactNode;
  description?: ReactNode;
  closeHref: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  useEffect(() => setOpen(true), [closeHref, title]);
  return (
    <Panel
      open={open}
      wide={wide}
      title={title}
      description={description}
      onClose={() => {
        setOpen(false);
        router.push(closeHref, { scroll: false });
      }}
    >
      {children}
    </Panel>
  );
}
