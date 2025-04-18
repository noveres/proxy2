import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { createReadStream } from 'fs';
import FormData from 'form-data';
import { IncomingMessage } from 'http';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false, // 禁用內建的 bodyParser
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 設置
  res.setHeader('Access-Control-Allow-Origin', 'https://noveres.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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
    // 檢查是否為帶有文件的POST請求
    if (req.method === 'POST' && req.headers['content-type']?.includes('multipart/form-data')) {
      // 解析 multipart/form-data
      const form = new formidable.IncomingForm();
      
      form.parse(req as IncomingMessage, async (err, fields, files) => {
        if (err) {
          return res.status(500).json({ error: 'File parsing error', details: err.message });
        }

        try {
          // 創建新的 FormData 對象
          const formData = new FormData();
          
          // 添加所有文本字段
          Object.entries(fields).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach(v => formData.append(key, v));
            } else {
              formData.append(key, value);
            }
          });
          
          // 添加所有文件
          Object.entries(files).forEach(([key, fileInfo]) => {
            if (Array.isArray(fileInfo)) {
              fileInfo.forEach(file => {
                formData.append(key, createReadStream(file.filepath), {
                  filename: file.originalFilename || 'file',
                  contentType: file.mimetype
                });
              });
            } else {
              formData.append(key, createReadStream(fileInfo.filepath), {
                filename: fileInfo.originalFilename || 'file',
                contentType: fileInfo.mimetype
              });
            }
          });
          
          // 發送到後端API
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders(),
          });
          
          // 處理回應
          const contentType = response.headers.get('content-type');
          let responseData;
          
          if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
          }
          
          // 設置HTTP狀態碼
          res.status(response.status);
          
          // 返回數據
          return res.send(responseData);
        } catch (fetchError) {
          console.error('Backend request error:', fetchError);
          return res.status(500).json({ 
            error: 'Backend request error', 
            details: fetchError.message || String(fetchError)
          });
        }
      });
    } else {
      // 處理非文件上傳的請求
      const headers: HeadersInit = {};
      
      // 複製原始請求的頭信息
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
      
      // 發送請求
      const response = await fetch(url, {
        method: req.method,
        headers: headers,
        body: body,
      });
      
      // 處理回應
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      // 設置HTTP狀態碼
      res.status(response.status);
      
      // 返回數據
      return res.send(responseData);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      details: error.message || String(error),
    });
  }
}