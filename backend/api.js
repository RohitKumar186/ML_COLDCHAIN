const API_BASE = "http://localhost:4000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = "Something went wrong";

    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}


/* =========================================================
   MONITORING
========================================================= */

export function getMonitoring() {
  return request("/monitoring");
}


/* =========================================================
   HISTORY
========================================================= */

export function getHistory() {
  return request("/history");
}


/* =========================================================
   PREDICTION
========================================================= */

export function getPrediction() {
  return request("/prediction");
}


/* =========================================================
   INVENTORY
========================================================= */

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
  return request(`/inventory/${id}`, {
    method: "DELETE",
  });
}