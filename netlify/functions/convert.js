const fetch = require('node-fetch');
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
    const body = JSON.parse(event.body);
    const { fileBase64, fileName, targetFormat } = body;
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
      throw new Error('ConvertAPI 未返回文件，可能是格式不支持');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, downloadUrl: data.Files[0].Url })
    };
  } catch (err) {
    console.error('函数错误:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
