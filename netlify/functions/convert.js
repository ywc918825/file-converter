const axios = require('axios');
const FormData = require('form-data');
const { parse } = require('parse-multipart-data');

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
    // 1. 解析文件
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

    // 2. 上传到临时存储（file.io）
    const tempForm = new FormData();
    tempForm.append('file', fileBuffer, { filename: fileName });
    const tempRes = await axios.post('https://file.io', tempForm, {
      headers: tempForm.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    if (!tempRes.data.link) throw new Error('文件上传临时存储失败: ' + (tempRes.data.message || ''));
    const fileUrl = tempRes.data.link;
    console.log('临时文件URL:', fileUrl);

    // 3. 提交 MinerU 任务
    const taskRes = await axios.post(MINERU_API, {
      url: fileUrl,
      checksum: '',
      content: JSON.stringify({ file_name: fileName })
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (taskRes.data.status !== 'success') {
      throw new Error(taskRes.data.message || '任务提交失败');
    }
    const taskId = taskRes.data.data.task_id;
    console.log('任务ID:', taskId);

    // 4. 轮询结果
    let resultUrl = null;
    for (let i = 0; i < 30; i++) {
      const statusRes = await axios.get(`https://mineru.net/api/v4/extract/task/${taskId}`);
      if (statusRes.data.data.task_status === 'done') {
        resultUrl = statusRes.data.data.download_url;
        break;
      }
      if (statusRes.data.data.task_status === 'failed') {
        throw new Error('MinerU 转换失败');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!resultUrl) throw new Error('转换超时，请重试');
    return respond(200, { success: true, downloadUrl: resultUrl });
  } catch (err) {
    console.error('MinerU 错误:', err.response?.data || err.message);
    return respond(500, { success: false, error: err.message || '内部错误' });
  }
};
