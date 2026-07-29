# 申请材料清单生成器

这是“升学雷达”里的一个面向中学生的小产品：输入或选择一所学校，后台会查询它的本科申请材料要求，并整理成一张可以打勾的待办清单。

## 功能

- 前端页面由 Node + Express 后台统一托管，避免跨域问题。
- 前端只请求自己的后台接口 `/api/materials`，不会出现 Kimi 或 Moonshot API Key。
- 后台从环境变量 `MOONSHOT_API_KEY` 读取密钥，调用 Kimi 联网搜索。
- Kimi 不可用、未配置密钥、网络失败或返回格式异常时，自动使用本地备用清单。
- 清单项可以打勾，进度环会实时更新，全部完成后显示庆祝按钮。
- 截止日期会显示“还剩几天”“已过期”“日期待确认”等状态。
- 页面适配手机宽度，按钮和清单项适合触屏操作。

## 本地运行

```bash
npm install
npm run dev
```

打开终端显示的地址，默认是：

```text
http://localhost:3000
```

## 配置 Kimi

复制 `.env.example` 为 `.env`，填入你的 Moonshot API Key：

```bash
MOONSHOT_API_KEY=你的 Moonshot API Key
PORT=3000
```

`.env` 已写入 `.gitignore`，不要上传到 GitHub。

## 验证兜底模式

不创建 `.env`，或暂时不填写 `MOONSHOT_API_KEY`，然后运行：

```bash
npm run dev
```

访问：

```text
http://localhost:3000/api/materials?school=NYU
```

返回结果里的 `source` 应该是 `fallback`，页面也会显示“本地备用清单”。

## 接口格式

`GET /api/materials?school=NYU`

返回示例：

```json
{
  "school": "NYU",
  "source": "fallback",
  "items": [
    {
      "name": "高中成绩单",
      "description": "由学校官方出具并盖章；如不是英文版本，通常需要准备认证翻译件。",
      "deadline": "2026-11-01"
    }
  ]
}
```

每个清单项固定包含：

- `name`：材料名
- `description`：一句话说明
- `deadline`：截止日期，没有则为空字符串
