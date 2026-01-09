# Nginx 反向代理配置

本目录包含 nginx 反向代理的配置文件。

## 文件说明

- `nginx.conf` - nginx 主配置文件
  - IP 白名单限制（公司 IP 段）
  - 前端代理（端口 5173）
  - API 代理（端口 3001）
  - WebSocket 代理（Socket.IO）

- `logs/` - nginx 日志目录（自动创建，已加入 .gitignore）

## 使用方法

详细部署说明请参考项目根目录的 `NGINX_SETUP.md`。

### 快速启动

```bash
# 在项目根目录执行
./start.sh start
```

### 查看日志

```bash
# 查看 nginx 访问日志
tail -f nginx/logs/access.log

# 查看 nginx 错误日志
tail -f nginx/logs/error.log
```

## IP 白名单

当前配置的公司 IP 段：

- 219.142.38.130-158
- 114.251.106.210-223

如需修改，编辑 `nginx.conf` 中的 `geo $allowed_ip` 块。

