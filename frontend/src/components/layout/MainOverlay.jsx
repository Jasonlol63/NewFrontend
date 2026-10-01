import { createPortal } from "react-dom";

// Renders children into #main-overlay (AuthenticatedLayout), which sits over the content
// area only, so a full-area modal leaves the sidebar / icon rail visible and usable.
// Mount it from user actions (e.g. after a click) so the layout's node already exists.
export default function MainOverlay({ children }) {
  const root = typeof document === "undefined" ? null : document.getElementById("main-overlay");
  return root ? createPortal(children, root) : null;
}
