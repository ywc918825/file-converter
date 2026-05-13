const axios = require('axios');
const FormData = require('form-data');
const { parse } = require('parse-multipart-data');

// 如果用 ConvertAPI，填入你的 Secret；如果用 MinerU，可忽略
const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8';  // 替换！

const respond = (code, data) => ({
  statusCode: code,
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
    // 1. 解析 multipart 数据
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.*)/);
    if (!boundaryMatch) throw new Error('无法获取 boundary');
    const boundary = boundaryMatch[1];
    const bodyBuffer = Buffer.from(event.body, 'base64');
    const parts = parse(bodyBuffer, boundary);

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

    const fileExt = fileName.split('.').pop().toLowerCase();

    // 2. 上传文件到 ConvertAPI
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });
    const uploadRes = await axios.post(
      `https://v2.convertapi.com/upload?secret=${CONVERT_SECRET}`,
      form,
      { headers: form.getHeaders() }
    );
    if (uploadRes.data.Error) throw new Error(uploadRes.data.Error);
    const fileId = uploadRes.data.FileId;

    // 3. 提交异步转换任务
    const asyncRes = await axios.post(
      `https://v2.convertapi.com/async/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}`,
      {
        Parameters: [
          { Name: 'FileId', Value: fileId },
          { Name: 'StoreFile', Value: 'true' },
          { Name: 'ImageQuality', Value: '100' },
          { Name: 'ImageResolution', Value: '300' }
        ]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (asyncRes.data.Error) throw new Error(asyncRes.data.Error);
    const jobId = asyncRes.data.JobId;

    // 4. 轮询结果
    let resultUrl = null;
    for (let i = 0; i < 30; i++) {
      const jobRes = await axios.get(
        `https://v2.convertapi.com/async/job/${jobId}?secret=${CONVERT_SECRET}`
      );
      if (jobRes.data.Status === 'Completed') {
        resultUrl = jobRes.data.Files[0].Url;
        break;
      }
      if (jobRes.data.Status === 'Failed') throw new Error('任务失败');
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!resultUrl) throw new Error('转换超时');

    return respond(200, { success: true, downloadUrl: resultUrl });
  } catch (err) {
    // 返回详细错误信息，包括服务器原始响应
    return respond(500, {
      success: false,
      error: err.message,
      detail: err.response?.data || null,
      stack: err.stack
    });
  }
};
