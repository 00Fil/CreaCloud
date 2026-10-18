import { MessageCircle } from "lucide-react";

export default function ChatIndex() {
  return (
    <div className="chat-wallpaper hidden h-full flex-1 flex-col items-center justify-center gap-3 text-center lg:flex">
      <MessageCircle className="size-10 text-pervinca" />
      <p className="font-serif text-2xl">Seleziona una conversazione</p>
      <p className="max-w-sm text-sm text-muted">
        Qui vedi tutte le chat WhatsApp del centro, puoi prendere il controllo di quelle gestite dall&apos;assistente o renderle manuali.
      </p>
    </div>
  );
}
