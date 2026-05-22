# Session Log: 002 - auth_module_endpoints

- **Fecha de la sesión:** 2026-05-21
- **Módulo afectado:** Auth
- **Estado final de la sesión:** Completado

---

## 📌 ¿Qué se construyó o modificó en esta sesión?

- Se implementó completamente el módulo de Autenticación e Identidad (Auth Service) bajo una arquitectura de Monolito Modular, aislando sus responsabilidades.
- Se crearon los siguientes endpoints, gestionados desde `src/modules/auth/routes/auth.routes.ts`:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/oauth/google`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/profile/me`
  - `PATCH /api/v1/auth/profile/update`
- Se abstrajo la lógica de negocio en `auth.service.ts` y las operaciones de base de datos en `auth.repository.ts`.
- Se introdujo un sistema estricto de validación centralizando esquemas de entrada en `schemas/auth.schema.ts` utilizando Zod y ejecutando la validación en el controlador antes de inyectar los datos limpios a la capa de servicio.
- Se construyó el middleware `authenticate.ts` para verificar de manera segura los JWT Access Tokens de solicitudes entrantes y revisar listas negras de tokens revocados desde Redis (`bl:<token>`).
- Se estableció el flujo de Refresh Tokens almacenados en Redis (`rt:<user_id>`) y rotación segura.
- Las fechas se manejan explícitamente en el backend (ej. `createdAt: new Date()`) asegurando su almacenamiento persistente en UTC sin delegar la función `NOW()` a la BD.

## 🔍 Detalles Técnicos Relevantes

- **Archivos creados o modificados:**
  - `src/app.ts`
  - `src/middlewares/authenticate.ts`
  - `src/utils/jwt.ts`
  - `src/utils/catchAsync.ts`
  - `src/modules/auth/routes/auth.routes.ts`
  - `src/modules/auth/controllers/auth.controller.ts`
  - `src/modules/auth/services/auth.service.ts`
  - `src/modules/auth/repositories/auth.repository.ts`
  - `src/modules/auth/schemas/auth.schema.ts`
- **Dependencias nuevas:**
  - `bcryptjs` (en lugar de `bcrypt` nativo por seguridad de compilación y compatibilidad).
  - `jsonwebtoken`
  - `google-auth-library` (para validar tokens OAuth2 provenientes del móvil).
- **Consideraciones de base de datos:** La base de datos es interactuada enteramente a través de `auth.repository.ts` utilizando métodos limpios. El algoritmo de generación dinámica de `username` evalúa de forma recursiva (con límite de string logic) la base de datos hasta encontrar colisiones y crear identidades únicas.

## 🚀 ¿Qué queda pendiente para la siguiente sesión? (Next Steps)

1. [ X ] Arrancar servicios locales (Redis y Postgres mediante Docker) y correr la batería de pruebas/ejecuciones manuales (`pnpm dev`) para ensayar el registro de usuarios, login tradicional y OAuth.
2. [ X ] Iniciar el desarrollo del Módulo de Catálogo, permitiendo la indexación y búsqueda básica de Series.
