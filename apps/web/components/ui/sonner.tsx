"use client";

import * as React from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** true su schermi da tablet in su; sul server si assume desktop. */
function useIsDesktop() {
  return React.useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function Toaster({
  className,
  style,
  toastOptions,
  icons,
  ...props
}: ToasterProps) {
  const { theme = "system" } = useTheme();
  const isDesktop = useIsDesktop();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={cn("toaster group font-sans!", className)}
      position={isDesktop ? "bottom-right" : "top-center"}
      richColors={false}
      closeButton
      containerAriaLabel="Notifiche"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
        close: <XIcon className="size-3" />,
        ...icons,
      }}
      toastOptions={{
        closeButtonAriaLabel: "Chiudi notifica",
        ...toastOptions,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
