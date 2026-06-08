# Transferencias entre cuentas — Diseño

Fecha: 2026-06-07

## Objetivo

Permitir mover dinero entre cuentas propias. Una transferencia es neutral para
las estadísticas globales (no es ingreso ni egreso del patrimonio): solo cambia
el balance de la cuenta origen y la de destino. Se permite transferir entre
cuentas de distinta moneda capturando el monto recibido.

## Enfoque elegido

Tabla `transfers` separada. Como `total_income` / `total_expenses` se derivan
solo de `transactions`, las transferencias quedan automáticamente neutrales en
el dashboard sin tocar esas queries. El balance por cuenta se ajusta sumando las
transferencias.

Enfoques descartados:
- Par de transacciones INCOME+EXPENSE enlazadas: obliga a excluir transferencias
  en todas las queries de summary; frágil.
- Nuevo tipo `TRANSFER` en `transactions`: rompe `CHECK(type IN ('INCOME','EXPENSE'))`.

## 1. Base de datos (`server/db.js`)

```sql
CREATE TABLE IF NOT EXISTS transfers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  from_account_id INTEGER NOT NULL REFERENCES accounts(id),
  to_account_id   INTEGER NOT NULL REFERENCES accounts(id),
  amount_from     REAL NOT NULL CHECK(amount_from > 0),
  amount_to       REAL NOT NULL CHECK(amount_to > 0),
  date            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`amount_from` está en la moneda de la cuenta origen; `amount_to` en la de
destino. Misma moneda ⇒ `amount_to = amount_from`.

## 2. Cálculo de balance

Ajustar la query de balance en `accounts.js` y el `by_account` de `summary.js`:

```
balance = (income − expense)
          − Σ transfers salientes (amount_from)
          + Σ transfers entrantes (amount_to)
```

Los totales globales de ingresos/egresos NO se tocan → transferencias neutrales.

## 3. API (`server/routes/transfers.js`, montado en `/api/transfers`)

- `GET /` → lista con joins a nombre/color/moneda de ambas cuentas, orden por
  `date` desc, `created_at` desc.
- `POST /` → valida: ambas cuentas existen y activas; `from_account_id !=
  to_account_id`; `amount_from > 0`. Si las monedas coinciden, fuerza
  `amount_to = amount_from`; si difieren, `amount_to` es requerido y > 0.
- `DELETE /:id`.

Sin edición: borrar y recrear.

## 4. Frontend

- Nueva página `client/src/pages/Transfers.jsx` siguiendo el patrón de
  `Transactions.jsx` (tabla + modal slide-over con estilos existentes).
- Entrada en `Sidebar.jsx` (ícono de flechas ⇄) y ruta `/transfers` en `App.jsx`.
- Tabla: Fecha · Origen → Destino · Monto · acción eliminar.
- Modal: select cuenta origen, select cuenta destino, monto enviado, monto
  recibido (solo visible si las monedas difieren; autocompletado si coinciden),
  fecha, descripción.
- `api.js`: `getTransfers`, `createTransfer`, `deleteTransfer`.

## 5. Tests (`server/tests/transfers.test.js`)

- Creación misma moneda (amount_to autocompletado).
- Creación cross-currency (amount_to distinto).
- Validación `from != to`.
- El balance de ambas cuentas se actualiza correctamente tras una transferencia.
