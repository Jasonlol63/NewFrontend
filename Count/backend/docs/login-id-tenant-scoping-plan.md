# login_id 按公司分区：完整修改方案

## 背景

`user.login_id` 目前是全局唯一（`uk_login_id`）。业务上需要允许同一个 `login_id`（例如 "APPLE"）在不同公司下代表不同的人。历史数据里已经出现过这个需求被手动绕过的痕迹（`APPLE_1`/`APPLE_2`/`APPLE_6`/`APPLE_7` 这些后缀就是撞车后改出来的）。

排查过程见：
- [admin_account_company_mapping.md](../../../../AppData/Local/Temp/claude/C--Users-User-OneDrive-Desktop-count168-site-Count/86aacc8a-03ab-4ef5-a94b-3c69c933e125/scratchpad/admin_account_company_mapping.md) —— 97 个账号的公司归属分析（37 确认 / 9 疑似占位 / 51 待人工确认）
- [admin-account-unresolved-tenant-lookup.md](admin-account-unresolved-tenant-lookup.md) —— 51 个待确认账号的原始数据 + 3 个已作废的 IT 系统账号
- [migrate_add_home_tenant_to_user_step1.sql](../src/main/resources/sql/migrate_add_home_tenant_to_user_step1.sql) —— 已写好，加 `home_tenant_id` 列并回填 37 个已确认账号

---

## 一、数据模型方向

新增 `user.home_tenant_id`（可空，FK `tenant.id`）表示"这个 login_id 归属的公司"，跟 `user_tenant_access`（多对多授权表，表示"这个账号被允许访问哪些公司"）分开维护，两者语义不同、不能互相替代。

**唯一性约束改成复合键，但采用"先加新的、旧的先留着"的顺序**，不是一步切换：

| 阶段 | 状态 |
|---|---|
| 现在 | `uk_login_id`（全局唯一） |
| Step A | `uk_login_id` + 新增 `uk_tenant_login(home_tenant_id, login_id)` 并存 |
| Step B（以后，视情况） | 删掉 `uk_login_id`，只保留 `uk_tenant_login` |

`home_tenant_id` **不设 NOT NULL**。原因：MySQL 唯一索引里多行 `NULL` 互相不冲突，所以 60 个还没确认公司的账号（51 待查 + 9 个疑似占位账号）可以先留空，不阻塞 Step A 上线，之后确认一个补一个，不用等全部搞完、不用建假的占位公司。

---

## 二、迁移 SQL 的执行顺序

1. **Step 1（已写好，未执行）**：加 `home_tenant_id` 列（可空）+ 回填 37 个已确认账号。
   → [migrate_add_home_tenant_to_user_step1.sql](../src/main/resources/sql/migrate_add_home_tenant_to_user_step1.sql)
2. **Step A（待写）**：加 `uk_tenant_login(home_tenant_id, login_id)`，`uk_login_id` 先保留不动。
   - 60 个 `home_tenant_id IS NULL` 的账号不受影响，不会跟任何人冲突。
   - 上线后现有登录、现有查重逻辑（代码还没改）完全不受影响，因为 `uk_login_id` 还在挡着。
3. **人工持续补数据**：`SELECT * FROM user WHERE home_tenant_id IS NULL;` 随时能看到还差哪些，补一个 `UPDATE ... WHERE id = ...` 就完成一个，不用等一批做完。
4. **9 个疑似占位/模板账号**（ADMIN/MAANGER/SUPERVISOR/ACCOUNTANT/AUDIT/CUSTOMER SERVICE/TEST01/DEMO2/TEST_1，见 mapping 文档「三」）：建议顺手把 `status` 改成 `INACTIVE`，不用给它们分配公司，永远留 `home_tenant_id = NULL` 也没问题——不影响任何唯一性判断，也不会被当成活跃账号。这个决定权在你，需要你点头。
5. **Step B（以后再做，不急）**：等你确认"现在真的要开始让新账号在不同公司用同一个 login_id"，再删 `uk_login_id`，正式切换。删之前跑一次 `SELECT login_id, COUNT(*) FROM user GROUP BY login_id HAVING COUNT(*)>1` 确认没有意外的全局重复（这在现在的 97 条数据里不会有，因为 login_id 目前还是全局唯一的）。

---

## 三、代码改动清单（Step A 上线后，找时间跟着做）

### 1. Entity / DTO
- [`Admin.java`](../src/main/java/com/eazycount/entity/Admin.java)：加 `Integer homeTenantId`（装箱类型，因为可能是 null，不能用 `int`）。
- [`AdminDTO.java`](../src/main/java/com/eazycount/dto/AdminDTO.java)：同步加字段，新建/编辑用户表单要能传公司。

### 2. 新建/编辑用户查重
- [`AdminDao.java:25`](../src/main/java/com/eazycount/dao/AdminDao.java:25) `findDuplicateLoginId` → 加 `homeTenantId` 参数；同时补一个编辑用的 exclude-id 版本（目前只有 email 有 `findDuplicateEmailExcludingId`，login_id 没有，这个顺手补上）。
- [`AdminMapper.xml:94-99`](../src/main/resources/mybatis/AdminMapper.xml:94) 对应 SQL 加 `AND home_tenant_id = #{homeTenantId}`。
- [`AdminServiceImpl.java:791-794`](../src/main/java/com/eazycount/service/impl/AdminServiceImpl.java:791) `assertNoDuplicateLoginId` → 签名加 `homeTenantId`，调用处一起改。
- 删掉孤儿方法 `findDuplicateLoginIdLoginId`（[AdminMapper.xml:66-92](../src/main/resources/mybatis/AdminMapper.xml:66)，没有任何 Java 代码引用它，是废弹），避免以后跟新逻辑搞混。

### 3. 登录身份查找
- [`AuthDao.java`](../src/main/java/com/eazycount/dao/AuthDao.java) / [`findAdminByLoginId`](../src/main/resources/mybatis/LoginMapper.xml:258) → 改成同时接收 `tenantCode`，查询条件：
  ```sql
  WHERE UPPER(TRIM(u.login_id)) = UPPER(TRIM(#{loginId}))
    AND (
      u.home_tenant_id = (SELECT id FROM tenant WHERE code = #{tenantCode})
      OR EXISTS (
        SELECT 1 FROM user_tenant_access uta
        JOIN tenant t2 ON t2.id = uta.tenant_id
        WHERE uta.user_id = u.id AND t2.code = #{tenantCode}
      )
    )
  ```
  这样能同时兼容"同名不同人各归各公司"（走 `home_tenant_id` 分支）跟"一个人被授权访问多家公司"（走 `user_tenant_access` 分支），两者不冲突。
- [`AuthServiceImpl.java:143`](../src/main/java/com/eazycount/service/impl/AuthServiceImpl.java:143) 调用处把已经拿到的 `tenantCode` 传进去（本来就有这个值，只是没用上）。第 151 行"查这个账号有没有权限进这家公司"那段逻辑要重新看一下是否还需要，还是改成"查这个账号还能不能访问其他公司"用于公司切换功能。

### 4. 前端
- `/auth/login` 本来就在收 `tenant_code`（[AuthController.java:40](../src/main/java/com/eazycount/controller/AuthController.java:40)），大概率不用改登录表单。
- 新建/编辑用户表单要加"选择归属公司"的字段（Count-frontend 那边，不在这个仓库）。

---

## 四、还没确认公司的 60 个账号，具体分两批处理

- **51 个待人工确认**（[admin-account-unresolved-tenant-lookup.md](admin-account-unresolved-tenant-lookup.md) 有完整原始数据：email / 角色 / 创建人 / 创建&登录时间）——找熟悉这批账号的人一个个标注，标完执行对应的 `UPDATE user SET home_tenant_id = ... WHERE id = ...`。
- **9 个疑似占位/模板账号**——建议直接停用（`status = 'INACTIVE'`），不分配公司。
- **3 个 IT 系统账号（523/524/525）**——已确认新库 `count168_site` 里根本没有这三条记录，不需要任何操作。

---

## 五、还需要你拍板的点

1. 9 个占位/模板账号要不要真的停用？还是留着但不管。
2. Step B（删掉 `uk_login_id`，正式允许跨公司重复 login_id）什么时候做——现在定方向，还是等 51 个都补完再动？我的建议是 Step A 先上，Step B 不急，反正 Step A 上线后旧约束还在，行为不变，随时可以晚点再删。
3. 代码改动（第三节那批）什么时候开始？可以等 Step 1 + Step A 的 SQL 先上线、数据先稳定下来，再排代码改动，也可以两边一起做。

你确认方向没问题，我就开始写 Step A 的 SQL；代码那部分你说"先不改"，我先停在这，等你叫我再动手。
