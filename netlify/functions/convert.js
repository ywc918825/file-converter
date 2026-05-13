const axios = require('axios');
const FormData = require('form-data');
const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8';  // 替换成真实 Secret

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
        body: JSON.stringify({ success: false, error: '缺少参数' })
      };
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const fileExt = fileName.split('.').pop().toLowerCase();
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}&StoreFile=true`;

    const response = await axios.post(convertUrl, form, {
      headers: form.getHeaders(),
      // 不设置 maxContentLength 限制，支持大文件
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const data = response.data;
    if (data.Error) {
      throw new Error(data.Error);
    }
    if (!data.Files || data.Files.length === 0) {
      throw new Error('ConvertAPI 未返回文件');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, downloadUrl: data.Files[0].Url })
    };
  } catch (err) {
    // 如果 axios 请求返回了响应，则提取响应体（可能是文本或 JSON）
    let errorMessage = err.message;
    if (err.response) {
      // 把 ConvertAPI 返回的原始内容原样返回给前端
      const raw = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, error: 'ConvertAPI 返回错误（状态码 ' + err.response.status + '）', detail: raw })
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: errorMessage })
    };
  }
};
