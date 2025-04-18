import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 添加 CORS 頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS 請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetPath = req.query.path as string;
  const backendBaseUrl = process.env.BACKEND_BASE_URL;
  const url = `${backendBaseUrl}/${targetPath}`;


  try {
    // 直接將請求轉發到後端
    const { data, status, headers } = await axios({
      method: req.method as any,
      url: url,
      headers: {
        ...req.headers,
        host: new URL(backendBaseUrl).host,
      },
      data: req,
      responseType: 'stream',
    });

    Object.entries(headers).forEach(([key, value]) => {
      if (value) res.setHeader(key, value);
    });
  
    // 返回響應
    res.status(status);
    data.pipe(res);
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      error: 'Proxy error',
      details: error.message,
      status
    });
  }


  try {
    // 創建請求頭，保留原請求的 Content-Type
    const headers: HeadersInit = {};
    const contentType = req.headers['content-type'];
    
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    // 根據請求類型和 Content-Type 處理請求體
    let requestBody;
    
    if (req.method !== 'GET') {
      if (contentType && contentType.includes('multipart/form-data')) {
        // 對於 multipart/form-data，直接傳遞原始請求
        // 注意：Vercel serverless 環境可能需要特殊處理 FormData
        // 這裡僅作示例，實際實現可能需要根據您的環境調整
        requestBody = req.body; // 對於文件上傳，這需要更複雜的處理
      } else {
        // 對於其他類型，例如 JSON
        requestBody = JSON.stringify(req.body);
      }
    }

    const response = await fetch(url, {
      method: req.method,
      headers: headers,
      body: requestBody,
    });

    const responseContentType = response.headers.get('content-type');

    res.status(response.status);

    if (responseContentType && responseContentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err });
  }
}