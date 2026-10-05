# Auto Renew 页面设计说明

Auto Renew 列出 30 天内即将到期（或已到期）的 Company / Group，操作人为每一行选一个续期周期，再 Approve 或 Reject。

- 当前是**纯设计版**：没有接 API，数据是占位数据，所有操作只改页面自己的状态，刷新即还原。
- 列表的壳（表头、斑马纹、悬停行、毛玻璃外框、页脚、翻页）直接复用 Admin / Account 的 `DataTable`，尺寸见 `admin-account-list-specs.md`，这里不重复。
- 所有按钮和选中项的蓝色都是登录页的渐变（`bg-brand-sweep`：`#0a3fc9 → #2f8dff → #3fc4ff`）。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/auto-renew/AutoRenewPage.jsx` | 页面：持有状态，定义列，拼装筛选卡片和 `DataTable` |
| `src/pages/auto-renew/AutoRenewFilterCard.jsx` | 顶部筛选卡片（M1 排版） |
| `src/pages/auto-renew/StatusFilter.jsx` | Status 行：图标方块 + 数量 |
| `src/pages/auto-renew/PeriodSelect.jsx` | Period 下拉卡片 |
| `src/pages/auto-renew/ChargeSwitch.jsx` | Charge 小开关 |
| `src/pages/auto-renew/autoRenewRules.js` | 周期表、Remaining 档位、各种颜色表、占位数据、搜索 / 排序 |
| `src/components/shared/SlideTabs.jsx` | Company / Group 滑块（通用组件） |
| `src/components/shared/list/cells.jsx` | `Badge` 增加了属性透传（`style` 等） |
| `src/index.css` | 新增 `renew-ring` / `renew-dot` 动画 |
| `src/App.jsx` | `/auto-renew` 路由指向本页 |

页面外框与 Account 一致：`flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]`，整页不滚动，只有表格区域内部滚动。

---

## 2. 顶部筛选卡片（M1）

卡片样式与 `ListToolbar` 相同：`rounded-xl border border-dash-line bg-white shadow-dash-filter`。

**第一行**（从左到右，靠左排列，不往右推）：

| 控件 | 说明 |
|---|---|
| Company / Group 滑块 | `SlideTabs`：白底灰边（与 `SegmentGroup` 同款），蓝色渐变滑块滑到选中项；每项带图标和 **Pending 数量**；每项最小宽度 120px |
| `Date Range:` + 日期框 | 直接用共用的 `DateRangePicker`（与 Dashboard 完全一致，含左侧快捷选择），宽 330px |
| 搜索框 | 宽 200px、高 36px，样式同 `ListToolbar`；输入的字母显示为大写，提示文字保持原样 |

**第二行**（上方一条细分隔线）：`Status:` + 四个图标方块。

小屏幕（高度 ≤ 720px）用 `short:` 收紧上下间距，控件太多时自动换行。

---

## 3. Status 筛选（图标方块）

四项单选，每项 = 图标方块 + 名称 + 数量。数量是**当前 Company / Group 页签下**各状态的行数。

| 项 | 图标 | 未选中图标底 | 选中 |
|---|---|---|---|
| Show All | 列表 | 浅青 `#d9f4fa` / 字 `#0b86a3` | 边框 `#0aa5c8`，图标方块实心青 |
| Pending | 时钟 | 浅蓝 `#dfeaff` / 字 `#0a3fc9` | 边框 `#1f6fe8`，图标方块和数量用登录页蓝色渐变 |
| Approved | 勾 | 浅绿 `#dcfce7` / 字 `#16a34a` | 边框 `#22c55e`，实心绿 |
| Rejected | 叉 | 浅玫红 `#ffe4ea` / 字 `#d63a58` | 边框 `#f0506e`，实心玫红 |

按钮形状：圆角方块（`rounded-[10px]`），图标方块 26px、`rounded-lg`，数量角标 `rounded-md`。选中时带同色投影和 1px 内描边；默认选中 **Pending**。

---

## 4. 列表列

| 列 | 可排序 | 内容 |
|---|---|---|
| No | 否 | 序号 |
| Company / Group | 是 | 名称，加粗；Group 页签下表头变成 `Group` |
| Name | 是 | 名称，没有时显示 `-` |
| Expiration | 是 | `dd-mm-yyyy` |
| Remaining | 是（按到期日） | 带圆点的徽章，见第 5 节 |
| Period | 否 | Pending 行是 `PeriodSelect`，已处理的行是文字 |
| Price | 是 | 选了周期才显示，否则灰色 `—` |
| Charge | 否 | `ChargeSwitch` |
| Status | 否 | 带圆点的徽章，见下表 |
| Action | 否 | 三个固定格子，见第 7 节 |

Status 徽章颜色：

| 状态 | 底色 | 字色 | 边框 | 圆点 |
|---|---|---|---|---|
| Pending | `#dfeaff` | `#0a3fc9` | `#aac6ff` | `#1f6fe8` |
| Approved | `#dcfce7` | `#13873f` | `#a7f0c0` | `#22c55e` |
| Rejected | `#ffe4ea` | `#c8304f` | `#ffc2cf` | `#f0506e` |

不设最小宽度，用 `fitWidth` 收紧列间距，表格随内容收缩（No 列 36px，Price 内容最小宽 54px，避免选周期时价格位数变化把整张表撑动）；在 1000 宽及以上的窗口都没有横向滚动；默认排序按到期日从近到远。没有批量选择，所以不会出现勾选列。

---

## 5. Remaining 档位

列表只会出现 30 天内的行，所以分四档，越接近到期颜色越深、光晕越快：

| 档位 | 条件 | 文案 | 颜色（底 / 字 / 边框） | 动效 |
|---|---|---|---|---|
| 30 天 | 剩余 16–30 天 | `N days left` | `#fff7cf` / `#7a5c00` / `#f3e18b` | 静止 |
| 15 天 | 剩余 8–15 天 | `N days left` | `#ffeddb` / `#a84300` / `#ffd2a6` | 每 5.2 秒一圈光晕 |
| 7 天 | 剩余 1–7 天 | `N days left` | `#ffe1d6` / `#b0340d` / `#ffb9a3` | 每 4 秒一圈光晕，圆点同时淡一下 |
| 过期 | 剩余 ≤ 0 天 | `Expired` / `Expires today` | 红色渐变（`#f08a8e → #dc4c53`）/ 白字 | 每 3 秒一圈光晕，圆点同时淡一下 |
| 已处理 | Approved / Rejected 的行 | 同上文案 | 灰 `#eceef2` / `#6b7280` | 静止 |

- 光晕是一圈 7px 向外扩散的淡色阴影（`box-shadow`），一次约 1 秒，其余时间静止。颜色来自徽章的 `--glow` 变量。
- 相邻行的动画延迟错开（`(行号 × 0.7) % 4` 秒），不会整列同时闪。
- 系统开启"减少动态效果"时全部关闭（徽章和圆点都带 `motion-reduce:animate-none`）。
- 阈值（7 / 15 / 30）写在 `remainingTier()`，改一处即可。

---

## 6. Period 下拉卡片

文件：`PeriodSelect.jsx`（Radix Popover，与 `DateRangePicker` 同一套做法）。

**触发按钮**：宽 148px、高 28px、`rounded-lg`。

| 状态 | 样式 |
|---|---|
| 未选 | 虚线灰蓝边框，文字 `Select period` |
| 已选 | 实线浅蓝边框 + 浅蓝渐变底，显示周期名 |
| 展开 | 实线 `#2f8dff` 边框，下方两个圆角变直，与卡片连成一体 |

**下拉卡片**：宽度**始终等于触发按钮宽度**（`w-(--radix-popover-trigger-width)`），紧贴按钮下方展开，边框 `#2f8dff`。

- 5 个周期：7 days / 1 month / 3 months / 6 months / 1 year，每行左边周期名、右边价格（粗体）。
- 选中行：浅蓝底 `#e8f2ff` + 左侧 3px 蓝色竖条 + 蓝色字。悬停行：`#f4f9ff`。
- 底部（浅蓝渐变条，上下两行都占满整个卡片宽度，避免窄卡片里被截断）：
  - 第一行：`CURRENT` + 划线的旧到期日（灰）。
  - 第二行：白底蓝边小卡片，左边小箭头 + `NEW`，右边蓝色粗体的新到期日。
  - 悬停哪个周期就预览哪个；没悬停时显示已选周期；两者都没有时显示 `Hover to preview new expiry`。
- 新到期日 = 原到期日 + 周期天数；如果已经过期，则从今天起算。

---

## 7. Charge 开关与 Action 列

**Charge 开关**（`ChargeSwitch.jsx`）：40×18px，`rounded-[5px]`，滑块 14px；文字 `ON` / `OFF`，7.5px 粗体。

| 状态 | 颜色 |
|---|---|
| ON | 登录页蓝色渐变 + 顶部高光，滑块在右 |
| OFF | 灰蓝渐变 `#b6c4d8 → #8497b3`，滑块在左 |

**Action 列**：固定三个格子 `grid-cols-[58px_50px_24px]`、间距 4px，整组居中，保证每一行的按钮上下对齐，不会因为有没有 Comm 图标而左右错位。

| 格子 | 内容 |
|---|---|
| 1 | `Approve`：登录页蓝色渐变；没选周期时禁用（半透明，提示 `Select a period first`） |
| 2 | `Reject`：石板灰渐变 `#94a3b8 → #64748b` |
| 3 | `Comm`：蓝色线条对话气泡，目前**禁用**，悬停提示 `Not available yet` |

已处理的行（Approved / Rejected）前两格留空，只保留第三格的 Comm。只读账号（`useCurrentUser().readOnly`）的 Approve、Reject、Charge 全部禁用，提示 `Read-only login`。

---

## 8. 当前的占位行为（接 API 时替换）

| 项目 | 现状 |
|---|---|
| 数据 | `buildMockRows()`：12 行，到期日按"今天"前后推算（过期 3 天、今天、5 / 7 / 12 / 15 / 22 / 30 天等），保证四档颜色始终都能看到 |
| 价格 | `基础价 × 周期倍率`，倍率（0.03 / 0.1 / 0.25 / 0.5 / 1）只是占位，不是真实规则 |
| Approve / Reject | 只把本行状态改成 Approved / Rejected，行会从 Pending 筛选里消失 |
| Charge | 只在页面里切换 |
| Date Range | 只保存选择，**不过滤列表**（还不确定它筛的是到期日还是申请日） |
| 页签数量 | 各页签里 Pending 的行数 |
| Comm | 禁用 |

接 API 时需要确认：Date Range 作用于哪个日期、真实的价格 / 周期规则、Reject 是否要二次确认、Comm 的功能，以及 Group 页签的列是否与 Company 完全一致。

---

## 9. 验证过的尺寸

1000×600、1100×620、1200×620、1280×560、1366×610、1440×760、1536×730、1600×800、1920×950 九个尺寸下（所有行都选到 1 year 这种最宽状态）：整页没有纵向或横向滚动，表格没有横向滚动条，筛选卡片、单元格内容、Period 弹窗都没有溢出或被覆盖，`oxlint` 无报错。选任意周期时各列宽度不变（逐行逐周期共 45 次切换，量过表头宽度和表格高度）。
