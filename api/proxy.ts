import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 添加 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetPath = req.query.path as string;
  const backendBaseUrl = process.env.BACKEND_BASE_URL;

  const url = `${backendBaseUrl}/${targetPath}`;
  
  try {
    // 判斷是否為 multipart/form-data
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data');
    let fetchOptions: any = {
      method: req.method,
      headers: { ...req.headers },
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (isMultipart) {
        // multipart 直接轉發原始 body
        fetchOptions.body = req;
        // 不要手動設置 Content-Type，讓 fetch 自己帶
        delete fetchOptions.headers['content-type'];
      } else {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(req.body);
      }
    }
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type');

    res.status(response.status);

    if (contentType && contentType.includes('application/json')) {
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