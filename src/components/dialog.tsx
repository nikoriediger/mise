"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { spring } from "@/components/motion";
import { useI18n } from "@/i18n/client";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

const noopSubscribe = () => () => {};
const mobileQuery = "(max-width: 639px)";
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(mobileQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Glass modal. On phones it's a bottom sheet (slides up, swipe down to close);
 * on larger screens a centered dialog. Closes on Escape or backdrop tap.
 */
export function Dialog({ open, onClose, children, className = "" }: DialogProps) {
  const dragControls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  // Portals need the DOM, so render nothing during server rendering and hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  if (!mounted) return null;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/40 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`glass max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lifted sm:max-h-[90vh] sm:rounded-3xl sm:pb-6 ${className}`}
            initial={mobile ? { y: "100%" } : { opacity: 0, scale: 0.94, y: 16 }}
            animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={mobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={mobile ? { type: "spring", stiffness: 380, damping: 36 } : spring}
            drag={mobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={mobile ? onDragEnd : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {mobile && (
              <div
                aria-hidden
                className="-mt-3 mb-3 flex h-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <span className="h-1.5 w-12 rounded-full bg-forest-900/20" />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type ConfirmProps = {
  open: boolean;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, message, confirmLabel, pending, onConfirm, onCancel }: ConfirmProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onCancel} className="p-6 sm:max-w-sm">
      <p className="text-base font-medium text-forest-900">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary min-h-12 sm:min-h-0" onClick={onCancel}>{t.common.cancel}</button>
        <button
          className="btn min-h-12 bg-red-700 text-white shadow-soft hover:bg-red-800 hover:shadow-lifted sm:min-h-0"
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
