import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';  // 添加 axios 導入

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
    // 選擇一種方式處理請求：這裡使用 axios
    const { data, status, headers } = await axios({
      method: req.method as any,
      url: url,
      headers: {
        ...req.headers,
        host: new URL(backendBaseUrl).host,
      },
      data: req.method !== 'GET' ? req.body : undefined,
      responseType: 'arraybuffer',  // 使用 arraybuffer 而不是 stream，在 serverless 環境中更可靠
    });

    // 設置響應頭
    Object.entries(headers).forEach(([key, value]) => {
      if (value) res.setHeader(key, value);
    });
  
    // 返回響應
    res.status(status);
    res.send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    const status = error.response?.status || 500;
    res.status(status).json({
      error: 'Proxy error',
      details: error.message || String(error),
      status
    });
  }
}