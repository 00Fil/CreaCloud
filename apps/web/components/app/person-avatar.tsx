import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Colori tenui e leggibili, scelti in modo stabile dal nome.
const PALETTE = [
  "bg-[#e6e9f5] text-[#3f4a7d] dark:bg-[#23283c] dark:text-[#cfd5ee]",
  "bg-[#f8e9e2] text-[#8a4632] dark:bg-[#3a2620] dark:text-[#e8b19c]",
  "bg-[#e3f1ea] text-[#2f6b4f] dark:bg-[#16291f] dark:text-[#8cc2ad]",
  "bg-[#f6efd9] text-[#7a5d16] dark:bg-[#2e2612] dark:text-[#e0c172]",
  "bg-[#eee7f6] text-[#5b4380] dark:bg-[#2a2236] dark:text-[#bba3d6]",
  "bg-[#e3eef6] text-[#2f5a7d] dark:bg-[#162430] dark:text-[#93bde0]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PersonAvatar({
  name,
  src,
  size = "default",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}) {
  const dims = { sm: "size-7 text-[11px]", default: "size-9 text-xs", lg: "size-11 text-sm", xl: "size-16 text-lg" }[size];
  return (
    <Avatar className={cn(dims, className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={cn("font-semibold", PALETTE[hash(name || "?") % PALETTE.length])}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
