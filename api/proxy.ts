import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 設置 CORS 頭部，允許所有來源訪問
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 處理 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetPath = req.query.path as string;
  const backendBaseUrl = process.env.BACKEND_BASE_URL;
  const url = `${backendBaseUrl}/${targetPath}`;

  try {
    const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

    const fetchOptions: any = {
      method: req.method,
      headers: {
        ...req.headers,
      },
      // 初始化為 undefined，稍後會根據請求方法設置
      body: undefined
    };

    // 針對 GET 和 HEAD 以外的請求方法，讀取 req stream 到 Buffer
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // 讀取 req stream 到 Buffer 以避免 duplex 問題
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const bodyBuffer = Buffer.concat(chunks);
      
      // 設置 body 為 Buffer
      fetchOptions.body = bodyBuffer;
      
      // 針對 multipart，不要手動設 Content-Type，讓 fetch 自己處理 boundary
      if (isMultipart) {
        delete fetchOptions.headers['content-type'];
      }
    }

    const response = await fetch(url, fetchOptions);

    res.status(response.status);
    
    // 複製所有響應頭部
    for (const [key, value] of response.headers.entries()) {
      // 不覆蓋已設置的 CORS 頭部
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, value);
      }
    }
    
    // 確保 Content-Type 被正確設置
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // 確保 CORS 頭部在響應返回前被設置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (response.body) {
      await streamPipeline(response.body, res); // 傳圖片／檔案 stream
    } else {
      res.end();
    }
  } catch (err: any) {
    // 確保即使在錯誤情況下也設置 CORS 頭部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    res.status(500).json({ error: 'Proxy error', details: err.message || err });
  }
}
