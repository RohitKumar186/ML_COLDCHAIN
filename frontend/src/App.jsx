import React from "react";
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
} from "lucide-react";

import "./css/app.css";

import Home from "./pages/Home";
import Monitoring from "./pages/Monitoring";
import Prediction from "./pages/Prediction";
import Inventory from "./pages/Inventory";

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

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">

        <header className="topbar">

          <NavLink to="/" className="brand">
            <span className="brand-mark">
              <Snowflake size={19} />
            </span>

            <span>
              <b>ColdChain</b>
              <small>Vaccine Monitoring System</small>
            </span>
          </NavLink>

          <nav className="topnav">
            {nav.map(({ path, label, icon: Icon }) => (
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
            ))}
          </nav>

          <div className="device-chip">
            <span className="online-dot" />
            VFR-2/8 · Unit A
          </div>

        </header>

        <main className="page-container">
          <Routes>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/monitoring"
              element={<Monitoring />}
            />

            <Route
              path="/prediction"
              element={<Prediction />}
            />

            <Route
              path="/inventory"
              element={<Inventory />}
            />

            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />

          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}