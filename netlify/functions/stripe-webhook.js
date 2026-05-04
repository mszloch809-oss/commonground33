// netlify/functions/stripe-webhook.js
// No external dependencies required

const FIREBASE_URL = "https://commonground-71e64-default-rtdb.firebaseio.com";

async function fbWrite(key, val) {
  await fetch(`${FIREBASE_URL}/cg/${key}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ v: JSON.stringify(val), t: Date.now() }),
  });
}

async function fbRead(key) {
  const r = await fetch(`${FIREBASE_URL}/cg/${key}.json`);
  const d = await r.json();
  return d?.v ? JSON.parse(d.v) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  let stripeEvent;
  try { stripeEvent = JSON.parse(event.body); }
  catch (err) { return { statusCode: 400, body: "Invalid JSON" }; }

  console.log("Stripe event:", stripeEvent.type);

  if (stripeEvent.type === "payment_intent.succeeded" || stripeEvent.type === "checkout.session.completed") {
    const obj = stripeEvent.data.object;
    const amount = (obj.amount_received || obj.amount || obj.amount_total || 0) / 100;
    const email = obj.receipt_email || obj.customer_email || obj?.customer_details?.email || "";

    console.log(`Payment $${amount} from ${email}`);

    const propId = "cottage";
    const units = ["101","102","201","202","301","302","303"];
    let foundUnit = obj.metadata?.unit || null;

    if (!foundUnit && email) {
      for (const unit of units) {
        const profile = await fbRead(`cg_profiles_${propId}_${unit}`);
        if (profile?.email?.toLowerCase() === email.toLowerCase()) { foundUnit = unit; break; }
      }
    }

    if (foundUnit) {
      const overrides = (await fbRead("cg_rent_status_overrides")) || {};
      if (!overrides[propId]) overrides[propId] = {};
      overrides[propId][foundUnit] = "paid";
      await fbWrite("cg_rent_status_overrides", overrides);

      const now = new Date();
      const year = now.getFullYear();
      const expKey = `expenses_${propId}-${year}`;
      const existing = (await fbRead(expKey)) || [];
      await fbWrite(expKey, [...existing, {
        id: "stripe-" + Date.now(), propId, year,
        date: now.toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"}),
        desc: `Rent Payment - Unit ${foundUnit}`,
        cat: "Rent", amount, vendor: "Stripe", unit: foundUnit, email,
      }]);

      return { statusCode: 200, body: JSON.stringify({ ok: true, unit: foundUnit, amount }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, warning: "Unit not found", email }) };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
