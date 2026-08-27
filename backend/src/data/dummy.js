// =========================================================
// COLD CHAIN DUMMY DATA
// Temporary sensor simulation before ESP data is connected.
// =========================================================

// =========================================================
// SHARED HELPER
// =========================================================

export const clamp = (n, min, max) =>
  Math.max(min, Math.min(max, n));


// =========================================================
// INTERNAL LIVE SENSOR STATE
// This is the SINGLE shared sensor state used by both
// Monitoring and Prediction.
// =========================================================

let liveTemperature = 5.2;
let liveHumidity = 55;
let liveVoltage = 12.0;
let liveDoorOpen = false;
let liveCoolingOn = true;
let liveDeviceConnected = true;


// =========================================================
// LAST GENERATED SENSOR SNAPSHOT
//
// Monitoring and Prediction will use this same snapshot.
// This prevents Monitoring and Prediction from showing
// different current temperatures.
// =========================================================

let latestSensorSnapshot = null;


// =========================================================
// GENERATE NEXT TEMPERATURE
// =========================================================

function generateTemperature() {
  const change = (Math.random() - 0.5) * 0.6;

  liveTemperature = clamp(
    liveTemperature + change,
    1.5,
    8.8
  );

  return Number(liveTemperature.toFixed(1));
}


// =========================================================
// GENERATE NEXT HUMIDITY
// =========================================================

function generateHumidity() {
  const change = (Math.random() - 0.5) * 4;

  liveHumidity = clamp(
    liveHumidity + change,
    40,
    70
  );

  return Number(liveHumidity.toFixed(2));
}


// =========================================================
// GENERATE NEXT VOLTAGE
// =========================================================

function generateVoltage() {
  const change = (Math.random() - 0.5) * 0.25;

  liveVoltage = clamp(
    liveVoltage + change,
    11.4,
    12.5
  );

  return Number(liveVoltage.toFixed(2));
}


// =========================================================
// RANDOM DOOR STATUS
// =========================================================

function generateDoorStatus() {
  if (Math.random() < 0.08) {
    liveDoorOpen = !liveDoorOpen;
  }

  return liveDoorOpen;
}


// =========================================================
// COOLING STATUS
// =========================================================

function generateCoolingStatus(temperature) {
  if (temperature > 6.5) {
    liveCoolingOn = true;
  } else if (temperature < 4.5) {
    liveCoolingOn = false;
  }

  return liveCoolingOn;
}


// =========================================================
// CREATE NEW SENSOR SNAPSHOT
//
// This function is the ONLY place that generates a new
// dummy sensor reading.
// =========================================================

function createSensorSnapshot() {
  const temperature = generateTemperature();
  const humidity = generateHumidity();
  const voltage = generateVoltage();
  const doorOpen = generateDoorStatus();
  const coolingOn = generateCoolingStatus(temperature);

  // Simulated sensor failures
  const temperatureSensorFailure =
    Math.random() < 0.02;

  const voltageSensorFailure =
    Math.random() < 0.02;

  const doorSensorFailure =
    Math.random() < 0.02;

  const deviceConnected =
    liveDeviceConnected &&
    Math.random() > 0.01;

  const snapshot = {
    temperature,
    humidity,
    voltage,

    doorOpen,
    coolingOn,
    deviceConnected,

    temperatureFailure:
      temperatureSensorFailure,

    temperatureSensorFailure,

    voltageFailure:
      voltageSensorFailure,

    voltageSensorFailure,

    doorFailure:
      doorSensorFailure,

    doorSensorFailure,

    timestamp:
      new Date().toISOString(),
  };

  latestSensorSnapshot = snapshot;

  console.log(
    `[DUMMY] Temp: ${temperature}°C | Humidity: ${humidity}% | Voltage: ${voltage}V`
  );

  return snapshot;
}


// =========================================================
// GET CURRENT SENSOR SNAPSHOT
//
// If a snapshot already exists, return it.
//
// This does NOT generate another random temperature.
// =========================================================

export function getLatestSensorSnapshot() {
  if (!latestSensorSnapshot) {
    return createSensorSnapshot();
  }

  return latestSensorSnapshot;
}


// =========================================================
// MONITORING SNAPSHOT
// GET /api/monitoring
//
// Generates one new sensor reading and stores it.
// =========================================================

export function randomMonitoringSnapshot() {
  return createSensorSnapshot();
}


// =========================================================
// HISTORY DATA
// =========================================================

export function generateHistory() {
  const data = Array.from(
    { length: 24 },
    (_, i) => ({
      time: `${String(
        9 + Math.floor(i / 2)
      ).padStart(2, "0")}:${
        i % 2 ? "30" : "00"
      }`,

      temp: Number(
        (
          5.1 +
          Math.sin(i / 3) * 0.7 +
          (Math.random() - 0.5) * 0.25
        ).toFixed(1)
      ),

      rh: Math.round(
        48 +
          Math.sin(i / 4) * 5 +
          (Math.random() - 0.5) * 2
      ),

      voltage: Number(
        (
          12 +
          Math.sin(i / 3) * 0.2 +
          (Math.random() - 0.5) * 0.1
        ).toFixed(2)
      ),
    })
  );

  const events = [
    {
      time: "20:42",
      title: "Device heartbeat OK",
      detail: "Connectivity restored",
    },
    {
      time: "19:18",
      title: "Door closed",
      detail: "Access event completed",
    },
    {
      time: "17:51",
      title: "Voltage warning",
      detail: "Supply briefly dropped",
    },
    {
      time: "16:20",
      title: "Self-test passed",
      detail: "All systems healthy",
    },
  ];

  return {
    data,
    events,
  };
}


// =========================================================
// PREDICTION
// GET /api/prediction
//
// IMPORTANT:
//
// Prediction does NOT generate a new sensor temperature.
//
// It reads the SAME temperature currently being used
// by Monitoring.
// =========================================================

export function generatePrediction() {
  // Get the SAME current sensor snapshot
  const sensor = getLatestSensorSnapshot();

  const current = Number(
    sensor.temperature.toFixed(1)
  );

  const data = [];

  // =======================================================
  // HISTORICAL READINGS
  // =======================================================

  for (let i = 0; i < 12; i++) {
    const historicalVariation =
      Math.sin(i / 2.5) * 0.25 +
      (Math.random() - 0.5) * 0.12;

    const historicalTemp = clamp(
      current + historicalVariation,
      1.5,
      9
    );

    data.push({
      x: `-${12 - i}m`,
      temp: Number(
        historicalTemp.toFixed(1)
      ),
      forecast: null,
    });
  }


  // =======================================================
  // CURRENT POINT
  // =======================================================

  data.push({
    x: "Now",
    temp: current,
    forecast: current,
  });


  // =======================================================
  // FUTURE PREDICTION
  // =======================================================

  let predictedTemperature = current;

  for (let i = 1; i <= 6; i++) {

    // Dummy future-temperature movement
    // Replace this later with the real ML model.

    const trend =
      (Math.random() - 0.45) * 0.35;

    predictedTemperature =
      predictedTemperature + trend;

    predictedTemperature = clamp(
      predictedTemperature,
      1,
      9.5
    );

    data.push({
      x: `+${i * 5}m`,
      temp: null,
      forecast: Number(
        predictedTemperature.toFixed(1)
      ),
    });
  }


  // =======================================================
  // PROJECTED VALUES
  // =======================================================

  const projected = data
    .filter(
      (item) =>
        item.forecast !== null &&
        item.forecast !== undefined
    )
    .map((item) =>
      Number(item.forecast)
    );


  const min = Math.min(
    ...projected,
    current
  );

  const max = Math.max(
    ...projected,
    current
  );


  // =======================================================
  // RISK CALCULATION
  // =======================================================

  let risk = "low";

  if (
    max > 8 ||
    min < 2
  ) {
    risk = "high";

  } else if (
    max > 7.4 ||
    min < 2.6
  ) {
    risk = "watch";
  }


  // =======================================================
  // DUMMY COOLING DECISION
  //
  // This currently simulates the output of the cooling
  // control ML model.
  //
  // 0 = OFF
  // 1 = LOW
  // 2 = HIGH
  // =======================================================

  let coolingLevel = 0;
  let coolingDecision = "OFF";
  let peltier = false;

  if (current >= 7.0) {

    coolingLevel = 2;
    coolingDecision = "HIGH";
    peltier = true;

  } else if (current >= 5.5) {

    coolingLevel = 1;
    coolingDecision = "LOW";
    peltier = true;

  } else {

    coolingLevel = 0;
    coolingDecision = "OFF";
    peltier = false;
  }


  // =======================================================
  // RETURN PREDICTION
  // =======================================================

  return {
    // Current temperature
    current,

    // Historical + future data
    data,

    // Projected range
    min: Number(min.toFixed(1)),
    max: Number(max.toFixed(1)),

    // Risk
    risk,

    // Cooling decision
    coolingDecision,

    // 0 = OFF
    // 1 = LOW
    // 2 = HIGH
    coolingLevel,

    // Peltier ON/OFF
    peltier,

    timestamp:
      new Date().toISOString(),
  };
}


// =========================================================
// INVENTORY
// =========================================================

export let inventoryLogs = [
  {
    id: 1,
    vaccine: "BCG",
    qty: 12,
    type: "in",
    time: "21 Aug 2026, 10:30",
    device: "VFR-2/8 · Unit A",
  },

  {
    id: 2,
    vaccine: "Oral Polio Vaccine (OPV)",
    qty: 8,
    type: "out",
    time: "21 Aug 2026, 09:15",
    device: "VFR-2/8 · Unit A",
  },

  {
    id: 3,
    vaccine: "Measles-Rubella (MR)",
    qty: 40,
    type: "in",
    time: "20 Aug 2026, 14:20",
    device: "VFR-2/8 · Unit A",
  },
];


// =========================================================
// ADD INVENTORY
// =========================================================

export function addInventoryLog({
  vaccine,
  qty,
  type = "in",
  time,
}) {
  const entry = {
    id: Date.now(),

    vaccine,

    qty: Number(qty),

    type,

    time:
      time ||
      new Date().toLocaleString(),

    device:
      "VFR-2/8 · Unit A",
  };

  inventoryLogs = [
    entry,
    ...inventoryLogs,
  ];

  return entry;
}


// =========================================================
// REMOVE INVENTORY
// =========================================================

export function removeInventoryLog(id) {
  const before =
    inventoryLogs.length;

  inventoryLogs =
    inventoryLogs.filter(
      (item) =>
        String(item.id) !==
        String(id)
    );

  return (
    inventoryLogs.length <
    before
  );
}