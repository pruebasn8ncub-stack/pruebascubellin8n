# Innovakine Web Application

Proyecto Frontend para Innovakine, construido con **Next.js 14**, **Tailwind CSS**, y conexión a una arquitectura backend híbrida alojada en **Hostinger** (vía Easypanel) y **Supabase** self-hosted.

## 🌟 Arquitectura y Conexiones

Esta aplicación utiliza un patrón híbrido para equilibrar **rendimiento** y **seguridad**:

1. **Lectura Directa de Supabase (Frontend SSR/CSR)**:
   - Para mostrar los datos del calendario y la agenda, el frontend utiliza el cliente `@supabase/supabase-js`. Esto permite una carga ultrarrápida (Direct Database Access) saltándose el coste temporal de una API intermedia.
   - La conexión a la base de datos de producción (Self-Hosted en Hostinger) está configurada en `src/lib/supabase.ts`.

2. **Escritura Segura y Lógica Administrativa (Custom API via Vercel Rewrites)**:
   - Las operaciones críticas, como la creación de nuevos _Profesionales_ o pacientes con lógica adjunta, se enrutan a través del backend propio alojado en `https://api-agenda-web.wfrhms.easypanel.host`.
   - Para mitigar los problemas de *Mixed Content* y esquivar las políticas de CORS restrictivas en la web, se utiliza un **Vercel Rewrite** definido en `next.config.mjs` que redirige el tráfico de `/api/v1/*` hacia el servidor en Hostinger de forma transparente.

## 📋 Estructura de Seguridad

A diferencia de la gestión convencional, los **Roles de Usuario** están protegidos en la base de datos de Supabase.
* La autenticación inicial de la sesión se hace directamente con Supabase (`signInWithPassword`).
* Para poder crear otros profesionales, un usuario debe tener obligatoriamente el `role: 'admin'` dentro de la tabla `profiles`. Modificar este parámetro requiere la `SUPABASE_SERVICE_ROLE_KEY` en el entorno administrativo del servidor backend.

## 🚀 Setup Local y Despliegue

### Requisitos Local
* Node.js v18+
* Gestor de paquetes `npm` (o `bun`/`yarn`/`pnpm`)

### Instalación
```bash
npm install
# Para levantar el entorno de desarrollo:
npm run dev
```

Las credenciales públicas de Supabase se encuentran ya parametrizadas desde el cliente.

### Despliegue en Vercel
1. Conecta el repositorio de GitHub a Vercel.
2. Asegúrate de configurar las credenciales estándar (si las utilizas vía variables dinámicas). En la versión actual, el `NEXT_PUBLIC_SUPABASE_URL` está configurado para la instancia self-hosted que previene fallos de Vercel Cache.

## 🩺 Módulos Principales
* **Agenda**: Vista principal tipo calendario para administrar todas las citas divididas por profesional.
* **Pacientes**: Gestión del historial, datos y contacto clínico.
* **Profesionales**: Control del staff médico y permisos administrativos.
* **Administración / Ajustes**: Portal principal para orquestar la clínica usando las políticas preestablecidas.

---
_Desarrollado para brindar la experiencia más dinámica y segura posible a las clínicas operadas bajo la red de Innovakine._
