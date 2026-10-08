import { useEffect, useRef, useState } from "react";

/** Full-screen toggle for one element: attach `ref` to it, call `toggle()`; `full` follows the browser (Esc included). */
export function useFullscreen() {
  const ref = useRef(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen?.());
  return { ref, full, toggle };
}
