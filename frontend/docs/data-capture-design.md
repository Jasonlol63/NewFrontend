# Data Capture and Data Capture Summary design

Routes `/data-capture` (sidebar item 9) and `/data-capture/summary` (opened by Submit). UI drafts: the
captured rows, accounts and submitted list are mock data (marked `TEMPORARY` in `shared/dataCaptureRules.js`, `summary/summaryRules.js`) until the
submit API exists. All sizes below are CSS px; "short" = viewport height <= 720, "modal-compact" <= 760,
"modal-short" <= 700, "modal-tiny" <= 600 (variants in `src/index.css`).

Files: `frontend/src/pages/data-capture/` (split like Process: an entry page plus one folder per kind)

| File | Role |
|---|---|
| `DataCapturePage.jsx` | Entry (`/data-capture`): owns the Group / Company scope and shows the Game or the Bank view |
| `games/GameCaptureView.jsx` | Game company capture: Date, Process, Currency, Description, Replace / Remove word, Remark, the sheet, Submit |
| `bank/BankCaptureView.jsx` | Bank company capture: Date, Process (fixed list), Currency, Remark, the sheet, Submit |
| `shared/CaptureSheet.jsx` | The paste sheet (columns 1-20, rows A.., editable cells) |
| `shared/SubmittedProcesses.jsx`, `shared/cardParts.jsx`, `shared/useFullscreen.js` | Right card of the capture pages, shared card surface and title, full-screen toggle |
| `shared/dataCaptureRules.js` | Capture constants (sheet size, modes, date options, mock submitted list) |
| `summary/DataCaptureSummaryPage.jsx` | The summary list (see "Summary page") |
| `summary/FormulaDialog.jsx` | Add / Edit Formula dialog |
| `summary/summaryRules.js` | Mock summary / captured data, `parseRate`, `rowAmount`, `capturedCells`, `evalFormula` |

Design previews (plain HTML, open with Live Server): `docs/data-capture-preview.html`,
`docs/data-capture-summary-preview.html` (summary + dialog, add `?frame=1` for the outer frame draft),
`docs/data-capture-summary-sizes.html` (tabs per screen size), `docs/data-capture-formula-sizes.html`,
`docs/data-capture-summary-list-options.html` (the A / B / C / D list drafts; D was chosen).

## Shared surfaces

| Thing | Value |
|---|---|
| Page padding | `clamp(10px, 2dvh, 16px)`; gaps `clamp(8px, 1.5dvh, 12px)` |
| Page height | `h-full min-h-[520px]`; the page never scrolls, only the sheet / list scrolls inside its card |
| Card (`cardClass`) | radius 12, border `modal-line`, bg `modal-card`, shadow `modal-card`, blur 14 + saturate 1.2 |
| Card title | 4px x 16px blue bar (`#3fc4ff` -> `#0a3fc9`) + 16px / 800 navy `#14336b` |
| Primary button | blue sweep gradient (`primaryButtonClass`), radius 10 |
| Table header | gradient `#60c1fe` -> `#0f61ff` (sheet) / `#1a6bff` (summary), white 11.5-12px bold |

## Data Capture page

Layout, top to bottom: top row (form card + Submitted card), error bar (only when the API fails), the Data Capture
Table card (fills the rest), Submit centred.

- **Top row:** `grid-cols-1`, from `lg` (1024+) `minmax(0,1.85fr) / minmax(0,1fr)`.
- **Form card (Game):** padding `px-4 pt-2.5 pb-3.5`, gap 8 (6 when short). Group / Company segments, a 1px rule, then a
  6-column grid (gap-x 14, gap-y 8): Date / Process / Currency = 2 columns each; Description = 2, Replace Word = 4;
  Remove Word = 3, Remark = 3. Below 900px everything is one column.
- **Form card (Bank):** 2-column grid: Date, Process, Currency, Remark (one column below 900px).
- **Description:** input-looking box with the picked descriptions as chips (22px high, radius 7) + `AddButton`
  (+ while none is picked, pen once something is). Opens the same `DescriptionPickerModal` as Add Process.
- **Submitted Processes card:** padding `px-4 pt-3 pb-3.5`; list is absolutely placed so it scrolls inside the card
  (min height 84); rows radius 10, padding 7 / 12 / 7 / 16, 3px blue bar on the left, code 13px/800, name 12px,
  user pill min-width 42, time 12px/700 + date 10.5px.
- **Data Capture Table card:** header bar `px-4 py-2.5`: title, mode select (Game, 140px wide), Reset (34px high),
  full-screen toggle (34px square, right). Bank: Reset, then right side "Add Row" select (84px) + add-rows button +
  full-screen.
- **Sheet:** 20 columns x 40 rows (`SHEET_COLS`, `SHEET_ROWS`), cells 27px high, row-letter column 56px wide
  (sticky), header 27px (sticky), table `min-w-[1100px] table-fixed`, font 12.5px; scrolls both ways inside the
  card. Cells are `contentEditable="plaintext-only"` (focus ring 2px blue).
- **Submit:** 34px high, min-width 108, padding 22, 13.5px. Enabled when the sheet has data and Process + Currency
  (+ at least one Description for Game) are set, not read-only. It opens the summary and passes
  `{ date, process, description, currency, remark }` as router state.

## Summary page (`/data-capture/summary`)

Opened by Submit; opened directly it shows an example (2026-10-08, SALARY). Back returns to `/data-capture`.

### Frame and rows

| Part | Spec |
|---|---|
| Page wrapper | `h-full min-h-[520px]`, padding `clamp(8px, 1.6dvh, 16px)` |
| Outer frame | fills the wrapper (`h-full min-h-[480px]`), radius 22, border `white/55`, bg `modal-bg` (`rgba(222,232,246,.62)`), blur 22 + saturate 1.15, shadow `0 20px 50px -30px rgba(20,51,107,.45)`; same surface as the form modals |
| Frame padding | x `clamp(12px, 1.8vw, 24px)`, y `clamp(10px, 2dvh, 18px)` |
| Frame gap | `clamp(6px, 1.3dvh, 10px)` |
| No max width | the frame fills the whole content area at every size (an earlier 1240 / 1400 cap left empty sides on 1920 and was removed) |

Order inside the frame: title + info row, Rate bar, list card, Submit / Back row.

### Title + info row

- Wraps (`flex-wrap`, gap-x 10, gap-y 4). Title: 4px blue bar + `clamp(16px, 2.2dvh, 18px)` / 800 navy.
- Info chips: Date, Process, Description, Currency, Remark. 12px (11.5px below 1400px wide), label grey `#6b7280`,
  value 800 navy with 5px margin; an empty value shows `-` in faint grey (600). A `·` separator after every chip but the last.

### Rate bar

- One strip: radius 10, border `white/80`, bg `white/55`, padding `px-2.5 py-1.5` (`py-1` when short), gap 8.
- Left: "Rate" label (13px/800 navy), input 150px wide x 28px high (radius 8, 12.5px, placeholder `e.g. *3 or /3`),
  **Select All** and **Submit** (primary, 28px high, radius 8, 12.5px, px 16). Submit is disabled until the text is
  `*n` or `/n` (`parseRate`); it writes the Rate Value into every row whose Rate box is ticked.
- Right (`ml-auto`, never shrinks): Refresh (28px square, restores the sample rows) and Delete (28px high, red
  gradient, slate when 0 selected, shows `Delete (n)`).

### List card

Card: radius 12, border `white/85`, bg `white/80`, shadow `0 8px 22px -16px rgba(20,51,107,.5)`, `overflow-hidden`.
**The card is as tall as its rows** (no flex-1): with few rows there is no empty area under the Total row; with
many rows it grows to the available height and the table scrolls inside it (vertical only, `overflow-x-hidden`,
thin scrollbar). The page and `<main>` never scroll.

Table: `table-fixed`, `w-full`, **no horizontal scroll at any size**. Formula is the only column without a width,
so it takes whatever the others leave and is always the widest column.

| Column | Width | Content |
|---|---|---|
| Id Product | 13% | 800 weight |
| Account | 15% | 11.5px (11px below 1400px) / 500 / `#475569`, truncates; dashed + button on the right |
| Currency | 7% | pill: 10.5px / 800, `#1d4ed8` on `#eaf4ff`, border `#bfd8ff` |
| Formula | rest (about 25-33%) | 700 / `#334155`, truncates; blue pen on the right |
| Source | 5.5% | centred |
| Rate | 4% | `SelectBox` |
| Rate Value | 6% | right aligned (`*3`) |
| Processed Amount | 9% | right aligned, 800, blue `#1d4ed8` positive / red `#dc2626` negative, `tabular-nums` |
| Skip | 4% | `SelectBox`; a skipped row is 45% opacity and leaves the Total |
| Delete | 5.5% | `SelectBox` |

Measured widths (Id Product / Account / Formula): 1920 viewport (content 1684) about 212 / 245 / 506;
1536 about 157 / 181 / 375; 1366 about 140 / 163 / 333; 1280 about 131 / 151 / 333.

Sizes:

| Part | Normal | short (<= 720 high) |
|---|---|---|
| Header row | 28px | 26px |
| Body row | 28px | 25px |
| Total row | 30px | 27px |
| Cell padding | 6px | below 1400px wide: 4px |
| Header text | 11.5px, one line from 1701px wide | below 1700px wide it may wrap to two lines (leading 1.15); below 1250px wide 10.5px with 2px padding |

Row look: white, even rows `#f7faff`, hover `#e9f3ff`, borders `#e8eef7`. Header sticky at the top, Total row
sticky at the bottom (`#dfeafb`, top border `#bcd0ec`, 800 navy; "Total" right aligned over the first 7 columns, the
sum under Processed Amount).

Icons (same as the Process pages): add = dashed 22px square, radius 7, border 1.5px dashed `#7fb2ff`, bg
`rgba(232,242,255,.7)`, blue `+` 13px, solid border + `#d6e8ff` on hover; edit = `IconAction` (blue `SquarePen`,
26px button, 16px icon, hover `#e8f1ff`); checkboxes = `SelectBox` (soft blue line squares).

### Bottom row

Submit (primary, 28px high) and Back (soft white, 28px high, px 16), left aligned, directly under the card.
Not wired yet (no submit API); Back goes to `/data-capture`.

### Screen size check (all fit with no page scroll, no horizontal scroll)

1920x950, 1600x800, 1536x730, 1440x760, 1366x610, 1280x560, 1100x700. At 1100 wide the Account column truncates
with an ellipsis; everything else is complete.

## Add / Edit Formula dialog

Opened by the + (Add Formula) or the pen (Edit Formula) of a row. Rendered into `#main-overlay` (covers the content
area, the sidebar stays usable).

| Part | Spec |
|---|---|
| Backdrop | `rgba(214,230,252,.72)` + blur 12; click closes; padding 16 |
| Dialog | width `min(1180px, 100%)`, `max-h-full`, radius 20, border `white/70`, bg `rgba(232,240,251,.88)`, blur 22, shadow `0 30px 70px -30px rgba(20,51,107,.55)` |
| Header | icon tile 36px (30 when modal-short), title 20px/800 navy (17 when modal-short), close X 32px; padding `18 / 14 / 12`; bottom border |
| Footer | Cancel + Save, 38px high, min-width 112 (34 / 104 when modal-short), right aligned; padding `18 / 12 / 16` |
| Body | `.formula-grid` in `index.css`, padding `18 / 16`, scrolls if the screen is too short |

Grid (areas: label `l..`, control `c..`):

- **>= 1401px:** columns `78px | .9fr | 96px | 1.1fr | 232px`, gap 10 x 14. Rows: Id Product + Input Method /
  Account + Currency / Source + Description / Data / Formula (full line) / Result (full line) / Row data (full
  width, under the keypad too). The keypad sits in column 5 spanning the first six rows.
- **<= 1400px:** `72 | .85fr | 84 | 1.15fr | 200px`, gap 8 x 12; keypad 200px wide.
- **<= 1100px:** four columns `78 | 1fr | 92 | 1fr`, keypad drops below (centred).
- **modal-short (<= 700 high):** gap 6 x 12, tighter paddings, Row data max-height 68, chips 26px high.

Controls: Id Product (uppercase input), Input Method (select, optional, with clear x), Account (searchable dropdown with
clear x + `AddButton`: + when empty, pen once picked, opens the Account page's Add / Edit Account modal on top),
Currency (select), Source, Description (uppercase), Data (Id Product select `flex 1.25`, min 104px; Row Data select
`flex 1`; **Add** button inserts the picked `$n`), Formula input, Result box (36px high, dashed border; red text when
invalid).

- **Row data:** every captured column of the picked Id Product as a chip `[n] text` (30px high, radius 8, text max
  180px, area max-height 104 and scrolls). Columns start at `$2` (column 1 is the Id Product). Number columns insert
  `$n` on click and show `x<count>` when used; text columns are greyed and disabled.
- **Keypad:** 232px wide, 4 columns, gap 8, keys 38px high (32 when modal-compact), radius 10. Digits white;
  `/ * - +` pale blue; `(` `)`; `Clr` red; `=` blue gradient and replaces the formula by its result.
- **Formula rules:** `+ - * / ( )`, numbers and `$n`; evaluated by `evalFormula` (a small parser, no `eval`).
  Save is disabled while the formula is empty. Saving writes `f`, Source, Account, Currency back to the row and sets
  its amount to the formula result keeping the row's sign.
- **Escape:** closes the Account modal first, then this dialog.
