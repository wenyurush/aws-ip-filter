```markdown
# AWS IP Range Filter (Cloudflare Worker)

🚀 **AWS IP Range Filter** 是一个部署在 Cloudflare Workers 上的轻量级工具。它提供了一个**极速的 Web 图形界面**和一个**强大的 REST API**，用于快速筛选、搜索和提取 AWS 的 IP 地址段（按地区、服务类型、IPv4/IPv6 等）。

这个工具解决了直接使用 AWS 官方 `ip-ranges.json` 文件体积大、难以阅读且无法快速集成到脚本中的问题。

## ✨ 功能特性

*   **双模式支持**：
    *   🖥️ **GUI 界面**：访问根路径即可进入图形化界面，支持实时搜索、多选筛选、一键复制。
    *   ⚙️ **API 接口**：支持 URL 参数调用，方便 Shell 脚本、CI/CD 流程集成。
*   **高性能缓存**：利用 Cloudflare Edge 缓存 AWS 源数据（默认缓存 4 小时），极大降低延迟。
*   **多维度筛选**：
    *   按地区 (Region) 筛选 (如 `us-east-1`, `ap-northeast-1`)。
    *   按服务 (Service) 筛选 (如 `EC2`, `S3`, `CLOUDFRONT`)。
    *   支持 IPv4 / IPv6 独立或混合输出。
*   **多格式输出**：支持标准 JSON 格式或纯文本 CIDR 列表（方便导入防火墙）。
*   **零成本部署**：完全兼容 Cloudflare Workers 免费套餐。

## 🖼️ 界面预览

*(建议在这里放一张你部署后的截图，比如左侧勾选了 EC2，右侧显示 IP 列表的界面)*

![Screenshot](https://via.placeholder.com/800x450?text=GUI+Screenshot+Here)

## 🛠️ 部署指南

### 方法一：直接复制 (最简单)

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **Create Application** -> **Create Worker**。
3.  点击 **Deploy** (先部署个空壳)。
4.  点击 **Edit code**。
5.  将本项目中的 `worker.js` 代码完全覆盖编辑器中的内容。
6.  点击右上角 **Deploy** 保存。

### 方法二：使用 Wrangler CLI

如果你熟悉 Cloudflare 的命令行工具：

1.  克隆仓库：
    ```bash
    git clone https://github.com/yourname/aws-ip-range-filter.git
    cd aws-ip-range-filter
    ```
2.  创建 `wrangler.toml` (如果项目中没有)：
    ```toml
    name = "aws-ip-filter"
    main = "worker.js"
    compatibility_date = "2023-10-01"
    ```
3.  部署：
    ```bash
    npm install -g wrangler
    wrangler deploy
    ```

## 📖 API 使用文档

你可以通过 URL 参数直接获取筛选后的数据。

### 基本格式

```
GET https://<your-worker-domain>/?<parameters>
```

### 参数说明

| 参数 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `region` | AWS 地区代码，支持逗号分隔多个 | `us-east-1`, `ap-northeast-1,eu-west-1` |
| `service` | AWS 服务代码，支持逗号分隔多个 | `EC2`, `S3`, `CLOUDFRONT` |
| `format` | 输出格式 | `json` (默认), `text` (纯文本 CIDR) |
| `ipv` | IP 版本筛选 | `all` (默认), `v4`, `v6` |

### 常见场景示例

#### 1. 获取 CloudFront 所有 IP 做白名单 (纯文本)
适合直接用于 Nginx 配置或防火墙规则。
```bash
curl "https://your-worker.dev/?service=CLOUDFRONT&format=text"
```
**输出:**
```text
144.220.0.0/16
52.124.128.0/17
...
```

#### 2. 获取日本东京 (ap-northeast-1) 的 EC2 详情 (JSON)
```bash
curl "https://your-worker.dev/?region=ap-northeast-1&service=EC2&format=json"
```

#### 3. 获取 S3 和 DynamoDB 在美东和美西的 IPv4 地址
```bash
curl "https://your-worker.dev/?region=us-east-1,us-west-1&service=S3,DYNAMODB&ipv=v4&format=text"
```

## 💻 本地开发

虽然这是一个 Worker 脚本，你也可以使用 Wrangler 在本地模拟运行：

```bash
# 启动本地开发服务器
wrangler dev worker.js
```
访问 `http://localhost:8787` 即可看到界面。

## 📝 License

MIT License. 随意修改和分发。

---
*AWS 是 Amazon.com, Inc. 或其附属公司的商标。本工具与 AWS 官方无关。*
```
