const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  return await res.json();
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  try {
    const data = await fbGet("workOrders");
    const workOrders = data ? Object.values(data) : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        workOrders
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: e.message
      })
    };
  }
};
