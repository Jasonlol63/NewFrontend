# Games Process 页面设计与 API 说明

Process 页（`/process`）在 **Game 公司（以及 Group 自己的数据）** 下显示 Games Process 列表：每个 Process 有一个 Process ID、若干 Description、一种币别、一周里要跑的天，以及 Data Capture 用的文字替换规则。可以新增、编辑、启用 / 停用、删除，新增时可以 Copy From 现有 Process，或一次用 Multi-Process 建多个。

- **已全部接 Spring Boot API**（`/api/process/*`、`/api/currency/available`），没有占位数据；改动后都重新读取列表。
- 页面外壳、列表卡片、弹窗外壳、颜色 token 沿用 Admin / Account，共用部分见 `admin-account-list-specs.md` 和 `form-modal-shared-design.md`，这里只写 Games Process 独有的部分。
- Bank 公司看到的是另一个列表，见 `bank-process-page-design.md`。
- 后端配对文档：`Count/docs/process-copy-from.md`（Copy From 与 formula 同步）；删除防护见 `Count/docs/frontend-springboot-migration.md` 第 37 节。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/pages/process/ProcessPage.jsx` | 页面入口：按当前公司类型选 Bank 或 Games 列表；Games 列表的工具栏、列、状态切换、删除、Add / Edit 弹窗的接线 |
| `src/pages/process/games/ProcessFormModal.jsx` | Add Process / Edit Process 弹窗（同一个组件）、Multi-Process 面板、Day Use 条、Description 框、Record 区 |
| `src/pages/process/games/DescriptionPickerModal.jsx` | "Select or Add Description" 弹窗（叠在 Process 弹窗上） |
| `src/pages/process/games/processRules.js` | 接口地址、`DAYS`、把接口行转成页面行（`normalizeProcessRow`）、搜索 / 排序 |
| `src/pages/process/games/processFormRules.js` | 表单校验、"Process ID 已被占用"的说明、两个接口的请求体 |
| `src/pages/process/games/useProcessList.js` | 列表读取、状态切换、批量删除、`reload()` |
| `src/pages/process/games/useProcessCurrencies.js` | 该公司的币别，给 Currency 下拉 |
| `src/pages/process/games/useProcessDescriptions.js` | 该公司的 Description 字典：读取、新增、删除 |
| `src/pages/process/games/processFormOptions.js` | 只剩一个 `MOCK_CURRENCIES` 占位常量，**Process 页已不用**，现在只有 Data Capture 的三处还在引用（等它们接币别 API 后可删） |
| `src/components/shared/form-modal/RecordBar.jsx`、`recordTime.js` | Bank 弹窗的记录条；Games 弹窗用自己的 `RecordSection`（见 5.7），时间格式化共用 `formatRecordTime` |
| `src/components/shared/list/useListScope.js`、`useListView.js`、`useRowActions.jsx`、`ListToolbar.jsx` | Group / Company 选择、搜索 / 排序 / 分页 / 选择、状态切换 + 删除确认流程、顶部卡片 |
| `src/App.jsx` | `/process` 路由指向 `ProcessPage` |

页面外框与 Account 一致：`flex h-full min-h-[520px] flex-col gap-[clamp(8px,1.5dvh,12px)] p-[clamp(10px,2dvh,16px)]`，整页不滚动，只有表格区域内部按页数翻。

---

## 2. 页面怎么决定显示哪个列表

`ProcessPage` 里：

```js
const isBank = scope.company !== null && Boolean(session?.tenant_has_bank);
```

- **选了某个 Company 且这个公司是 Bank 类型**（后端算好放在 `/auth/current-user` 的 `tenant_has_bank`）→ 直接渲染 `BankProcessView`，不再请求 Games 列表（`useProcessList(null)`）。
- **选了 Group 自己的数据**（`scope.company === null`）或 Game 公司 → Games 列表。
- 页面的"当前公司"就是会话所在的公司：点 Group / Company 选择器会调用 `/auth/switch-tenant`，侧边栏和所有页面一起跟着变（规则见 `frontend/CLAUDE.md` 第 8 条）。所以 Process 页不保存自己的公司选择。
- 列表里还会再按 `category === "GAME"` 过滤一次（`rows`），接口按公司返回的是该公司全部 Process。

---

## 3. 顶部工具栏（`ListToolbar`）

一张白色卡片，样式与 Admin / Account 完全相同。

**第一行**，从左到右：

| 控件 | 说明 |
|---|---|
| `Add Process` | 蓝色主按钮，打开 Add 弹窗。只读登录时禁用，悬停提示 `Read-only login` |
| 搜索框 | 宽 ≤ 260px，占位文字 `Search Process ID, Description`；搜 Process ID、Description、币别、状态、Day Use 的缩写（MO、TU……） |
| `Show All` / `Show Active` / `Show Inactive` | 三个筛选标签。**一个都不勾时只显示 Active**；`Show Inactive` 加上 Inactive；两个都勾显示全部；`Show All` 是"不分页，全部放进表格里滚动" |
| `Delete (n)` | 靠右，红色；n 是已勾选行数，0 时灰色不可点 |

**第二行**：`Group ID:` 和 `Company:` 两排按钮（`SegmentGroup`）。Group 只有一个且没有独立公司时不显示 Group 行；Group 下没有公司时不显示 Company 行。再点一下当前按钮可以切到"独立公司 / Group 自己的数据"（规则见 `useListScope`）。

选择器切换成功后调用 `view.reset()`：回到第 1 页、清空勾选。

---

## 4. 列表

`DataTable`（`boxedPager`、`fitWidth`、`minWidth="min-w-[640px]"`），列：

| 列 | 可排序 | 内容 |
|---|---|---|
| No | 否 | 序号（跨页连续） |
| Process ID | 是 | 加粗，不换行 |
| Description | 是 | 该 Process 所有 Description 用 `, ` 连起来；没有时 `-`；列宽不够时 `fit` 收缩成 `...`，悬停显示全文 |
| Status | 是 | `StatusBadge`：绿色 Active / 红色 Inactive，**点一下就切换**（见 4.2） |
| Currency | 是 | 白底蓝边小徽章，显示币别代码 |
| Day Use | 是 | 七个小方块 `MO TU WE TH FR SA SU`，该 Process 运行的天点亮 |
| Action | 否 | 编辑图标（打开 Edit 弹窗），只读登录时禁用 |

最右边还有一列勾选框（`DataTable` 自带）。

### 4.1 Day Use 小方块（`DayUse`）

| 状态 | 外观 |
|---|---|
| 运行的天 | 浅蓝底 `#e0edff`、蓝边 `#bcd9fb`、深蓝字 `#1d4ed8` |
| 不运行的天 | 灰底 `#eef2f7`、无边框、灰字 `#9ca3af` |

尺寸：高 22px、最小宽 27px、10.5px 粗体、间距 3px；窗口宽 ≤ 1100px 时宽 23px、9.5px 字、间距 2px。悬停显示星期全称。排序按"哪周开始得早，其次天数多"（把天数字符串拼起来比较）。

### 4.2 状态切换、勾选和删除

- **点状态徽章**：调用 `POST /api/process/update-status`，成功后只更新那一行的状态（不重读列表）；请求期间徽章变成处理中状态（`pendingIds`）。失败弹出 `Status not changed` 对话框，内容是后端的原话。
- **只有 Inactive 的行可以勾选**（后端也只允许删除 Inactive）；只读登录时全部不可勾选。
- **Delete (n)**：先弹确认框 `Delete 2 processes?`，一行时写出名字 `CODE (DESCRIPTION)`。确认后**逐个**调用 `/delete-process`，所以中途失败时前面已删掉的仍然会从列表里消失（`finally` 里统一移除），失败那条的后端原话显示在 `Delete failed` 对话框里。
- 删除成功后清空勾选（`onDeleted: view.clearSelection`）。
- 默认排序：按 Process ID（数字在前，`numeric: true`），相同时按 Description。

### 4.3 列表请求

`useProcessList(tenantId)`：

- 切换公司时，上一家公司的行继续显示、整张表变淡（`loading`），新数据到了才替换；请求带 `AbortController`，切得快时旧请求会被取消。
- 读取失败时 `rows` 变空，错误显示在列表上方的红色条里（与 Group / Company 选择器的错误合并显示）。
- `reload()`：对同一家公司再读一次（新增 / 编辑成功之后调用）。

---

## 5. Add Process / Edit Process 弹窗

`ProcessFormModal`（`mode: "add" | "edit"`），外壳是 `FormModal`（全内容区、毛玻璃、侧边栏保持清晰，Back / Cancel / 蓝色保存键，`Esc` 关闭）。标题图标 Add 是 `FilePlus2`，Edit 是 `FilePen`；保存键文字 Add 是 `Add Process`，Edit 是 `Update Process`。

### 5.1 布局（按内容区宽度，不是屏幕宽度）

| 内容区宽度 | 布局 |
|---|---|
| ≥ 900px | 两栏：**左**=Information；**右**=Text & Replacement（上）+ Schedule（下，`flex-[1.15]` 稍高） |
| < 900px（竖屏平板 / 手机） | 一栏，整个弹窗上下滚动，卡片顺序不变 |

高度越矮越紧凑：`modal-compact`（≤760）、`modal-tiny`（≤600）。Description 框高 `clamp(84px,13dvh,140px)`，compact 时 72px，tiny 时 64px。

### 5.2 Information 卡片

| 字段 | 说明 |
|---|---|
| Copy From（可选，**仅 Add**） | 下拉，列出该公司 **Active** 的 Process，文字 `CODE (DESCRIPTION)`；右侧有 x 可清除 |
| Process ID | 文本框，**输入时自动转大写并保持光标位置**；Edit 时灰色不可改（后端从不改已建立的 Process ID）。Add 时右边有 `Multi-Process` 按钮 |
| Currency | 下拉，选项来自 `/api/currency/available?tenant_id=…`，显示代码，值是币别 id；Edit 里可以改 |
| Description（必填） | 一个框，已选的 Description 显示成蓝色小标签（带 x 可移除），点框或右上的 `Add` 打开 Description 选择弹窗 |
| Save Data Capture Table | 开关 On / Off，对应后端 `enableSaveDraft`（Data Capture 页的 Save Draft） |
| Record（**仅 Edit**） | 见 5.7 |

### 5.3 Text & Replacement 卡片

| 字段 | 说明 |
|---|---|
| Remove Word（可选） | 多行文本框，提示：多个词用逗号 `,` 分隔；只匹配整个词时在前面加 `=` |
| Replace From / Replace To（可选） | 两个文本框，**保存时转大写**，提示 `Word to be replaced` / `Replacement word`；< 600px 时叠成一列 |

### 5.4 Schedule 卡片

- **Day Use**：一条细长的分段条：`ALL DAY` + `MON … SUN`，可多选；七天都选上时 `ALL DAY` 自动亮起，点它可以全选 / 全清。选中是蓝色渐变（`bg-brand-sweep`）。< 600px 时变成 4 列，`ALL DAY` 占整行。
- **Remarks**（可选）：多行文本框，占满卡片剩下的高度，**保存时转大写**。

### 5.5 Copy From（仅 Add）

选了一个 Process 后，表单立刻被它的值填满：Currency、Save Data Capture Table、Remove Word、Replace From / To、Remarks、Description（整组替换）、Day Use（整组替换）。**填进去之后全部仍可修改**；清除下拉（x）只是不再复制，已经在表单里的值保留。

保存时的请求带上表单里**当时**的值（不是源 Process 的值），再带 `copyFromProcessId`。后端按源 Process 重新读一遍并校验"必须是 Active"，然后：

- 请求里带的字段优先；没带的才用源的值；
- **源 Process 的所有 formula 一定会复制过来**，并且和源建立 formula 同步关系（任何一边编辑 formula，另一边同步；删除不同步，细节见 `Count/docs/process-copy-from.md`）；
- 如果选的源本身就是别人 Copy From 出来的，后端会静默改成链条的"根"（所以关系永远是一个根对多个子）。

### 5.6 Multi-Process（仅 Add）

点 Process ID 右边的 `Multi-Process`，Process ID 输入框换成"现有 Process ID 的勾选区"：

1. **展开状态**：搜索框 + `Select all`（只全选当前搜索结果）+ `Clear`，下面是网格（`repeat(auto-fill, minmax(108px,1fr))`），高 `clamp(170px,30dvh,300px)`，底栏显示 `n of N selected` 和 `Done`。
2. **Done 之后折叠**成一排小标签（带 x），点这个框或 `Add` 可再展开；按钮 `Multi-Process`（此时是按下状态）再点一下回到手输单个 ID。
3. 选项来自列表里**去重后的 Process ID**（同一个 ID 可以有多行，只要 Description 不同）。

保存时每个勾选的 ID **各发一个** `/add-process`，其它字段（币别、Description、天、文字）共用表单里的值。这是前端按顺序逐个发的，不是一次事务：

- 全部成功 → 弹窗关闭，重读列表；
- 中途第 k 个失败 → 前 k-1 个已经建好，页面会重读列表，弹窗留着，底部红字写 `Created 2 of 5 (A, B). C failed: …`，并且已建好的 ID 从勾选里去掉，修好后可以直接再点保存继续建剩下的。

### 5.7 Record（仅 Edit）

Information 卡片最下面一块，两行只读：`Modified` 和 `Created`，每行是时间（`formatRecordTime`）加一个蓝色小标签，写操作人的登录名（`updatedBy` / `createdBy`）。

### 5.8 校验

保存前先在前端校验（`validateProcessForm`），第一个问题显示在弹窗底部红字里：

| 情况 | 提示 |
|---|---|
| Add，没填 Process ID | `Process ID is required` |
| Add + Multi-Process，一个都没勾 | `Select at least one Process ID` |
| 没选币别 | `Currency is required` |
| 一个 Description 都没选 | `Select at least one description` |

通过后再查"同 Process ID + 同 Description 是否已被别的 Process 占用"（`findProcessIdInUse`，用列表里的数据查，Edit 时排除自己）：占用时提示 `Process ID 123 already in use: SLOT, FISH`，**指明是哪几个 Description**。后端也会查并只回 `Process ID already in use`；数据库里还有一条触发器兜底（并发也防得住）。规则是：**同一个 Process ID 可以出现多次，但不能和同一个 Description 配两次**。

校验通过后弹窗里保存键变成处理中，防止连点；底部还会显示币别 / Description 字典读取失败的错误（`currencies.error`、`descriptionList.error`）。币别还没读完时保存键不可点。

---

## 6. Select or Add Description 弹窗

从 Description 框打开，叠在 Process 弹窗上面（同样全内容区，侧边栏保持清晰），标题 `Select or Add Description`，保存键 `Confirm Selection (n)`（窄屏缩成 `Confirm (n)`）。

| 内容区宽度 | 布局 |
|---|---|
| ≥ 900px | 两栏：**左** Selected Descriptions（`1fr`）｜**右** Available Descriptions（`1.7fr`） |
| < 900px | 一栏：Available 在上（固定高 460px）、Selected 在下（最小高 220px），整体上下滚动 |

**Available Descriptions**（右 / 上）

- 顶部是新增区：一个输入框 `ENTER NEW DESCRIPTION NAME...`（自动大写）+ `Add`，回车也能新增。新增成功后新名字**自动勾选并排到最前面**。重复（前端按已有名字查）显示 `"XXX" already exists`，后端重复显示 `Description name already exists!`。
- 下面是搜索框 + `Select all`（只全选当前搜索结果）。
- 网格 `repeat(auto-fill, minmax(168px,1fr))`，每格：勾选框 + 名字，右边一个小红 x 删除。**勾上的 Description 不能删**（x 变灰，提示 `Untick it first to delete`）；点 x 先弹确认框 `Delete description?`。

**Selected Descriptions**（左 / 下）：已勾选的网格（`minmax(132px,1fr)`），每格带 x 取消勾选；右上角 `n selected` 和 `Clear all`。

**新增和删除是立刻保存到后端的**（不等 `Confirm`），列表跟着更新；`Confirm Selection` 只是把勾选结果交回 Process 弹窗，真正保存到 Process 还是要点 Process 弹窗的保存键。取消弹窗不会撤销已经做的新增 / 删除。

---

## 7. API 对照

所有请求都是 `postJson`（POST、`credentials: include`），成功判断用返回体的 `success: true`，失败时抛出后端的 `message`；401 会跳登录页。

| 功能 | 接口 | 请求体 | 前端函数 / 位置 |
|---|---|---|---|
| 列表 | `POST /api/process/process-list` | 公司 id 本身（一个数字，不是对象） | `useProcessList` |
| 新增 | `POST /api/process/add-process` | 见下 | `ProcessPage.submitProcess` ← `buildProcessRequest` |
| 编辑 | `POST /api/process/update-process` | 见下 | 同上 |
| 启用 / 停用 | `POST /api/process/update-status` | `{ id, tenantId }` | `useProcessList.toggleStatus` |
| 删除 | `POST /api/process/delete-process` | `{ id, tenantId }` | `useProcessList.deleteRows`（逐个） |
| Description 列表 | `POST /api/process/list-description` | 公司 id 本身 | `useProcessDescriptions` |
| 新增 Description | `POST /api/process/add-description` | `{ tenantId, name }` | 同上 `add`，返回新项 |
| 删除 Description | `POST /api/process/delete-description` | `{ id, tenantId }` | 同上 `remove` |
| 币别下拉 | `POST /api/currency/available?tenant_id=…` | 无 | `useProcessCurrencies` |

**列表返回**（每个 `ProcessDTO`）：

```
{ id,
  process: { id, tenantId, category, code, copiedFromProcessId, enableSaveDraft, currencyId,
             removeWord, replaceWordFrom, replaceWordTo, remark, status, createdBy, updatedBy, createdAt, updatedAt },
  currencyCode,
  processDescriptions: [{ id, name }],
  processDays: [{ dayOfWeek }] }          // 1 = 周一 … 7 = 周日
```

`normalizeProcessRow` 把它压平：`status` 转小写、`days` 去重排序并只留 1–7、`description` 是名字用 `, ` 拼起来、`descriptionIds` 留给表单和"已占用"检查用。后端按 Process ID 排序；**登录的是员工账号并且被限制了 Process 权限（`process_acl_mode` 为 NONE / CUSTOM）时，列表只返回被允许的那几条**，所以不同员工看到的列表可能不同。

**新增请求体**（`buildProcessRequest`，Multi-Process 时每个 ID 一份）：

```
{ tenantId, code, currencyId: <数字>, descriptionIds: [id…], dayOfWeeks: [1..7 升序],
  removeWord, replaceWordFrom (大写), replaceWordTo (大写), remark (大写),
  enableSaveDraft: <Save Data Capture Table 开关>,
  copyFromProcessId?: <Copy From 的 Process id> }
```

**编辑请求体**：同上但不带 `code`、`copyFromProcessId`，带 `id`。

---

## 8. 后端规则（前端依据）

**新增**（`ProcessServiceImpl.addNewProcess`）

- 需要登录 + 写权限；Process ID 去空格转大写；`category` 不传默认 `GAME`；状态固定 `ACTIVE`。
- 币别必须属于该公司（`Currency not found!`）；每个 `descriptionId` 必须属于该公司（`Description not found: id`）；天数只收 1–7，重复的忽略。
- `(公司, category, code, description)` 不能重复，否则 `Process ID already in use`。
- 同一个 Process ID 允许建多行（例如同一供应商代码拆成几段、各有各的解析规则）。
- 新建的 Process 会自动加进"自定义权限"的管理员的可见名单（`grantProcessToCustomAdmins`），他们不用再手动授权才看得到。
- `enableSaveDraft` 只有 `GAME` 才会为 true，Bank 永远是 false。
- 写审计日志（`PROCESS` 模块）。

**编辑**（`updateProcess`）

- Process ID、category 不会变；币别、Remove Word、Replace From / To、Remarks、Save Draft 覆盖；**Description 和 Day Use 是整组删掉再重建**（所以前端必须把完整的集合发回来，而不是只发改动）。
- 同样检查 `(code, description)` 冲突，排除自己。

**状态切换**：Active ⇄ Inactive 互换，返回更新后的整行（前端取 `data.status`）。

**删除**（`deleteProcessById`）：只允许 **Inactive**（`Process is not inactive, cannot be deleted!`）；该 Process 在 transactions 里有记录时拒绝（`Process has existing transaction cannot be deleted!`）；Description 关联、Day、已提交记录随外键级联删除。

**Description 字典**：名字去空格转大写，同公司内唯一（`Description name already exists!`）；删除需要写权限。

---

## 9. 已知情况和注意点

- **删除 Description 会把它从所有用到它的 Process 上拿掉。** 数据库外键是 `ON DELETE CASCADE`，后端删除时也不检查有没有 Process 在用。前端的保护只有"这次弹窗里勾着的不能删"，勾选的是当前 Process 的，并不代表别的 Process 没用到它。删之前请确认，需要时可以在后端加"被使用则拒绝"。
- **Description 和 Day Use 编辑是整体替换**：Edit 里把所有 Description 都 x 掉会被前端拦住（至少一个），但直接调接口发空数组，后端会把关联清空。
- **Copy From 之后源 Process 的 formula 双向同步**是后端行为，前端没有任何提示；复制出来的 Process 在 Maintenance 的 Formula 页改 formula 会连带改到源那一份。
- **Multi-Process 不是事务**：见 5.6，部分成功是正常情况，已建的不会回滚。
- **只读登录**：Add、Edit、勾选、状态徽章都禁用；弹窗里不会出现，因为入口已经禁用。
- **列表不分公司缓存**：切换公司后旧公司的行会短暂保留并变淡，数据到了才换，属于预期行为。

---

## 10. 手动验证清单

1. 用 Game 公司登录，进入 `/process`，列表出现；切到 Bank 公司，页面换成 Bank Process。
2. Add：不选币别 / 不选 Description 分别看到提示；正常新增后出现在列表（默认只显示 Active）。
3. 同一个 Process ID 再建一个、Description 有重叠：看到 `already in use: …` 并列出重叠的名字。
4. Copy From：选一个 Process，表单被填满，改一两个字段保存；新 Process 的 formula 与源一致。
5. Multi-Process：勾 3 个现有 ID，人为让第 2 个失败（比如占用冲突），确认提示 `Created 1 of 3 …`，且已建的那个在列表里。
6. Edit：Process ID 不可改，Record 区有 Modified / Created；保存后 Day Use 方块更新。
7. 状态徽章切到 Inactive，勾选并删除；对有交易的 Process 删除，确认显示后端的拒绝原因。
8. Description 弹窗：新增（自动勾选并置顶）、重复名字、勾着的不能删、删除后列表更新。
9. 窗口 1280×560 与 1536×730：整页不滚动，弹窗里两栏 / 一栏切换正常（< 900px 内容区时一栏滚动）。
