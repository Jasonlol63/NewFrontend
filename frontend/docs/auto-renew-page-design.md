# Auto Renew 页面设计说明

Auto Renew 列出 30 天内即将到期（或已到期）的 Company / Group，操作人为每一行选一个续期周期，再 Approve 或 Reject。

- 已接后端 `/api/auto-renew`（list / approve / reject / delete）和 Domain 的分账接口，没有占位数据。唯一只存在页面里的是 Pending 行已选的 **Period 和 Charge**：后端在 Approve 之前没有地方存它们，刷新页面会清空（接口见第 9 节）。
- 列表的壳（表头、斑马纹、悬停行、毛玻璃外框、页脚、翻页）直接复用 Admin / Account 的 `DataTable`，尺寸见 `admin-account-list-specs.md`，这里不重复。
- 所有按钮和选中项的蓝色都是登录页的渐变（`bg-brand-sweep`：`#0a3fc9 → #2f8dff → #3fc4ff`）。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/auto-renew/AutoRenewPage.jsx` | 页面：读列表、持有状态，定义列，Approve / Reject / Undo，拼装筛选卡片、`DataTable` 和弹窗 |
| `src/pages/auto-renew/autoRenewApi.js` | 所有后端调用：列表（连同分账和账号）、approve、reject、undo、保存分账 |
| `src/pages/auto-renew/ChargeDialog.jsx` | Comm 按钮打开的 Charge 弹窗（第 7 节） |
| `src/pages/auto-renew/AutoRenewFilterCard.jsx` | 顶部筛选卡片（M1 排版） |
| `src/pages/auto-renew/StatusFilter.jsx` | Status 行：图标方块 + 数量 |
| `src/pages/auto-renew/PeriodSelect.jsx` | Period 下拉卡片 |
| `src/pages/auto-renew/ChargeSwitch.jsx` | Charge 小开关 |
| `src/pages/auto-renew/autoRenewRules.js` | 周期表（含后端编码）、价格、新到期日、后端行转页面行（`toRow`）、Remaining 档位、颜色表、搜索 / 排序 |
| `src/pages/domain/SharePanel.jsx` | 弹窗右栏的 Share，与 Domain 页共用（窄屏时页签、Profit 卡和账号行会换行） |
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
| Price | 是 | 选了周期才显示，否则灰色 `—`。永远是后端全局价表里该类型（公司 / 集团）和周期的价格，不能修改；已处理的行显示批准时的价格 |
| Charge | 否 | `ChargeSwitch` |
| Status | 否 | 带圆点的徽章，见下表 |
| Action | 否 | 三个固定格子，见第 8 节 |

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

- 5 个周期：7 days / 1 month / 3 months / 6 months / 1 year，每行左边周期名、右边价格（粗体，来自后端价表；没配价格的显示 0.00）。后端编码分别是 `7days / 1month / 3months / 6months / 1year`，页面用 `7d / 1m / 3m / 6m / 1y`，由 `PERIODS` 互相转换。
- 选中行：浅蓝底 `#e8f2ff` + 左侧 3px 蓝色竖条 + 蓝色字。悬停行：`#f4f9ff`。
- 底部（浅蓝渐变条，上下两行都占满整个卡片宽度，避免窄卡片里被截断）：
  - 第一行：`CURRENT` + 划线的旧到期日（灰）。
  - 第二行：白底蓝边小卡片，左边小箭头 + `NEW`，右边蓝色粗体的新到期日。
  - 悬停哪个周期就预览哪个；没悬停时显示已选周期；两者都没有时显示 `Hover to preview new expiry`。
- 新到期日与后端一致：永远从当前到期日起算（已过期也**不**从今天算），7 天加 7 日，其余按日历月 / 年加，当月没有的日子退到月末（等同 `LocalDate.plusMonths`）。

---

## 7. Charge 弹窗（Comm 按钮）

文件：`ChargeDialog.jsx`。用共用的 `FormModal` / `FormCard`：填满内容区、Sidebar 不被盖住，外壳、按钮、卡片与 Domain 的 Settings 弹窗一致。标题 `Charge · 公司代码`。

**左栏 Renewal**（宽 4 : 右栏 6）

| 项 | 说明 |
|---|---|
| Period | 同一个 `PeriodSelect`，与列表**共用同一份状态**：弹窗里换周期，列表立刻变，反过来也一样 |
| Price | **只读**，显示该周期的后端全局价 |
| Charge | 同一个 `ChargeSwitch`，与列表共用同一个值；关闭时右栏 Share 整块变灰禁用，**没有单独的 Share 开关** |
| Current / New | 原到期日（划线）和新到期日；已处理的行只显示后端记录的新到期日 |

**右栏 Share**：直接用 Domain 的 `SharePanel`（价格行、Profit 卡、Sales / CS / IT 页签、账号分配）。

- 数据与 Domain 页是**同一份**（`tenant_fee_share_allocate`）：页面加载时从 `/api/domain/list` 读，账号下拉用 C168 里 STAFF / AGENT 的 Active 账号。
- 点 Save 时，只有分账改过才调 `PUT /api/domain/update-setting`，只带分账行和这一行的到期日，**不带收费标志，所以不产生账**；Profit 自动取剩余比例。失败时错误显示在弹窗底部，弹窗不关。
- Period、Charge 的改动立刻写进页面状态；Cancel / Back / Esc 把这一行还原成打开时的样子，Share 则要 Save 才写入后端。
- Charge 开着时，分账行没选账号或总和超过 100%，Save 灰掉并提示原因。
- 只读登录和已处理（Approved / Rejected）的行只能查看：输入禁用，Save 灰掉，底部提示 `View only`。

**各尺寸**：宽屏左右分栏；内容区窄于 800px 上下叠放；窄于 480px 时 Share 的三个部门页签改单列，Profit 金额换行，账号行改成上下两行。1280×560 到 1920×950、1000×600、768×1024、375×812 都检查过：整页无滚动，弹窗无溢出，只有账号列表在卡片内部滚动。

---

## 8. Charge 开关与 Action 列

**Charge 开关**（`ChargeSwitch.jsx`）：40×18px，`rounded-[5px]`，滑块 14px；文字 `ON` / `OFF`，7.5px 粗体。

| 状态 | 颜色 |
|---|---|
| ON | 登录页蓝色渐变 + 顶部高光，滑块在右 |
| OFF | 灰蓝渐变 `#b6c4d8 → #8497b3`，滑块在左 |

**Action 列**：固定三个格子 `grid-cols-[58px_50px_24px]`、间距 4px，整组居中，保证每一行的按钮上下对齐，不会因为有没有 Comm 图标而左右错位。

| 格子 | 内容 |
|---|---|
| 1 | `Approve`：登录页蓝色渐变，见下 |
| 2 | `Reject`：石板灰渐变 `#94a3b8 → #64748b`；点后先弹确认框 `Reject request?`，确认才调接口 |
| 3 | `Comm`：蓝色线条对话气泡，打开第 7 节的弹窗；该行已有分账时右上角有一个蓝点 |

**Approve 禁用的情况**（悬停给出原因）：没选周期；后端的 `can_approve` 为 false（这家公司在 C168 里没有对应账号，或付款方与收款方是同一个账号）；所选周期的价格是 0。请求进行中所有行的 Approve / Reject / Undo 都禁用，防止重复点击。

**已处理的行**（Approved / Rejected）前两格合并成一个 `Undo` 按钮：确认后调 `/api/auto-renew/delete`，把申请退回 Pending；撤回 Approved 还会回滚到期日并删除当时产生的账本流水，确认框里有说明。后端的 `can_delete` 为 false 时（比如之后又续过期）禁用。

只读账号（`useCurrentUser().readOnly`）的 Approve、Reject、Undo、Charge、Period 全部禁用，提示 `Read-only login`；弹窗里只能查看。

---

## 9. 后端接口与行为

| 动作 | 接口 | 说明 |
|---|---|---|
| 读列表 | `POST /api/auto-renew/list` | 每次读一个页签：`status: "all"`、`entity_type`、`date_from` / `date_to`。Pending 是到期日在 30 天窗口内的全部；Approved / Rejected 按**处理时间**落在 Date Range 内的。数量用返回的 `counts`、`tab_pending_counts` |
| 读分账 / 账号 | `POST /api/domain/list`、`POST /api/account/list` | 每行的 Sales / CS / IT 和账号下拉 |
| Approve | `POST /api/auto-renew/approve` | `{ request_id, period, charge_on_approve }`。后端把到期日延长，Charge 开着时按全局价和该公司已保存的分账向 C168 账本写入付款、佣金、净利润流水；价格 ≤ 0 或没有 Profit 分账会报错 |
| Reject | `POST /api/auto-renew/reject` | `{ request_id }` |
| Undo | `POST /api/auto-renew/delete` | `{ request_id }`，退回 Pending |
| 保存分账 | `PUT /api/domain/update-setting` | 见第 7 节 |

- 成功后重新读列表；Pending 行已选的 Period 和 Charge 会按申请 id 保留，其他行不丢选择。后端报错时在页面顶部显示红色提示条，行保持原样。
- 刷新页面会清空已选的 Period 和 Charge。要持久化需要在 `tenant_auto_renew` 加列，目前不做。
- 价格表里没配价格的周期（价格 0）批不了，要到 Domain 的 Price 里补。
- 保存分账时带的是列表读到的到期日；如果几乎同时有人批准了同一家的续期，理论上可能把到期日写回旧值。

---

## 10. 验证过的尺寸

1000×600、1100×620、1200×620、1280×560、1366×610、1440×760、1536×730、1600×800、1920×950 九个尺寸下（所有行都选到 1 year 这种最宽状态）：整页没有纵向或横向滚动，表格没有横向滚动条，筛选卡片、单元格内容、Period 弹窗都没有溢出或被覆盖，`oxlint` 无报错。选任意周期时各列宽度不变（逐行逐周期共 45 次切换，量过表头宽度和表格高度）。


Charge 弹窗另外在 1280×560、1366×610、1440×760、1536×730、1600×800、1920×950、1100×620、1000×600、768×1024、375×812 检查过，结果见第 7 节。
