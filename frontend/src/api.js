
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

export function getPrediction() {
  return request("/prediction");
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
