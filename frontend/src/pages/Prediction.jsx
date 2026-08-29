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
   PREDICTION PAGE
========================================================= */

export default function Prediction() {

  const [prediction, setPrediction] = useState(null);

  const [loading, setLoading] = useState(true);

  const [backendError, setBackendError] = useState("");


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
      return 0;
    }

    const value =
      prediction.inside_temperature ??
      prediction.inside_temp ??
      prediction.current ??
      prediction.temperature;

    return Number(value) || 0;

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
     PROJECTED VALUES
  ======================================================= */

  const projectedMin = useMemo(() => {

    if (!hasPrediction) {
      return null;
    }

    return Math.min(
      ...futureTemperatures
    );

  }, [futureTemperatures, hasPrediction]);


  const projectedMax = useMemo(() => {

    if (!hasPrediction) {
      return null;
    }

    return Math.max(
      ...futureTemperatures
    );

  }, [futureTemperatures, hasPrediction]);


  /* =======================================================
     LAST PREDICTED TEMPERATURE
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
     TREND
  ======================================================= */

  const trend = useMemo(() => {

    if (
      prediction?.trend
    ) {

      return String(
        prediction.trend
      ).toUpperCase();

    }

    if (
      futureTemperatures.length < 2
    ) {

      return "STABLE";
    }

    const first =
      futureTemperatures[0];

    const last =
      futureTemperatures[
        futureTemperatures.length - 1
      ];

    const difference =
      last - first;


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
  ]);


  /* =======================================================
     COOLING LEVEL
  ======================================================= */

  const coolingLevel = useMemo(() => {

    if (!prediction) {
      return 0;
    }

    return Number(
      prediction.cooling_level ??
      prediction.coolingLevel ??
      0
    );

  }, [prediction]);


  /* =======================================================
     COOLING DECISION
  ======================================================= */

  const coolingDecision = useMemo(() => {

    if (
      prediction?.cooling_decision
    ) {

      return String(
        prediction.cooling_decision
      ).toUpperCase();

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

    if (
      prediction?.peltier !==
      undefined
    ) {

      const value =
        prediction.peltier;

      if (
        typeof value === "boolean"
      ) {

        return value;
      }

      return (
        String(value)
          .toUpperCase() !==
        "OFF"
      );
    }

    return coolingLevel > 0;

  }, [
    prediction,
    coolingLevel,
  ]);


  /* =======================================================
     RISK
  ======================================================= */

  const risk = useMemo(() => {

    if (prediction?.risk) {

      return String(
        prediction.risk
      ).toLowerCase();

    }

    if (
      projectedMax !== null &&
      projectedMax > 8
    ) {

      return "high";
    }

    if (
      projectedMax !== null &&
      projectedMax > 7.4
    ) {

      return "watch";
    }

    return "low";

  }, [
    prediction,
    projectedMax,
  ]);


  const riskLabel =
    risk === "low"
      ? "Low risk"
      : risk === "watch"
      ? "Watch"
      : "Elevated risk";


  /* =======================================================
     TREND LABEL
  ======================================================= */

  const trendLabel =
    trend === "UP"
      ? "Temperature is expected to rise."

      : trend === "DOWN"
      ? "Temperature is expected to fall."

      : "Temperature is expected to remain stable.";


  /* =======================================================
     GRAPH DATA
     
     IMPORTANT:
     
     The current point is connected directly to
     the first ML predicted point.
     
     This makes the graph visibly show:
     
     CURRENT → FUTURE
  ======================================================= */

  const graphData = useMemo(() => {

    if (!prediction) {
      return [];
    }

    const result = [];


    /* =====================================================
       CURRENT
    ===================================================== */

    result.push({

      x: "Now",

      temperature:
        Number(
          current.toFixed(2)
        ),

      predicted:
        hasPrediction
          ? Number(
              current.toFixed(2)
            )
          : null,

      type: "Current",

      step: 0,

    });


    /* =====================================================
       FUTURE
    ===================================================== */

    futureTemperatures.forEach(
      (
        value,
        index
      ) => {

        result.push({

          x:
            `+${(index + 1) * 5}m`,

          temperature:
            null,

          predicted:
            Number(
              value.toFixed(2)
            ),

          type:
            "Predicted",

          step:
            index + 1,

        });

      }
    );


    return result;

  }, [
    prediction,
    current,
    futureTemperatures,
    hasPrediction,
  ]);


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {

    return (

      <div>

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

          </div>

        </div>


        <div className="card">

          <div className="card-sub">
            Loading prediction data...
          </div>

        </div>

      </div>

    );
  }


  /* =======================================================
     BACKEND ERROR
  ======================================================= */

  if (backendError) {

    return (

      <div>

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

          </div>

        </div>


        <div className="alert warn">

          <AlertTriangle size={14} />

          {backendError}

        </div>

      </div>

    );
  }


  /* =======================================================
     UI
  ======================================================= */

  return (

    <div>


      {/* ===================================================
          HEADER
      =================================================== */}

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

        </div>


        <span
          className={`badge ${
            risk === "high"
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


      {/* ===================================================
          WARNING
      =================================================== */}

      {risk !== "low" && (

        <div className="alert warn">

          <AlertTriangle size={14} />

          Early warning: projected temperature
          requires attention.

        </div>

      )}


      {/* ===================================================
          MAIN KPIs
      =================================================== */}

      <div className="grid grid-3 prediction-kpis">


        {/* CURRENT */}

        <div className="stat">

          <div className="stat-label">
            Current temperature
          </div>

          <div className="stat-value">

            {current.toFixed(1)}
            °C

          </div>

          <div className="stat-meta">
            Live sensor reading
          </div>

        </div>


        {/* PROJECTED */}

        <div className="stat">

          <div className="stat-label">
            Projected temperature
          </div>

          <div className="stat-value">

            {hasPrediction
              ? `${finalPrediction.toFixed(1)}°C`
              : "—"}

          </div>

          <div className="stat-meta">

            {hasPrediction
              ? `After ${futureTemperatures.length * 5} minutes`
              : "Waiting for ML prediction"}

          </div>

        </div>


        {/* RANGE */}

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
              ? `${futureTemperatures.length} ML predictions`
              : "No forecast available"}

          </div>

        </div>

      </div>


      {/* ===================================================
          CONTROL
      =================================================== */}

      <div className="grid grid-3 prediction-kpis">


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
            Level {coolingLevel} / 2
          </div>

        </div>


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
              peltierOn
                ? "risk-watch"
                : "risk-low"
            }`}
          >

            {peltierOn
              ? "ON"
              : "OFF"}

          </div>

          <div className="stat-meta">

            {peltierOn
              ? "Cooling is active"
              : "Cooling is inactive"}

          </div>

        </div>

      </div>


      {/* ===================================================
          TREND CARD
      =================================================== */}

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


      {/* ===================================================
          FORECAST GRAPH
      =================================================== */}

      <div className="card prediction-chart">

        <div className="card-head">

          <div>

            <h3 className="card-title">

              <TrendingUp size={15} />

              Temperature forecast

            </h3>

            <div className="card-sub">

              Current sensor reading and
              future ML predictions

            </div>

          </div>


          <BrainCircuit
            size={17}
            color="var(--blue)"
          />

        </div>


        {/* =================================================
            FORECAST SUMMARY
        ================================================= */}

        {hasPrediction && (

          <div
            className="card-sub"
            style={{
              marginTop: "4px",
              marginBottom: "12px",
            }}
          >

            <b>
              {current.toFixed(1)}°C
            </b>

            {" → "}

            <b>
              {finalPrediction.toFixed(1)}°C
            </b>

            {" over "}

            <b>
              {futureTemperatures.length * 5} min
            </b>

            {" · Trend: "}

            <b>
              {trend}
            </b>

          </div>

        )}


        <div
          className="chart-box"
          style={{
            minHeight: "320px",
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

              ML future prediction is
              not available yet.

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
                  top: 10,
                  right: 20,
                  left: 5,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  stroke="#e7ebf1"
                  strokeDasharray="3 3"
                  vertical={false}
                />


                {/* SAFE RANGE */}

                <ReferenceArea
                  y1={2}
                  y2={8}
                  fill="#159b61"
                  fillOpacity={0.06}
                />


                {/* UPPER LIMIT */}

                <ReferenceLine
                  y={8}
                  stroke="#d94250"
                  strokeDasharray="4 4"
                  label="8°C"
                />


                {/* LOWER LIMIT */}

                <ReferenceLine
                  y={2}
                  stroke="#d94250"
                  strokeDasharray="4 4"
                  label="2°C"
                />


                <XAxis
                  dataKey="x"
                  tick={{
                    fontSize: 10,
                  }}
                  minTickGap={20}
                />


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

                      `${Number(
                        value
                      ).toFixed(2)}°C`,

                      name === "predicted"
                        ? "ML Predicted"
                        : "Current",

                    ];

                  }}
                />


                {/* =================================================
                    CURRENT SENSOR
                ================================================= */}

                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="#2867e8"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                  }}
                  connectNulls={false}
                  name="Current"
                />


                {/* =================================================
                    ML FUTURE PREDICTION
                   
                    Current value is included as the first
                    point so the predicted line visibly starts
                    from the current temperature.
                ================================================= */}

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


        {/* =================================================
            FOOTER
        ================================================= */}

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
              {current.toFixed(1)}°C
            </b>

          </span>


          <span>

            Projected:{" "}

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


      {/* ===================================================
          HOW IT WORKS
      =================================================== */}

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
              the next 20 temperature points.
            </div>

            <div className="list-row">
              04 · The predicted curve shows
              whether temperature is rising,
              falling, or stable.
            </div>

            <div className="list-row">
              05 · Cooling control uses the
              predicted temperature to determine
              the required cooling level.
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
              • Review the predicted trend
              before temperature leaves
              the 2–8°C range.
            </div>

          </div>

        </div>

      </div>

    </div>

  );
}