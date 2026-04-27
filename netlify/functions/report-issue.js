const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886";

const VENDORS = [
  { name: "Doherty Plumbing", trade: "plumbing", phone: "+16178940445" },
  { name: "Szloch Electric", trade: "electrical", phone: "+17817062034" },
  { name: "AirCare HVAC", trade: "hvac", phone: "+15085550303" },
  { name: "HandyPro Services", trade: "general", phone: "+15085550606" }
];

function categorize(text) {
  const t = text.toLowerCase();
  if (t.includes("power") || t.includes("electric") || t.includes("outlet")) return "electrical";
  if (t.includes("leak") || t.includes("sink") || t.includes("water")) return "plumbing";
  if (t.includes("heat") || t.includes("ac")) return "hvac";
  return "general";
}

function findVendor(category) {
  return VENDORS.find(v => v.trade === category) || VENDORS[3];
}

async function sendWhatsApp(toPhone, message) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const params = new URLSearchParams();
  params.append("From", TWILIO_FROM_NUMBER);
  params.append("To", `whatsapp:${toPhone}`);
  params.append("Body", message);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const data = await res.json();
  console.log("WhatsApp send:", data);

  if (!res.ok) throw new Error(data.message);
  return data;
}

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const issue = body.text;
    const unit = body.unit;
    const category = categorize(issue);
    const vendor = findVendor(category);

    const workOrderId = `WO-${Date.now()}`;

    const workOrder = {
      workOrderId,
      issue,
      unit,
      category,
      vendorName: vendor.name,
      vendorPhone: vendor.phone,
      status: "open",
      submittedAt: new Date().toISOString()
    };

    await fetch(`${FIREBASE_DB_URL}/workOrders/${workOrderId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workOrder)
    });

    const msg = `New Work Order ${workOrderId}
Unit ${unit}
Issue: ${issue}

Reply YES or DONE`;

    await sendWhatsApp(vendor.phone, msg);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, workOrderId })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};
