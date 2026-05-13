const axios = require('axios');

exports.handler = async (event) => {
  // CORS 头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: '仅支持 POST' })
    };
  }

  try {
    const { fileBase64, fileName, targetFormat, token } = JSON.parse(event.body);
    if (!fileBase64 || !fileName || !targetFormat || !token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少参数' })
      };
    }

    // Base64 -> Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    // 1. 上传到 ConvertAPI
    const uploadRes = await axios.post('https://v2.convertapi.com/upload', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    if (uploadRes.data.Error) {
      throw new Error(uploadRes.data.Error);
    }
    const fileId = uploadRes.data.FileId;
    const fileExt = uploadRes.data.FileExt;

    // 2. 转换
    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}`;
    const convertBody = {
      Parameters: [
        { Name: 'FileId', Value: fileId },
        { Name: 'StoreFile', Value: true }
      ]
    };

    const convertRes = await axios.post(convertUrl, convertBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (convertRes.data.Error) throw new Error(convertRes.data.Error);
    if (!convertRes.data.Files || convertRes.data.Files.length === 0) {
      throw new Error('服务器未返回文件，格式可能不支持');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        downloadUrl: convertRes.data.Files[0].Url
      })
    };

  } catch (err) {
    console.error('函数内部错误:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};