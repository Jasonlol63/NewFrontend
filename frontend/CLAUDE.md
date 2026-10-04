# Frontend conventions

## Every page must fit the screen (no page scroll on desktop)

Target desktop viewports (CSS px, i.e. after browser chrome and Windows scaling):

| Case | Viewport |
|---|---|
| 1366 laptop | 1280×560 – 1366×610 |
| 1920 @125% scaling | 1536×730 |
| Common monitors | 1440×760, 1600×800 |
| Large | 1920×950 |

**Height is the tight dimension**, not width. Rules:

1. **The page itself never scrolls.** Standalone pages (login flow) use `min-h-dvh` + centered content.
   Pages inside `AuthenticatedLayout` get an `h-dvh overflow-hidden` shell; only `<main>` scrolls, the
   Sidebar stays fixed. A page that should fill the screen uses `xl:h-full` + `flex-1 min-h-0` regions.
2. **No large fixed heights.** Never `min-h-[780px]`, `h-screen` inside the layout, fixed `pb-20`, etc.
   A small floor (≈520px) is fine so the layout never collapses on tiny windows.
3. **Scale spacing with height.** Use the fluid tokens from `src/index.css`:
   `p-fluid-*`, `gap-fluid-*`, `mb-fluid-*` (`2xs xs sm md lg`), `size-auth-logo`, or an inline
   `clamp(min, Ndvh, max)` where max = the original design value.
4. **Short screens** (`max-height: 720px`): use the `short:` variant to tighten (smaller icons/charts,
   less padding). Shrink, don't hide important elements (e.g. the logo stays, just smaller).
5. **Widths are fluid.** `w-full max-w-[…]` instead of `w-[400px]`; grids use `minmax()`/fr and change
   column count by breakpoint; cap very wide content with `max-w`.
6. **Overflowing data scrolls inside its own container** (tables: `overflow-x-auto` / `overflow-y-auto`
   on the card body), never the whole page.
7. **Sidebar has two modes**, switched at the `nav` breakpoint (1200px, `nav:` / `max-nav:`):
   ≥1200 full `Sidebar` (width `clamp(220px,15.5vw,236px)`); <1200 icon-only `SidebarRail` + the full
   sidebar as a floating drawer. Menu items live once in `components/layout/sidebarConfig.js`;
   submenus are built only in the full `Sidebar` (the rail opens the drawer for them). A menu item with
   `children` has no `path` of its own: it only expands/collapses (one open at a time, collapsed on load).
   Page layouts that switch to multi-column should key off available width (`lg:` = 1024+), since
   the rail frees ~180px below 1200.
8. **Verify** each new/changed page in the preview at the viewports above:
   `document.documentElement.scrollHeight <= innerHeight` and `scrollWidth <= innerWidth`,
   and `<main>` has no overflow for screen-filling pages.
