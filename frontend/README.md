# Cold Chain Monitoring Dashboard

Professional React dashboard split into five pages:

- **Home** — navigation and overview
- **Real-Time Monitoring** — temperature, humidity, door, cooling, voltage, connectivity and failures
- **History** — temperature, humidity, voltage, historical sensor readings and device/failure history
- **Prediction** — future temperature, safe-range risk and early warning
- **Vaccine Inventory** — vaccine type, quantity, date/time and refrigerator

## Setup

```bash
npm install react-router-dom lucide-react recharts
npm run dev
```

The files are intentionally separated so each feature can later be connected to its own API/service without turning the dashboard into one large component.
