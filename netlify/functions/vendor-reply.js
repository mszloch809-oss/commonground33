function extractETA(body) {
  const cleaned = body.replace(/^yes[,\s\-]*/i, "").trim();
  if (!cleaned || cleaned.length < 2) return "on my way";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isDone(body) {
  const lower = body.toLowerCase();
  return lower.includes("done") || lower.includes("complete") ||
    lower.includes("finished") || lower.includes("resolved") ||
    lower.includes("all set") || lower.includes("wrapped up");
}

function isConfirm(body) {
  const lower = body.toLowerCase();
  return lower.startsWith("yes") || lower.includes("on my way") ||
    lower.includes("confirmed") || lower.includes("omw") ||
    lower.includes("be there") || lower.includes("heading over");
}

export const handler = async (event) => {
  const emptyTwiML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  try {
    const params = new URLSearchParams(event.body);
    const messageBody = params.get("Body")?.trim() || "";

    if (isDone(messageBody)) {
      console.log("Vendor marked job DONE:", messageBody);
    } else if (isConfirm(messageBody)) {
      const eta = extractETA(messageBody);
      console.log("Vendor confirmed ETA:", eta);
    } else {
      console.log("Vendor message received:", messageBody);
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
