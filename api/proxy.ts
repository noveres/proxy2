import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { createReadStream } from 'fs';
import FormData from 'form-data';
import { IncomingMessage } from 'http';

export const config = {
  api: {
    bodyParser: false, // 禁用內建的 bodyParser，讓我們可以自己處理 multipart/form-data
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 設置
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
    if (req.method === 'POST' && req.headers['content-type']?.includes('multipart/form-data')) {
      // 處理文件上傳
      const form = new formidable.IncomingForm();
      form.parse(req as IncomingMessage, async (err, fields, files) => {
        if (err) {
          return res.status(500).json({ error: 'File parsing error', details: err.message });
        }

        // 創建新的 FormData 發送到後端
        const formData = new FormData();
        
        // 添加文本字段
        Object.keys(fields).forEach(key => {
          formData.append(key, fields[key][0]);
        });

        // 添加文件
        Object.keys(files).forEach(key => {
          const file = files[key][0];
          formData.append(key, createReadStream(file.filepath), {
            filename: file.originalFilename,
            contentType: file.mimetype
          });
        });

        try {
          // 發送到後端
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              ...formData.getHeaders()
            },
            body: formData
          });

          // 回傳後端響應
          const contentType = response.headers.get('content-type');
          res.status(response.status);

          if (contentType?.includes('application/json')) {
            const data = await response.json();
            res.json(data);
          } else {
            const text = await response.text();
            res.send(text);
          }
        } catch (fetchError) {
          res.status(500).json({ error: 'Backend request error', details: fetchError.message });
        }
      });
    } else {
      // 處理非文件上傳的請求
      const response = await fetch(url, {
        method: req.method,
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
        },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });

      const contentType = response.headers.get('content-type');
      res.status(response.status);

      if (contentType?.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.send(text);
      }
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}