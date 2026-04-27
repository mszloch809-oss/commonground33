const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886";

const VENDORS = [
  { id: 1, name: "Doherty Plumbing", contact: "Joe Doherty", trade: "plumbing", phone: "+16178940445", preferred: true },
  { id: 2, name: "Szloch Electric", contact: "Mike Szloch", trade: "electrical", phone: "+17817062034", preferred: true },
  { id: 3, name: "PlumbRight LLC", contact: "PlumbRight", trade: "plumbing", phone: "+15085550101", preferred: false },
  { id: 4, name: "Voltex Electric", contact: "Voltex", trade: "electrical", phone: "+15085550202", preferred: false },
  { id: 5, name: "AirCare HVAC", contact: "AirCare", trade: "hvac", phone: "+15085550303", preferred: false },
  { id: 6, name: "HandyPro Services", contact: "HandyPro", trade: "general", phone: "+15085550606", preferred: false },
];

const PROPERTY_NAMES = {
  cottage: "123 Main St, Woburn MA",
  main: "24 Marlborough St, Boston MA",
  elm: "76 Forest St, Stoneham MA"
};

const KEYWORDS = {
  plumbing: ["leak","faucet","pipe","drain","toilet","water","flood","clog","sewer","drip","plumb"],
  electrical: ["electric","outlet","light","breaker","switch","power","circuit","wire","spark","socket"],
  hvac: ["heat","air","hvac","furnace","boiler","radiator","thermostat","cool","ac","hot water","pilot"],
  appliance: ["fridge","oven","stove","dishwasher","washer","dryer","appliance","refrigerator","microwave"],
  structural: ["ceiling","wall","floor","door","window","roof","crack","stain","mold"]
};

function fallbackCategorize(text) {
  const lower = text.toLowerCase();
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  return "general";
}

function findVendor(category) {
  const preferred = VENDORS.find(v => v.trade === category && v.preferred);
  if (preferred) return preferred;
  const any = VENDORS.find(v => v.trade === category);
  if (any) return any;
  return VENDORS.find(v => v.trade === "general");
}

async function sendWhatsApp(to, body) {
  const url = "https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_ACCOUNT_SID + "/Messages.json";
  const auth = Buffer.from(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN).toString("base64");
  const params = new URLSearchParams();
  params.append("From", TWILIO_FROM_NUMBER);
  params.append("To", "whatsapp:" + to);
  params.append("Body", body);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const data = await res.json();
  console.log("Twilio response:", JSON.stringify(data));
  if (!res.ok) throw new Error("Twilio error " + data.code + ": " + data.message);
  return true;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
      body: ""
    };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  try {
    const body = JSON.parse(event.body || "{}");
    const propertyId = body.propertyId || "cottage";
    const unit = body.unit || "?";
    const text = body.text || "";
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "No text" }) };

    let category = fallbackCategorize(text);
    try {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 20, messages: [{ role: "user", content: "One word only — plumbing, electrical, hvac, appliance, structural, or general. Issue: \"" + text + "\"" }] })
      });
      const aiData = await aiRes.json();
      const aiCat = (aiData.content && aiData.content[0] && aiData.content[0].text) ? aiData.content[0].text.trim().toLowerCase().replace(/[^a-z]/g,"") : "";
      if (["plumbing","electrical","hvac","appliance","structural","general"].includes(aiCat)) category = aiCat;
    } catch (e) { console.log("AI fallback:", e.message); }

    const vendor = findVendor(category);
    const workOrderId = "WO-" + Date.now();
    const propName = PROPERTY_NAMES[propertyId] || propertyId;
    const msg = "CommonGround — New Work Order\nID: " + workOrderId + "\n📍 " + propName + ", Unit " + unit + "\n🔧 " + category.toUpperCase() + ": " + text.slice(0,120) + "\n\nReply YES + your ETA\nWhen done reply: DONE";

    await sendWhatsApp(vendor.phone, msg);
    console.log("Dispatched " + workOrderId + " to " + vendor.name);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, workOrderId, category, vendor: vendor.name, vendorContact: vendor.contact }) };
  } catch (e) {
    console.error("report-issue error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
