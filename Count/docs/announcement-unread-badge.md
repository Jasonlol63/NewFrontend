# Sidebar 铃铛未读提示 — 改为按登录账号、后端存储

> **范围**：`announcement_read_state` 新表，`AnnouncementController` 新增 `unreadCount` / `markRead`，
> `AnnouncementService(Impl)` / `AnnouncementDao` / `AnnouncementsMapper.xml`；桌面前端
> `useAnnouncementUnread.js`、`announcementApi.js`、`AuthenticatedLayout.jsx`、`useMemberPageShell.js`。
> **对应提交**：`c0a47df`（2026-09-30）；建表脚本 `backend/src/main/resources/sql/migrate_add_announcement_read_state.sql`。
> **相关文档**：`realtime-websocket-mechanism.md`（公告广播）、`frontend-springboot-migration.md` 第 4.6 节（Announcement 迁移）。

---

## 1. 问题

铃铛上的未读数原本完全在浏览器里算：已读时间戳存 `localStorage`，key 是 **用户 + 公司(tenant)**。结果：

- 切换公司后，同一条公告又显示成未读；
- 换浏览器 / 换设备，已读记录丢失，公告再次提示；
- 账号被新授权一个公司，该公司的 key 是空的，历史公告全部变成未读；
- 还要靠 tenant 查询、drill-down 公司等逻辑拼出 key，容易出错。

根因：「已读」是账号的属性，却被存成了「浏览器 × 公司」的属性。

## 2. 方案

未读状态改为 **按登录账号** 记录，由后端保存和计算，与公司、浏览器、设备无关。

### 2.1 表 `announcement_read_state`

| 字段 | 说明 |
|---|---|
| `user_type` | `user`（后台员工）/ `owner` / `member`（对应 `account` 表） |
| `user_id` | 对应表的 id |
| `last_read_at` | 该账号最后一次标记已读的时间（DB 时钟） |
| `updated_at` | 自动更新时间 |

主键 `(user_type, user_id)`。三张表的 id 空间会重叠，所以 `user_type` 必须进主键。

**IT 账号**在数据库没有对应行，**不参与**未读提醒：`unreadCount` 恒为 0，`markRead` 不做任何事。

### 2.2 未读规则（SQL 内计算，只用 DB 时间）

```
未读数 = company_code='C168' 且 status='ACTIVE' 的公告中，
         created_at > COALESCE(last_read_at, 该账号自己的 created_at) 的条数
```

- 账号还没有 `announcement_read_state` 记录时，以账号自身 `created_at` 为基准 → **新账号看不到注册前的旧公告**。
- 公告是全平台的（`C168`），所以没有公司维度。

### 2.3 接口

| 接口 | 作用 |
|---|---|
| `GET /api/announcement/unreadCount` | 返回 `data.unreadCount` |
| `POST /api/announcement/markRead` | `INSERT ... ON DUPLICATE KEY UPDATE last_read_at = NOW()` |

身份取自 session（`user_type` + `user_id`），前端不传任何标识。

## 3. 前端行为（`useAnnouncementUnread(me, pollMs)`）

- 删除 localStorage、tenant 查询、drill-down 公司逻辑；签名改为 `(me, pollMs)`。
- **刷新时机**：账号变化时、收到 `announcements` 实时广播（`onRealtimeInvalidate`）时；没挂 `AppRealtimeBridge` 的壳（会员自助壳）通过 `pollMs` 轮询兜底（页面隐藏时跳过）。
- **markRead 乐观更新**：点击铃铛 / 进入公告页时，先把徽标清零，再请求后端；失败则重新 `refresh`。
- **防旧响应覆盖**：用 `requestSeqRef` 序号，`markRead` 和每次 `refresh` 都会递增；返回时序号不一致的响应直接丢弃，避免「点了已读，旧请求晚到又把数字改回去」。
- 调用点：`AuthenticatedLayout.jsx`（铃铛点击、进入公告页）、`useMemberPageShell.js`。

## 4. 上线 / 迁移

1. 手动执行 `migrate_add_announcement_read_state.sql`（项目没有自动 SQL runner）。脚本可重复执行（`CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE`）。
2. 脚本会给 **所有现有账号** 回填 `last_read_at = 迁移时间`，所以上线瞬间没人会突然看到一堆旧公告的未读。
3. 之后新建的账号没有记录，走 2.2 的「账号创建时间」基准。

## 5. 已知限制

- **移动端未改**：`c168_mobile` 仍使用自己的按日期判断的本地「已读」存储，和桌面端不互通。
- 「已读」是全量的：一次 `markRead` 把该账号截至当前的所有公告都标为已读，不记录单条。
- 公告被编辑（update）不会重新变未读，只有新发布（`created_at` 更晚）的才会计入。
