const axios = require('axios');
const FormData = require('form-data');

// 🔒 把你的 ConvertAPI Secret 填在这里
const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8';

const respond = (statusCode, data) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { success: false, error: '仅支持 POST' });

  try {
    const { fileBase64, fileName, targetFormat } = JSON.parse(event.body);
    if (!fileBase64 || !fileName || !targetFormat) {
      return respond(400, { success: false, error: '缺少参数' });
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const fileExt = fileName.split('.').pop().toLowerCase();
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}&StoreFile=true`;

    const response = await axios.post(convertUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const data = response.data;
    if (data.Error) {
      return respond(500, { success: false, error: data.Error });
    }
    if (!data.Files || !data.Files[0]) {
      return respond(500, { success: false, error: 'ConvertAPI 未返回文件' });
    }

    return respond(200, { success: true, downloadUrl: data.Files[0].Url });
  } catch (err) {
    // 如果是 axios 错误，取出详细响应
    if (err.response) {
      const status = err.response.status;
      const detail = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
      return respond(502, { success: false, error: `ConvertAPI 返回错误 (${status})`, detail });
    }
    // 其他错误
    console.error('函数内部异常:', err);
    return respond(500, { success: false, error: err.message || '内部错误' });
  }
};
