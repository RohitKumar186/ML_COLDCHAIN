import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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

  const [prediction, setPrediction] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [backendError, setBackendError] =
    useState("");


  /* =======================================================
     FETCH PREDICTION
  ======================================================= */

  const loadPrediction = async () => {

    try {

      const data =
        await getPrediction();

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

    const interval =
      setInterval(
        loadPrediction,
        2000
      );

    return () =>
      clearInterval(interval);

  }, []);


  /* =======================================================
     CURRENT TEMPERATURE
  ======================================================= */

  const current = useMemo(() => {

    if (!prediction) {
      return 0;
    }


    if (
      prediction.inside_temperature !==
        undefined &&
      prediction.inside_temperature !==
        null
    ) {

      return Number(
        prediction.inside_temperature
      ) || 0;
    }


    if (
      prediction.current !==
        undefined &&
      prediction.current !==
        null
    ) {

      return Number(
        prediction.current
      ) || 0;
    }


    if (
      prediction.temperature !==
        undefined &&
      prediction.temperature !==
        null
    ) {

      return Number(
        prediction.temperature
      ) || 0;
    }


    return 0;

  }, [prediction]);


  /* =======================================================
     COOLING DECISION
  ======================================================= */

  const coolingDecision =
    useMemo(() => {

      if (!prediction) {
        return "OFF";
      }


      if (
        prediction.cooling_decision !==
          undefined &&
        prediction.cooling_decision !==
          null
      ) {

        return String(
          prediction.cooling_decision
        ).toUpperCase();

      }


      if (
        prediction.coolingDecision !==
          undefined &&
        prediction.coolingDecision !==
          null
      ) {

        return String(
          prediction.coolingDecision
        ).toUpperCase();

      }


      /*
        Backend may return peltier/fan
        action without cooling_decision.
      */

      if (
        prediction.cooling_level !==
          undefined
      ) {

        const level =
          Number(
            prediction.cooling_level
          );

        if (level >= 2) {
          return "HIGH";
        }

        if (level === 1) {
          return "LOW";
        }
      }


      return "OFF";

    }, [prediction]);


  /* =======================================================
     COOLING LEVEL
  ======================================================= */

  const coolingLevel =
    useMemo(() => {

      if (!prediction) {
        return 0;
      }


      if (
        prediction.cooling_level !==
          undefined &&
        prediction.cooling_level !==
          null
      ) {

        return Number(
          prediction.cooling_level
        );
      }


      if (
        prediction.coolingLevel !==
          undefined &&
        prediction.coolingLevel !==
          null
      ) {

        return Number(
          prediction.coolingLevel
        );
      }


      if (
        coolingDecision ===
        "HIGH"
      ) {

        return 2;
      }


      if (
        coolingDecision ===
        "LOW"
      ) {

        return 1;
      }


      return 0;

    }, [
      prediction,
      coolingDecision,
    ]);


  /* =======================================================
     PELTIER STATUS
  ======================================================= */

  const peltierOn =
    useMemo(() => {

      if (!prediction) {
        return false;
      }


      if (
        prediction.peltier !==
          undefined &&
        prediction.peltier !==
          null
      ) {

        const value =
          prediction.peltier;

        if (
          typeof value ===
          "boolean"
        ) {

          return value;
        }


        return (
          String(value)
            .toUpperCase() !==
          "OFF"
        );
      }


      return (
        coolingLevel > 0
      );

    }, [
      prediction,
      coolingLevel,
    ]);


  /* =======================================================
     FUTURE ML PREDICTIONS
     
     Backend:
     
     future_temperatures: [
       future_1,
       future_2,
       ...
       future_20
     ]
  ======================================================= */

  const futureTemperatures =
    useMemo(() => {

      if (!prediction) {
        return [];
      }


      if (
        !Array.isArray(
          prediction.future_temperatures
        )
      ) {

        return [];
      }


      return prediction
        .future_temperatures
        .map(Number)
        .filter(
          Number.isFinite
        );

    }, [prediction]);


  /* =======================================================
     PREDICTION AVAILABLE
  ======================================================= */

  const hasPrediction =
    futureTemperatures.length >
    0;


  /* =======================================================
     GRAPH DATA
     
     IMPORTANT:
     
     Current:
       temp = current
       forecast = null
     
     Future:
       temp = null
       forecast = predicted
     
     Therefore current is NOT counted as a
     predicted value.
  ======================================================= */

  const data = useMemo(() => {

    if (!prediction) {
      return [];
    }


    const graphData = [];


    /* =====================================================
       CURRENT SENSOR READING
    ===================================================== */

    graphData.push({

      x: "Now",

      temp:
        Number(
          current.toFixed(1)
        ),

      forecast:
        null,

      type:
        "Current",

    });


    /* =====================================================
       FUTURE ML PREDICTIONS
       
       FUTURE_POINTS = 20
       
       Each point represents one future
       prediction step.
       
       Current model has 20 future points.
    ===================================================== */

    futureTemperatures.forEach(
      (
        temperature,
        index
      ) => {

        graphData.push({

          x:
            `+${(index + 1) * 5}m`,

          temp:
            null,

          forecast:
            Number(
              temperature.toFixed(1)
            ),

          type:
            "Predicted",

          step:
            index + 1,

        });

      }
    );


    return graphData;

  }, [
    prediction,
    current,
    futureTemperatures,
  ]);


  /* =======================================================
     PROJECTED VALUES
     
     ONLY FUTURE ML VALUES.
     
     Current sensor value is NOT included.
  ======================================================= */

  const projected =
    useMemo(() => {

      return futureTemperatures
        .filter(
          Number.isFinite
        );

    }, [
      futureTemperatures,
    ]);


  /* =======================================================
     PROJECTED MINIMUM
  ======================================================= */

  const min =
    useMemo(() => {

      if (
        projected.length === 0
      ) {

        return null;
      }


      return Math.min(
        ...projected
      );

    }, [
      projected,
    ]);


  /* =======================================================
     PROJECTED MAXIMUM
  ======================================================= */

  const max =
    useMemo(() => {

      if (
        projected.length === 0
      ) {

        return null;
      }


      return Math.max(
        ...projected
      );

    }, [
      projected,
    ]);


  /* =======================================================
     TREND
     
     Prefer ML backend trend.
     
     Fallback:
       Compare first and last prediction.
  ======================================================= */

  const trend =
    useMemo(() => {

      if (
        prediction?.trend
      ) {

        return String(
          prediction.trend
        ).toUpperCase();

      }


      if (
        futureTemperatures.length <
        2
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


      if (
        difference >
        0.2
      ) {

        return "UP";
      }


      if (
        difference <
        -0.2
      ) {

        return "DOWN";
      }


      return "STABLE";

    }, [
      prediction,
      futureTemperatures,
    ]);


  /* =======================================================
     RISK
  ======================================================= */

  const risk =
    useMemo(() => {

      if (
        prediction?.risk
      ) {

        return String(
          prediction.risk
        ).toLowerCase();

      }


      if (
        max !== null &&
        (
          max > 8 ||
          min < 2
        )
      ) {

        return "high";
      }


      if (
        max !== null &&
        (
          max > 7.4 ||
          min < 2.6
        )
      ) {

        return "watch";
      }


      return "low";

    }, [
      prediction,
      min,
      max,
    ]);


  /* =======================================================
     RISK LABEL
  ======================================================= */

  const riskLabel =
    risk === "low"
      ? "Low risk"
      : risk === "watch"
      ? "Watch"
      : "Elevated risk";


  /* =======================================================
     COOLING LABEL
  ======================================================= */

  const coolingLabel =
    coolingDecision ===
    "HIGH"

      ? "High cooling"

      : coolingDecision ===
        "LOW"

      ? "Low cooling"

      : "Cooling off";


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

          <AlertTriangle
            size={14}
          />

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
          PAGE HEADER
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

            <ShieldCheck
              size={12}
            />

          ) : (

            <AlertTriangle
              size={12}
            />

          )}

          {riskLabel}

        </span>

      </div>


      {/* ===================================================
          EARLY WARNING
      =================================================== */}

      {risk !== "low" && (

        <div className="alert warn">

          <AlertTriangle
            size={14}
          />

          Early warning: the projected
          temperature is approaching or crossing
          the 2–8°C safe range. Review cooling
          and door conditions.

        </div>

      )}


      {/* ===================================================
          PREDICTION KPIs
      =================================================== */}

      <div className="grid grid-3 prediction-kpis">


        {/* CURRENT */}

        <div className="stat">

          <div className="stat-label">
            Current temperature
          </div>

          <div className="stat-value">

            {Number(
              current
            ).toFixed(1)}
            °C

          </div>

          <div className="stat-meta">
            Live sensor reading
          </div>

        </div>


        {/* PROJECTED */}

        <div className="stat">

          <div className="stat-label">
            Projected range
          </div>

          <div className="stat-value">

            {hasPrediction
              ? `${Number(min).toFixed(1)}–${Number(max).toFixed(1)}°C`
              : "—"}

          </div>

          <div className="stat-meta">

            {hasPrediction
              ? `${futureTemperatures.length} ML future predictions`
              : "Waiting for ML prediction"}

          </div>

        </div>


        {/* RISK */}

        <div className="stat">

          <div className="stat-label">
            Risk level
          </div>

          <div
            className={`stat-value risk-${risk}`}
          >

            {risk === "low"
              ? "Low"
              : risk === "watch"
              ? "Watch"
              : "Elevated"}

          </div>

          <div className="stat-meta">
            Based on projected temperature
          </div>

        </div>

      </div>


      {/* ===================================================
          COOLING CONTROL
      =================================================== */}

      <div className="grid grid-3 prediction-kpis">


        {/* COOLING DECISION */}

        <div className="stat">

          <div className="stat-label">

            <Snowflake
              size={14}
              style={{
                verticalAlign:
                  "middle",
                marginRight:
                  "5px",
              }}
            />

            ML cooling decision

          </div>


          <div className="stat-value">

            {coolingDecision}

          </div>


          <div className="stat-meta">
            {coolingLabel}
          </div>

        </div>


        {/* COOLING LEVEL */}

        <div className="stat">

          <div className="stat-label">
            Cooling level
          </div>

          <div className="stat-value">

            {coolingLevel} / 2

          </div>

          <div className="stat-meta">
            0 = OFF · 1 = LOW · 2 = HIGH
          </div>

        </div>


        {/* PELTIER */}

        <div className="stat">

          <div className="stat-label">

            <Power
              size={14}
              style={{
                verticalAlign:
                  "middle",
                marginRight:
                  "5px",
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
          PREDICTED TREND
      =================================================== */}

      <div className="card prediction-trend">

        <div className="card-head">

          <div>

            <h3 className="card-title">

              <TrendingUp
                size={15}
              />

              Predicted trend

            </h3>


            <div className="card-sub">

              ML prediction indicates the
              temperature is{" "}

              <b>
                {trend}
              </b>

              {" · "}

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
          TEMPERATURE FORECAST
      =================================================== */}

      <div className="card prediction-chart">

        <div className="card-head">

          <div>

            <h3 className="card-title">

              <TrendingUp
                size={15}
              />

              Temperature forecast

            </h3>


            <div className="card-sub">

              Live temperature followed by
              ML-predicted future temperature

            </div>

          </div>


          <BrainCircuit
            size={17}
            color="var(--blue)"
          />

        </div>


        {/* =================================================
            PREDICTION SUMMARY
        ================================================= */}

        {hasPrediction && (

          <div
            className="card-sub"
            style={{
              marginBottom:
                "12px",
              marginTop:
                "4px",
            }}
          >

            Current:{" "}
            <b>
              {current.toFixed(1)}°C
            </b>

            {" → "}

            Predicted after{" "}
            <b>
              {futureTemperatures.length * 5} min
            </b>
            :{" "}

            <b>
              {
                futureTemperatures[
                  futureTemperatures.length - 1
                ].toFixed(1)
              }°C
            </b>

          </div>

        )}


        <div className="chart-box">

          {!hasPrediction ? (

            <div
              className="card-sub"
              style={{
                padding:
                  "40px 20px",
                textAlign:
                  "center",
              }}
            >

              ML future prediction is
              not available yet.

              <br />

              Waiting for a trained model
              and sufficient prediction data.

            </div>

          ) : (

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <ComposedChart
                data={data}
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


                {/* =========================================
                    SAFE OPERATING RANGE
                ========================================= */}

                <ReferenceArea
                  y1={2}
                  y2={8}
                  fill="#159b61"
                  fillOpacity={0.06}
                />


                {/* =========================================
                    UPPER LIMIT
                ========================================= */}

                <ReferenceLine
                  y={8}
                  stroke="#d94250"
                  strokeDasharray="4 4"
                />


                {/* =========================================
                    LOWER LIMIT
                ========================================= */}

                <ReferenceLine
                  y={2}
                  stroke="#d94250"
                  strokeDasharray="4 4"
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
                  width={40}
                />


                {/* =========================================
                    TOOLTIP
                ========================================= */}

                <Tooltip
                  formatter={(
                    value,
                    name
                  ) => {

                    if (
                      value ===
                        null ||
                      value ===
                        undefined
                    ) {

                      return null;
                    }


                    return [

                      `${Number(
                        value
                      ).toFixed(1)}°C`,

                      name ===
                      "forecast"

                        ? "ML Predicted"

                        : "Current",

                    ];

                  }}
                />


                {/* =========================================
                    CURRENT SENSOR VALUE
                ========================================= */}

                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#2867e8"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                  }}
                  connectNulls={false}
                  name="Current"
                />


                {/* =========================================
                    FUTURE ML PREDICTION
                ========================================= */}

                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#c77a05"
                  strokeWidth={3}
                  strokeDasharray="7 5"
                  dot={{
                    r: 3,
                  }}
                  connectNulls={false}
                  name="ML Predicted"
                />

              </ComposedChart>

            </ResponsiveContainer>

          )}

        </div>


        {/* =================================================
            GRAPH FOOTER
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

            Trend:{" "}

            <b>
              {trend}
            </b>

          </span>

        </div>

      </div>


      {/* ===================================================
          INFORMATION
      =================================================== */}

      <div className="grid grid-2 prediction-info">


        {/* HOW IT WORKS */}

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
              current and predicted temperature
              to determine the required level.

            </div>

          </div>

        </div>


        {/* RECOMMENDED CHECKS */}

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
              before the temperature leaves
              the 2–8°C range.

            </div>

          </div>

        </div>

      </div>

    </div>

  );
}