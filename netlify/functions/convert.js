// netlify/functions/convert.js
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '函数正常' })
  };
};
