import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFallbackChecklist, getFallbackSchoolNames } from "./fallbackData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const KIMI_TIMEOUT_MS = 30000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function normalizeChecklist(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item.name || item.material || item["材料名"] || "").trim(),
      description: String(item.description || item.note || item["一句话说明"] || "").trim(),
      deadline: String(item.deadline || item.dueDate || item["截止日期"] || "").trim()
    }))
    .filter((item) => item.name);
}

function extractJsonArray(text) {
  const clean = String(text || "").trim();

  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : parsed.items;
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchKimiChecklist(school) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 MOONSHOT_API_KEY");
  }

  // Kimi 的联网搜索工具需要关闭 thinking；超时会抛错，然后接口自动走本地备用清单。
  const response = await fetchWithTimeout(
    "https://api.moonshot.cn/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "kimik2.6",
        thinking: { type: "disabled" },
        temperature: 0.2,
        response_format: { type: "json_object" },
        tools: [
          {
            type: "builtin_function",
            function: {
              name: "$web_search"
            }
          }
        ],
        messages: [
          {
            role: "system",
            content:
              "你是面向中学生的升学申请材料助手。请使用联网搜索核对学校本科申请材料要求。只返回 JSON，不要 Markdown。JSON 结构为 {\"items\":[{\"name\":\"材料名\",\"description\":\"一句话说明\",\"deadline\":\"YYYY-MM-DD 或空字符串\"}]}。如果截止日期无法确认，deadline 留空。"
          },
          {
            role: "user",
            content: `请查询 ${school} 的本科申请材料清单和各材料截止日期。`
          }
        ]
      })
    },
    KIMI_TIMEOUT_MS
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kimi 请求失败：${response.status} ${body.slice(0, 160)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const checklist = normalizeChecklist(extractJsonArray(content));

  if (!checklist.length) {
    throw new Error("Kimi 没有返回可用清单");
  }

  return checklist;
}

app.get("/api/schools", (_req, res) => {
  res.json({ schools: getFallbackSchoolNames() });
});

app.get("/api/materials", async (req, res) => {
  const school = String(req.query.school || "NYU").trim();

  try {
    const items = await fetchKimiChecklist(school);
    res.json({ school, source: "kimi", items });
  } catch (error) {
    // 兜底逻辑：AI、网络、密钥、超时、格式异常都会进入这里，保证前端永远有清单可渲染。
    res.json({
      school,
      source: "fallback",
      warning: error.message,
      items: getFallbackChecklist(school)
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(port, () => {
  console.log(`申请材料清单生成器已启动：http://localhost:${port}`);
});
