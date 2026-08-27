# Cold Chain Dashboard — Backend (dummy data)

Express API that serves dummy JSON matching what each page of the
`cold-chain-dashboard` frontend expects. Swap the generators in
`data/dummy.js` for real sensor/DB reads later — the routes and response
shapes are designed to stay the same.

## Setup

```bash
npm install
npm run dev     # nodemon, auto-restarts on change
# or
npm start
```

Runs on `http://localhost:4000` by default (override with `PORT`).

## Endpoints

| Method | Path              | Returns                                              |
|--------|-------------------|-------------------------------------------------------|
| GET    | `/api/health`     | `{ status: "ok" }`                                    |
| GET    | `/api/monitoring` | Live sensor snapshot: temp, rh, voltage, door, cooling, online, fault, power |
| GET    | `/api/history`    | `{ data: [...24 readings], events: [...device/failure log] }` |
| GET    | `/api/prediction` | `{ current, data: [...forecast points], min, max, risk }` |
| GET    | `/api/inventory`  | `{ logs: [...usage records] }`                        |
| POST   | `/api/inventory`  | Add a usage record. Body: `{ vaccine, qty, time }`     |
| DELETE | `/api/inventory/:id` | Remove a usage record                              |

## Wiring it into the frontend

Each page currently generates its own fake data with `useState`/`Math.random`.
To connect a page, replace the local generator with a fetch, e.g. in
`Monitoring.jsx`:

```js
useEffect(() => {
  const load = () => fetch("http://localhost:4000/api/monitoring")
    .then(r => r.json())
    .then(d => { setTemp(d.temp); setRh(d.rh); setVoltage(d.voltage); /* ... */ });
  load();
  const id = setInterval(load, 2200);
  return () => clearInterval(id);
}, []);
```

`History.jsx` and `Prediction.jsx` follow the same pattern with `/api/history`
and `/api/prediction`. `Inventory.jsx` can call `GET /api/inventory` on load,
`POST /api/inventory` from `add()`, and `DELETE /api/inventory/:id` from the
remove button.

If the frontend runs on a different port during `npm run dev` (Vite default
5173), either use the full backend URL as above or add a Vite proxy for
`/api` to `http://localhost:4000`.
