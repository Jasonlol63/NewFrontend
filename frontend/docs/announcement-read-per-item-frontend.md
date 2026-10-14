# 铃铛公告面板：逐条标记已读（前端）

> **范围**：`components/layout/NotificationPanel.jsx`、`useNotifications.js`、`notificationRules.js`、`layouts/AuthenticatedLayout.jsx`、
> `pages/announcement/announcementApi.js`、`i18n/locales/{zh,en}/notification.json`。
> **后端**：`Count/docs/announcement-read-per-item-backend.md`。

## 1. 行为

旧版：已读只有「Mark all as read」一种。新版：**打开铃铛不会标记任何已读**，一条公告在以下情况变为已读：

| 操作 | 效果 |
|---|---|
| 点卡片右上角的 ✓ 按钮（悬停提示「标为已读 / Mark as read」） | 这一条已读 |
| 点卡片的空白处（卡片上任意位置） | 这一条已读 |
| 点 Show more / 展开 | 这一条已读（点击会冒泡到卡片） |
| 点 Mark all as read / 全部标为已读 | 全部已读 |

已读卡片：不再显示蓝点和 ✓ 按钮，左侧色条变灰，点击不再请求后端。
未读数（侧边栏铃铛徽标、面板标题的「N 条新」）随每次标记逐条减少。

## 2. 数据流

- `announcementApi.js`：新增 `fetchUnreadIds()`（`GET /unreadIds`）；`markAnnouncementsRead(id)` 带 id 标单条，不带 id 标全部。
- `useNotifications.js`：
  - `refresh` 并行取 列表 + `unreadCount` + `unreadIds`，未读集合直接用后端返回的 id，
    删除了原来「列表前 N 条算未读」的推断（`unreadIdsOf`），因为单条已读后未读条不一定连续。
  - 新增 `markRead(id)`：先乐观更新（从未读集合移除、计数 -1），再请求后端；失败则 `refresh`。
  - 和 `markAllRead` 共用 `seq` 序号，旧响应晚到不会把已读又改回未读。
- `NotificationPanel.jsx`：新增 `onMarkRead` prop；`NotificationCard` 在未读时才绑定 `onClick` 并渲染 ✓ 按钮。
- `AuthenticatedLayout.jsx`：把 `notifications.markRead` 传给面板。
- i18n：新增 `markRead` 文案。

## 3. 注意

- 点击卡片内的文字或链接同样算已读（按需求「卡片任意位置点击都算」）。
- 面板打开时仍会 `reload` 一次列表和未读状态，但这只是读取，不会改变已读状态。
- 实时广播（announcements）或窗口聚焦触发的 `refresh` 会以后端数据为准覆盖本地状态。
