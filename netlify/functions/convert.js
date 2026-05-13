// netlify/functions/convert.js
const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8'; // 替换为真实 Secret

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: '仅支持 POST' }) };
  }

  try {
    const { fileBase64, fileName, targetFormat } = JSON.parse(event.body);
    if (!fileBase64 || !fileName || !targetFormat) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少参数：fileBase64, fileName, targetFormat' })
      };
    }

    // 解码 Base64 为 Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    
    // 动态 require form-data
    const FormData = require('form-data');
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    // 推断源格式
    const fileExt = fileName.split('.').pop().toLowerCase();

    // 直接调用转换端点，同时上传文件
    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}&StoreFile=true`;

    const response = await fetch(convertUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const data = await response.json();

    if (data.Error) {
      throw new Error(data.Error);
    }

    if (!data.Files || data.Files.length === 0) {
      throw new Error('未返回文件');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        downloadUrl: data.Files[0].Url
      })
    };
  } catch (err) {
    console.error('云函数错误:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
