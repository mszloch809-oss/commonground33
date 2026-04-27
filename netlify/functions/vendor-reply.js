export const handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0"?><Response></Response>`
  };
};
