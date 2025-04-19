# proxy2
你的程式邏輯基本上是正確的，有考慮到：

- CORS
- `multipart/form-data` 不手動設 `Content-Type`
- stream passthrough 給後端

但 Vercel 的伺服器環境有一些**特殊限制**會讓這段「轉發 multipart stream」的行為**有潛在問題**。以下是一些 **你可以檢查 / 修改的地方**：

---

### ✅ **1. Vercel 中 req 不是純 Node stream**
Vercel 的 `req` 是被包裝過的，對於需要 `duplex: 'half'` 的 fetch 請求可能會出錯。這是近期 `fetch()` 的一個坑 —— `duplex` 只支援 **Node v18+ 且需原生 stream**，Vercel 有可能不完全支援。

#### 🔧 解法：**讀取 `req` stream 到 Buffer 再傳送**
雖然這樣會失去 stream 的優勢，但能避免 `duplex` 問題：

```ts
const chunks: Buffer[] = [];
for await (const chunk of req) {
  chunks.push(chunk);
}
const bodyBuffer = Buffer.concat(chunks);
```

然後設定：

```ts
fetchOptions.body = bodyBuffer;
```

同時保留原本的 `Content-Type`（除非你刻意改變它）。

---

### ✅ **2. 檢查 headers['content-type'] 是不是 undefined**
Vercel 有時會自動處理 headers，導致 `content-type` 在中間層變成 `undefined`，你可以加強處理：

```ts
const contentType = req.headers['content-type'] || req.headers['Content-Type'];
```

然後判斷：

```ts
const isMultipart = contentType?.includes('multipart/form-data');
```

---

### ✅ **3. 修改 Vercel 的 `vercel.json`（如有使用）**
如果你用的是 Vercel 的 Serverless Functions，確認 `vercel.json` 沒有強制 body parser：

```json
{
  "functions": {
    "api/proxy.ts": {
      "memory": 512,
      "maxDuration": 10
    }
  }
}
```

如果還是報錯，可改為自己建獨立中介層（不部署在 Vercel）。

---

### ✅ **4. 確保後端支援 multipart 且沒加 JSON parser**
如果你後端是 Express，記得 **不要加 `express.json()` 在 multipart route 上**，應該使用 `multer` 或類似套件處理 multipart/form-data。

---

### ⚠️ 補充建議：用 Proxy 模式會更穩定
若你的目的是**完全轉發請求**（不處理 body），使用像 `http-proxy` 或 `http-proxy-middleware` 模式在 Node.js Server 會更保險（Vercel 不太適合高 stream 使用場景）。

---

### ✅ 範例修正重點總結

```ts
// 原始 req stream 轉為 buffer
const chunks: Buffer[] = [];
for await (const chunk of req) {
  chunks.push(chunk);
}
const bodyBuffer = Buffer.concat(chunks);

// 如果是 multipart，保留 headers，但不要主動設 content-type（讓它自己帶 boundary）
if (isMultipart) {
  delete fetchOptions.headers['content-type'];
}

fetchOptions.body = bodyBuffer;
```

---

如果你想要更 stream-efficient 的解法（不轉 buffer），我可以幫你設計非 Vercel 的部署方式（像是在 Node server、Cloudflare Workers、或 edge functions）。你有偏好部署平台嗎？還是只用 Vercel？
