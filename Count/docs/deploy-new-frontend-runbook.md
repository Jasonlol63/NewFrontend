# 新前端上线 count168.site 的执行清单（2026-10-15）

目标：把新的 React 前端（`Count-Frontend`）和对应的新后端上线到生产 `count168.site`。`c168_mobile` 不受影响
（它在服务器的 `/var/www/count168.com|.net|.org/c168_mobile`，部署脚本只推 `dist` 到 `/var/www/count168-site/Count-Frontend/`）。

| | 生产 | 测试（已经是新版） |
|---|---|---|
| 域名 | count168.site | cf.count168.site |
| 前端目录 | /var/www/count168-site/Count-Frontend | /var/www/cf/Count-Frontend |
| 后端 | /var/www/count168-site/Count，`count168-api`，8082 | /var/www/cf/Count，`count168-api-cf`，8084 |
| 数据库 | count168_site | test_site |

SQL 文件都在 `Count/backend/src/main/resources/` 下。下面所有 `<用户>` 换成数据库用户，密码用 `-p` 交互输入，**不要写进命令历史**。

---

## 0. 提交前（本地）

```powershell
cd C:\Users\User\OneDrive\Desktop\count168-site
git checkout -b new-frontend
```

- `.github/workflows/deploy.yml`：前端构建命令已改成 `npm run build`（新 `package.json` 没有 `build:deploy`）。
- `.gitignore`：已忽略 `Count/db-backups/`（真实数据和密码哈希，不能提交）。
- 提交时务必包含这三个新文件，否则后端编译失败：`CursorPage.java`、`SummaryFormulaEvaluator.java`、`TransactionGroupId.java`
  （用 `git add Count/backend` 即可）。

先别 push，做完第 1、2 步再 push。

## 1. 服务器：备份（可回滚的前提）

```bash
ssh -i "C:\Users\User\Downloads\Server_Key.pem" ec2-user@56.68.48.190
mkdir -p ~/db-backups
TS=$(date +%Y%m%d_%H%M)
mysqldump --single-transaction -u<用户> -p count168_site | gzip > ~/db-backups/count168_site_pre_newfront_$TS.sql.gz
cp /var/www/count168-site/Count/Count-0.0.1-SNAPSHOT.jar /var/www/count168-site/Count/Count-0.0.1-SNAPSHOT.jar.bak_$TS
cp -a /var/www/count168-site/Count-Frontend /var/www/count168-site/Count-Frontend.bak_$TS
ls -lh ~/db-backups | tail -3
```

确认备份文件大小正常（不是 0）再继续。

## 2. 服务器：增量迁移（旧 jar 继续运行不受影响）

先把 SQL 传上去（在本地 PowerShell 执行）：

```powershell
$R = "C:\Users\User\OneDrive\Desktop\count168-site\Count\backend\src\main\resources"
scp -i "C:\Users\User\Downloads\Server_Key.pem" `
  "$R\SqlEtcForMigrate\fixes\add_idx_dc_tenant_cat_created_20261013.sql" `
  "$R\SqlEtcForMigrate\fixes\add_idx_txn_tenant_created_20261013.sql" `
  "$R\sql\migrate_announcement_read_per_item.sql" `
  "$R\sql\migrate_add_auto_renew_permission.sql" `
  "$R\sql\migrate_merge_group_id_step1.sql" `
  ec2-user@56.68.48.190:~/
```

先看生产库现在是什么状态（只读）：

```sql
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema='count168_site' AND column_name='group_id'
   AND table_name IN ('transactions','transactions_deleted','bank_process_accounting_posted');
SHOW INDEX FROM transactions WHERE Key_name='idx_txn_tenant_created';
SHOW INDEX FROM data_captures WHERE Key_name='idx_dc_tenant_cat_created';
SHOW TABLES LIKE 'announcement_read';
```

缺什么补什么，按这个顺序（已存在的会报 Duplicate key，跳过那条即可）：

```bash
# 索引：新后端用 FORCE INDEX，必须在部署前建好；transactions 很大，请在低峰期做
mysql -u<用户> -p count168_site < ~/add_idx_dc_tenant_cat_created_20261013.sql
mysql -u<用户> -p count168_site < ~/add_idx_txn_tenant_created_20261013.sql
# 公告按条已读、Auto Renew 权限
mysql -u<用户> -p count168_site < ~/migrate_announcement_read_per_item.sql
mysql -u<用户> -p count168_site < ~/migrate_add_auto_renew_permission.sql
# group_id：只加列和回填，不动旧列，可重复执行
mysql -u<用户> -p count168_site < ~/migrate_merge_group_id_step1.sql
```

**不要跑 `migrate_merge_group_id_step2.sql`**（会删旧列，旧 jar 马上报错）。

## 3. push（触发部署）

```powershell
git push -u origin new-frontend
```

workflow 只在 `main` 上触发，所以要么合并到 `main`，要么直接在 `main` 上提交后 push。确认 GitHub Actions 里
两个 job（deploy-backend、deploy-frontend）都是绿的。后端重启期间会有几秒不可用。

## 4. 服务器：push 完马上重跑回填

step 1 跑完到新 jar 上线之间，旧 jar 产生的 Rate / Bank 记录没有 `group_id`，重跑一次补上（可重复执行）：

```bash
mysql -u<用户> -p count168_site < ~/migrate_merge_group_id_step1.sql
```

## 5. 验证

```bash
systemctl is-active count168-api
journalctl -u count168-api -n 100 --no-pager | tail -40
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8082/api/settings/getTelegramLink
```

浏览器强制刷新 count168.site，依次检查：登录、Transaction Payment（提交一笔、点 Balance 填表单）、
Maintenance 五个列表（Transaction / Capture / Payment / Formula / Bank Process）、Announcement 已读、Admin 编辑用户、
Ownership。刷新子路径（例如 /transaction-payment）确认不是 404。

## 6. 回滚

```bash
TS=<第 1 步的时间戳>
# 前端
rm -rf /var/www/count168-site/Count-Frontend && mv /var/www/count168-site/Count-Frontend.bak_$TS /var/www/count168-site/Count-Frontend
# 后端
cp /var/www/count168-site/Count/Count-0.0.1-SNAPSHOT.jar.bak_$TS /var/www/count168-site/Count/Count-0.0.1-SNAPSHOT.jar
sudo systemctl restart count168-api
```

step 1 是纯增量，旧 jar 不读新列，回滚不需要还原数据库。只有在跑过 step 2 之后才需要用第 1 步的 dump 还原。

## 7. 稳定几天之后（不要和上线同一天）

1. 再做一次新的 `mysqldump`。
2. 跑 `migrate_merge_group_id_step2.sql`（删 `rate_group_id`、`bank_process_posted_id`，并把视图指向 `group_id`）。
3. 公告迁移脚本末尾提到的旧表 `announcement_read_state` 确认不再使用后再删。

## 8. 建议（需要 sudo）

测试站的 nginx 对 `/assets/` 做了"文件不存在就 404，不回退到 index.html"（10 月 1 日白屏事故后加的），生产的
`/etc/nginx/conf.d/count168.site.conf` 没有。建议照 `cf.count168.site.conf` 加上：

```nginx
    location /assets/ {
        alias /var/www/count168-site/Count-Frontend/assets/;
        try_files $uri =404;
        expires 1y;
    }
    location = /index.html {
        alias /var/www/count168-site/Count-Frontend/index.html;
        add_header Cache-Control "no-cache";
    }
```

改完 `sudo nginx -t && sudo systemctl reload nginx`。
