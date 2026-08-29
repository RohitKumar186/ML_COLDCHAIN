import React, { useEffect, useMemo, useState } from "react";

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


/* =====================================================
   PREDICTION PAGE
===================================================== */

export default function Prediction() {

  const [prediction, setPrediction] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [backendError, setBackendError] =
    useState("");


  /* =====================================================
     FETCH PREDICTION DATA
  ===================================================== */

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


  /* =====================================================
     INITIAL LOAD + LIVE POLLING
  ===================================================== */

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


  /* =====================================================
     CURRENT TEMPERATURE
  ===================================================== */

  const current =
    useMemo(() => {

      if (!prediction)
        return 0;


      if (
        prediction.inside_temperature !== undefined &&
        prediction.inside_temperature !== null
      ) {

        return Number(
          prediction.inside_temperature
        ) || 0;
      }


      if (
        prediction.current !== undefined &&
        prediction.current !== null
      ) {

        return Number(
          prediction.current
        ) || 0;
      }


      if (
        prediction.temperature !== undefined &&
        prediction.temperature !== null
      ) {

        return Number(
          prediction.temperature
        ) || 0;
      }


      return 0;

    }, [prediction]);


  /* =====================================================
     COOLING DECISION
  ===================================================== */

  const coolingDecision =
    useMemo(() => {

      if (!prediction)
        return "OFF";


      if (
        prediction.cooling_decision !== undefined &&
        prediction.cooling_decision !== null
      ) {

        return String(
          prediction.cooling_decision
        ).toUpperCase();

      }


      if (
        prediction.coolingDecision !== undefined &&
        prediction.coolingDecision !== null
      ) {

        return String(
          prediction.coolingDecision
        ).toUpperCase();

      }


      return "OFF";

    }, [prediction]);


  /* =====================================================
     COOLING LEVEL
     
     REAL ML VALUE
     
     0 = OFF
     1 = LOW
     2 = HIGH
  ===================================================== */

  const coolingLevel =
    useMemo(() => {

      if (!prediction)
        return 0;


      let value = null;


      if (
        prediction.cooling_level !== undefined &&
        prediction.cooling_level !== null
      ) {

        value =
          Number(
            prediction.cooling_level
          );

      }


      else if (
        prediction.coolingLevel !== undefined &&
        prediction.coolingLevel !== null
      ) {

        value =
          Number(
            prediction.coolingLevel
          );

      }


      /* -----------------------------------------------
         Fallback from cooling decision
      ------------------------------------------------ */

      if (
        !Number.isFinite(value)
      ) {

        if (
          coolingDecision === "HIGH"
        ) {

          return 2;

        }

        if (
          coolingDecision === "LOW"
        ) {

          return 1;

        }

        return 0;
      }


      /* -----------------------------------------------
         Keep level inside valid range
      ------------------------------------------------ */

      return Math.max(
        0,
        Math.min(
          2,
          value
        )
      );

    }, [
      prediction,
      coolingDecision,
    ]);


  /* =====================================================
     COOLING LEVEL LABEL
  ===================================================== */

  const coolingLevelLabel =
    coolingLevel === 2
      ? "HIGH"
      : coolingLevel === 1
      ? "LOW"
      : "OFF";


  /* =====================================================
     PELTIER STATUS
     
     Handles:
     "ON"
     "OFF"
     true
     false
  ===================================================== */

  const peltierOn =
    useMemo(() => {

      if (!prediction)
        return false;


      if (
        prediction.peltier !== undefined &&
        prediction.peltier !== null
      ) {

        const value =
          prediction.peltier;


        if (
          typeof value === "string"
        ) {

          return (
            value.toUpperCase() ===
            "ON"
          );

        }


        return Boolean(value);
      }


      return coolingLevel > 0;

    }, [
      prediction,
      coolingLevel,
    ]);


  /* =====================================================
     FAN STATUS
  ===================================================== */

  const fanOn =
    useMemo(() => {

      if (!prediction)
        return false;


      if (
        prediction.fan !== undefined &&
        prediction.fan !== null
      ) {

        const value =
          prediction.fan;


        if (
          typeof value === "string"
        ) {

          return (
            value.toUpperCase() ===
            "ON"
          );

        }


        return Boolean(value);
      }


      return coolingLevel > 0;

    }, [
      prediction,
      coolingLevel,
    ]);


  /* =====================================================
     FUTURE TEMPERATURES
  ===================================================== */

  const futureTemperatures =
    useMemo(() => {

      if (!prediction)
        return [];


      if (
        Array.isArray(
          prediction.future_temperatures
        )
      ) {

        return prediction.future_temperatures
          .map(Number)
          .filter(
            Number.isFinite
          );

      }


      return [];

    }, [prediction]);


  /* =====================================================
     GRAPH DATA
  ===================================================== */

  const data =
    useMemo(() => {

      if (!prediction)
        return [];


      const graphData = [];


      graphData.push({

        x: "Now",

        temp:
          Number(
            current.toFixed(1)
          ),

        forecast:
          Number(
            current.toFixed(1)
          ),

      });


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

          });

        }
      );


      return graphData;

    }, [
      prediction,
      current,
      futureTemperatures,
    ]);


  /* =====================================================
     PROJECTED VALUES
  ===================================================== */

  const projected =
    useMemo(() => {

      return data
        .filter(
          (item) =>
            item.forecast !== null &&
            item.forecast !== undefined &&
            Number.isFinite(
              item.forecast
            )
        )
        .map(
          (item) =>
            item.forecast
        );

    }, [data]);


  /* =====================================================
     MIN
  ===================================================== */

  const min =
    useMemo(() => {

      if (!prediction)
        return Number(current);


      if (
        prediction.min !== undefined &&
        prediction.min !== null
      ) {

        return Number(
          prediction.min
        );

      }


      if (projected.length) {

        return Math.min(
          ...projected,
          Number(current)
        );

      }


      return Number(current);

    }, [
      prediction,
      projected,
      current,
    ]);


  /* =====================================================
     MAX
  ===================================================== */

  const max =
    useMemo(() => {

      if (!prediction)
        return Number(current);


      if (
        prediction.max !== undefined &&
        prediction.max !== null
      ) {

        return Number(
          prediction.max
        );

      }


      if (projected.length) {

        return Math.max(
          ...projected,
          Number(current)
        );

      }


      return Number(current);

    }, [
      prediction,
      projected,
      current,
    ]);


  /* =====================================================
     RISK
  ===================================================== */

  const risk =
    useMemo(() => {

      if (prediction?.risk) {

        return String(
          prediction.risk
        ).toLowerCase();

      }


      if (
        max > 8 ||
        min < 2
      ) {

        return "high";

      }


      if (
        max > 7.4 ||
        min < 2.6
      ) {

        return "watch";

      }


      return "low";

    }, [
      prediction,
      min,
      max,
    ]);


  /* =====================================================
     TREND
  ===================================================== */

  const trend =
    useMemo(() => {

      if (!prediction?.trend)
        return "STABLE";


      return String(
        prediction.trend
      ).toUpperCase();

    }, [prediction]);


  /* =====================================================
     LABELS
  ===================================================== */

  const riskLabel =
    risk === "low"
      ? "Low risk"
      : risk === "watch"
      ? "Watch"
      : "Elevated risk";


  const coolingLabel =
    coolingDecision === "HIGH"
      ? "High cooling"
      : coolingDecision === "LOW"
      ? "Low cooling"
      : "Cooling off";


  /* =====================================================
     LOADING
  ===================================================== */

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
              Short-term temperature prediction and
              early warning based on current and
              historical readings.
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


  /* =====================================================
     BACKEND ERROR
  ===================================================== */

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
              Short-term temperature prediction and
              early warning based on current and
              historical readings.
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
            03 · FORECAST
          </div>

          <h1 className="page-title">
            Prediction
          </h1>

          <p className="page-desc">
            Short-term temperature prediction and
            early warning based on current and
            historical readings.
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


      {/* =================================================
          EARLY WARNING
      ================================================= */}

      {risk !== "low" && (

        <div className="alert warn">

          <AlertTriangle size={14} />

          Early warning: the projected temperature is
          approaching or crossing the 2–8°C safe range.
          Review cooling and door conditions.

        </div>

      )}


      {/* =================================================
          FIRST KPI ROW
      ================================================= */}

      <div className="grid grid-3 prediction-kpis">


        {/* CURRENT */}

        <div className="stat">

          <div className="stat-label">
            Current temperature
          </div>

          <div className="stat-value">
            {Number(current).toFixed(1)}°C
          </div>

          <div className="stat-meta">
            Live reading
          </div>

        </div>


        {/* PROJECTED RANGE */}

        <div className="stat">

          <div className="stat-label">
            Projected range
          </div>

          <div className="stat-value">

            {Number(min).toFixed(1)}
            –
            {Number(max).toFixed(1)}°C

          </div>

          <div className="stat-meta">
            Next forecast window
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
            Based on predicted temperature
          </div>

        </div>

      </div>


      {/* =================================================
          SECOND KPI ROW
      ================================================= */}

      <div className="grid grid-3 prediction-kpis">


        {/* =================================================
            ML COOLING DECISION
        ================================================= */}

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


        {/* =================================================
            COOLING LEVEL
        ================================================= */}

        <div className="stat">

          <div className="stat-label">
            Cooling level
          </div>


          <div className="stat-value">

            {coolingLevel} / 2

          </div>


          <div className="stat-meta">

            {coolingLevelLabel}

            {" · "}

            0 = OFF · 1 = LOW · 2 = HIGH

          </div>

        </div>


        {/* =================================================
            PELTIER
        ================================================= */}

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


      {/* =================================================
          FAN STATUS
      ================================================= */}

      <div className="card prediction-trend">

        <div className="card-head">

          <div>

            <h3 className="card-title">

              <Snowflake size={15} />

              Cooling hardware

            </h3>

            <div className="card-sub">

              ML control output sent toward the
              cooling system.

            </div>

          </div>


          <div>

            <b>
              Peltier:{" "}
            </b>

            {peltierOn
              ? "ON"
              : "OFF"}

            {" · "}

            <b>
              Fan:{" "}
            </b>

            {fanOn
              ? "ON"
              : "OFF"}

          </div>

        </div>

      </div>


      {/* =================================================
          PREDICTED TREND
      ================================================= */}

      <div className="card prediction-trend">

        <div className="card-head">

          <div>

            <h3 className="card-title">

              <TrendingUp size={15} />

              Predicted trend

            </h3>

            <div className="card-sub">

              ML prediction indicates the temperature is{" "}

              <b>
                {trend}
              </b>.

            </div>

          </div>


          <BrainCircuit
            size={17}
            color="var(--blue)"
          />

        </div>

      </div>


      {/* =================================================
          FORECAST GRAPH
      ================================================= */}

      <div className="card prediction-chart">

        <div className="card-head">

          <div>

            <h3 className="card-title">

              <TrendingUp size={15} />

              Temperature forecast

            </h3>

            <div className="card-sub">

              Current temperature followed by ML
              projected temperature

            </div>

          </div>


          <BrainCircuit
            size={17}
            color="var(--blue)"
          />

        </div>


        <div className="chart-box">

          {data.length === 0 ? (

            <div className="card-sub">
              No prediction data available.
            </div>

          ) : (

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <ComposedChart
                data={data}
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
                  fillOpacity={0.06}
                />


                <ReferenceLine
                  y={8}
                  stroke="#d94250"
                  strokeDasharray="4 4"
                />


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
                />


                <YAxis
                  domain={[0, 10]}
                  tick={{
                    fontSize: 10,
                  }}
                  tickCount={6}
                />


                <Tooltip
                  formatter={
                    (value, name) => [

                      `${Number(
                        value
                      ).toFixed(1)}°C`,

                      name ===
                      "forecast"
                        ? "Predicted"
                        : "Temperature",

                    ]
                  }
                />


                <Area
                  type="monotone"
                  dataKey="temp"
                  stroke="#2867e8"
                  fill="#eaf1ff"
                  strokeWidth={2}
                  connectNulls={false}
                />


                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#c77a05"
                  strokeWidth={2.5}
                  strokeDasharray="6 5"
                  dot={false}
                  connectNulls={true}
                />

              </ComposedChart>

            </ResponsiveContainer>

          )}

        </div>


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

              {Number(
                current
              ).toFixed(1)}°C

            </b>

          </span>

        </div>

      </div>


      {/* =================================================
          INFORMATION
      ================================================= */}

      <div className="grid grid-2 prediction-info">


        <div className="card">

          <h3 className="card-title">
            How the warning works
          </h3>

          <div className="list">

            <div className="list-row">
              01 · Current temperature is continuously
              observed.
            </div>

            <div className="list-row">
              02 · Recent historical readings establish
              the trend.
            </div>

            <div className="list-row">
              03 · The ML model projects future
              temperature.
            </div>

            <div className="list-row">
              04 · A warning is raised before the safe
              range is breached.
            </div>

          </div>

        </div>


        <div className="card">

          <h3 className="card-title">
            Recommended checks
          </h3>

          <div className="list">

            <div className="list-row">
              • Confirm the refrigerator door is sealed.
            </div>

            <div className="list-row">
              • Check cooling/Peltier status.
            </div>

            <div className="list-row">
              • Check supply voltage and device
              connectivity.
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}