# Announcement 已读：从「全部已读」改为「逐条已读」（后端）

> **范围**：新表 `announcement_read`（取代 `announcement_read_state`），`AnnouncementController` / `AnnouncementService(Impl)` / `AnnouncementDao` / `AnnouncementsMapper.xml`。
> **迁移脚本**：`backend/src/main/resources/sql/migrate_announcement_read_per_item.sql`（可重复执行）。
> **前置文档**：`announcement-unread-badge.md`（按账号存储已读的上一版，其中 2.1–2.3 的表结构与规则以本文为准）。
> **前端**：`frontend/docs/announcement-read-per-item-frontend.md`。

## 1. 为什么改

旧表 `announcement_read_state` 每个账号只有一行 `last_read_at`，只能表达「这个时间点之前全部已读」，
无法记录「只读了其中某一条」。要支持单条已读，必须一条通告一条记录；在原表加字段（JSON / 逗号串）
无法在 SQL 里判断、并发写会互相覆盖、通告删除后还会残留无效 id，所以改成关联表。

## 2. 表 `announcement_read`

| 字段 | 说明 |
|---|---|
| `user_type` | `user` / `owner` / `member`（三个 id 空间会重叠，必须进主键） |
| `user_id` | 对应表的 id |
| `announcement_id` | `announcements.id`，外键 `ON DELETE CASCADE`（通告删除，已读记录一起删） |
| `read_at` | 标记已读的时间 |

主键 `(user_type, user_id, announcement_id)`，另有 `announcement_id` 索引。
IT 账号没有 DB 行，不参与（`unreadCount` 恒为 0、`unreadIds` 为空、`markRead` 不做事）。

## 3. 未读规则（Mapper 里的 `<sql id="unreadWhere">`，计数 / 取 id / 全部已读共用）

```
公告 company_code='C168' 且 status='ACTIVE'
  且 created_at > 该账号自己的 created_at      -- 新账号看不到注册前的旧公告
  且 announcement_read 中没有 (user_type, user_id, 该公告id)
```

计数和 id 列表用同一段条件，数量与高亮不会对不上。`last_read_at` 这种水位线不再使用。

## 4. 接口

| 接口 | 作用 |
|---|---|
| `GET /api/announcement/unreadCount` | 未读条数（排除单条已读） |
| `GET /api/announcement/unreadIds` | **新增**。`data.ids`：未读公告 id，新的在前 |
| `POST /api/announcement/markRead` | body `{"id": n}` → 标这一条；无 body / 无 id → 全部已读 |

- 单条：`INSERT IGNORE ... SELECT ... FROM announcements WHERE id = ?`（id 不存在则不插入，重复点击幂等）。
- 全部：`INSERT IGNORE ... SELECT a.id ... WHERE <unreadWhere>`，把当前所有未读一次插入。
- `markRead` 的 body 改为可选，旧调用方（不带 body）行为不变。
- 身份仍取自 session，前端不传账号信息。

## 5. 迁移 / 上线

1. **先执行**迁移脚本，**再部署**后端（新后端依赖新表，没建表时未读相关接口会报错）。
2. 脚本建表，并把每个账号原 `last_read_at` 之前的公告回填为已读；回填后没有人会突然出现一堆未读。
3. 旧表 `announcement_read_state` 在脚本最后一行 `DROP`（已注释）。本地 `count_real` 已回填（2089 个账号 × 5 条 = 10445 行）并已删除旧表；其他环境确认新后端正常后再手动执行。

## 6. 已知限制

- 公告被编辑（update）不会重新变未读，只有新发布的才会计入。
- `c168_mobile` 仍是它自己的本地已读逻辑，与桌面端不互通。
