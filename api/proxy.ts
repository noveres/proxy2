import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';  // 添加 axios 導入

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 添加 CORS 頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS 請求 (預檢請求)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetPath = req.query.path as string || '';
  const backendBaseUrl = process.env.BACKEND_BASE_URL;
  
  if (!backendBaseUrl) {
    return res.status(500).json({ error: 'Backend URL not configured' });
  }

  const url = `${backendBaseUrl}/${targetPath}`;

  try {
    // 準備請求頭
    const headers: HeadersInit = {};
    
    // 複製原始請求的頭信息，排除一些特定頭
    for (const [key, value] of Object.entries(req.headers)) {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = value as string;
      }
    }

    // 處理請求體
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body);
    }

    // 發送請求到後端
    const response = await fetch(url, {
      method: req.method,
      headers: headers,
      body: body,
    });

    // 獲取響應數據
    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // 設置響應狀態
    res.status(response.status);

    // 轉發響應頭 (可選)
    response.headers.forEach((value, key) => {
      // 避免覆蓋已設置的 CORS 頭
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, value);
      }
    });

    // 返回響應數據
    return res.send(responseData);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      details: error.message || String(error),
    });
  }
}