const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8'; // 替换！

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
    const FormData = require('form-data');
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    const fileExt = fileName.split('.').pop().toLowerCase();
    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}&StoreFile=true`;

    const response = await fetch(convertUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    const data = await response.json();

    if (data.Error) throw new Error(data.Error);
    if (!data.Files || data.Files.length === 0) throw new Error('未返回文件');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, downloadUrl: data.Files[0].Url })
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
