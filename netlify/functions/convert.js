const fetch = require('node-fetch');
const { parse } = require('parse-multipart-data');

// 使用 MinerU Agent 模式（免费，无需 Token）
const MINERU_API = 'https://mineru.net/api/v4/file-extract';

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
    // 1. 解析文件（和之前一样）
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

    // 2. 把文件上传到临时存储（获取一个公网 URL）
    // 这里使用 file.io 临时存储（免费，文件保留 1 天）
    const tempForm = new (require('form-data'))();
    tempForm.append('file', fileBuffer, { filename: fileName });
    const tempResponse = await fetch('https://file.io', {
      method: 'POST',
      body: tempForm,
      headers: tempForm.getHeaders()
    });
    const tempData = await tempResponse.json();
    if (!tempData.link) throw new Error('文件上传临时存储失败');
    const fileUrl = tempData.link;

    // 3. 提交给 MinerU 解析
    const taskRes = await fetch(MINERU_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: fileUrl,
        checksum: '',
        content: JSON.stringify({ file_name: fileName })
      })
    });
    const taskData = await taskRes.json();
    if (taskData.status !== 'success') throw new Error(taskData.message || '提交任务失败');
    const taskId = taskData.data.task_id;

    // 4. 轮询任务结果（等待最多 60 秒）
    let downloadUrl = null;
    for (let i = 0; i < 30; i++) {
      const statusRes = await fetch(`https://mineru.net/api/v4/extract/task/${taskId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      const statusData = await statusRes.json();
      if (statusData.data.task_status === 'done') {
        downloadUrl = statusData.data.download_url;
        break;
      }
      if (statusData.data.task_status === 'failed') {
        throw new Error('转换任务失败');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!downloadUrl) throw new Error('转换超时，请重试');

    return respond(200, { success: true, downloadUrl });
  } catch (err) {
    console.error('云函数错误:', err);
    return respond(500, { success: false, error: err.message || '内部错误' });
  }
};
