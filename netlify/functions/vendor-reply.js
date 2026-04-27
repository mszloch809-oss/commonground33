const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

function isDone(body) {
  const lower = body.toLowerCase();
  return lower.includes("done") || lower.includes("complete") || lower.includes("finished") || lower.includes("resolved") || lower.includes("all set");
}

function isConfirm(body) {
  const lower = body.toLowerCase();
  return lower.startsWith("yes") || lower.includes("on my way") || lower.includes("confirmed") || lower.includes("omw") || lower.includes("be there") || lower.includes("heading over");
}

function extractETA(body) {
  return body.replace(/^yes[,\s\-]*/i, "").trim() || "on my way";
}

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  return await res.json();
}

async function fbPatch(path, data) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

async function sendText(to, body) {
  if (!to) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const params = new URLSearchParams();
  params.append("From", TWILIO_FROM_NUMBER);
  params.append("To", to);
  params.append("Body", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Twilio send failed");
}

export const handler = async (event) => {
  const emptyTwiML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  try {
    const params = new URLSearchParams(event.body || "");
    const messageBody = params.get("Body")?.trim() || "";
    const from = params.get("From")?.replace("whatsapp:", "") || "";

    const allOrders = await fbGet("workOrders");
    const orders = allOrders ? Object.values(allOrders) : [];

    const order = orders
      .filter(o => o.vendorPhone === from && o.status !== "closed" && o.status !== "resolved")
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];

    if (!order) {
      console.log("No matching open work order for vendor:", from);
      return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: emptyTwiML };
    }

    let update = {
      vendorReply: messageBody,
      vendorReplyAt: new Date().toISOString()
    };

    if (isDone(messageBody)) {
      update.status = "resolved";
      update.tenantMessage = `Your maintenance request ${order.workOrderId} has been marked resolved.`;
    } else if (isConfirm(messageBody)) {
      const eta = extractETA(messageBody);
      update.status = "in_progress";
      update.eta = eta;
      update.tenantMessage = `${order.vendorName} confirmed your request ${order.workOrderId}. ETA: ${eta}.`;
    } else {
      update.status = "in_progress";
      update.tenantMessage = `${order.vendorName} sent an update on ${order.workOrderId}: ${messageBody}`;
    }

    await fbPatch(`workOrders/${order.workOrderId}`, update);

    if (order.tenantPhone) {
      await sendText(order.tenantPhone, update.tenantMessage);
    }

  } catch (e) {
    console.error("vendor-reply error:", e.message);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: emptyTwiML
  };
};
