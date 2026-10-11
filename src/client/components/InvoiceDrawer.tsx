import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import InvoiceReceipt from "../pages/InvoiceReceipt";

// Slide-over panel that shows an invoice without leaving the page underneath.
export default function InvoiceDrawer({
  invoiceId,
  onClose,
  onChanged,
}: {
  invoiceId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { pathname } = useLocation();
  // The parent passes a new onClose every render; keep the latest in a ref so the effects below
  // run once (re-running would capture the already-locked body scroll as the "previous" value).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Escape closes it, and the page behind doesn't scroll while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("has-drawer");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("has-drawer");
    };
  }, []);

  // Following a link inside the receipt (tour, customer) moves to another page, so close.
  const startPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== startPath.current) closeRef.current();
  }, [pathname]);

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label="Invoice">
        <div className="drawer-header no-print">
          <span className="drawer-title">Invoice</span>
          <Link to={`/invoices/${invoiceId}`} className="drawer-full">
            Open full page ↗
          </Link>
          <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close invoice">
            ×
          </button>
        </div>
        <div className="drawer-body">
          <InvoiceReceipt invoiceId={invoiceId} embedded onChanged={onChanged} onDeleted={() => { onChanged(); onClose(); }} />
        </div>
      </aside>
    </div>,
    document.body,
  );
}
