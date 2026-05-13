const fetch = require('node-fetch');
const FormData = require('form-data');
const { parse } = require('parse-multipart-data');
const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8';  // 替换！

const respond = (code, data) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { success: false, error: '仅支持 POST' });

  try {
    // 1. 提取 boundary
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.*)/);
    if (!boundaryMatch) throw new Error('无法获取 boundary');
    const boundary = boundaryMatch[1];

    // 2. Netlify 函数的 body 是 base64 编码的二进制数据
    const bodyBuffer = Buffer.from(event.body, 'base64');

    // 3. 解析 multipart 表单
    const parts = parse(bodyBuffer, boundary);

    // 4. 提取文件和参数
    let fileBuffer = null, fileName = '', targetFormat = 'docx';
    for (const part of parts) {
      if (part.name === 'file') {
        fileBuffer = part.data;
        fileName = part.filename;
      } else if (part.name === 'targetFormat') {
        targetFormat = part.data.toString('utf-8').trim();
      }
    }

    if (!fileBuffer || !fileName) throw new Error('未收到文件');
    console.log(`收到文件: ${fileName}, 大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB, 格式: ${targetFormat}`);

    // 5. 准备发送给 ConvertAPI 的表单
    const fileExt = fileName.split('.').pop().toLowerCase();
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });

    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}&StoreFile=true`;
    console.log('调用 ConvertAPI...');

    const response = await fetch(convertUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const data = await response.json();
    console.log('ConvertAPI 响应:', JSON.stringify(data).substring(0, 200));

    if (data.Error) return respond(500, { success: false, error: data.Error });
    if (!data.Files || data.Files.length === 0) return respond(500, { success: false, error: 'ConvertAPI 未返回文件' });

    return respond(200, { success: true, downloadUrl: data.Files[0].Url });
  } catch (err) {
    console.error('云函数错误:', err);
    return respond(500, { success: false, error: err.message || '内部错误' });
  }
};
