const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

function isDone(text) {
  return text.toLowerCase().includes("done");
}

function isConfirm(text) {
  return text.toLowerCase().includes("yes");
}

export const handler = async (event) => {
  try {
    const params = new URLSearchParams(event.body);
    const body = params.get("Body");
    const from = params.get("From").replace("whatsapp:", "");

    const res = await fetch(`${FIREBASE_DB_URL}/workOrders.json`);
    const data = await res.json();
    const orders = data ? Object.values(data) : [];

    const order = orders.find(o => o.vendorPhone === from && o.status !== "resolved");

    if (!order) return { statusCode: 200, body: "" };

    let status = "in_progress";

    if (isDone(body)) status = "resolved";
    else if (isConfirm(body)) status = "in_progress";

    await fetch(`${FIREBASE_DB_URL}/workOrders/${order.workOrderId}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

  } catch (e) {
    console.log(e);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0"?><Response></Response>`
  };
};
