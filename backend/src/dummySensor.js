import pool from "./db/pool.js";

function generateSensorData() {
  const temperature = Number((4 + Math.random() * 2).toFixed(2));
  const humidity = Number((55 + Math.random() * 10).toFixed(2));
  const voltage = Number((11.8 + Math.random() * 0.5).toFixed(2));

  const doorOpen = Math.random() < 0.05;
  const coolingOn = temperature > 5;
  const deviceConnected = true;

  return {
    temperature,
    humidity,
    voltage,
    doorOpen,
    coolingOn,
    deviceConnected,
  };
}

async function insertDummyReading() {
  try {
    const data = generateSensorData();

    await pool.query(
      `
      INSERT INTO sensor_readings
      (
        temperature,
        humidity,
        voltage,
        door_open,
        cooling_on,
        device_connected
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        data.temperature,
        data.humidity,
        data.voltage,
        data.doorOpen,
        data.coolingOn,
        data.deviceConnected,
      ]
    );

    console.log(
      `[DUMMY] Temp: ${data.temperature}°C | Humidity: ${data.humidity}% | Voltage: ${data.voltage}V`
    );
  } catch (error) {
    console.error("Dummy sensor error:", error);
  }
}

setInterval(insertDummyReading, 5000);

insertDummyReading();