import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      duplex: 'half', // 💥 必須加上這行才不會錯
    };

    // 針對 multipart，不要手動設 Content-Type，讓 fetch 自己處理 boundary
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req; // stream passthrough
      if (isMultipart) {
        delete fetchOptions.headers['content-type'];
      }
    }

    const response = await fetch(url, fetchOptions);

    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    if (response.body) {
      await streamPipeline(response.body, res); // 傳圖片／檔案 stream
    } else {
      res.end();
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Proxy error', details: err.message || err });
  }
}
