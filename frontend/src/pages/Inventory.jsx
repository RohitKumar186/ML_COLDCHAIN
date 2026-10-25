
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Syringe,
  CalendarClock,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
} from "lucide-react";

import "../css/inventory.css";
import { getInventory, addInventoryLog } from "../api";

export default function Inventory({ selectedVaccine }) {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(
    selectedVaccine?.name || ""
  );
  const [qty, setQty] = useState("");
  const [type, setType] = useState("in");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [backendError, setBackendError] = useState("");

  const selectedVaccineName =
    selectedVaccine?.name?.trim() || "";

  /* =====================================================
     KEEP FORM SYNCHRONIZED WITH SELECTED VACCINE
  ===================================================== */

  useEffect(() => {
    setName(selectedVaccineName);
    setError("");
  }, [selectedVaccineName]);

  /* =====================================================
     FETCH INVENTORY
  ===================================================== */

  const loadInventory = async () => {
    try {
      const data = await getInventory();

      console.log("Inventory API:", data);

      const records = Array.isArray(data)
        ? data
        : Array.isArray(data?.inventory)
        ? data.inventory
        : Array.isArray(data?.logs)
        ? data.logs
        : [];

      const normalizedRecords = records.map(
        (item, index) => {
          const rawType = String(
            item.type ??
              item.transactionType ??
              "out"
          )
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

          return {
            id:
              item.id ??
              item._id ??
              `${index}-${item.createdAt ?? item.timestamp ?? ""}`,

            vaccine:
              item.vaccine ??
              item.vaccineType ??
              item.name ??
              "Unknown vaccine",

            type: [
              "in",
              "stock_in",
              "addition",
              "add",
            ].includes(rawType)
              ? "in"
              : "out",

            qty: Number(
              item.qty ??
                item.quantity ??
                item.quantityUsed ??
                0
            ),

            time:
              item.time ??
              item.dateTime ??
              item.timestamp ??
              item.createdAt ??
              "—",

            device:
              item.device ??
              item.deviceId ??
              item.refrigerator ??
              "—",
          };
        }
      );

      setLogs(normalizedRecords);
      setBackendError("");
    } catch (err) {
      console.error("Inventory API error:", err);

      setBackendError(
        err?.message ||
          "Unable to load inventory from the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     INITIAL LOAD
  ===================================================== */

  useEffect(() => {
    loadInventory();
  }, []);

  /* =====================================================
     FILTER INVENTORY FOR SELECTED VACCINE
  ===================================================== */

  const visibleLogs = useMemo(() => {
    if (!selectedVaccineName) {
      return logs;
    }

    return logs.filter(
      (item) =>
        String(item.vaccine).trim().toLowerCase() ===
        selectedVaccineName.toLowerCase()
    );
  }, [logs, selectedVaccineName]);

  /* =====================================================
     CURRENT STOCK
     Case-insensitive vaccine names
  ===================================================== */

  const stockMap = useMemo(() => {
    return visibleLogs.reduce((result, item) => {
      const vaccineKey = String(item.vaccine)
        .trim()
        .toLowerCase();

      if (result[vaccineKey] === undefined) {
        result[vaccineKey] = 0;
      }

      if (item.type === "in") {
        result[vaccineKey] += Number(item.qty) || 0;
      } else {
        result[vaccineKey] -= Number(item.qty) || 0;
      }

      return result;
    }, {});
  }, [visibleLogs]);

  /* =====================================================
     TOTAL CURRENT STOCK
  ===================================================== */

  const totalStock = useMemo(() => {
    return Object.values(stockMap).reduce(
      (sum, value) =>
        sum + Math.max(Number(value) || 0, 0),
      0
    );
  }, [stockMap]);

  /* =====================================================
     TOTAL STOCK IN
  ===================================================== */

  const totalStockIn = useMemo(() => {
    return visibleLogs
      .filter((item) => item.type === "in")
      .reduce(
        (sum, item) =>
          sum + (Number(item.qty) || 0),
        0
      );
  }, [visibleLogs]);

  /* =====================================================
     TOTAL STOCK OUT
  ===================================================== */

  const totalStockOut = useMemo(() => {
    return visibleLogs
      .filter((item) => item.type === "out")
      .reduce(
        (sum, item) =>
          sum + (Number(item.qty) || 0),
        0
      );
  }, [visibleLogs]);

  /* =====================================================
     ADD INVENTORY
  ===================================================== */

  const add = async () => {
    setError("");

    const vaccineName = (
      selectedVaccineName || name
    ).trim();

    if (!vaccineName) {
      setError("Please select or enter a vaccine type.");
      return;
    }

    if (
      qty.trim() === "" ||
      !Number.isFinite(Number(qty)) ||
      Number(qty) <= 0
    ) {
      setError(
        "Please enter a valid quantity greater than zero."
      );
      return;
    }

    const quantity = Number(qty);

    if (!Number.isSafeInteger(quantity)) {
      setError("Quantity must be a whole number.");
      return;
    }

    /* CHECK AVAILABLE STOCK */

    if (type === "out") {
      const vaccineKey = vaccineName
        .trim()
        .toLowerCase();

      const availableStock = Math.max(
        Number(stockMap[vaccineKey]) || 0,
        0
      );

      if (quantity > availableStock) {
        setError(
          `Only ${availableStock} doses of ${vaccineName} are currently available.`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        vaccine: vaccineName,
        type,
        quantity,
      };

      await addInventoryLog(payload);
      await loadInventory();

      setName(selectedVaccineName);
      setQty("");
      setType("in");
      setOpen(false);
      setError("");
    } catch (err) {
      console.error("Inventory save error:", err);

      setError(
        err?.message ||
          "Unable to save inventory transaction."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =====================================================
     LOADING STATE
  ===================================================== */

  if (loading) {
    return (
      <div>
        <div className="page-head">
          <div>
            <div className="eyebrow">
              04 · INVENTORY
            </div>

            <h1 className="page-title">
              Vaccine Usage / Inventory Record
            </h1>

            <p className="page-desc">
              Record vaccine stock additions and usage
              from the selected refrigerator.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-sub">
            Loading inventory data...
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <div>
      {/* PAGE HEADER */}

      <div className="page-head">
        <div>
          <div className="eyebrow">
            04 · INVENTORY
          </div>

          <h1 className="page-title">
            Vaccine Usage / Inventory Record
          </h1>

          <p className="page-desc">
            Record vaccine stock additions and usage
            from the selected refrigerator.
          </p>

          {selectedVaccineName && (
            <p className="card-sub">
              Selected vaccine:{" "}
              <b>{selectedVaccineName}</b>
            </p>
          )}
        </div>

        <span className="badge blue">
          <Package size={12} />
          {totalStock} doses in stock
        </span>
      </div>

      {/* BACKEND ERROR */}

      {backendError && (
        <div className="alert warn" role="alert">
          <AlertTriangle size={14} />
          {backendError}
        </div>
      )}

      {/* INVENTORY CARD */}

      <div className="card inventory-card">
        <div className="card-head">
          <div>
            <h3 className="card-title">
              Inventory log
            </h3>

            <div className="card-sub">
              {visibleLogs.length} recorded inventory entries
            </div>
          </div>

          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setOpen((previous) => !previous);
              setError("");
              setName(selectedVaccineName);
            }}
          >
            <Plus size={13} />
            Add inventory
          </button>
        </div>

        {/* ENTRY FORM */}

        {open && (
          <div className="entry-form">
            {/* VACCINE */}

            <div>
              <label>Vaccine type</label>

              <input
                className="input"
                placeholder="e.g. BCG"
                value={selectedVaccineName || name}
                readOnly={Boolean(selectedVaccineName)}
                onChange={(e) => {
                  if (!selectedVaccineName) {
                    setName(e.target.value);
                    setError("");
                  }
                }}
              />
            </div>

            {/* TRANSACTION TYPE */}

            <div className="stock-type-field">
              <label>Transaction type</label>

              <div className="stock-type-selector">
                <button
                  type="button"
                  className={
                    type === "in"
                      ? "stock-type active stock-in"
                      : "stock-type"
                  }
                  onClick={() => {
                    setType("in");
                    setError("");
                  }}
                >
                  <ArrowDownToLine size={15} />

                  <span>
                    <b>Stock In</b>
                    <small>
                      Add vaccines to inventory
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    type === "out"
                      ? "stock-type active stock-out"
                      : "stock-type"
                  }
                  onClick={() => {
                    setType("out");
                    setError("");
                  }}
                >
                  <ArrowUpFromLine size={15} />

                  <span>
                    <b>Stock Out</b>
                    <small>
                      Remove / use vaccines
                    </small>
                  </span>
                </button>
              </div>
            </div>

            {/* QUANTITY */}

            <div>
              <label>
                {type === "in"
                  ? "Quantity added"
                  : "Quantity used"}
              </label>

              <input
                className="input"
                type="number"
                min="1"
                step="1"
                placeholder="12"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setError("");
                }}
              />
            </div>

            {/* AUTOMATIC DATE / TIME */}

            <div>
              <label>Date / time</label>

              <div className="input automatic-time">
                <CalendarClock size={14} />

                <span>
                  Automatically recorded when saved
                </span>
              </div>
            </div>

            {/* ERROR */}

            {error && (
              <div
                className="inventory-error"
                role="alert"
              >
                <AlertTriangle size={13} />
                {error}
              </div>
            )}

            {/* ACTIONS */}

            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setOpen(false);
                  setError("");
                  setQty("");
                  setName(selectedVaccineName);
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={add}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : type === "in"
                  ? "Add stock"
                  : "Remove stock"}
              </button>
            </div>
          </div>
        )}

        {/* INVENTORY TABLE */}

        <div className="table-wrap">
          <table className="table inventory-table">
            <thead>
              <tr>
                <th>Vaccine type</th>
                <th>Transaction</th>
                <th>Quantity</th>
                <th>Date / time</th>
                <th>Device / refrigerator</th>
              </tr>
            </thead>

            <tbody>
              {visibleLogs.map((item) => (
                <tr key={item.id}>
                  {/* VACCINE */}

                  <td>
                    <span className="vaccine-name">
                      <span className="vaccine-icon">
                        <Syringe size={14} />
                      </span>

                      {item.vaccine}
                    </span>
                  </td>

                  {/* TRANSACTION */}

                  <td>
                    <span
                      className={`transaction-badge ${
                        item.type === "in"
                          ? "transaction-in"
                          : "transaction-out"
                      }`}
                    >
                      {item.type === "in" ? (
                        <ArrowDownToLine size={12} />
                      ) : (
                        <ArrowUpFromLine size={12} />
                      )}

                      {item.type === "in"
                        ? "Stock In"
                        : "Stock Out"}
                    </span>
                  </td>

                  {/* QUANTITY */}

                  <td>
                    <b
                      className={
                        item.type === "in"
                          ? "quantity-in"
                          : "quantity-out"
                      }
                    >
                      {item.type === "in" ? "+" : "-"}
                      {item.qty} doses
                    </b>
                  </td>

                  {/* DATE */}

                  <td>
                    <span className="date-cell">
                      <CalendarClock size={13} />
                      {item.time}
                    </span>
                  </td>

                  {/* DEVICE */}

                  <td>{item.device}</td>
                </tr>
              ))}

              {visibleLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="empty-inventory"
                  >
                    {selectedVaccineName
                      ? `No inventory records found for ${selectedVaccineName}. Add opening stock to begin tracking.`
                      : "No inventory records yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVENTORY SUMMARY */}

      <div className="grid grid-3 inventory-summary">
        <div className="stat">
          <div className="stat-label">
            Current stock
          </div>

          <div className="stat-value">
            {totalStock}
          </div>

          <div className="stat-meta">
            doses available
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">
            Stock in
          </div>

          <div className="stat-value stock-in-value">
            +{totalStockIn}
          </div>

          <div className="stat-meta">
            doses added
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">
            Stock out
          </div>

          <div className="stat-value stock-out-value">
            -{totalStockOut}
          </div>

          <div className="stat-meta">
            doses used
          </div>
        </div>
      </div>
    </div>
  );
}
