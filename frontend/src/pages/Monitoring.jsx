import React, { useEffect, useMemo, useState } from "react";
import {
  Thermometer,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
} from "recharts";
import "../css/monitoring.css";
import { getMonitoring } from "../api";

const timeOptions = [
  { key: "10m", label: "10 min", points: 10 },
  { key: "30m", label: "30 min", points: 30 },
  { key: "1h", label: "1 hr", points: 60 },
  { key: "all", label: "All time", points: 120 },
];

/* =====================================================
   FAILURE ITEM
===================================================== */

function FailureItem({ title, failed }) {
  return (
    <div className="failure-item">
      <div
        className={`failure-status ${
          failed ? "failed" : "working"
        }`}
      >
        {failed ? (
          <AlertTriangle size={16} />
        ) : (
          <CheckCircle2 size={16} />
        )}
      </div>

      <div className="failure-info">
        <b>{title}</b>

        <span
          className={
            failed ? "failure-text" : "working-text"
          }
        >
          {failed
            ? "Failure detected"
            : "Working normally"}
        </span>
      </div>
    </div>
  );
}

/* =====================================================
   MONITORING PAGE
===================================================== */

export default function Monitoring() {
  const [temp, setTemp] = useState(5.2);

  const [humidity, setHumidity] = useState(null);
  const [voltage, setVoltage] = useState(null);

  const [doorOpen, setDoorOpen] = useState(false);
  const [coolingOn, setCoolingOn] = useState(false);
  const [deviceConnected, setDeviceConnected] =
    useState(false);

  const [tempHistory, setTempHistory] = useState([]);
  const [graphRange, setGraphRange] = useState("10m");

  const [temperatureFailure, setTemperatureFailure] =
    useState(false);

  const [voltageFailure, setVoltageFailure] =
    useState(false);

  const [doorFailure, setDoorFailure] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");

  /* =====================================================
     FETCH MONITORING DATA
  ===================================================== */

  const loadMonitoring = async () => {
    try {
      const data = await getMonitoring();

      console.log("Monitoring API:", data);

      /* -----------------------------------------------
         TEMPERATURE
      ------------------------------------------------ */

      const temperatureValue =
        typeof data.temperature === "object"
          ? Number(data.temperature?.value)
          : Number(data.temperature);

      if (Number.isFinite(temperatureValue)) {
        setTemp(temperatureValue);

        setTempHistory((history) => [
          ...history.slice(-119),
          {
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            value: temperatureValue,
          },
        ]);
      }

      /* -----------------------------------------------
         OTHER SENSOR VALUES
      ------------------------------------------------ */

      const humidityValue = Number(data.humidity);

      if (Number.isFinite(humidityValue)) {
        setHumidity(humidityValue);
      }

      const voltageValue = Number(data.voltage);

      if (Number.isFinite(voltageValue)) {
        setVoltage(voltageValue);
      }

      /* -----------------------------------------------
         DEVICE STATES
      ------------------------------------------------ */

      setDoorOpen(Boolean(data.doorOpen));
      setCoolingOn(Boolean(data.coolingOn));
      setDeviceConnected(
        Boolean(data.deviceConnected)
      );

      /* -----------------------------------------------
         FAILURE DETECTION
      ------------------------------------------------ */

      const temperatureFault =
        data.temperatureFailure ??
        data.temperature?.failure ??
        !Number.isFinite(temperatureValue);

      const voltageFault =
        data.voltageFailure ??
        data.voltage?.failure ??
        !Number.isFinite(voltageValue);

      const doorFault =
        data.doorFailure ??
        data.door?.failure ??
        false;

      setTemperatureFailure(Boolean(temperatureFault));
      setVoltageFailure(Boolean(voltageFault));
      setDoorFailure(Boolean(doorFault));

      setBackendError("");
      setLoading(false);

    } catch (error) {
      console.error(
        "Monitoring API error:",
        error
      );

      setBackendError(
        "Unable to connect to monitoring backend."
      );

      setLoading(false);
    }
  };

  /* =====================================================
     INITIAL LOAD + LIVE POLLING
  ===================================================== */

  useEffect(() => {
    loadMonitoring();

    const interval = setInterval(() => {
      loadMonitoring();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  /* =====================================================
     GRAPH DATA
  ===================================================== */

  const graphData = useMemo(() => {
    const selectedOption = timeOptions.find(
      (option) => option.key === graphRange
    );

    const points = selectedOption?.points || 10;

    return tempHistory.slice(-points);
  }, [tempHistory, graphRange]);

  const values = graphData.map(
    (item) => item.value
  );

  const lowest = values.length
    ? Math.min(...values)
    : temp;

  const highest = values.length
    ? Math.max(...values)
    : temp;

  /* =====================================================
     TEMPERATURE STATUS
  ===================================================== */

  const tempStatus =
    temp >= 2 &&
    temp <= 8 &&
    !temperatureFailure
      ? "ok"
      : "bad";

  /* =====================================================
     OVERALL FAILURE STATUS
  ===================================================== */

  const anyFailure =
    temperatureFailure ||
    voltageFailure ||
    doorFailure ||
    !deviceConnected;

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div>

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="page-head">
        <div>
          <div className="eyebrow">
            01 · LIVE SYSTEM
          </div>

          <h1 className="page-title">
            Real-Time Monitoring
          </h1>

          <p className="page-desc">
            Live temperature conditions and failure
            detection for the selected vaccine refrigerator.
          </p>
        </div>

        <span
          className={`badge ${
            anyFailure ? "bad" : "ok"
          }`}
        >
          {anyFailure ? (
            <AlertTriangle size={12} />
          ) : (
            <CheckCircle2 size={12} />
          )}

          {anyFailure
            ? "Attention required"
            : "System healthy"}
        </span>
      </div>

      {/* =================================================
          BACKEND ERROR
      ================================================= */}

      {backendError && (
        <div className="alert warn">
          <AlertTriangle size={14} />
          {backendError}
        </div>
      )}

      {/* =================================================
          TEMPERATURE + GRAPH
      ================================================= */}

      <div className="monitoring-main">

        {/* =================================================
            TEMPERATURE CARD
        ================================================= */}

        <div className="card sensor-card temperature-card">

          <div className="card-head">
            <div className="sensor-title">

              <span className="sensor-icon">
                <Thermometer size={17} />
              </span>

              <div>
                <h3 className="card-title">
                  Temperature
                </h3>

                <div className="card-sub">
                  Core sensor · safe 2–8°C
                </div>
              </div>

            </div>

            <span className={`badge ${tempStatus}`}>
              {temperatureFailure
                ? "Fault"
                : temp >= 2 && temp <= 8
                ? "Normal"
                : "Warning"}
            </span>
          </div>

          <div
            className={`sensor-value ${tempStatus}`}
          >
            {loading || temperatureFailure
              ? "—"
              : temp.toFixed(1)}

            <small>°C</small>
          </div>

          <div className="sensor-minmax">

            <div>
              <span>Lowest</span>

              <b>
                {Number(lowest).toFixed(1)}°C
              </b>
            </div>

            <div>
              <span>Highest</span>

              <b>
                {Number(highest).toFixed(1)}°C
              </b>
            </div>

          </div>

          <div className="temperature-range">
            <span>
              Safe operating range
            </span>

            <strong>
              2°C — 8°C
            </strong>
          </div>

        </div>

        {/* =================================================
            TEMPERATURE GRAPH
        ================================================= */}

        <div className="card temperature-chart-card">

          <div className="chart-header">

            <div>
              <h3 className="card-title">
                Temperature History
              </h3>

              <div className="card-sub">
                Historical temperature readings
              </div>
            </div>

            <span className="chart-live">
              LIVE
            </span>

          </div>

          {/* TIME RANGE */}

          <div className="range-selector">

            {timeOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                className={
                  graphRange === option.key
                    ? "range-option active"
                    : "range-option"
                }
                onClick={() =>
                  setGraphRange(option.key)
                }
              >
                {option.label}
              </button>
            ))}

          </div>

          {/* GRAPH */}

          <div className="monitor-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart data={graphData}>

                <CartesianGrid
                  stroke="#e7ebf1"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <ReferenceArea
                  y1={2}
                  y2={8}
                  fill="#159b61"
                  fillOpacity={0.07}
                />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  minTickGap={25}
                />

                <YAxis
                  tick={{ fontSize: 10 }}
                  domain={[0, 10]}
                  tickCount={6}
                />

                <Tooltip
                  formatter={(value) => [
                    `${value}°C`,
                    "Temperature",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2867e8"
                  fill="#eaf1ff"
                  strokeWidth={2.2}
                  dot={false}
                />

              </AreaChart>
            </ResponsiveContainer>

          </div>

          <div className="chart-footer">

            <span>
              Safe range: <b>2°C – 8°C</b>
            </span>

            <span>
              Current:{" "}
              <b>
                {temperatureFailure
                  ? "—"
                  : `${temp.toFixed(1)}°C`}
              </b>
            </span>

          </div>

        </div>
      </div>

      {/* =================================================
          FAILURE DETECTION
      ================================================= */}

      <div className="card failure-card">

        <div className="card-head">

          <div>
            <h3 className="card-title">
              Failure Detection
            </h3>

            <div className="card-sub">
              Current status of critical monitoring sensors
            </div>
          </div>

          <span
            className={`badge ${
              anyFailure ? "bad" : "ok"
            }`}
          >
            {anyFailure
              ? "Failure detected"
              : "All systems normal"}
          </span>

        </div>

        <div className="failure-grid">

          <FailureItem
            title="Temperature sensor"
            failed={temperatureFailure}
          />

          <FailureItem
            title="Voltage sensor"
            failed={voltageFailure}
          />

          <FailureItem
            title="Door sensor"
            failed={doorFailure}
          />

        </div>

      </div>

    </div>
  );
}