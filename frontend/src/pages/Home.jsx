import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BrainCircuit,
  Syringe,
  CheckCircle2,
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

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section className="hero home-hero">
        <div className="eyebrow">
          COLD CHAIN MONITORING SYSTEM
        </div>

        <h1>
          Vaccine refrigerator control center
        </h1>

        <p>
          A clear, professional workspace for monitoring
          refrigerator health, predicting temperature risk
          and maintaining vaccine usage records.
        </p>

        <div className="home-status">
          <span className="status-dot" />

          Unit A is online · Safe operating range:{" "}
          <b>2–8°C</b>
        </div>
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