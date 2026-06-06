# Guía de Construcción de Módulos — Binger Backend

> **Fuente de verdad:** Este documento describe el estándar de desarrollo que deben seguir todos los módulos del backend. Está basado en la implementación existente de los módulos `activity/reviews` y `activity/tracking`.

---

## 1. Estructura de Carpetas

Cada módulo (o sub-módulo) debe tener la siguiente estructura interna sin excepciones:

```
src/modules/<nombre-modulo>/
├── controllers/      # Capa de transporte HTTP
├── repositories/     # Capa de acceso a datos (Prisma)
├── routes/           # Definición de endpoints y aplicación de middlewares
├── schemas/          # Validación de entrada con Zod
├── services/         # Lógica de negocio pura
└── types/            # Interfaces y tipos TypeScript de la capa de dominio
```

---

## 2. Capa por Capa: Responsabilidades y Reglas

### 📁 `types/` — Contratos de Dominio

**Responsabilidad:** Definir las interfaces TypeScript que representan la forma de los datos *dentro* del sistema (camelCase, alineadas con Prisma).

**Reglas:**
- Los tipos de **entrada de la API** usan `snake_case` (ej: `series_id`, `contains_spoilers`) porque vienen del cliente.
- Los tipos de **datos internos** (pasados entre servicio y repositorio) usan `camelCase` (ej: `seriesId`, `containsSpoilers`).
- Nunca importar `prisma` aquí. Solo interfaces y tipos puros.

**Ejemplo:**
```typescript
// Input API (snake_case del cliente)
export interface CreateSeriesReviewInput {
  series_id: string;
  rating: number;
  content?: string;
  contains_spoilers: boolean;
}

// Data interna (camelCase para Prisma)
export interface CreateSeriesReviewData {
  userId: string;
  seriesId: string;
  rating: number;
  content?: string;
  containsSpoilers: boolean;
}
```

---

### 📁 `schemas/` — Validación de Entrada con Zod

**Responsabilidad:** Validar y parsear los datos crudos del `req.body`, `req.params` y `req.query` **antes** de que lleguen al servicio.

**Reglas:**
- Siempre usar `zod/v4` importado desde `'zod/v4'` para schemas de body/query. Para schemas simples de parámetros (`idParamSchema`) se puede usar `'zod'`.
- Usar `z.coerce.number()` para query params numéricos (vienen como string desde la URL).
- Usar `z.preprocess` solo cuando se necesite transformación más compleja que `coerce`.
- Los schemas exportados terminan en `Schema` (ej: `createListSchema`, `idParamSchema`).
- Nunca contener lógica de negocio ni llamadas a la base de datos.

**Ejemplo:**
```typescript
import { z } from 'zod/v4';

export const idParamSchema = z.string().uuid('Invalid ID format');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  is_private: z.boolean().optional().default(false),
});
```

---

### 📁 `repositories/` — Capa de Acceso a Datos

**Responsabilidad:** Encapsular **todas** las consultas a PostgreSQL vía Prisma. El servicio nunca debe importar `prisma` directamente.

**Reglas:**
- Solo importar `prisma` desde `'../../../config/database.js'` (ajustar niveles de `../` según la profundidad).
- Los métodos son `static async`.
- Cada método realiza una sola operación sobre la base de datos.
- Los tipos de parámetros e interfaces de datos internos se importan desde `../types/`.
- Las transacciones multi-paso se implementan aquí como un método único que llama a `prisma.$transaction(async (tx) => { ... })`.
- No lanzar errores de negocio aquí; devolver `null` si no encuentra un recurso y dejar que el servicio decida.

**Ejemplo:**
```typescript
import { prisma } from '../../../config/database.js';
import { CreateListItemData } from '../types/social.types.js';

export class SocialRepository {
  static async findListById(listId: string) {
    return prisma.list.findUnique({ where: { id: listId } });
  }

  static async updateListItemsTransaction(listId: string, items: CreateListItemData[]) {
    return prisma.$transaction(async (tx) => {
      await tx.listItem.deleteMany({ where: { listId } });
      if (items.length > 0) {
        await tx.listItem.createMany({ data: items });
      }
    });
  }
}
```

---

### 📁 `services/` — Lógica de Negocio

**Responsabilidad:** Orquestar las reglas de negocio. No sabe nada de HTTP (`req`/`res`). Llama al repositorio para datos y lanza `AppError` para señalar errores operacionales.

**Reglas:**

#### ✅ Manejo de Errores — LA REGLA MÁS IMPORTANTE
El **único** mecanismo para lanzar errores operacionales es:

```typescript
throw new AppError(
  'Mensaje descriptivo para el cliente',
  HttpStatus.XXX,    // de '../../../../constants/httpStatus.js'
  ErrorCodes.XXX,    // de '../../../../constants/errorCodes.js'
);
```

> ⚠️ **NUNCA** usar `ApiError.badRequest()`, `ApiError.notFound()` ni variantes estáticas. `ApiError` no existe en este proyecto. Solo existe `AppError` como clase constructora.

**Imports obligatorios del servicio:**
```typescript
import { AppError } from '../../../middlewares/errorHandler.js';
import { HttpStatus } from '../../../constants/httpStatus.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
```

**Errores comunes:**
| Situación | Código correcto |
|---|---|
| Recurso no encontrado | `HttpStatus.NOT_FOUND`, `ErrorCodes.NOT_FOUND` |
| Acción prohibida / no propietario | `HttpStatus.FORBIDDEN`, `ErrorCodes.FORBIDDEN` |
| Validación de negocio (auto-follow, duplicado) | `HttpStatus.BAD_REQUEST`, `ErrorCodes.BAD_REQUEST` |
| Conflicto de unicidad | `HttpStatus.CONFLICT`, `ErrorCodes.CONFLICT` |

**Ejemplo correcto:**
```typescript
static async deleteReview(userId: string, reviewId: string) {
  const existing = await ReviewsRepository.findReviewById(reviewId);
  if (!existing)
    throw new AppError('Review not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  if (existing.userId !== userId)
    throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

  await ReviewsRepository.deleteReview(reviewId);
}
```

**Otras reglas:**
- Los métodos son `static async`.
- Las operaciones de Redis en background (fire-and-forget) se hacen con `.catch(console.error)` o `.catch((err) => logger.error(...))`.
- Nunca usar `console.log`; usar el `logger` de `'../../../config/logger.js'` para logs relevantes.
- No importar `prisma` directamente. Todo acceso a datos pasa por el repositorio.

---

### 📁 `controllers/` — Capa de Transporte HTTP

**Responsabilidad:** Extraer datos del `req`, invocar el servicio, y devolver la respuesta HTTP. No contiene lógica de negocio.

**Reglas:**
- Siempre envolver con `catchAsync` de `'../../../utils/catchAsync.js'`. Esto redirige automáticamente cualquier error (incluyendo `AppError` y `ZodError`) al `errorHandler` global, sin necesidad de `try/catch`.
- Parsear inputs en el controlador con los schemas de Zod antes de pasarlos al servicio.
- Para respuestas estándar usar `ApiResponse.success(res, data)`.
- Para respuestas con forma custom (campos extra como `pagination`, `message`, etc.) construir el objeto JSON directamente.
- **Nunca** poner `try/catch` ni `next(error)` manualmente: `catchAsync` lo maneja.

**Ejemplo:**
```typescript
import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync.js';
import { ApiResponse } from '../../../utils/apiResponse.js';
import { SocialService } from '../services/social.service.js';
import { idParamSchema, createListSchema } from '../schemas/social.schema.js';

export const createList = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const payload = createListSchema.parse(req.body);

  const result = await SocialService.createList(userId, payload);

  return res.status(201).json({
    status: 'success',
    data: result,
  });
});
```

---

### 📁 `routes/` — Definición de Endpoints

**Responsabilidad:** Declarar las rutas, aplicar middlewares de autenticación y conectar con los controladores.

**Reglas:**
- No hay lógica aquí. Solo `router.use()`, `router.get()`, `router.post()`, etc.
- El middleware `authenticate` de `'../../../middlewares/authenticate.js'` se aplica con `router.use(authenticate)` para proteger rutas masivamente, o inline en rutas individuales cuando la autenticación es parcial (algunas rutas públicas, otras privadas).
- El router se exporta con nombre descriptivo: `export { router as socialRouter }`.

**Ejemplo con rutas mixtas (algunas públicas, otras privadas):**
```typescript
import { Router } from 'express';
import { authenticate } from '../../../middlewares/authenticate.js';
import { getPublicFeed, createList } from '../controllers/social.controller.js';

const router: Router = Router();

// Rutas públicas
router.get('/public', getPublicFeed);

// Todas las rutas posteriores requieren autenticación
router.use(authenticate);
router.post('/lists', createList);

export { router as socialRouter };
```

---

## 3. Flujo de una Petición HTTP (de punta a punta)

```
Cliente HTTP
    │
    ▼
Express (app.ts) — middlewares globales (helmet, cors, json)
    │
    ▼
Router del Módulo (routes/)
    │   Aplica middleware authenticate si la ruta lo requiere
    ▼
Controller (controllers/)
    │   1. catchAsync envuelve la función
    │   2. Schema de Zod parsea req.body / req.params / req.query
    │   3. Llama al Service con datos ya tipados
    ▼
Service (services/)
    │   4. Lógica de negocio
    │   5. Llama al Repository para leer/escribir datos
    │   6. Lanza AppError si hay error operacional
    ▼
Repository (repositories/)
    │   7. Ejecuta queries en PostgreSQL via Prisma
    │   8. Retorna null si no encuentra recursos (no lanza errores)
    ▼
Service (de vuelta)
    │   9. Opera sobre Redis en background si aplica
    │   10. Retorna resultado al Controller
    ▼
Controller (de vuelta)
    │   11. Construye respuesta JSON y llama res.status().json()
    ▼
Cliente HTTP — Respuesta
```

**Si hay error en cualquier paso:**
```
AppError / ZodError lanzado
    │
    ▼
catchAsync captura y llama next(error)
    │
    ▼
errorHandler global (middlewares/errorHandler.ts)
    │   - ZodError → 400 con detalles de campos
    │   - AppError → statusCode definido en el throw
    │   - Otros → 500 Internal Server Error
    ▼
Cliente HTTP — Respuesta de error
```

---

## 4. Registro en app.ts

Al crear un nuevo módulo, registrar su router en [`src/app.ts`](file:///c:/Users/Usuario/OneDrive/Documentos/Programacion/proyectos/binger-series-backend/src/app.ts):

```typescript
import { socialRouter } from './modules/social/routes/social.routes.js';

app.use('/api/v1/social', socialRouter);
```

---

## 5. Checklist de Nuevo Módulo

Antes de considerar un módulo listo, verificar:

- [ ] Carpetas: `controllers/`, `repositories/`, `routes/`, `schemas/`, `services/`, `types/`
- [ ] `types/`: interfaces en camelCase (dominio interno) y snake_case (input API) separadas
- [ ] `schemas/`: validación Zod completa para body, params y query
- [ ] `repositories/`: solo Prisma, sin lógica de negocio, sin `AppError`
- [ ] `services/`: usa `new AppError(msg, HttpStatus.X, ErrorCodes.X)` para todos los errores
- [ ] `services/`: no importa `prisma` directamente
- [ ] `controllers/`: usa `catchAsync`, sin `try/catch` manual
- [ ] `controllers/`: parsea inputs con Zod antes de llamar al service
- [ ] `routes/`: aplica `authenticate` correctamente
- [ ] Router exportado e importado en `app.ts`
- [ ] `npm run lint -- --fix` pasa sin errores

---

## 6. Resumen de Imports por Capa

| Archivo | Imports clave |
|---|---|
| `service` | `AppError` de `middlewares/errorHandler.js`, `HttpStatus` de `constants/httpStatus.js`, `ErrorCodes` de `constants/errorCodes.js`, `logger` de `config/logger.js` |
| `repository` | `prisma` de `config/database.js` |
| `controller` | `catchAsync` de `utils/catchAsync.js`, `ApiResponse` de `utils/apiResponse.js` |
| `routes` | `authenticate` de `middlewares/authenticate.js` |
| `schemas` | `z` de `zod/v4` |
