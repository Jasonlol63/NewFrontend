# Announcement page design

Route `/announcement` (sidebar item 3). Wired to the Spring Boot API (see "API wiring" below); the page
loads announcements, the notice and the Telegram link on open and reads the lists again after every change.

Files: `frontend/src/pages/announcement/`

| File | Role |
|---|---|
| `AnnouncementPage.jsx` | Page: two tabs, owns the state, the delete confirm, the sign-out confirm and the "link saved" dialog |
| `AnnouncementList.jsx` | The announcement cards (every one in full, newest first); exports `DELETE_ACTION_CLASS` |
| `AnnouncementFormModal.jsx` | New / Edit announcement, full-area `FormModal` |
| `NotificationPreview.jsx` | Live preview of the notification card inside the form |
| `MaintenanceTab.jsx` | The one maintenance notice: create form / one row / in-place edit form, plus the IT sign-out switch |
| `TelegramCard.jsx` | Telegram support link of the login page (slim bar on laptops, three layers on big screens) |
| `PanelCard.jsx` | Glass card frame of the Settings tab (accent bar, icon tile, title, subtitle, footer) + `StatusPill` |
| `RichText.jsx` | Rich text editor (`RichTextEditor`), display component (`RichContent`), shared look `RICH_CLASS` |
| `announcementRules.js` | HTML sanitizing, search, version parsing, Telegram handle rules, list-title <-> content, backend row mapping |

## Layout

Two tabs with `SlideTabs`: **Announcement** (count badge) and **Settings** (gear icon; it holds what used to be the
Maintenance and Contact tabs, so the page has one tab less). The page root is a `@container/page` and fills the
content area: `h-full min-h-[520px]`, fluid padding / gaps from `dvh`. The page itself never scrolls; the list, or the
Settings area, scrolls inside itself when the screen is too short.

The page is **not zoomed on big screens**. An earlier attempt scaled only this page up (CSS zoom, then per-element
clamps up to 52px) and looked wrong next to the other pages. If big screens should grow, do it once in
`AuthenticatedLayout` for every page, not here.

### Announcement tab
- Toolbar: tabs, `PrimaryButton` "New Announcement" (the same bright blue as "Add Domain" / "Add User" on the list
  pages), search box (title / content / creator).
- No pager: every announcement is shown in full. Under the list the sky-gradient count chip of the list pages
  (`TRAY`, exported from `DataTable.jsx`): "Showing all N announcements" / "Showing x of N" while searching.
- Card = glass (`bg-white/55`, `border-modal-line`, `shadow-modal-card`, blur), radius 16, a 4px bar on the left edge
  (blue; the newest one is green with a "Latest" pill). Header: title, `Version x.y.z` pill (read from "Version ..." in
  the content, nothing when absent), Edit (`IconAction`, same as Admin / Account) and Delete (the same icon button,
  red). Body: inner glass block with the list title (default `✨ 本次更新包括 ✨`), the content and the fixed thanks
  line. Footer: created by / time.
- Empty / no match: dashed glass block with a message.
- Delete asks first (`DeleteDialog`), Edit opens the form modal.

### New / Edit announcement (`AnnouncementFormModal`)
`FormModal` (fills the content area, sidebar stays visible). Two `FormCard`s, 6 : 5: left "Announcement" (Title,
List section title optional, Content editor that takes the rest of the height), right "Notification preview"
(`NotificationPreview` + an info line). Below 900px of content width the cards stack and only the body scrolls.
Save is "Publish" when new, "Save" when editing; disabled with a yellow-dot hint ("Enter a title." / "Enter the
announcement content.") until the form is valid.

### Settings tab
Scroll container with two cards (the maintenance card grows with `flex-[1_0_auto]` and takes the free height, the
Telegram card is `flex-none`, so the Maintenance card is always the larger one: about 640px against 300px at
1920x1030, 420px against 60px at 1280x560):

1. **Maintenance Notice** (`MaintenanceTab`, amber accent): there is only ever one notice and no modal.
   - Nothing published: the card is the create form ("Create Maintenance Notice", "No notice yet" pill). Left: Prefix +
     editor; right: "Notice preview" (the yellow notice strip users see), the one-notice info line and, for IT, the
     sign-out switch. Footer: Publish (disabled until Prefix and Content are filled, with the hint).
   - Published: one row (Prefix, content, created by / time, Edit, Delete) and, for IT, the sign-out switch card
     under it; "Published" pill in the header.
   - Edit swaps the row for the same form in place ("Edit Maintenance Notice", Cancel / Save, no switch in it).
     Delete confirms, then the create form comes back.
2. **Telegram Support Link** (`TelegramCard`, blue accent) has two layouts, picked by the width of the card
   (`useWide`, a `ResizeObserver`; threshold `WIDE_FROM = 1360`, which is about a 1650px screen with the sidebar):
   - **Narrow (laptops, up to about 1650px): one slim bar on one line**, about 60-70px high, so the maintenance card
     stays the main thing. Left to right: icon tile with a status dot (green = Active, grey = Hidden) and the title with
     "Active · Login page button" under it; the `https://t.me/` prefixed handle box with **Test link** right next to it;
     "who / when" (JK + time); Reset and Save at the right edge. The link itself is not printed (Test link opens it, its
     tooltip shows the address); Test link is not shown while the link is empty. The subtitle and "who / when" hide below
     1000px of page width; below 900px the bar wraps to two lines (about 110px); below 600px the title, the box, Test
     link and the buttons take a full line each (about 200px on a phone). Control height is
     `clamp(38px, 5.2dvh, 48px)` (38px = the form modals' buttons).
   - **Wide (1650px screens and up): three layers in a taller card.** The card is taller (`min-h`
     `clamp(240px, 28.7dvh, 322px)`: about 296px on 1920x1030, 322px on 2560x1300, against about 640px / 880px for the
     maintenance card) but what is inside is **not scaled up**: tile 32-38px, title 17px, subtitle 11.5px, Active pill,
     input / Test link / Reset / Save 38-42px with 13.5px text, "Current link" strip 12px: the same sizes as the
     maintenance card above, so the two read as one family. The extra height is spread as space between the layers
     (`justify-between`). Layer 1: icon with the status dot, title, subtitle, Active / Hidden pill at the right.
     Layer 2: the handle box + Test link (up to `clamp(420px, 28vw, 560px)`) and Reset / Save at the right edge.
     Layer 3: a "Current link" strip (white glass, the live link, who / when at the right) and under it the hint line.
   Common to both: the hint sentence is the handle box's tooltip (visible text only in the wide layout); an invalid
   handle shows a red line and disables Save. Accepts a full link, `t.me/x`, `@x` or `x` (`normalizeHandle`); empty +
   Save hides the button on the login page (status becomes Hidden, "Current link" says no link is set). Saving shows
   a success `StatusDialog`. No login-page preview image (removed on request). Earlier versions (a big three-row card
   at every size, then a bar only) looked heavier than the maintenance card or too thin on big screens, hence the
   two layouts.

The two blocks are told apart by the 4px top accent bar (amber / blue) and the icon tile colour.

### Sign out online users switch (IT only)
- Visible only to the IT login (`useCurrentUser().role === "it"`).
- Create form: the switch only records the choice (`kickUsers` in the Publish payload); nobody is signed out until
  Publish. Off: just publish the notice, users stay signed in.
- Published notice: switching it ON signs everyone out immediately, after a confirm `StatusDialog` (warning,
  "Sign out users" / "Cancel") because the action cannot be undone; switching OFF applies at once.
- Look: a card with a logout icon; it turns red while on. The switch (`BigSwitch`, 48x26) is bigger than the shared
  `ToggleSwitch` on purpose (a serious action); the shared one was not changed.
- Still to settle with the back end: whether "on" also blocks sign-in until it is turned off (the card text says so)
  or only signs out whoever is online now.

## Rich text (`RichText.jsx`)
No rich text library is installed, so this is a small editor on `contentEditable` + `document.execCommand`:
Normal / Heading, bold, italic, underline, strikethrough, numbered / bulleted list, quote, code (wraps the selection),
link (inline address bar, http / https / mailto only), clear formatting. Paste is always plain text.
The stored value is HTML; everything shown goes through `sanitizeHtml` (allow-list of tags, `<a>` keeps only safe
`href`, scripts / styles / handlers dropped). `RICH_CLASS` puts back list markers, quote bar, link colour and code
chip that the Tailwind reset removes; the editor, the previews and the cards share it. If the old page used Quill, a
swap to Quill would only change this file.

## Shared things this page uses
Already in the project and used as they are: `FormModal`, `FormCard`, `Field`, `TextInput`, `SoftButton`,
`primaryButtonClass` (`form-modal/fields.jsx`), `MainOverlay`, `PrimaryButton` (`ListToolbar.jsx`), `IconAction`
(`cells.jsx`), `DeleteDialog`, `StatusDialog`, `SlideTabs`, the `modal-*` colour tokens and `brand-*` utilities from
`index.css`.

Changed for this page (small, backwards compatible):
- `components/shared/SlideTabs.jsx`: new optional `tabClassName` / `labelClassName` props (the page hides the labels
  below 480px so three tabs fit a phone); every tab gets `aria-label`; the label is wrapped in a `<span>`.
- `components/shared/form-modal/FormModal.jsx`: the title truncates instead of overlapping the Back button; below
  480px of content width Back shows only the arrow (it keeps `aria-label="Back"`). Affects every form modal, only on
  narrow screens.
- `components/shared/list/DataTable.jsx`: `TRAY` is now exported so the page can show the same count chip without a table.
- `App.jsx`: `/announcement` renders `AnnouncementPage` instead of `ComingSoonPage`.

Local to this page, candidates to move to shared if another page needs them: `PanelCard` (glass card with accent bar),
`StatusPill`, `BigSwitch`, `KickSwitch`, `DELETE_ACTION_CLASS` (red Delete icon button).

## Sizes checked
No page scroll, no horizontal overflow, no overlap and no clipped button text at 2560x1300, 1920x1030, 1920x950,
1536x730, 1440x760, 1366x610, 1280x560, 1024x768, 800x600, 375x812 and 320x640, for: Announcement list, New and Edit
announcement modal, Settings (published, editing, empty / create, switch on). Form modals sit over the content area
only; the sidebar / rail stays visible. Phones: the Settings area scrolls inside itself; on a phone the published
notice row is shorter than the Telegram bar because the bar wraps into several lines. The Telegram bar is one line
from about 900px of page width (laptops, and 1024-wide screens with the icon rail), wraps below that, and uses the
roomy layout from a 1650px screen.

## API wiring (`announcementApi.js`)
| Page | Endpoint |
|---|---|
| Announcement list / add / edit / delete | `GET /api/announcement/listAnnouncement`, `POST addAnnouncementContent`, `updateAnnouncement`, `deleteAnnouncement` |
| Maintenance notice | `GET listMaintenance` (the newest row, highest id, is the notice), `POST addMaintenanceContent`, `updateMaintenance`, `deleteMaintenance` |
| Sign out switch (IT) | `GET /api/it/maintenance-mode`, `POST /api/it/maintenance-mode?enabled=` (form-encoded) |
| Telegram link | `GET /api/settings/getTelegramLink`, `POST updateTelegramLink` (`https://t.me/<handle>`, empty = hidden) |

- **List section title** has no column: it is stored as the leading `<h3>` of `content` (`joinContent` / `splitContent`);
  empty falls back to the default title. Old rows without an `<h3>` show the default.
- **Sign out switch** is the global maintenance mode flag, not a field of the notice. On the create form it only marks the
  choice; Publish creates the notice and then turns the flag on. On a published notice it applies at once (turning on is confirmed first).
  Deleting the notice while the flag is on turns the flag off first.
- Failed calls show the backend message in an error `StatusDialog`; a failed first load shows a Retry.

## Not done
- Whether IT can save the Telegram link is open: the backend `updateLink` rejects a login with no DB `user_id`.
- Read-only logins are not hidden from the buttons; the backend rejects their changes and the error dialog shows why.
- No pagination (by design); if the list grows very large, load more on scroll later.
