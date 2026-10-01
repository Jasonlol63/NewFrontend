// Images the authenticated shell paints on first render. The login flow warms
// these into the HTTP cache so the dashboard background and sidebar don't flash
// their fallback colors right after sign-in.
export const APP_SHELL_IMAGES = [
  "/images/Count-Inside-Bg.webp",
  "/images/count-sidebar-bg.webp",
  "/images/avatar1.webp",
  "/images/Logo-2.webp",
];

export function preloadImages(srcs) {
  srcs.forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  });
}
