const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

function categorize(text) {
  const t = text.toLowerCase();
  if (t.includes("electric") || t.includes("power")) return "electrical";
  if (t.includes("leak") || t.includes("water")) return "plumbing";
  return "general";
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);

    const workOrderId = `WO-${Date.now()}`;

    const workOrder = {
      workOrderId,
      issue: body.text,
      unit: body.unit,
      propertyId: body.propertyId,
      propertyName: "33 Cottage St",
      category: categorize(body.text),
      status: "open",
      submittedAt: new Date().toISOString(),
      tenantName: body.tenantName || "",
      tenantPhone: body.tenantPhone || "",
      vendorName: "Szloch Electric"
    };

    await fetch(`${FIREBASE_DB_URL}/workOrders/${workOrderId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workOrder)
    });

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
