# Domain 页面设计说明

Domain 页列出每个 Owner（域名主）和它名下的 Group / Company，可以新增、编辑。

- 已接 Spring Boot API（`domainApi.js`，仅 C168 能访问）：列表、新增、编辑、Set 设置、价格、删除都走后端，每次改动后重新读取列表。
- 页面外壳、弹窗外壳、颜色 token 都沿用 Admin / Account，共用部分见 `admin-account-list-specs.md` 和 `form-modal-shared-design.md`，这里只记 Domain 独有的部分。
- 所有蓝色都是项目的蓝渐变（`bg-brand-sweep`、`bg-seg-active`）；Groups、Companies 的标签是同一色相的深浅，不引入别的颜色。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/domain/DomainPage.jsx` | 列表页：工具栏 + 卡片行列表，打开 Add / Edit 弹窗 |
| `src/pages/domain/CodeChips.jsx` | Groups / Companies 的标签和 `+N` |
| `src/pages/domain/domainApi.js` | 接口调用：list / add / update / update-setting / delete / list-fee / add-fee、C168 账号列表 |
| `src/pages/domain/domainRules.js` | 把平铺行合并成 owner 行、价格转换、到期日格式、搜索、排序、折叠数量、删除资格 |
| `src/pages/domain/DomainFormModal.jsx` | Add Domain / Edit Domain 弹窗（同一个组件） |
| `src/pages/domain/MemberRow.jsx` | 弹窗里的一行 Group 或 Company，和公司的 Group 快捷菜单 |
| `src/pages/domain/domainFormRules.js` | 弹窗的草稿、未保存改动统计、保存条件、`/add`、`/update` 的请求体 |
| `src/pages/domain/domainSettingsRules.js` | Set 弹窗的规则、`/update-setting` 的请求体 |
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
| Domain Information（整行） | Add：Owner Code、Name、Email、Password、Secondary Password 一排五个；Edit：Owner Code、Name、Email、Password(选填)，再加 Secondary Password(选填，仅 Owner / Partnership / Admin 可见) |
| Groups（左） | `Group ID` 输入 + `Add`，下面是已添加列表，右上角 `N added` |
| Companies（右） | `Company ID` 输入、`Group (opt.)` 下拉、`Add`，下面是列表，右上角 `N added` 和 `Multiple Choice` |

- Secondary Password：只能输数字、最多 6 位，不足 6 位红框提示（Add 和 Edit 都一样）。
- `Save` 的条件：Add 要五个字段齐全且 Secondary Password 是 6 位；Edit 只要 Owner Code、Name、Email 有值（填了 Secondary Password 的话必须是 6 位）。
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

## 6. 接 API 后的行为

- **保存顺序**：先 `/add` 或 `/update`（owner + Group + Company），成功后拿到每个 tenant 的 id，再对 Set 过的 Group / Company 逐个 `PUT /update-setting`。owner 保存失败：弹窗保持打开；设置失败：owner 已保存，弹窗关闭并列出失败的代码，需重新 Set。
- **Owner Code** 编辑时只读（后端更新时不改它）。**Name 输入时自动转大写**（保存时也转一次）。Password 留空 = 不改。
- **Secondary Password**：Add 必填（6 位数字）；**Edit 里是可选的，只有 Owner / Partnership / Admin 看得到**（其他角色没有这一栏；后端本身不检查角色，只在前端限制），留空 = 不改，填了必须是 6 位数字。
- **Set 弹窗**：到期日 = Start Date + Period；后端只存到期日，所以重新打开时 Start Date / Period 为空，已有到期日时 Period 可以不选（到期日不变）。**Category（Company type）只能单选一个**，对应后端的 feature module（Games 1、Bank 2、Loan 3、Rate 4、Money 5）；Group 不发，后端默认 Games。
- **Share 开关 = 保存时收费（Charge on Save）**：开 = 发送分成行（Profit 为 C168 账号，其余 Sales / CS / IT）并让后端按所选 Period 的价格记账；关 = 不发分成行也不收费，已保存的分成保持不变。后端不保存开关，重新打开永远是关，已保存的分成行会显示出来。开启要求选了 Period、该 Period 价格大于 0、每行都选了账号、分成不超过 100%。
- **No Expiry Date**：Period 里多一项，只有 Owner / Partnership / Admin 看得到，保存为 `9999-12-31`，显示 `No Expiry`；选了之后 Share 开关自动关闭且不可开。
- **删除**：勾选的 owner 逐个 `POST /delete`，遇到第一个失败就停（例如 C168 下有交易记录），然后重新读取列表。
- **× 移除 Group / Company**：已保存的会先确认，说明 **C168 里的对应账号会保留**（`/update` 只删 tenant；只有删除整个 Domain 才会连 C168 账号一起清理，之前移除的公司不会被清掉）。
- **Share 的账号下拉**（和旧版一样）：只取 Active 的账号；Sales、CS、IT 只能选角色 STAFF / AGENT；Profit 只取角色 PROFIT（或账号就叫 PROFIT）的账号，默认 C168，其次 PROFIT，再其次第一个；已保存的分成行用到的账号不符合规则时仍保留在下拉里。
- 只读登录：Add、Delete、弹窗 Save 都不可用。

## 7. 仍然没做

- `+N` 点开怎么展示、平板和手机布局。
- 列表接口返回的 owner 带着加密后的 password / secondaryPassword（后端没有过滤），前端不用。
- 新建的 Group / Company 没设置 Set 就保存的话，到期日是空（NO SET），目前不拦截。
