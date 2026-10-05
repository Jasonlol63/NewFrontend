# Domain 页面设计说明

Domain 页列出每个 Owner（域名主）和它名下的 Group / Company，可以新增、编辑。

- 当前是**纯设计版**：没有接 API，数据是占位数据，所有操作只改页面自己的状态，刷新即还原。
- 页面外壳、弹窗外壳、颜色 token 都沿用 Admin / Account，共用部分见 `admin-account-list-specs.md` 和 `form-modal-shared-design.md`，这里只记 Domain 独有的部分。
- 所有蓝色都是项目的蓝渐变（`bg-brand-sweep`、`bg-seg-active`）；Groups、Companies 的标签是同一色相的深浅，不引入别的颜色。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/domain/DomainPage.jsx` | 列表页：工具栏 + 卡片行列表，打开 Add / Edit 弹窗 |
| `src/pages/domain/CodeChips.jsx` | Groups / Companies 的标签和 `+N` |
| `src/pages/domain/domainRules.js` | 占位数据、搜索、排序、折叠数量、删除资格 |
| `src/pages/domain/DomainFormModal.jsx` | Add Domain / Edit Domain 弹窗（同一个组件） |
| `src/pages/domain/MemberRow.jsx` | 弹窗里的一行 Group 或 Company，和公司的 Group 快捷菜单 |
| `src/pages/domain/domainFormRules.js` | 弹窗的占位数据、未保存改动统计、保存条件 |
| `src/components/shared/list/DataTable.jsx` | 新增 `variant="cards"` 和 `boxedPager`（见第 3、4 节） |
| `src/components/shared/list/useListView.js` | 新增 `rowGap` |
| `src/pages/admin/AdminPage.jsx`、`src/pages/account/AccountPage.jsx` | 传了 `boxedPager`，用同一个分页条 |
| `src/App.jsx` | `/domain` 路由指向 `DomainPage` |

---

## 2. 列表页

页面外框与 Admin 一致：`flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]`，整页不滚动。

### 2.1 工具栏（没有白色卡片框）

按钮、搜索框都在页面背景上，**统一高 36px**（`h-9`）。

| 控件 | 说明 |
|---|---|
| `Add Domain` | 蓝色主按钮，打开 Add 弹窗 |
| 搜索框 | 宽 ≤ 280px，提示文字 `Search by Owner Name/Company`，输入显示为大写；搜 Owner Code、Name、Email、Group、Company |
| `Price` | 灰蓝次按钮，**未接**（点了没反应，悬停提示 `Not available yet`） |
| `Delete (n)` | 靠右，**一直是红色**（沿用旧版），**未接**；n 是已勾选行数 |

### 2.2 列表（`DataTable variant="cards"`）

列：No、Owner Code、Name、Email、Groups、Companies、Created By、Action（编辑图标）、最右一列勾选框。

- **Groups 最多显示 2 个，Companies 最多显示 3 个**，多出的折成 `+N`（浅蓝到淡青渐变小标签，悬停显示被折叠的代码）。没有时显示浅色 `—`。
- Groups 标签：中等浅蓝底、深蓝字、蓝边；Companies 标签：白底、浅蓝边、深蓝字。同一行里靠深浅区分。
- **Created By 是 `SYSTEM` 的行没有勾选框，不能删除**（旧版规则，后端没有这条检查，只在前端）。
- 搜索、排序（Owner Code / Name / Email / Created By）、分页、勾选全部复用 `useListView`；默认按 Owner Code 排序。
- 不滚动：一页放几行由表格区域高度决定，放不下的翻到下一页。
- 窄屏不做专门布局，沿用 `fitWidth` 收紧列间距；手机尺寸不做。

---

## 3. `DataTable variant="cards"`

给 `DataTable` 加的可选样式，**默认不传，其他页面完全不变**。

| 项目 | 值 |
|---|---|
| 外框 | 没有（无边框、无毛玻璃、无底色） |
| 表头 | 一条浅蓝带（`#e4eefc`）、文字深蓝 `brand-navy` 14px、标题后带冒号（`No:`、`Owner Code:`） |
| 行 | 每行一张圆角卡片（单元格圆角 12px），行距 8px，带淡投影 `drop-shadow(0 2px 3px rgba(15,23,42,.1))` |
| **行背景** | 整行一道渐变：左 `#ffffff` → 中 `#e6f0ff` → 右 `#cfe2fd`（Sky sweep） |
| 悬停 / 选中 | 在行背景上叠一层半透明蓝：悬停 `rgba(47,111,239,.09)`，选中 `rgba(47,111,239,.2)` |
| 滚动 | 不滚动（`overflow-hidden`） |
| 底栏 | 没有底栏条；行数文字和分页条各是一个蓝渐变小胶囊 |

**渐变横跨整行的实现**：每个单元格画同一张整行宽度的渐变，再按自己的位置往左偏移（`useRowSweep`：`background-size = 表格宽`、`background-position = -单元格 offsetLeft`），拼起来是连续的一道。列宽变化（窗口缩放、字体加载、`fitWidth` 收紧列）会自动重算。

`useListView(rows, { …, rowGap })`：卡片之间的间距要同样传给它（Domain 用 8），它才能算准一页放几行（表头下面也有一个间距）。

---

## 4. 分页条（Sky tray）

`DataTable` 的 `boxedPager` 属性，`variant="cards"` 时自动开启；Admin、Account 页手动传了 `boxedPager`，其他页面还是原来的圆角白按钮。

- 托盘：圆角方块，从左上纯白斜向渐变到右下浅蓝（`#ffffff → #e4efff`），浅蓝细边 `#cfe0fa`，柔和蓝色阴影，顶部白色高光。
- 当前页：蓝色渐变方块（`#6fc8ff → #2f7bff → #0d60ff`），白字，发光阴影；其余页码和箭头深蓝字，悬停半透明白。
- 行数文字胶囊（`Showing 1–12 of 15 domains`）只有 `cards` 变体用，同一个渐变。
- **大小按屏幕高度变化**（越矮越小）：

| 屏幕高度 | 按钮 | 页码字号 |
|---|---|---|
| < 760px | 24px | 11px |
| 760 – 899px | 28px | 12px |
| ≥ 900px | 30px | 12.5px |

---

## 5. Add / Edit Domain 弹窗

`DomainFormModal`（`mode: "add" | "edit"`），外壳是 `FormModal`（毛玻璃、只盖内容区、Back / Cancel / Save、`Esc` 关闭）。**两个模式标题图标一样，都是地球。**

### 5.1 三张卡片

| 卡片 | 内容 |
|---|---|
| Domain Information（整行） | Add：Owner Code、Name、Email、Password、Secondary Password 一排五个；Edit：Owner Code、Name、Email、Password(选填) 一排四个，没有 Secondary Password |
| Groups（左） | `Group ID` 输入 + `Add`，下面是已添加列表，右上角 `N added` |
| Companies（右） | `Company ID` 输入、`Group (opt.)` 下拉、`Add`，下面是列表，右上角 `N added` 和 `Multiple Choice` |

- Secondary Password：只能输数字、最多 6 位，不足 6 位红框提示（Add 模式）。
- `Save` 的条件：Add 要五个字段齐全且 Secondary Password 是 6 位；Edit 只要 Owner Code、Name、Email 有值。
- 新增 Group / Company 会转大写，重复或空值有红色提示；删除一个 Group，属于它的公司自动变成 `No group`。

### 5.2 列表行（`MemberRow`）

`[代码 + 公司的 Group 标签] | 到期日期（行正中间） | [Set] [×]`

- **Set** 是整行最醒目的按钮：蓝渐变、高 30px、最小宽 62px；**×** 小而淡（灰蓝，悬停才变柔和玫红），和 Set 间距 14px，避免误点删除。
- 日期没设置过时显示灰色斜体 `Not set`。
- `Set` 现在没有动作（要打开的设置弹窗还没设计）。

### 5.3 公司进、出集团（只改弹窗里的草稿，Save 才算数）

- **单个快捷**：点公司行的 Group 标签（`Group AP ▾` / `No group ▾`），弹出菜单选一个 Group 或 `No group`，卡片里显示一行绿色提示（`CX moved to IG`）。
- **批量（Multiple Choice）**：点开后「添加输入行」被一条操作条取代（`N selected`、`All`、`Clear`、`Move to group…`、`Cancel`、`Done (n)`），每行前出现勾选框，点勾选框或整行都能选；选好公司和目标 Group 后 `Done` 才亮，点 `Done` 才批量移动并退出多选；`Esc`、`Cancel` 或再点一次 `Multiple Choice` 是放弃。
- **未保存提示**（Edit 模式）：被移动或新加的公司行有橙色小圆点，Group 标签外一圈橙边；弹窗底部左边显示 `N unsaved changes  applied when you press Save`，N 包括新增、删除、移动的 Group 和 Company。`Cancel`、`Back` 会丢弃全部改动。

### 5.4 尺寸

- 内容区宽度 ≥ 900px：Domain Information 始终一排，不折行；< 900px（平板）：2 列，整个弹窗上下滚动。手机不做。
- 高度越矮越紧凑：`modal-compact`（≤760）、`modal-short`（≤700，添加行上方的小标签隐藏，占位文字已经说明）、`modal-tiny`（≤600）。
- Multiple Choice 的操作条占用添加行的位置，不额外占高；在内容区 < 1100px 时允许换成两行。
- 1280×560 下 Edit 的 6 家公司全部可见。

---

## 6. 当前是占位的部分

| 项目 | 状态 |
|---|---|
| 列表数据 | `domainRules.js` 的 15 行占位数据；K、DEMO、TEST001 额外给了多个 Group / Company 用来展示 `+N`（`AB1`、`G1`、`MX` 等名字是编的） |
| Edit 里的日期和公司所属 Group | 从列表行自动生成的占位值（第一个 Group 的日期 `08-09-2027`；前两家公司进第一个 Group） |
| `Add Domain` 弹窗的 `Save` / `Edit` 的 `Save` | 只关闭弹窗，没有保存 |
| `Price`、`Delete`、`Set` | 点了没有动作 |
| `+N` | 只有悬停提示，点了没有展开 |

---

## 7. 接 API 前要知道的后端情况（读自 `Count/backend`）

- **列表** `POST /api/domain/list`（`ownerId` 可选）返回 `owner × tenant` 的**平铺行**（`owner left join tenant`），每行 `{ owner, tenant }`，字段是驼峰（`ownerCode`、`createdBy` 等）。要按 `owner.id` 合并成一行：`tenant.tenantType` 为 `GROUP` 的进 Groups，`COMPANY` 的进 Companies；owner 没有任何 tenant 时 tenant 是空的。没有分页、没有按登录人过滤。
- **删除** `POST /api/domain/delete`，请求体是 owner（`{ id }`）：一次一个 owner，会连带删掉它名下所有 Group / Company 和 C168 里对应的账户；如果其中任何一个 C168 账户有交易记录，整个删除被拒绝（报错信息里带公司代码）；需要可写权限，只读登录会被拒绝；有审计日志。`SYSTEM` 行不能删只是前端规则。
- 新增 `/add`、编辑 `/update`、单个设置 `/update-setting`、价格 `/list-fee`、`/add-fee` 也都在 `DomainController`；成功判断用返回体的 `success: true`（`postJson` 已支持）。
- **安全提示**：列表接口返回的 `owner` 带着 `password` 和 `secondaryPassword`（加密值），会随 JSON 到浏览器；前端不用，建议后端返回前置空或换一个不含密码的返回对象。

---

## 8. 还没做 / 还没定

- `+N` 点开怎么展示（弹窗 / 展开成多行）
- `Price` 点开是弹窗还是跳页
- `Set` 点开的设置弹窗（到期日、分成、模块）
- 平板（内容区 < 900px）和手机的专门布局
- 删除 Group / Company 是否要加确认（`×` 比文字按钮小，建议加行内确认）
