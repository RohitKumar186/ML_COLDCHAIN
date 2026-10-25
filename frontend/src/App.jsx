
import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";

import {
  Activity,
  BrainCircuit,
  Syringe,
  Snowflake,
  Thermometer,
  RefreshCw,
  X,
  ChevronDown,
} from "lucide-react";

import "./css/app.css";

import Home from "./pages/Home";
import Monitoring from "./pages/Monitoring";
import Prediction from "./pages/Prediction";
import Inventory from "./pages/Inventory";
import { getVaccines } from "./api";

const nav = [
  {
    path: "/monitoring",
    label: "Monitoring",
    icon: Activity,
  },
  {
    path: "/prediction",
    label: "Prediction",
    icon: BrainCircuit,
  },
  {
    path: "/inventory",
    label: "Vaccine Inventory",
    icon: Syringe,
  },
];

const STORAGE_KEY = "coldChainSelectedVaccine";

// =========================================================
// READ SAVED VACCINE
// =========================================================

function readSavedVaccine() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// =========================================================
// VERIFY VACCINE TEMPERATURE CONFIGURATION
// =========================================================

function hasVerifiedTemperatureConfiguration(vaccine) {
  if (!vaccine) return false;

  const min = Number(vaccine.minStorageTemp);
  const max = Number(vaccine.maxStorageTemp);
  const unit = vaccine.temperatureUnit || "C";

  return (
    vaccine.configurationVerified === true &&
    vaccine.temperatureConfigurationValid !== false &&
    vaccine.minStorageTemp != null &&
    vaccine.maxStorageTemp != null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min < max &&
    ["C", "F"].includes(unit)
  );
}

// =========================================================
// TEMPERATURE LABEL
// =========================================================

function getTemperatureLabel(vaccine) {
  if (!hasVerifiedTemperatureConfiguration(vaccine)) {
    return "Storage limits not verified";
  }

  const unit = vaccine.temperatureUnit || "C";

  return `${vaccine.minStorageTemp}°${unit} to ${vaccine.maxStorageTemp}°${unit}`;
}

// =========================================================
// VACCINE SELECTION MODAL
// =========================================================

function VaccineSelectionModal({
  open,
  currentVaccine,
  onClose,
  onConfirm,
  required,
}) {
  const [vaccines, setVaccines] = useState([]);

  const [selectedId, setSelectedId] = useState(
    currentVaccine?.id != null
      ? String(currentVaccine.id)
      : ""
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -------------------------------------------------------
  // LOAD VACCINES FROM DATABASE
  // -------------------------------------------------------

  async function loadVaccines() {
    setLoading(true);
    setError("");

    try {
      const data = await getVaccines();

      if (!Array.isArray(data)) {
        throw new Error(
          "Unexpected vaccine API response. Expected a vaccine list."
        );
      }

      setVaccines(data);

      const currentExists = data.some(
        (vaccine) =>
          String(vaccine.id) === String(selectedId)
      );

      if (!currentExists) {
        setSelectedId("");
      }
    } catch (err) {
      setError(
        err.message || "Unable to load vaccines."
      );
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // LOAD WHEN MODAL OPENS
  // -------------------------------------------------------

  useEffect(() => {
    if (open) {
      loadVaccines();
    }
  }, [open]);

  // -------------------------------------------------------
  // UPDATE SELECTED VACCINE
  // -------------------------------------------------------

  useEffect(() => {
    if (open) {
      setSelectedId(
        currentVaccine?.id != null
          ? String(currentVaccine.id)
          : ""
      );
    }
  }, [open, currentVaccine]);

  const selectedVaccine = vaccines.find(
    (vaccine) =>
      String(vaccine.id) === String(selectedId)
  );

  const validConfiguration =
    hasVerifiedTemperatureConfiguration(
      selectedVaccine
    );

  if (!open) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaccine-modal-title"
        style={styles.modal}
      >
        <div style={styles.modalHeader}>
          <div style={styles.modalIcon}>
            <Syringe size={23} />
          </div>

          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close vaccine selection"
              style={styles.closeButton}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <p style={styles.eyebrow}>
          VACCINE CONFIGURATION
        </p>

        <h2
          id="vaccine-modal-title"
          style={styles.title}
        >
          Select your vaccine
        </h2>

        <p style={styles.description}>
          Choose the vaccine stored in this monitored
          unit. Temperature limits will be taken from
          the database configuration.
        </p>

        {loading ? (
          <div style={styles.message}>
            <RefreshCw size={18} />

            Loading vaccines from database...
          </div>
        ) : error ? (
          <div
            role="alert"
            style={styles.error}
          >
            <strong>
              Unable to load vaccines
            </strong>

            <p>{error}</p>

            <button
              type="button"
              onClick={loadVaccines}
              style={styles.secondaryButton}
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        ) : vaccines.length === 0 ? (
          <div style={styles.message}>
            No active vaccine records were found.
            Configure verified vaccine records in
            PostgreSQL before continuing.
          </div>
        ) : (
          <>
            <label
              htmlFor="vaccine-select"
              style={styles.label}
            >
              Available vaccines
            </label>

            <div style={styles.selectWrapper}>
              <select
                id="vaccine-select"
                value={selectedId}
                onChange={(event) =>
                  setSelectedId(event.target.value)
                }
                style={styles.select}
              >
                <option value="">
                  Select a vaccine...
                </option>

                {vaccines.map((vaccine) => (
                  <option
                    key={vaccine.id}
                    value={String(vaccine.id)}
                  >
                    {vaccine.name}
                    {` — ${getTemperatureLabel(vaccine)}`}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={18}
                style={styles.selectIcon}
              />
            </div>

            {selectedVaccine && (
              <div style={styles.details}>
                <div style={styles.detailHeading}>
                  <Thermometer size={19} />
                  Storage configuration
                </div>

                <strong>
                  {selectedVaccine.name}
                </strong>

                <p style={styles.range}>
                  {getTemperatureLabel(selectedVaccine)}
                </p>

                {selectedVaccine.productIdentifier && (
                  <p style={styles.smallText}>
                    Product:{" "}
                    {selectedVaccine.productIdentifier}
                  </p>
                )}

                {selectedVaccine.storageInstructions && (
                  <p style={styles.smallText}>
                    {selectedVaccine.storageInstructions}
                  </p>
                )}

                {!validConfiguration && (
                  <p
                    role="alert"
                    style={styles.warning}
                  >
                    This vaccine does not have a verified
                    temperature configuration. Select a
                    verified record before continuing.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div style={styles.actions}>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={
              !validConfiguration ||
              loading ||
              Boolean(error)
            }
            onClick={() => {
              if (validConfiguration) {
                onConfirm(selectedVaccine);
              }
            }}
            style={{
              ...styles.primaryButton,
              opacity:
                !validConfiguration || loading || error
                  ? 0.5
                  : 1,
              cursor:
                !validConfiguration || loading || error
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Confirm vaccine
          </button>
        </div>
      </section>
    </div>
  );
}

// =========================================================
// MAIN APPLICATION
// =========================================================

export default function App() {
  const [selectedVaccine, setSelectedVaccine] =
    useState(readSavedVaccine);

  const [modalOpen, setModalOpen] = useState(
    () => !readSavedVaccine()
  );

  const [checkingVaccine, setCheckingVaccine] =
    useState(() => Boolean(readSavedVaccine()));

  // -------------------------------------------------------
  // REVALIDATE SAVED VACCINE ON APP STARTUP
  // -------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function verifySavedVaccine() {
      const savedVaccine = readSavedVaccine();

      if (!savedVaccine?.id) {
        setSelectedVaccine(null);
        setModalOpen(true);
        setCheckingVaccine(false);
        return;
      }

      setCheckingVaccine(true);

      try {
        const vaccines = await getVaccines();

        if (cancelled) return;

        if (!Array.isArray(vaccines)) {
          throw new Error(
            "Unexpected vaccine API response."
          );
        }

        const currentVaccine = vaccines.find(
          (vaccine) =>
            String(vaccine.id) ===
            String(savedVaccine.id)
        );

        if (
          hasVerifiedTemperatureConfiguration(
            currentVaccine
          )
        ) {
          // Use the latest database record,
          // not the previously cached object.
          setSelectedVaccine(currentVaccine);

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(currentVaccine)
            );
          } catch {
            // Continue with current-session state.
          }

          setModalOpen(false);
        } else {
          // Record is missing or its limits are unverified.
          setSelectedVaccine(null);

          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Ignore storage restrictions.
          }

          setModalOpen(true);
        }
      } catch (err) {
        if (cancelled) return;

        console.error(
          "Unable to verify saved vaccine:",
          err
        );

        // Do not use stale saved limits if the database
        // cannot confirm the selected vaccine.
        setSelectedVaccine(null);

        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage restrictions.
        }

        setModalOpen(true);
      } finally {
        if (!cancelled) {
          setCheckingVaccine(false);
        }
      }
    }

    verifySavedVaccine();

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------
  // CONFIRM VACCINE
  // -------------------------------------------------------

  function handleVaccineConfirm(vaccine) {
    if (!hasVerifiedTemperatureConfiguration(vaccine)) {
      return;
    }

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(vaccine)
      );
    } catch {
      // Do not block current-session use if storage fails.
    }

    setSelectedVaccine(vaccine);
    setModalOpen(false);
  }

  // -------------------------------------------------------
  // CHANGE VACCINE
  // -------------------------------------------------------

  function handleChangeVaccine() {
    setModalOpen(true);
  }

  // -------------------------------------------------------
  // RENDER APPLICATION
  // -------------------------------------------------------

  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <NavLink
            to="/"
            className="brand"
          >
            <span className="brand-mark">
              <Snowflake size={19} />
            </span>

            <span>
              <b>ColdChain</b>
              <small>
                Vaccine Monitoring System
              </small>
            </span>
          </NavLink>

          <nav className="topnav">
            {nav.map(
              ({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    isActive
                      ? "nav-link active"
                      : "nav-link"
                  }
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </NavLink>
              )
            )}
          </nav>

          <button
            type="button"
            onClick={handleChangeVaccine}
            style={styles.vaccineChip}
            title="Change selected vaccine"
          >
            <span style={styles.onlineDot} />

            <span>
              {selectedVaccine?.name ||
                "Select vaccine"}
            </span>

            <ChevronDown size={14} />
          </button>
        </header>

        <main className="page-container">
          {checkingVaccine ? (
            <div
              role="status"
              style={{
                padding: "48px 20px",
                textAlign: "center",
                color: "#657184",
              }}
            >
              <RefreshCw
                size={22}
                style={{
                  display: "block",
                  margin: "0 auto 12px",
                }}
              />

              Verifying vaccine configuration...
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    selectedVaccine={selectedVaccine}
                    onChangeVaccine={handleChangeVaccine}
                  />
                }
              />

              <Route
                path="/monitoring"
                element={
                  <Monitoring
                    selectedVaccine={selectedVaccine}
                  />
                }
              />

              <Route
                path="/prediction"
                element={
                  <Prediction
                    selectedVaccine={selectedVaccine}
                  />
                }
              />

              <Route
  path="/inventory"
  element={
    <Inventory selectedVaccine={selectedVaccine} />
  }
/>

              <Route
                path="*"
                element={
                  <Navigate
                    to="/"
                    replace
                  />
                }
              />
            </Routes>
          )}
        </main>

        <VaccineSelectionModal
          open={modalOpen}
          currentVaccine={selectedVaccine}
          required={!selectedVaccine}
          onClose={() => setModalOpen(false)}
          onConfirm={handleVaccineConfirm}
        />
      </div>
    </BrowserRouter>
  );
}

// =========================================================
// MODAL STYLES
// =========================================================

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(10, 20, 35, 0.72)",
    backdropFilter: "blur(5px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    overflowY: "auto",
  },

  modal: {
    background: "#ffffff",
    color: "#182230",
    width: "100%",
    maxWidth: 520,
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 18,
    padding: 28,
    boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#eaf5ef",
    color: "#18794e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 8,
  },

  eyebrow: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: 700,
    color: "#18794e",
  },

  title: {
    fontSize: 27,
    lineHeight: 1.2,
    margin: "0 0 10px",
  },

  description: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#657184",
    marginBottom: 24,
  },

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
  },

  selectWrapper: {
    position: "relative",
  },

  select: {
    width: "100%",
    appearance: "none",
    border: "1px solid #d5dce5",
    borderRadius: 10,
    padding: "13px 40px 13px 12px",
    fontSize: 14,
    background: "#ffffff",
    color: "#182230",
  },

  selectIcon: {
    position: "absolute",
    right: 12,
    top: 13,
    pointerEvents: "none",
  },

  details: {
    marginTop: 18,
    border: "1px solid #e0e7ee",
    borderRadius: 12,
    padding: 16,
    background: "#f8fafc",
  },

  detailHeading: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
    color: "#18794e",
  },

  range: {
    fontSize: 21,
    fontWeight: 700,
    margin: "8px 0",
  },

  smallText: {
    fontSize: 12,
    color: "#657184",
    lineHeight: 1.5,
  },

  warning: {
    color: "#a34b00",
    fontSize: 12,
    lineHeight: 1.5,
  },

  message: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 10,
    background: "#f3f6f9",
    fontSize: 13,
    lineHeight: 1.5,
  },

  error: {
    background: "#fff0f0",
    color: "#a4262c",
    padding: 16,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.5,
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 24,
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 9,
    padding: "12px 18px",
    background: "#18794e",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 13,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid #d5dce5",
    borderRadius: 9,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#182230",
    fontSize: 13,
    cursor: "pointer",
  },

  vaccineChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #d5dce5",
    borderRadius: 20,
    padding: "8px 12px",
    background: "#ffffff",
    color: "#182230",
    fontSize: 12,
    cursor: "pointer",
    maxWidth: 230,
  },

  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#16a36a",
    flexShrink: 0,
  },
};
