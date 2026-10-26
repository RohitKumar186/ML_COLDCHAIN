import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
} from "recharts";

import {
  BrainCircuit,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Snowflake,
  Power,
} from "lucide-react";

import "../css/prediction.css";

import { getPrediction } from "../api";


/* =========================================================
   VACCINE TEMPERATURE CONFIGURATION
========================================================= */

function getVaccineLimits(vaccine) {
  if (!vaccine) return null;

  const min = Number(vaccine.minStorageTemp);
  const max = Number(vaccine.maxStorageTemp);
  const unit = vaccine.temperatureUnit || "C";

  if (
    vaccine.configurationVerified !== true ||
    vaccine.temperatureConfigurationValid === false ||
    vaccine.minStorageTemp == null ||
    vaccine.maxStorageTemp == null ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max ||
    !["C", "F"].includes(unit)
  ) {
    return null;
  }

  // Sensor and forecast readings are Celsius.
  const minC = unit === "F" ? ((min - 32) * 5) / 9 : min;
  const maxC = unit === "F" ? ((max - 32) * 5) / 9 : max;

  return {
    minC,
    maxC,
    label: `${min}°${unit} – ${max}°${unit}`,
  };
}


/* =========================================================
   PREDICTION PAGE
========================================================= */

export default function Prediction({ selectedVaccine }) {

  const [prediction, setPrediction] = useState(null);

  const [loading, setLoading] = useState(true);

  const [backendError, setBackendError] = useState("");

  const vaccineLimits = getVaccineLimits(selectedVaccine);
  const minTempC = vaccineLimits?.minC ?? null;
  const maxTempC = vaccineLimits?.maxC ?? null;
  const configuredRangeLabel =
    vaccineLimits?.label || "Not verified";


  /* =======================================================
     FETCH PREDICTION
  ======================================================= */

  const loadPrediction = async () => {

    try {

      const data = await getPrediction();

      console.log(
        "Prediction API:",
        data
      );

      setPrediction(data);

      setBackendError("");

      setLoading(false);

    } catch (error) {

      console.error(
        "Prediction API error:",
        error
      );

      setBackendError(
        "Unable to connect to prediction backend."
      );

      setLoading(false);
    }
  };


  /* =======================================================
     LIVE POLLING
  ======================================================= */

  useEffect(() => {

    loadPrediction();

    const interval = setInterval(
      loadPrediction,
      2000
    );

    return () => clearInterval(interval);

  }, []);


  /* =======================================================
     CURRENT TEMPERATURE
  ======================================================= */

  const current = useMemo(() => {

    if (!prediction) {
      return null;
    }

    const value =
      prediction.inside_temperature ??
      prediction.inside_temp ??
      prediction.current ??
      prediction.temperature;

    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;

  }, [prediction]);


  /* =======================================================
     FUTURE ML PREDICTIONS
  ======================================================= */

  const futureTemperatures = useMemo(() => {

    if (!prediction) {
      return [];
    }

    const values =
      prediction.future_temperatures ??
      prediction.futureTemperatures ??
      prediction.predictions ??
      [];

    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map(Number)
      .filter(Number.isFinite);

  }, [prediction]);


  /* =======================================================
     PREDICTION AVAILABLE
  ======================================================= */

  const hasPrediction =
    futureTemperatures.length > 0;


  /* =======================================================
     NEXT PREDICTED TEMPERATURE

     futureTemperatures[0] = next 5-minute prediction
  ======================================================= */

  const nextPrediction = useMemo(() => {

    if (!hasPrediction) {
      return null;
    }

    return futureTemperatures[0];

  }, [
    futureTemperatures,
    hasPrediction,
  ]);


  /* =======================================================
     FINAL PREDICTION

     Last of the forecast points.
  ======================================================= */

  const finalPrediction = useMemo(() => {

    if (!hasPrediction) {
      return null;
    }

    return futureTemperatures[
      futureTemperatures.length - 1
    ];

  }, [
    futureTemperatures,
    hasPrediction,
  ]);


  /* =======================================================
     PROJECTED MINIMUM
  ======================================================= */

  const projectedMin = useMemo(() => {

    if (!hasPrediction) {
      return null;
    }

    return Math.min(
      ...futureTemperatures
    );

  }, [
    futureTemperatures,
    hasPrediction,
  ]);


  /* =======================================================
     PROJECTED MAXIMUM
  ======================================================= */

  const projectedMax = useMemo(() => {

    if (!hasPrediction) {
      return null;
    }

    return Math.max(
      ...futureTemperatures
    );

  }, [
    futureTemperatures,
    hasPrediction,
  ]);


  /* =======================================================
     TREND
  ======================================================= */

  const trend = useMemo(() => {

    if (prediction?.trend) {

      return String(
        prediction.trend
      ).toUpperCase();

    }

    if (futureTemperatures.length === 0 || current === null) {
      return "WAITING";
    }

    const difference =
      futureTemperatures[
        futureTemperatures.length - 1
      ] - current;

    if (difference > 0.2) {
      return "UP";
    }

    if (difference < -0.2) {
      return "DOWN";
    }

    return "STABLE";

  }, [
    prediction,
    futureTemperatures,
    current,
  ]);


  /* =======================================================
     TREND DESCRIPTION
  ======================================================= */

  const trendLabel =
    trend === "UP"
      ? "Temperature is expected to rise."
      : trend === "DOWN"
      ? "Temperature is expected to fall."
      : trend === "WAITING"
      ? "Waiting for live sensor data and an ML forecast."
      : "Temperature is expected to remain stable.";


  /* =======================================================
     COOLING LEVEL
  ======================================================= */

  const coolingLevel = useMemo(() => {

    if (!prediction) {
      return null;
    }

    const value = prediction.coolingLevel ?? prediction.cooling_level;
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;

  }, [prediction]);


  /* =======================================================
     COOLING DECISION
  ======================================================= */

  const coolingDecision = useMemo(() => {

    if (prediction?.coolingDecision) {

      return String(
        prediction.coolingDecision
      ).toUpperCase();

    }

    if (prediction?.cooling_decision) {

      return String(
        prediction.cooling_decision
      ).toUpperCase();

    }

    if (coolingLevel === null) {
      return "UNAVAILABLE";
    }

    if (coolingLevel >= 2) {
      return "HIGH";
    }

    if (coolingLevel === 1) {
      return "LOW";
    }

    return "OFF";

  }, [
    prediction,
    coolingLevel,
  ]);


  /* =======================================================
     PELTIER
  ======================================================= */

  const peltierOn = useMemo(() => {

    if (prediction?.peltier !== undefined) {

      if (typeof prediction.peltier === "boolean") {
        return prediction.peltier;
      }

      return (
        String(
          prediction.peltier
        ).toUpperCase() !== "OFF"
      );

    }

    if (coolingLevel === null) {
      return null;
    }

    return coolingLevel > 0;

  }, [
    prediction,
    coolingLevel,
  ]);


  /* =======================================================
     VACCINE-SPECIFIC FORECAST RISK
  ======================================================= */

  const risk = useMemo(() => {

    // No risk classification without verified limits.
    if (
      !vaccineLimits ||
      projectedMin === null ||
      projectedMax === null
    ) {
      return "unknown";
    }

    if (
      projectedMin < minTempC ||
      projectedMax > maxTempC
    ) {
      return "high";
    }

    // Watch if the forecast approaches a configured boundary.
    const rangeWidth = maxTempC - minTempC;
    const watchMargin = rangeWidth * 0.1;

    if (
      projectedMin <= minTempC + watchMargin ||
      projectedMax >= maxTempC - watchMargin
    ) {
      return "watch";
    }

    return "low";

  }, [
    vaccineLimits,
    minTempC,
    maxTempC,
    projectedMin,
    projectedMax,
  ]);


  const riskLabel =
    risk === "low"
      ? "Low risk"
      : risk === "watch"
      ? "Watch"
      : risk === "unknown"
      ? "Limits unavailable"
      : "Elevated risk";


  /* =======================================================
     GRAPH DATA
  ======================================================= */

  const graphData = useMemo(() => {

    if (!prediction) {
      return [];
    }

    const result = [];

    // Add a current point only when a real sensor reading exists.
    if (current !== null) {
      result.push({
        x: "Now",
        current: Number(current.toFixed(2)),
        predicted: Number(current.toFixed(2)),
        type: "Current",
      });
    }

    // Future ML predictions.
    futureTemperatures.forEach(
      (
        value,
        index
      ) => {

        result.push({

          x: `+${(index + 1) * 5}m`,

          current: null,

          predicted:
            Number(
              value.toFixed(2)
            ),

          type: "ML Predicted",

        });

      }
    );

    return result;

  }, [
    prediction,
    current,
    futureTemperatures,
  ]);


  /* =======================================================
     MAIN UI
     Keep the dashboard visible even when the sensor/API has
     no data. Empty values are shown as unavailable, not zero.
  ======================================================= */


  return (

    <div>

      {/* HEADER */}

      <div className="page-head">

        <div>

          <div className="eyebrow">
            03 · FORECAST
          </div>

          <h1 className="page-title">
            Prediction
          </h1>

          <p className="page-desc">
            Short-term temperature prediction
            and early warning based on current
            and historical readings.
          </p>

          <p className="card-sub">
            Selected vaccine:{" "}
            <b>{selectedVaccine?.name || "Not selected"}</b>
            {" · "}Configured range: {configuredRangeLabel}
          </p>

        </div>

        <span
          className={`badge ${
            risk === "high" || risk === "unknown"
              ? "bad"
              : risk === "watch"
              ? "warn"
              : "ok"
          }`}
        >

          {risk === "low" ? (
            <ShieldCheck size={12} />
          ) : (
            <AlertTriangle size={12} />
          )}

          {riskLabel}

        </span>

      </div>


      {/* SENSOR / BACKEND STATUS */}
      {(backendError || !prediction || current === null) && (
        <div className="alert warn" role="status" style={{ marginBottom: "16px" }}>
          <AlertTriangle size={14} />
          {backendError
            ? "Prediction service is unavailable. The page is still displayed; live values will appear when the backend and sensor data are available."
            : "Waiting for ESP32 sensor data. The dashboard is ready, but live temperature and ML predictions are not available yet."}
        </div>
      )}

      {/* VACCINE LIMIT WARNING */}

      {!vaccineLimits && (

        <div className="alert warn" role="alert">

          <AlertTriangle size={14} />

          The selected vaccine has no verified temperature limits.
          Vaccine-specific forecast risk cannot be assessed.

        </div>

      )}

      {vaccineLimits && risk !== "low" && risk !== "unknown" && (

        <div className="alert warn">

          <AlertTriangle size={14} />

          Early warning: projected temperature may approach or
          exceed the selected vaccine's configured storage range.

        </div>

      )}


      {/* TOP CARDS */}

      <div className="grid grid-3 prediction-kpis">

        {/* CURRENT TEMPERATURE */}

        <div className="stat">

          <div className="stat-label">
            Current temperature
          </div>

          <div className="stat-value">
            {current === null ? "—" : `${current.toFixed(1)}°C`}
          </div>

          <div className="stat-meta">
            Live sensor reading
          </div>

        </div>


        {/* PROJECTED TEMPERATURE */}

        <div className="stat">

          <div className="stat-label">
            Projected temperature
          </div>

          <div className="stat-value">
            {hasPrediction
              ? `${nextPrediction.toFixed(1)}°C`
              : "—"}
          </div>

          <div className="stat-meta">
            {hasPrediction
              ? "Next 5 minutes"
              : "Waiting for ML prediction"}
          </div>

        </div>


        {/* PROJECTED RANGE */}

        <div className="stat">

          <div className="stat-label">
            Projected range
          </div>

          <div className="stat-value">
            {hasPrediction
              ? `${projectedMin.toFixed(1)}–${projectedMax.toFixed(1)}°C`
              : "—"}
          </div>

          <div className="stat-meta">
            {hasPrediction
              ? `${futureTemperatures.length} ML predictions · ${
                  futureTemperatures.length * 5
                } minutes`
              : "No forecast available"}
          </div>

        </div>

      </div>


      {/* CONTROL CARDS */}

      <div className="grid grid-3 prediction-kpis">

        {/* COOLING */}

        <div className="stat">

          <div className="stat-label">

            <Snowflake
              size={14}
              style={{
                verticalAlign: "middle",
                marginRight: "5px",
              }}
            />

            ML cooling decision

          </div>

          <div className="stat-value">
            {coolingDecision}
          </div>

          <div className="stat-meta">
            {coolingLevel === null ? "No control data" : `Level ${coolingLevel} / 2`}
          </div>

        </div>


        {/* TREND */}

        <div className="stat">

          <div className="stat-label">
            Predicted trend
          </div>

          <div className="stat-value">
            {trend}
          </div>

          <div className="stat-meta">
            {trendLabel}
          </div>

        </div>


        {/* PELTIER */}

        <div className="stat">

          <div className="stat-label">

            <Power
              size={14}
              style={{
                verticalAlign: "middle",
                marginRight: "5px",
              }}
            />

            Peltier status

          </div>

          <div
            className={`stat-value ${
              peltierOn === null
                ? ""
                : peltierOn
                ? "risk-watch"
                : "risk-low"
            }`}
          >

            {peltierOn === null ? "Unavailable" : peltierOn ? "ON" : "OFF"}

          </div>

          <div className="stat-meta">
            {peltierOn === null
              ? "Waiting for device status"
              : peltierOn
              ? "Cooling is active"
              : "Cooling is inactive"}
          </div>

        </div>

      </div>


      {/* TREND CARD */}

      <div className="card prediction-trend">

        <div className="card-head">

          <div>

            <h3 className="card-title">
              <TrendingUp size={15} />
              Predicted trend
            </h3>

            <div className="card-sub">
              {trendLabel}
            </div>

          </div>

          <BrainCircuit
            size={17}
            color="var(--blue)"
          />

        </div>

      </div>


      {/* TEMPERATURE FORECAST GRAPH */}

      <div className="card prediction-chart">

        <div className="card-head">

          <div>

            <h3 className="card-title">
              <TrendingUp size={15} />
              Temperature forecast
            </h3>

            <div className="card-sub">
              Current sensor reading followed
              by ML-predicted future temperature
            </div>

          </div>

          <BrainCircuit
            size={17}
            color="var(--blue)"
          />

        </div>


        {/* FORECAST SUMMARY */}

        {hasPrediction && (

          <div
            className="card-sub"
            style={{
              marginTop: "4px",
              marginBottom: "12px",
            }}
          >

            <b>{current === null ? "—" : `${current.toFixed(1)}°C`}</b>

            {" → "}

            <b>{nextPrediction.toFixed(1)}°C</b>

            {" next 5 min · "}

            <b>{finalPrediction.toFixed(1)}°C</b>

            {" after "}

            <b>{futureTemperatures.length * 5} min</b>

            {" · Trend: "}

            <b>{trend}</b>

          </div>

        )}


        {/* GRAPH */}

        <div
          className="chart-box"
          style={{
            minHeight: "360px",
          }}
        >

          {!hasPrediction ? (

            <div
              className="card-sub"
              style={{
                padding: "60px 20px",
                textAlign: "center",
              }}
            >

              ML future prediction is not available yet.

              <br />

              Waiting for prediction data.

            </div>

          ) : (

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <ComposedChart
                data={graphData}
                margin={{
                  top: 15,
                  right: 25,
                  left: 5,
                  bottom: 10,
                }}
              >

                <CartesianGrid
                  stroke="#e7ebf1"
                  strokeDasharray="3 3"
                  vertical={false}
                />


                {/* SELECTED VACCINE STORAGE RANGE */}

                {vaccineLimits && (
                  <ReferenceArea
                    y1={minTempC}
                    y2={maxTempC}
                    fill="#159b61"
                    fillOpacity={0.06}
                  />
                )}

                {vaccineLimits && (
                  <>
                    <ReferenceLine
                      y={maxTempC}
                      stroke="#d94250"
                      strokeDasharray="4 4"
                      label={`${maxTempC.toFixed(1)}°C max`}
                    />

                    <ReferenceLine
                      y={minTempC}
                      stroke="#d94250"
                      strokeDasharray="4 4"
                      label={`${minTempC.toFixed(1)}°C min`}
                    />
                  </>
                )}


                {/* X AXIS */}

                <XAxis
                  dataKey="x"
                  tick={{
                    fontSize: 10,
                  }}
                  minTickGap={18}
                />


                {/* Y AXIS */}

                <YAxis
                  domain={[
                    "auto",
                    "auto",
                  ]}
                  tick={{
                    fontSize: 10,
                  }}
                  width={45}
                />


                {/* TOOLTIP */}

                <Tooltip
                  formatter={(
                    value,
                    name
                  ) => {

                    if (
                      value === null ||
                      value === undefined
                    ) {
                      return null;
                    }

                    return [
                      `${Number(value).toFixed(2)}°C`,
                      name === "ML Predicted"
                        ? "ML Predicted"
                        : "Current",
                    ];

                  }}
                />


                {/* CURRENT SENSOR LINE */}

                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#2867e8"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                  }}
                  connectNulls={false}
                  name="Current"
                />


                {/* ML FORECAST LINE */}

                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#c77a05"
                  strokeWidth={3}
                  strokeDasharray="7 5"
                  dot={{
                    r: 3,
                  }}
                  connectNulls={true}
                  name="ML Predicted"
                />

              </ComposedChart>

            </ResponsiveContainer>

          )}

        </div>
                {/* GRAPH FOOTER */}

        <div className="chart-footer">

          <span>
            {selectedVaccine?.name || "Vaccine"} range:{" "}

            <b>
              {configuredRangeLabel}
            </b>
          </span>


          <span>
            Current:{" "}

            <b>
              {current === null ? "—" : `${current.toFixed(1)}°C`}
            </b>
          </span>


          <span>
            Next 5 min:{" "}

            <b>
              {hasPrediction
                ? `${nextPrediction.toFixed(1)}°C`
                : "—"}
            </b>
          </span>


          <span>
          {hasPrediction
          ? `${futureTemperatures.length * 5} min: `
            : "Forecast: "}
          <b>
            {hasPrediction
            ? `${finalPrediction.toFixed(1)}°C`
            : "—"}
          </b>
          </span>


          <span>
            Trend:{" "}

            <b>
              {trend}
            </b>
          </span>

        </div>

      </div>


      {/* HOW IT WORKS */}

      <div className="grid grid-2 prediction-info">

        <div className="card">

          <h3 className="card-title">
            How the prediction works
          </h3>

          <div className="list">

            <div className="list-row">
              01 · Current sensor temperature
              is continuously observed.
            </div>

            <div className="list-row">
              02 · Historical readings are
              used as ML training data.
            </div>

            <div className="list-row">
              03 · The trained model predicts
              future temperature points.
            </div>

            <div className="list-row">
              04 · Each forecast point represents
              approximately 5 minutes.
            </div>

            <div className="list-row">
              05 · The complete forecast duration
              depends on the number of predictions.
            </div>

            <div className="list-row">
              06 · Review cooling status alongside
              the predicted temperature trend.
            </div>

          </div>

        </div>


        <div className="card">

          <h3 className="card-title">
            Recommended checks
          </h3>

          <div className="list">

            <div className="list-row">
              • Confirm the refrigerator door
              is sealed.
            </div>

            <div className="list-row">
              • Check cooling/Peltier status.
            </div>

            <div className="list-row">
              • Check supply voltage and
              device connectivity.
            </div>

            <div className="list-row">
              • Compare the forecast with the selected
              vaccine's verified storage range.
              If limits are unavailable, do not assume
              a safe range.
            </div>

          </div>

        </div>

      </div>

    </div>

  );
}