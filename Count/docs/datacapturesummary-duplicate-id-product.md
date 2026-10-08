# Data Capture Summary：同一个 Id Product 出现在多行时，公式被存错 / 刷新后错位

## 问题现象

- 一个 Process 的 Capture 表里，同一个 Id Product 可以出现在**多行**，互相独立。典型原因是 Replace Word：
  例如 `OVERALL → M99M06`，让 A 行也变成了 `M99M06`，于是表里有 A(0) / B(1) / D(3) 三行 `M99M06`。
- 在后面那一行（例如 D 行，`row_index=3`）设置公式（如 930.78）后，点 Summary 页面的刷新键：
  - 这条数据**跑到第一个 `M99M06` 行的下面**（变成了它的子行）；
  - 原来的 D 行变成一条空的 `M99M06`，看起来像"已经删除的行又冒出来了"；
  - 有时还会多出一行公式为 `0` 的 CITIBET 行，或者新增的子行直接不显示。
- 重新进入页面、或删除后重做，问题又不出现。

## 根因（共四处，叠加出现）

### 1. 后端：新增公式时，MAIN / SUB 的判断没有看行号

`DataCaptureSummaryServiceImpl.saveAddFormula()` 原来的判断是：

> 这个 Id Product 下只要已经有"带 account 的 MAIN"（`findMainWithAccount`，只按 Id Product 查），新公式就存成 SUB。

A 行的 `M99M06` 已经有 MAIN，所以 D 行的新公式被存成了 `M99M06` 的 SUB，而不是 D 行自己的 MAIN。
`saveAsMain()` 内部的 `findMainByProduct` 也只按 Id Product 取第一条，即便走 MAIN 分支，也会去覆盖 A 行那条 MAIN。

前端保存时把 D 行当作 MAIN 原地更新、页面看起来正常；后端实际存的是 SUB，刷新重新渲染后位置就变了。

### 2. 模板列表接口没有返回 `row_index`

Summary 页面通过 `POST api/maintenance/formula-maintenance/list` 取模板，这个接口：

- `MaintenanceMapper.xml` 的 `findFormulaMaintenanceRows` 的 SELECT 里没有 `row_index`，`MaintenanceFormulaDTO` 也没有该字段；
- 前端 `summaryApi.js` 的 `toTemplateShape` 自然也没有 `row_index`。

前端匹配逻辑（`findMainRowForTemplate`、`findMainRowForSubTemplatePure`）本来就是按 `row_index` 区分同名行的，
但拿到的 `row_index` 永远为空，于是：SUB 一律挂到第一个同名 MAIN（`return mains[0]`）。

### 3. 前端：同名 MAIN 被合并，且"父行"判断取的是第一个同名 MAIN

- `summaryApi.js` 的 `buildTemplatesFromFormulaRows` 里 `templates[idProduct] = shaped`，同名的多条 MAIN 只会留下最后一条；
  `summaryTemplatePopulatePure.js` 里写好的 `template.allMains` 分支从来没有数据来源，没被触发过。
  没有被保留的那条 MAIN 只能靠 localStorage 草稿显示，所以"清掉草稿 / 换浏览器就不对"。
- `isParentRowSuppressed()` 和 `populateSummaryRowsPure` 里给 SUB 找父行时，用 `find` 取到的是**第一个**同名 MAIN，
  不是 SUB 真正的父行。只要第一个同名 MAIN 被标记过"删除"（localStorage 的 `summarySuppressedRowKeys`），
  这个 Id Product 下所有 SUB 都会被过滤掉，表现为"子行直接不显示"。

### 4. 前端：刷新恢复草稿时，空行会抢走同名另一行的草稿（刷新后同一条数据出现两次）

点刷新键（`handleRefresh`）会先把当前行存成 localStorage 草稿（只存有 account 或公式的行），再重新生成骨架行并按草稿恢复。
`findSavedRowForRestore()` 的最后一级兜底只比 Id Product（不比行号）。同名行里排在前面的空行（例如 B 行，`row_index=1`）
会先于 D 行（`row_index=3`）去匹配，把属于 D 行的草稿抢走；D 行本身虽然由数据库模板填好了，结果就是 B、D 两行都显示同一条公式，合计也被算重。

这条路径**必须有草稿才会触发**：清掉 localStorage 后新增一次、不清草稿直接刷新，才会复现；只清草稿后重新进入页面则看起来正常，容易被误判为"已修好"。

## 修复

### 后端

- [`DataCaptureSummaryServiceImpl.java`](../backend/src/main/java/com/eazycount/service/impl/DataCaptureSummaryServiceImpl.java)
  `saveAddFormula()` 改为按 `row_index` 判断：
  | 情况 | 结果 |
  |---|---|
  | 请求带 `rowIndex`，且该 Id Product 没有"没有 row_index 的旧 MAIN" | 按行判断 |
  | 按行判断：该 `row_index` 已有 MAIN 且有 account | 存成 SUB（在这一行下面追加子行） |
  | 按行判断：该 `row_index` 没有 MAIN，或有 MAIN 但没有 account | 存成 MAIN（前者新建，后者更新那一行） |
  | 请求没带 `rowIndex`，或存在没有 row_index 的旧 MAIN | 沿用原规则（同 Id Product 有带 account 的 MAIN 就存 SUB） |

  `saveAsMain()` 不再自己按 Id Product 查，改由调用方把目标行传进来，避免覆盖同名的另一行 MAIN。
- [`DataCaptureSummaryDao.java`](../backend/src/main/java/com/eazycount/dao/DataCaptureSummaryDao.java) /
  [`DataCaptureSummaryMapper.xml`](../backend/src/main/resources/mybatis/DataCaptureSummaryMapper.xml) 新增
  `findMainByProductAndRowIndex`、`findMainWithoutRowIndex`。
- [`MaintenanceMapper.xml`](../backend/src/main/resources/mybatis/MaintenanceMapper.xml) 的 `findFormulaMaintenanceRows` 增加
  `f.row_index AS rowIndex`；[`MaintenanceFormulaDTO.java`](../backend/src/main/java/com/eazycount/dto/MaintenanceFormulaDTO.java)
  增加 `rowIndex`。Formula Maintenance 页面共用这个接口，只是多一个字段，不受影响。

### 前端

- [`summaryApi.js`](../../Count-Frontend/src/pages/datacapturesummary/lib/summaryApi.js)：
  模板带上 `row_index`；`buildTemplatesFromFormulaRows` 在同名 MAIN 多于一条时，把全部 MAIN 放进 `allMains`
  （单条 MAIN 仍走原来的路径，行为不变）。
- [`summarySuppressedRows.js`](../../Count-Frontend/src/pages/datacapturesummary/lib/summarySuppressedRows.js)：
  `isParentRowSuppressed` 优先按 SUB 的 `parentRowIndex` 找真正的父行，找不到才退回第一个同名 MAIN。
- [`summaryTemplatePopulatePure.js`](../../Count-Frontend/src/pages/datacapturesummary/table/summaryTemplatePopulatePure.js)：
  只有"所有同名 MAIN 都被标记删除"才整体跳过该 Id Product 的 SUB，否则逐条判断。
  同一文件里的 `findSavedRowForRestore` / `mergeServerStateRows`：恢复草稿时，如果某个 Id Product 在页面上有多个 MAIN 行，
  兜底匹配（只比 Id Product 的那一级）要求草稿的 `displayOrder` 与该行的 `rowIndex` 一致；Id Product 在页面上只出现一次时，
  保留原来的宽松兜底，行为不变（行号过期的旧数据仍能恢复）。

## 验证情况

- `./mvnw -q -o compile` 通过；原有的 `summaryFormulaReference.test.js`、`summaryTransform.test.js` 共 11 个 `node --test` 用例全部通过。
  本次没有保留新增的单元测试，同名行 + 刷新这条路径目前只有手工验证，没有自动化回归。
- 本地库手工验证：在后面一行新增公式，库里存成 `MAIN`、`row_index` 为该行序号，A 行那条不变；再在同一行追加一次才是 `SUB`；
  刷新后 SUB 留在自己那一行下面（本地反馈"都对了"）。
- 第 4 处（草稿抢行）先用临时脚本复现：B 行（行号 1）拿走了 D 行的草稿、D 行匹配为空；修改后 B 行为空、D 行拿到自己的草稿；
  Id Product 唯一、行号过期的行仍能走旧兜底。临时脚本没有保留，页面上的"清草稿后新增 → 不清草稿直接刷新"还需要再手工验证一次。
- 本地测试要点：测试前要清掉残留的旧公式行，并清掉浏览器里的 `summarySuppressedRowKeys`、`formulaSource` 草稿（或用无痕窗口），
  否则会被旧数据 / 旧草稿干扰。**验证第 4 处时顺序相反：清草稿 → 新增公式 → 不要再清，直接刷新**，因为它只在有草稿时才出现。
  **上线本身不要求用户清 localStorage。**

## 已知限制 / 注意事项

- **线上已经存错的数据不会被自动修好**：之前被存成 SUB、本应是 MAIN 的记录（本案例是 id 38282），需要手工删除后让用户重新设置公式。
  可以先用下面这条只读查询找"疑似"记录（有同名 MAIN，但没有任何同名 MAIN 的 `row_index` 与该 SUB 相同；需要人工逐条判断，**该 SQL 还没有在正式库跑过**）：

  ```sql
  SELECT s.id, p.code, s.id_product, s.row_index, s.sub_order, s.account_id, s.formula, s.created_at
  FROM data_capture_formula s
  JOIN process p ON p.id = s.process_id
  WHERE s.product_type = 'SUB'
    AND EXISTS (SELECT 1 FROM data_capture_formula m
                WHERE m.process_id = s.process_id AND m.product_type = 'MAIN'
                  AND m.id_product = s.parent_id_product)
    AND NOT EXISTS (SELECT 1 FROM data_capture_formula m
                    WHERE m.process_id = s.process_id AND m.product_type = 'MAIN'
                      AND m.id_product = s.parent_id_product AND m.row_index = s.row_index);
  ```
- 只改了"新增公式"（`saveAddFormula`）。`updateFormula`、`deleteFormulas` 的逻辑没动。
- `row_index` 本身可能是过期值（例如本地 YONG 存的是 5，页面实际是 4）。这种情况匹配会落空，然后退回原来的"取第一个空行"做法，
  行为和修复前一致，不会更糟。
- 截图里偶现的"公式为 0 的 CITIBET 行"，库里并没有对应记录（只有一条 SUB）。根据代码推断是：该 SUB 当时挂在 A 行下面，
  公式 `$11` 去读 A 行第 11 列（空）得到 0；这是推断，没有逐步验证。修复后 SUB 挂到自己那一行，这个现象预期会消失。
- 同一个 Id Product 的多条 MAIN，唯一索引 `uk_dcf_tenant_process_formula` 拦不住（MAIN 的 `parent_id_product`、`sub_order` 为 NULL，
  MySQL 里 NULL 不参与重复判断），所以新增第二条同名 MAIN 不会报唯一键冲突。
- count168-site 与 count-org 两个仓库同步修改。
