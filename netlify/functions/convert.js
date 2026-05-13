const axios = require('axios');
const FormData = require('form-data');
const { parse } = require('parse-multipart-data');

const CONVERT_SECRET = '29E4EDmfLee8q4ZKUzA8ioAVLSrTOIH8'; // 替换！

// ... (respond 辅助函数，保持不变)
const respond = (code, data) => ({
  statusCode: code,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  // ... (预检和请求方法检查，保持不变)
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { success: false, error: '仅支持 POST' });

  try {
    // 1. 解析文件
    // ... (解析 multipart 数据，提取文件 Buffer 和 targetFormat，保持不变)
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    // ... (代码省略，与之前相同) ...
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
    console.log(`接收文件: ${fileName}, 大小: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    const fileExt = fileName.split('.').pop().toLowerCase();

    // --- 代码改进点：使用异步工作流 (Async Workflow) ---
    const baseUrl = 'https://v2.convertapi.com';

    // 步骤 1：上传文件，获取 FileId
    const form = new FormData();
    form.append('File', fileBuffer, { filename: fileName });
    const uploadResponse = await axios.post(
      `${baseUrl}/upload?secret=${CONVERT_SECRET}`,
      form,
      { headers: form.getHeaders() }
    );
    if (uploadResponse.data.Error) throw new Error(uploadResponse.data.Error);
    const fileId = uploadResponse.data.FileId;
    console.log(`文件已上传，FileId: ${fileId}`);

    // 步骤 2：发起异步转换任务
    const convertParams = [
      { Name: 'FileId', Value: fileId },
      { Name: 'StoreFile', Value: 'true' },
      { Name: 'ImageQuality', Value: '100' },
      { Name: 'ImageResolution', Value: '300' }
    ];
    const asyncTaskResponse = await axios.post(
      `${baseUrl}/async/convert/${fileExt}/to/${targetFormat}?secret=${CONVERT_SECRET}`,
      { Parameters: convertParams },
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (asyncTaskResponse.data.Error) throw new Error(asyncTaskResponse.data.Error);
    const jobId = asyncTaskResponse.data.JobId;
    console.log(`异步任务已提交，JobId: ${jobId}`);

    // 步骤 3：轮询任务状态
    let resultUrl = null;
    for (let i = 0; i < 30; i++) {
      const jobStatusResponse = await axios.get(
        `${baseUrl}/async/job/${jobId}?secret=${CONVERT_SECRET}`
      );
      if (jobStatusResponse.data.Status === 'Completed') {
        resultUrl = jobStatusResponse.data.Files[0].Url;
        console.log(`转换完成，下载链接: ${resultUrl}`);
        break;
      }
      if (jobStatusResponse.data.Status === 'Failed') {
        throw new Error('异步任务处理失败');
      }
      // 等待 2 秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!resultUrl) throw new Error('异步任务处理超时');

    return respond(200, { success: true, downloadUrl: resultUrl });

  } catch (err) {
    console.error('云函数错误:', err);
    return respond(500, { success: false, error: err.message || '内部错误' });
  }
};
