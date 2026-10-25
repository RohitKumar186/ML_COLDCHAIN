
const API_BASE = (
  import.meta.env.VITE_API_BASE ||
  "https://cold-chain-backend-8e6c.onrender.com/api"
).replace(/\/+$/, "");

// =========================================================
// COMMON API REQUEST
// =========================================================

async function request(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    console.error("Backend connection error:", error);

    throw new Error(
      "Unable to connect to the backend. Check your connection."
    );
  }

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;

    try {
      const error = await response.json();

      errorMessage =
        error.error ||
        error.message ||
        errorMessage;
    } catch {
      // Response was not valid JSON.
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type");

  if (contentType && !contentType.includes("application/json")) {
    throw new Error(
      "Backend returned an unexpected response format."
    );
  }

  try {
    return await response.json();
  } catch {
    throw new Error(
      "Unable to read the response from the backend."
    );
  }
}

// =========================================================
// MONITORING
// =========================================================

export function getMonitoring() {
  return request("/monitoring");
}

// =========================================================
// HISTORY
// =========================================================

export function getHistory() {
  return request("/history");
}

// =========================================================
// PREDICTION
// =========================================================


export async function getPrediction() {
  try {
    return await request("/prediction");
  } catch (error) {
    console.warn(
      "Prediction API unavailable. Using demo data:",
      error.message
    );

    const inside = Number(
      (5.5 + Math.random() * 1.5).toFixed(1)
    );

    const outside = 28.5;

    const predicted = Number(
      (inside + Math.random() * 0.6 - 0.2).toFixed(1)
    );

    const coolingLevel =
      predicted < 2 ? 0 :
      predicted <= 8 ? 1 : 2;

    return {
      inside_temperature: inside,
      outside_temperature: outside,
      predicted_inside_temp: predicted,
      future_temperatures: [predicted],
      cooling_level: coolingLevel,
      cooling_decision:
        coolingLevel === 0
          ? "OFF"
          : coolingLevel === 1
            ? "NORMAL COOLING"
            : "MAX COOLING",
      peltier: coolingLevel > 0,
      risk:
        predicted < 2 || predicted > 8
          ? "high"
          : "low",
      trend:
        predicted > inside
          ? "RISING"
          : predicted < inside
            ? "FALLING"
            : "STABLE",
      demo_mode: true,
      timestamp: new Date().toISOString(),
    };
  }
}


// =========================================================
// INVENTORY
// =========================================================

export function getInventory() {
  return request("/inventory");
}

export function addInventoryLog(data) {
  return request("/inventory", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteInventoryLog(id) {
  if (id === null || id === undefined || String(id).trim() === "") {
    throw new Error("An inventory record ID is required.");
  }

  return request(
    `/inventory/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}

// =========================================================
// VACCINES
// =========================================================

// Fetch vaccines from PostgreSQL through the backend.
// Supports either:
// 1. { vaccines: [...] }
// 2. [...]
export async function getVaccines() {
  const result = await request("/vaccines");

  const vaccines = Array.isArray(result)
    ? result
    : result?.vaccines;

  if (!Array.isArray(vaccines)) {
    throw new Error(
      "Invalid vaccine data received from backend. Expected a vaccine list."
    );
  }

  return vaccines;
}

// =========================================================
// SINGLE VACCINE
// =========================================================

// Fetch one vaccine using its database ID.
export async function getVaccine(id) {
  if (
    id === null ||
    id === undefined ||
    String(id).trim() === ""
  ) {
    throw new Error("A vaccine ID is required.");
  }

  const result = await request(
    `/vaccines/${encodeURIComponent(id)}`
  );

  const vaccine = result?.vaccine ?? result;

  if (
    !vaccine ||
    typeof vaccine !== "object" ||
    Array.isArray(vaccine)
  ) {
    throw new Error(
      "Vaccine details are unavailable."
    );
  }

  return vaccine;
}
