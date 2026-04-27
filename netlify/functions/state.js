const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

export const handler = async () => {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/workOrders.json`);
    const data = await res.json();

    const workOrders = data ? Object.values(data) : [];

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, workOrders })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};
