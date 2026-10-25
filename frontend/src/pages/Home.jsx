
import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BrainCircuit,
  Syringe,
  CheckCircle2,
  Thermometer,
  RefreshCw,
} from "lucide-react";

import "../css/home.css";

const features = [
  {
    to: "/monitoring",
    icon: Activity,
    title: "Real-Time Monitoring & Failure Detection",
    desc: "Live temperature, humidity, door, cooling, voltage, connectivity and fault status.",
    items: [
      "Temperature",
      "Humidity",
      "Door status",
      "Cooling status",
      "Voltage / power",
      "Device connectivity",
      "Sensor failure",
      "Voltage failure",
      "Cooling / device failure",
    ],
  },
  {
    to: "/prediction",
    icon: BrainCircuit,
    title: "Prediction",
    desc: "Use current and historical temperature trends to identify upcoming risk.",
    items: [
      "Future temperature prediction",
      "Safe-range risk detection",
      "Early warning",
    ],
  },
  {
    to: "/inventory",
    icon: Syringe,
    title: "Vaccine Usage / Inventory Record",
    desc: "Record what vaccine was used, quantity, date/time and refrigerator.",
    items: [
      "Vaccine type",
      "Quantity used",
      "Date / time",
      "Device / refrigerator",
    ],
  },
];

function getStorageRange(vaccine) {
  if (
    !vaccine ||
    vaccine.minStorageTemp == null ||
    vaccine.maxStorageTemp == null ||
    vaccine.temperatureConfigurationValid === false ||
    vaccine.configurationVerified !== true
  ) {
    return null;
  }

  const min = Number(vaccine.minStorageTemp);
  const max = Number(vaccine.maxStorageTemp);
  const unit = String(vaccine.temperatureUnit || "C").toUpperCase();

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max ||
    !["C", "F"].includes(unit)
  ) {
    return null;
  }

  return `${min}°${unit} to ${max}°${unit}`;
}

export default function Home({
  selectedVaccine,
  onChangeVaccine,
}) {
  const storageRange = getStorageRange(selectedVaccine);

  return (
    <div>
      {/* HERO */}
      <section className="hero home-hero">
        <div className="eyebrow">
          COLD CHAIN MONITORING SYSTEM
        </div>

        <h1>Vaccine refrigerator control center</h1>

        <p>
          Monitor refrigerator health, understand temperature
          risks and maintain vaccine usage records using the
          selected vaccine's storage configuration.
        </p>

        {/* SELECTED VACCINE */}
        <div
          className="home-status"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Thermometer size={17} />

          {selectedVaccine ? (
            <>
              <span>
                Selected vaccine:{" "}
                <b>{selectedVaccine.name || "Unnamed vaccine"}</b>
              </span>

              <span>·</span>

              <span>
                Storage range:{" "}
                <b>{storageRange || "Not verified"}</b>
              </span>
            </>
          ) : (
            <span>
              No vaccine selected. Select a vaccine before
              using vaccine-specific monitoring.
            </span>
          )}

          {onChangeVaccine && (
            <button
              type="button"
              onClick={onChangeVaccine}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid currentColor",
                background: "transparent",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <RefreshCw size={13} />
              Change vaccine
            </button>
          )}
        </div>

        {selectedVaccine && !storageRange && (
          <p
            role="alert"
            style={{
              color: "#b45309",
              fontWeight: 600,
              marginTop: 12,
            }}
          >
            Warning: This vaccine's storage limits are
            missing or unverified. Do not assume a default
            temperature range.
          </p>
        )}
      </section>

      {/* SYSTEM MODULES */}
      <div className="section-label">
        SYSTEM MODULES
      </div>

      <div className="grid grid-2 feature-grid">
        {features.map(
          ({ to, icon: Icon, title, desc, items }) => (
            <Link
              className="card feature-card home-feature"
              to={to}
              key={to}
            >
              <div className="feature-icon">
                <Icon size={21} />
              </div>

              <div>
                <h3>{title}</h3>

                <p>{desc}</p>

                <div className="feature-items">
                  {items.map((item) => (
                    <span key={item}>
                      <CheckCircle2 size={12} />
                      {item}
                    </span>
                  ))}
                </div>

                <span className="open-module">
                  Open module →
                </span>
              </div>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
