// netlify/functions/convert.js
// 转换专用 Secret，安全存储在后端，不暴露
const CONVERT_SECRET = 'eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiI1MDcwMDU4NiIsInJvbCI6IlJPTEVfUkVHSVNURVIiLCJpc3MiOiJPcGVuWExhYiIsImlhdCI6MTc3ODU2NjA3MiwiY2xpZW50SWQiOiJsa3pkeDU3bnZ5MjJqa3BxOXgydyIsInBob25lIjoiIiwib3BlbklkIjpudWxsLCJ1dWlkIjoiMjUzYWUxYWEtYzkzMi00ZmFhLWJlZGUtOTQ0MGEzYmE4N2RmIiwiZW1haWwiOiIiLCJleHAiOjE3ODYzNDIwNzJ9.61mmGOZuBleHoGkSXyOK1p20GT9dLlwe7h9khlZ-PcCFdIBk9n8TZgeh6mFEIq6cmgJAgnQOv8g-ii_DRCHdOw'; // 替换为你真实的 Secret

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
    const { fileId, fileExt, targetFormat } = JSON.parse(event.body);
    if (!fileId || !fileExt || !targetFormat) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少必要参数' })
      };
    }

    // 构造 JSON body，将 Secret 作为参数之一
    const requestBody = {
      Parameters: [
        { Name: 'FileId', Value: fileId },
        { Name: 'StoreFile', Value: true },
        { Name: 'Secret', Value: CONVERT_SECRET }  // 密钥放在这里
      ]
    };

    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/${targetFormat}`;

    // 使用内置 fetch（Netlify Node 18+ 支持）
    const response = await fetch(convertUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.Error) {
      throw new Error(data.Error);
    }

    if (!data.Files || data.Files.length === 0) {
      throw new Error('转换失败：未返回文件，可能格式不支持');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        downloadUrl: data.Files[0].Url
      })
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
