# DarkMoney Frontend

Base inicial del frontend de DarkMoney alineada con:

- [BBP_DarkMoney_Frontend.md](./BBP_DarkMoney_Frontend.md)
- [DATABASE_DICTIONARY.md](./DATABASE_DICTIONARY.md)

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- TanStack Query
- Zustand
- Supabase JS

## Variables de entorno

Copia `.env.example` a `.env` y completa:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_APP_URL=https://darkmoney.company
VITE_PADDLE_CLIENT_TOKEN=
VITE_PADDLE_PRO_PRICE_ID=
VITE_PADDLE_ENV=sandbox
```

Para el nuevo checkout de Paddle tambien necesitas configurar en Supabase Functions:

```txt
PADDLE_API_KEY
PADDLE_WEBHOOK_SECRET
```

## Comandos

### Opcion 1: con Docker

Necesitas tener Docker Desktop instalado.

```bash
docker compose up --build
```

Luego abre:

```txt
http://localhost:5173
```

Para detenerlo:

```bash
docker compose down
```

### Opcion 2: con Node local

```bash
npm install
npm run dev
```

## Nota

En este entorno de trabajo no habia `node`, `npm` ni `docker` disponibles en PATH al momento de generar esta base, por lo que no pude verificar la ejecucion local ni por contenedor desde aqui.
