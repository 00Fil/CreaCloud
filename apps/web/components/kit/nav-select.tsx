"use client";

import { useRouter } from "next/navigation";

import { Select } from "../ui";

/** Menu a tendina che cambia pagina appena si sceglie (filtri senza pulsante «Filtra»). */
export function NavSelect({
  label,
  value,
  options,
  className,
}: {
  label: string;
  value: string;
  options: { href: string; label: string; value: string }[];
  className?: string;
}) {
  const router = useRouter();
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <Select
        value={value}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value);
          if (o) router.push(o.href, { scroll: false });
        }}
        className="w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
