# 💰 Agenda Financiera

Aplicación personal para llevar el control de tus finanzas: cuentas, transacciones, transferencias entre cuentas y notas, con un dashboard de resumen.

Funciona de forma local — el servidor sirve la app y guarda los datos en una base SQLite en tu propia máquina.

## Características

- **Cuentas** — crea cuentas en distintas monedas (DOP, USD, EUR) con su color, y consulta el balance de cada una. Cada monto se muestra siempre en la moneda de su cuenta.
- **Transacciones** — registra ingresos y egresos con su categoría, etiquetas y campos personalizados (método de pago, o los que tú definas). Filtros por tipo, categoría, etiqueta, cuenta y rango de fechas, atajos de período (hoy/semana/mes/año), búsqueda por descripción y totales de la vista filtrada.
- **Transferencias entre cuentas** — mueve dinero de una cuenta a otra, incluso entre monedas distintas. Son neutrales para las estadísticas (no cuentan como ingreso ni egreso), solo ajustan los balances.
- **Notas** — apuntes rápidos.
- **Dashboard** — totales de ingresos/egresos por moneda, balances por cuenta, gráfico de ingresos vs egresos y distribución de egresos por categoría, con períodos de semana/mes/año.
- **Ajustes** — preferencias (moneda por defecto, período inicial del dashboard, filas por página); catálogos editables de categorías (nombre, color, ingreso/egreso) y tipos de cuenta; campos personalizados para transacciones (texto, número, lista, fecha, sí/no); restaurar cuentas archivadas; exportar/restaurar backup en JSON y borrado total con confirmación.

## Tecnologías

- **Frontend:** React + Vite, React Router, Recharts. UI propia sin librería de componentes.
- **Backend:** Express + SQLite (`node:sqlite`).
- **Tests:** runner nativo de Node (`node --test`) con Supertest.

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior (la app usa el módulo nativo `node:sqlite`).

## Inicio rápido

### Windows

Haz doble clic en **`start.bat`**. La primera vez instala dependencias y compila el frontend; luego abre el navegador automáticamente en `http://localhost:3737`.

> Mantén abierta la ventana de la consola mientras uses la app: el servidor funciona solo mientras esa ventana esté activa. Para cerrarlo, escribe `1` y presiona Enter, o cierra la ventana.

### Manual (cualquier sistema)

```bash
# 1. Instalar dependencias
npm install
cd client && npm install && cd ..

# 2. Compilar el frontend
npm run build

# 3. Iniciar el servidor (sirve la app en http://localhost:3737)
npm start
```

## Desarrollo

Para trabajar con recarga en caliente del frontend, ejecuta el backend y el dev server de Vite por separado:

```bash
# Terminal 1 — API (puerto 3737)
npm start

# Terminal 2 — frontend con HMR (puerto 5173, hace proxy de /api al backend)
cd client && npm run dev
```

## Tests

```bash
npm test
```

## Estructura

```
server/          API Express + SQLite
  routes/        accounts, transactions, transfers, notes, summary
  tests/         pruebas de cada ruta
client/          app React + Vite
  src/pages/     Dashboard, Transactions, Transfers, Accounts, Notes
data/            base SQLite (generada en runtime, ignorada por git)
```

## Datos

La base de datos se crea automáticamente en `data/agenda.db` la primera vez que inicias el servidor. Esa carpeta está en `.gitignore`, así que tus datos nunca se suben al repositorio.
