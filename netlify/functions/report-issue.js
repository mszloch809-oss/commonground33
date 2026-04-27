const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

const VENDORS = [
  { id: 1, name: "Doherty Plumbing", contact: "Joe Doherty", trade: "plumbing", phone: "+16178940445", preferred: true },
  { id: 2, name: "Szloch Electric", contact: "Mike Szloch", trade: "electrical", phone: "+17817062034", preferred: true },
  { id: 3, name: "AirCare HVAC", contact: "AirCare", trade: "hvac", phone: "+15085550303", preferred: false },
  { id: 4, name: "HandyPro Services", contact: "HandyPro", trade: "general", phone: "+15085550606", preferred: false }
];

const PROPERTY_NAMES = {
  cottage: "123 Main St",
  main: "24 Marlborough St",
  elm: "76 Forest St"
};

const KEYWORDS = {
  plumbing: ["leak", "faucet", "pipe", "drain", "toilet", "water", "flood", "clog", "sewer", "drip"],
  electrical: ["electric", "outlet", "light", "breaker", "switch", "power", "circuit", "wire", "spark"],
  hvac: ["heat", "air", "hvac", "furnace", "boiler", "radiator", "thermostat", "ac"],
  appliance: ["fridge", "oven", "stove", "dishwasher", "washer", "dryer", "refrigerator"],
  structural: ["ceiling", "wall", "floor", "door", "window", "roof", "crack", "mold"]
};

function fallbackCategorize(text) {
  const lower = text.toLowerCase();

  for (const [category, words] of Object.entries(KEYWORDS)) {
    if (words.some(word => lower.includes(word))) return category;
  }

  return "general";
}

function findVendor(category) {
  const preferred = VENDORS.find(v => v.trade === category && v.preferred);
  if (preferred) return preferred;

  const anyMatch = VENDORS.find(v => v.trade === category);
  if (anyMatch) return anyMatch;

  return VENDORS.find(v => v.trade === "general");
}

async function saveWorkOrder(workOrderId, workOrder) {
  if (!FIREBASE_DB_URL) {
    throw new Error("Missing FIREBASE_DB_URL environment variable");
  }

  const res = await fetch(`${FIREBASE_DB_URL}/workOrders/${workOrderId}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workOrder)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Firebase save failed: " + errText);
  }
}

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const propertyId = body.propertyId || "cottage";
    const propertyName = PROPERTY_NAMES[propertyId] || propertyId;
    const unit = body.unit || "?";
    const text = body.text || body.issue || "";
    const tenantPhone = body.tenantPhone || "";
    const tenantName = body.tenantName || "";

    if (!text.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: "No issue text provided" })
      };
    }

    const category = fallbackCategorize(text);
    const vendor = findVendor(category);
    const workOrderId = `WO-${Date.now()}`;

    const workOrder = {
      workOrderId,
      propertyId,
      propertyName,
      unit,
      issue: text,
      category,
      status: "open",
      submittedAt: new Date().toISOString(),
      tenantName,
      tenantPhone,
      vendorName: vendor.name,
      vendorContact: vendor.contact,
      vendorPhone: vendor.phone,
      vendorReply: "",
      tenantMessage: "",
      eta: "",
      twilioEnabled: false
    };

    await saveWorkOrder(workOrderId, workOrder);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        workOrderId,
        category,
        vendor: vendor.name,
        message: "Work order created. Twilio is turned off for now."
      })
    };

  } catch (e) {
    console.error("report-issue error:", e.message);

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
