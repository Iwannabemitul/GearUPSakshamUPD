"use client";

/**
 * LoginDialogs — About / Privacy Policy / Terms & Conditions as modal
 * dialogs on the login screen (C.2). The single-route architecture is kept:
 * no new paths, just local dialog state.
 */

import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogKind = "about" | "privacy" | "terms" | null;

export function LoginDialogs() {
  const { t } = useLang();
  const [open, setOpen] = useState<DialogKind>(null);

  const items: Array<{ kind: Exclude<DialogKind, null>; label: string; titleKey: string; bodyKey: string }> = [
    {
      kind: "about",
      label: t("ui.aboutSaksham"),
      titleKey: "pages.aboutTitle",
      bodyKey: "pages.aboutBody",
    },
    {
      kind: "privacy",
      label: t("ui.privacyPolicy"),
      titleKey: "pages.privacyTitle",
      bodyKey: "pages.privacyBody",
    },
    {
      kind: "terms",
      label: t("ui.termsConditions"),
      titleKey: "pages.termsTitle",
      bodyKey: "pages.termsBody",
    },
  ];

  const current = items.find((i) => i.kind === open);

  return (
    <>
      <footer className="relative flex flex-wrap gap-6 text-sm text-white/80 mt-8 lg:mt-0">
        {items.map((i) => (
          <button
            key={i.kind}
            type="button"
            onClick={() => setOpen(i.kind)}
            className="cursor-pointer hover:text-white underline-offset-2 hover:underline bg-transparent"
          >
            {i.label}
          </button>
        ))}
      </footer>

      {/* The whole Root is conditionally rendered: unmounting it removes the
          portal instantly. (Radix Presence otherwise waits for an exit
          `animationend` that never fires with this Tailwind-4 animate setup,
          leaving a blank, uncloseable box — see MASTER-PROMPT known issues.) */}
      {current ? (
        <Dialog open onOpenChange={(v) => !v && setOpen(null)}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t(current.titleKey)}</DialogTitle>
              <DialogDescription>{t(current.bodyKey)}</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
