const fetch = require('node-fetch');
const FormData = require('form-data');
const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8';  // ⚠️ 替换

exports.handler = async (event) => {
  // 统一返回 JSON 的辅助函数
  const json = (statusCode, data) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data)
  });

  // 处理预检
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {});
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: '仅支持 POST' });
  }

  try {
    const { fileBase64, fileName, targetFormat } = JSON.parse(event.body);
    if (!fileBase64 || !fileName || !targetFormat) {
      return json(400, { success: false, error: '缺少参数' });
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
      return json(500, { success: false, error: data.Error });
    }
    if (!data.Files || !data.Files[0]) {
      return json(500, { success: false, error: 'ConvertAPI 未返回文件' });
    }

    return json(200, { success: true, downloadUrl: data.Files[0].Url });
  } catch (err) {
    console.error('函数内部异常:', err);
    return json(500, { success: false, error: err.message || '未知错误' });
  }
};
