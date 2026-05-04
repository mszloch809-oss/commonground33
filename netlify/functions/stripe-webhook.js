// netlify/functions/stripe-webhook.js
// Catches Stripe payment events and updates Firebase rent status

const FIREBASE_URL = "https://commonground-71e64-default-rtdb.firebaseio.com";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Write to Firebase Realtime Database
async function fbWrite(key, val) {
  const url = `${FIREBASE_URL}/cg/${key}.json`;
  await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ v: JSON.stringify(val), t: Date.now() }),
  });
}

// Read from Firebase
async function fbRead(key) {
  const url = `${FIREBASE_URL}/cg/${key}.json`;
  const r = await fetch(url);
  const d = await r.json();
  return d?.v ? JSON.parse(d.v) : null;
}

// Map Stripe payment metadata to unit + propId
// Stripe payment link includes metadata we set up
function extractUnitInfo(paymentIntent) {
  // Check metadata first (most reliable)
  const meta = paymentIntent.metadata || {};
  if (meta.unit && meta.propId) {
    return { unit: meta.unit, propId: meta.propId };
  }

  // Fall back to checking description
  const desc = paymentIntent.description || "";
  const match = desc.match(/Unit\s+(\w+)/i);
  if (match) {
    return { unit: match[1], propId: "cottage" };
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const sig = event.headers["stripe-signature"];
  const body = event.body;

  let stripeEvent;

  try {
    // Verify webhook signature if secret is set
    if (STRIPE_WEBHOOK_SECRET && sig) {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      stripeEvent = stripe.webhooks.constructEvent(
        body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } else {
      // No signature verification (dev mode)
      stripeEvent = JSON.parse(body);
    }
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log("Stripe event:", stripeEvent.type);

  // Handle successful payment
  if (
    stripeEvent.type === "payment_intent.succeeded" ||
    stripeEvent.type === "checkout.session.completed" ||
    stripeEvent.type === "charge.succeeded"
  ) {
    const obj =
      stripeEvent.data.object;
    const amount = obj.amount_received || obj.amount || obj.amount_total || 0;
    const amountDollars = amount / 100;

    // Get customer email to identify tenant
    const email =
      obj.receipt_email ||
      obj.customer_email ||
      obj?.customer_details?.email ||
      "";

    console.log(`Payment of $${amountDollars} from ${email}`);

    // Try to find unit by email in Firebase profiles
    let foundUnit = null;
    let foundPropId = "cottage";

    // Check metadata first
    const unitInfo = extractUnitInfo(obj);
    if (unitInfo) {
      foundUnit = unitInfo.unit;
      foundPropId = unitInfo.propId;
    } else if (email) {
      // Look up tenant by email across all units
      const propIds = ["cottage"];
      const units = ["101", "102", "201", "202", "301", "302", "303"];

      for (const propId of propIds) {
        for (const unit of units) {
          const profile = await fbRead(`cg_profiles_${propId}_${unit}`);
          if (
            profile &&
            profile.email &&
            profile.email.toLowerCase() === email.toLowerCase()
          ) {
            foundUnit = unit;
            foundPropId = propId;
            break;
          }
        }
        if (foundUnit) break;
      }
    }

    if (foundUnit) {
      console.log(`Marking Unit ${foundUnit} at ${foundPropId} as PAID`);

      // Update rent status override in Firebase
      const overrides = (await fbRead("cg_rent_status_overrides")) || {};
      if (!overrides[foundPropId]) overrides[foundPropId] = {};
      overrides[foundPropId][foundUnit] = "paid";
      await fbWrite("cg_rent_status_overrides", overrides);

      // Log the payment to ledger
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const year = now.getFullYear();
      const expKey = `expenses_${foundPropId}-${year}`;
      const existing = (await fbRead(expKey)) || [];
      const paymentRecord = {
        id: "stripe-" + Date.now(),
        propId: foundPropId,
        year,
        date: dateStr,
        desc: `Rent Payment - Unit ${foundUnit}`,
        cat: "Rent",
        amount: amountDollars,
        vendor: "Stripe",
        unit: foundUnit,
        stripePaymentId: obj.id,
        email,
        recurring: false,
      };
      await fbWrite(expKey, [...existing, paymentRecord]);

      console.log("Firebase updated successfully");
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          unit: foundUnit,
          amount: amountDollars,
        }),
      };
    } else {
      console.log(
        `Could not identify unit for payment from ${email}. Amount: $${amountDollars}`
      );
      // Still return 200 so Stripe doesn't retry
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          warning: "Unit not identified",
          email,
          amount: amountDollars,
        }),
      };
    }
  }

  // All other events - acknowledge receipt
  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, type: stripeEvent.type }),
  };
};
