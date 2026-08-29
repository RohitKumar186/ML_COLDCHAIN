import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

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


// =========================================================
// TIME RANGE OPTIONS
// =========================================================

const timeOptions = [
  {
    key: "10m",
    label: "10 min",
    points: 10,
  },
  {
    key: "30m",
    label: "30 min",
    points: 30,
  },
  {
    key: "1h",
    label: "1 hr",
    points: 60,
  },
  {
    key: "all",
    label: "All time",
    points: 120,
  },
];


// =========================================================
// FAILURE ITEM
// =========================================================

function FailureItem({
  title,
  failed,
}) {
  return (
    <div className="failure-item">

      <div
        className={`failure-status ${
          failed
            ? "failed"
            : "working"
        }`}
      >
        {failed ? (
          <AlertTriangle size={16} />
        ) : (
          <CheckCircle2 size={16} />
        )}
      </div>

      <div className="failure-info">

        <b>
          {title}
        </b>

        <span
          className={
            failed
              ? "failure-text"
              : "working-text"
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


// =========================================================
// MONITORING PAGE
// =========================================================

export default function Monitoring() {

  // =======================================================
  // SENSOR VALUES
  // =======================================================

  const [temp, setTemp] =
    useState(null);

  const [outsideTemp, setOutsideTemp] =
    useState(null);

  const [voltage, setVoltage] =
    useState(null);

  const [doorOpen, setDoorOpen] =
    useState(null);

  const [coolingOn, setCoolingOn] =
    useState(false);


  // =======================================================
  // DEVICE STATE
  // =======================================================

  const [deviceConnected, setDeviceConnected] =
    useState(false);


  // =======================================================
  // SENSOR FAILURE STATES
  // =======================================================

  const [temperatureFailure, setTemperatureFailure] =
    useState(true);

  const [voltageFailure, setVoltageFailure] =
    useState(true);

  const [doorFailure, setDoorFailure] =
    useState(true);


  // =======================================================
  // TEMPERATURE HISTORY
  // =======================================================

  const [tempHistory, setTempHistory] =
    useState([]);


  const [graphRange, setGraphRange] =
    useState("10m");


  // =======================================================
  // UI
  // =======================================================

  const [loading, setLoading] =
    useState(true);

  const [backendError, setBackendError] =
    useState("");


  // =======================================================
  // LOAD MONITORING DATA
  // =======================================================

  const loadMonitoring = async () => {

    try {

      const data =
        await getMonitoring();

      console.log(
        "Monitoring API:",
        data
      );


      // ===================================================
      // DEVICE CONNECTION
      // ===================================================

      const connected =
        data?.deviceConnected === true;

      setDeviceConnected(
        connected
      );


      // ===================================================
      // COMPLETE DEVICE OFFLINE
      //
      // If ESP32/device itself is offline:
      //
      // Temperature → FAILURE
      // Voltage     → FAILURE
      // Door        → FAILURE
      //
      // This is intentionally different from an
      // individual sensor failure.
      // ===================================================

      if (!connected) {

        setTemp(null);

        setOutsideTemp(null);

        setVoltage(null);

        setDoorOpen(null);

        setCoolingOn(false);


        setTemperatureFailure(true);

        setVoltageFailure(true);

        setDoorFailure(true);


        setBackendError("");

        setLoading(false);

        return;
      }


      // ===================================================
      // TEMPERATURE
      // ===================================================

      const temperatureValue =
        data?.insideTemperature !== null &&
        data?.insideTemperature !== undefined
          ? Number(
              data.insideTemperature
            )
          : null;


      const temperatureFault =
        data?.temperatureFailure === true ||
        temperatureValue === null ||
        !Number.isFinite(
          temperatureValue
        );


      setTemperatureFailure(
        temperatureFault
      );


      if (!temperatureFault) {

        setTemp(
          temperatureValue
        );


        // ===============================================
        // ADD CURRENT VALUE TO GRAPH HISTORY
        // ===============================================

        setTempHistory(
          (history) => {

            const now =
              new Date();

            const time =
              now.toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }
              );


            return [
              ...history.slice(-119),

              {
                time,
                value:
                  temperatureValue,
              },
            ];

          }
        );

      } else {

        // Only temperature becomes unavailable.
        // Voltage and door continue independently.

        setTemp(null);
      }


      // ===================================================
      // OUTSIDE TEMPERATURE
      // ===================================================

      const outsideTemperatureValue =
        data?.outsideTemperature !== null &&
        data?.outsideTemperature !== undefined
          ? Number(
              data.outsideTemperature
            )
          : null;


      if (
        outsideTemperatureValue !== null &&
        Number.isFinite(
          outsideTemperatureValue
        )
      ) {

        setOutsideTemp(
          outsideTemperatureValue
        );

      } else {

        setOutsideTemp(null);

      }


      // ===================================================
      // VOLTAGE
      // ===================================================

      const voltageValue =
        data?.voltage !== null &&
        data?.voltage !== undefined
          ? Number(
              data.voltage
            )
          : null;


      const voltageFault =
        data?.voltageFailure === true ||
        voltageValue === null ||
        !Number.isFinite(
          voltageValue
        ) ||
        voltageValue <= 0;


      setVoltageFailure(
        voltageFault
      );


      if (!voltageFault) {

        setVoltage(
          voltageValue
        );

      } else {

        setVoltage(null);

      }


      // ===================================================
      // DOOR SENSOR
      // ===================================================

      const doorFault =
        data?.doorFailure === true ||
        data?.doorOpen === null ||
        data?.doorOpen === undefined;


      setDoorFailure(
        doorFault
      );


      if (!doorFault) {

        setDoorOpen(
          Boolean(
            data.doorOpen
          )
        );

      } else {

        setDoorOpen(null);

      }


      // ===================================================
      // COOLING
      // ===================================================

      setCoolingOn(
        Boolean(
          data?.coolingOn
        )
      );


      setBackendError("");

      setLoading(false);

    } catch (error) {

      console.error(
        "Monitoring API error:",
        error
      );


      // ===================================================
      // BACKEND / DEVICE UNAVAILABLE
      //
      // Treat all critical sensors as failed.
      // ===================================================

      setDeviceConnected(false);

      setTemp(null);

      setOutsideTemp(null);

      setVoltage(null);

      setDoorOpen(null);

      setCoolingOn(false);


      setTemperatureFailure(true);

      setVoltageFailure(true);

      setDoorFailure(true);


      setBackendError(
        "Unable to connect to monitoring backend."
      );

      setLoading(false);
    }
  };


  // =======================================================
  // LIVE POLLING
  //
  // Check every 5 seconds.
  // =======================================================

  useEffect(() => {

    loadMonitoring();


    const interval =
      setInterval(
        () => {
          loadMonitoring();
        },
        5000
      );


    return () => {

      clearInterval(
        interval
      );

    };

  }, []);


  // =======================================================
  // GRAPH DATA
  // =======================================================

  const graphData =
    useMemo(() => {

      const selectedOption =
        timeOptions.find(
          (option) =>
            option.key ===
            graphRange
        );


      const points =
        selectedOption?.points ||
        10;


      return tempHistory.slice(
        -points
      );

    }, [
      tempHistory,
      graphRange,
    ]);


  // =======================================================
  // MIN / MAX
  // =======================================================

  const values =
    graphData.map(
      (item) =>
        item.value
    );


  const lowest =
    deviceConnected &&
    !temperatureFailure &&
    values.length > 0
      ? Math.min(
          ...values
        )
      : null;


  const highest =
    deviceConnected &&
    !temperatureFailure &&
    values.length > 0
      ? Math.max(
          ...values
        )
      : null;


  // =======================================================
  // TEMPERATURE STATUS
  // =======================================================

  const tempStatus =
    !deviceConnected ||
    temperatureFailure
      ? "bad"
      : temp !== null &&
        temp >= 2 &&
        temp <= 8
      ? "ok"
      : "bad";


  // =======================================================
  // OVERALL FAILURE
  // =======================================================

  const anyFailure =
    !deviceConnected ||
    temperatureFailure ||
    voltageFailure ||
    doorFailure;


  // =======================================================
  // RENDER
  // =======================================================

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
            Live temperature conditions and
            failure detection for the selected
            vaccine refrigerator.
          </p>

        </div>


        {/* OVERALL STATUS */}

        <span
          className={`badge ${
            anyFailure
              ? "bad"
              : "ok"
          }`}
        >

          {anyFailure ? (
            <AlertTriangle size={12} />
          ) : (
            <CheckCircle2 size={12} />
          )}


          {!deviceConnected
            ? "Device offline"
            : anyFailure
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
          TEMPERATURE + HISTORY
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


            <span
              className={`badge ${
                tempStatus
              }`}
            >

              {!deviceConnected
                ? "Offline"
                : temperatureFailure
                ? "Fault"
                : temp !== null &&
                  temp >= 2 &&
                  temp <= 8
                ? "Normal"
                : "Warning"}

            </span>

          </div>


          {/* CURRENT VALUE */}

          <div
            className={`sensor-value ${
              tempStatus
            }`}
          >

            {loading ||
            temp === null
              ? "—"
              : temp.toFixed(1)}

            <small>
              °C
            </small>

          </div>


          {/* MIN / MAX */}

          <div className="sensor-minmax">

            <div>

              <span>
                Lowest
              </span>

              <b>

                {lowest === null
                  ? "—"
                  : `${lowest.toFixed(1)}°C`}

              </b>

            </div>


            <div>

              <span>
                Highest
              </span>

              <b>

                {highest === null
                  ? "—"
                  : `${highest.toFixed(1)}°C`}

              </b>

            </div>

          </div>


          {/* SAFE RANGE */}

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
            TEMPERATURE HISTORY
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

              {deviceConnected &&
              !temperatureFailure
                ? "LIVE"
                : "OFFLINE"}

            </span>

          </div>


          {/* RANGE SELECTOR */}

          <div className="range-selector">

            {timeOptions.map(
              (option) => (

                <button
                  type="button"
                  key={option.key}
                  className={
                    graphRange ===
                    option.key
                      ? "range-option active"
                      : "range-option"
                  }
                  onClick={() =>
                    setGraphRange(
                      option.key
                    )
                  }
                >

                  {option.label}

                </button>

              )
            )}

          </div>


          {/* CHART */}

          <div className="monitor-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <AreaChart
                data={graphData}
              >

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
                  tick={{
                    fontSize: 10,
                  }}
                  minTickGap={25}
                />


                <YAxis
                  tick={{
                    fontSize: 10,
                  }}
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


          {/* CHART FOOTER */}

          <div className="chart-footer">

            <span>

              Safe range:{" "}

              <b>
                2°C – 8°C
              </b>

            </span>


            <span>

              Current:{" "}

              <b>

                {!deviceConnected ||
                temperatureFailure ||
                temp === null
                  ? "—"
                  : `${temp.toFixed(1)}°C`}

              </b>

            </span>

          </div>

        </div>

      </div>


      {/* =================================================
          OUTSIDE TEMPERATURE + VOLTAGE
      ================================================= */}

      <div className="grid grid-2">


        {/* =================================================
            OUTSIDE TEMPERATURE
        ================================================= */}

        <div className="card">

          <div className="card-head">

            <div>

              <h3 className="card-title">
                Outside Temperature
              </h3>

              <div className="card-sub">
                DHT22 external temperature sensor
              </div>

            </div>


            <span
              className={`badge ${
                !deviceConnected ||
                outsideTemp === null
                  ? "bad"
                  : "ok"
              }`}
            >

              {!deviceConnected ||
              outsideTemp === null
                ? "OFFLINE"
                : "LIVE"}

            </span>

          </div>


          <div className="sensor-value">

            {!deviceConnected ||
            outsideTemp === null
              ? "—"
              : outsideTemp.toFixed(1)}

            <small>
              °C
            </small>

          </div>

        </div>


        {/* =================================================
            VOLTAGE
        ================================================= */}

        <div className="card">

          <div className="card-head">

            <div>

              <h3 className="card-title">
                Voltage
              </h3>

              <div className="card-sub">
                AC supply monitoring
              </div>

            </div>


            <span
              className={`badge ${
                !deviceConnected ||
                voltageFailure
                  ? "bad"
                  : "ok"
              }`}
            >

              {!deviceConnected
                ? "OFFLINE"
                : voltageFailure
                ? "FAILURE"
                : "LIVE"}

            </span>

          </div>


          <div className="sensor-value">

            {!deviceConnected ||
            voltageFailure ||
            voltage === null
              ? "—"
              : voltage.toFixed(1)}

            <small>
              V
            </small>

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


          {/* OVERALL FAILURE STATUS */}

          <span
            className={`badge ${
              anyFailure
                ? "bad"
                : "ok"
            }`}
          >

            {!deviceConnected
              ? "Device offline"
              : anyFailure
              ? "Failure detected"
              : "All systems normal"}

          </span>

        </div>


        {/* =================================================
            SENSOR FAILURE ITEMS
        ================================================= */}

        <div className="failure-grid">


          {/* TEMPERATURE */}

          <FailureItem
            title="Temperature sensor"
            failed={
              !deviceConnected ||
              temperatureFailure
            }
          />


          {/* VOLTAGE */}

          <FailureItem
            title="Voltage sensor"
            failed={
              !deviceConnected ||
              voltageFailure
            }
          />


          {/* DOOR */}

          <FailureItem
            title="Door sensor"
            failed={
              !deviceConnected ||
              doorFailure
            }
          />


        </div>

      </div>

    </div>
  );
}