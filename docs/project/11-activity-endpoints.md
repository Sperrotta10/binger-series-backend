# API Contracts: Módulo 4 - Actividad y Diario

Este documento define el contrato estricto de los endpoints para el módulo de Actividad y Diario de **Binger**. Todas las operaciones de escritura e historial están optimizadas mediante índices compuestos y contadores en caché distribuidos en Redis.

---

## 1. POST `/api/v1/activity/watch`
**Descripción:** Registra un episodio específico como visto por el usuario. El sistema deduce de forma automática el parámetro `is_rewatch` analizando si ya existe un registro idéntico previo en la base de datos. Dispara el evento asíncrono `episode.watched` internamente.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body (Payload):**
```json
{
  "episode_id": "episode-uuid-1111-2222",
  "watched_at": "2026-05-20T19:30:00Z" 
}

```

*Nota: Si `watched_at` no es provisto por el cliente, el backend asignará la marca de tiempo UTC actual por defecto.*

* **Respuestas:**
* **`201 Created`:** El registro fue insertado con éxito y las estadísticas se actualizaron en background.
```json
{
  "status": "success",
  "message": "Episode successfully logged in your diary",
  "data": {
    "log_id": "watch-log-uuid-9999",
    "episode_id": "episode-uuid-1111-2222",
    "is_rewatch": false,
    "watched_at": "2026-05-20T19:30:00Z"
  }
}

```

* **`400 Bad Request`:** `episode_id` inválido o ausente.
* **`404 Not Found`:** El episodio no existe en el catálogo local.

---

## 2. DELETE `/api/v1/activity/watch/:logId`

**Descripción:** Elimina un registro de visualización del diario. Dispara de forma asíncrona un evento de decremento en las estadísticas del usuario en Redis.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `logId` (UUIDv4 del log en la tabla `watch_logs`).
* **Respuestas:**
* **`200 OK`:** Registro eliminado.
```json
{
  "status": "success",
  "message": "Diary log entry removed successfully."
}

```

* **`403 Forbidden`:** El log pertenece a otro usuario.
* **`404 Not Found`:** El `logId` provisto no existe.

---

## 3. GET `/api/v1/activity/stats/me`

**Descripción:** Obtiene las estadísticas de consumo y gamificación del usuario en tiempo real leyendo directamente las estructuras atómicas precalculadas en Redis (`user:stats:ID`).

* **Headers:** `Authorization: Bearer <accessToken>`
* **Respuestas:**
* **`200 OK`:** Retorna los contadores de forma inmediata sin sobrecargar PostgreSQL.
```json
{
  "status": "success",
  "data": {
    "user_id": "user-uuid-1234",
    "total_minutes_watched": 14820,
    "total_episodes_count": 312,
    "current_streak_days": 5,
    "episodes_watched_today": 2
  }
}

```

---

## 4. POST `/api/v1/activity/reviews`

**Descripción:** Crea una reseña pública de una serie o de una temporada específica acompañando una puntuación.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body (Payload):**

```json
{
  "series_id": "series-uuid-7890",
  "season_id": null, 
  "rating": 4.5,
  "content": "El tercer acto de esta temporada es de lo mejor del año. Gran guion.",
  "contains_spoilers": true
}

```

*Nota: El parámetro `rating` es un float estricto que acepta valores del 0.5 al 5.0 en incrementos de 0.5. El backend rechazará valores fuera de este rango.*

* **Respuestas:**
* **`201 Created`:** Reseña publicada.
```json
{
  "status": "success",
  "message": "Review published successfully",
  "data": {
    "review_id": "review-uuid-5555",
    "rating": 4.5,
    "contains_spoilers": true,
    "created_at": "2026-05-20T19:32:00Z"
  }
}

```

* **`400 Bad Request`:** El rating no es múltiplo de 0.5 o el texto supera los límites de caracteres establecidos.

---

## 5. PUT `/api/v1/activity/reviews/:reviewId`

**Descripción:** Modifica el contenido, la calificación o la bandera de spoiler de una reseña existente.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `reviewId` (UUIDv4 de la reseña).
* **Body (Payload):** Igual al del POST pero con los campos que se desean actualizar de forma parcial.
* **Respuestas:**
* **`200 OK`:** Reseña actualizada.
* **`403 Forbidden`:** Intento de modificar una reseña ajena.

---

## 6. POST `/api/v1/activity/watchlist/toggle`

**Descripción:** Endpoint de tipo *toggle* atómico. Si la serie no está en la Watchlist del usuario, la inserta. Si ya existe la relación, la elimina. Simplifica la reactividad del UI en React Native con una sola llamada.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body (Payload):**

```json
{
  "series_id": "series-uuid-7890"
}

```

* **Respuestas:**
* **`200 OK`:** Operación realizada. Devuelve la acción ejecutada para actualizar los estados locales del frontend.
```json
{
  "status": "success",
  "data": {
    "series_id": "series-uuid-7890",
    "action": "added" 
  }
}

```

*Nota: El campo `action` retornará `"added"` o `"removed"` dinámicamente.*

---

## 7. PUT `/api/v1/activity/watch/:logId`
**Descripción:** Modifica los metadatos de un registro de visualización existente en el diario (como cambiar la fecha/hora en que se vio o alternar manualmente el estado de *rewatch*).

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `logId` (UUIDv4 del log en la tabla `watch_logs`).
* **Body (Payload):**
```json
{
  "watched_at": "2026-05-19T21:00:00Z",
  "is_rewatch": true
}

```

*Nota: Todos los campos del body son opcionales (parciales), permitiendo actualizar solo la fecha o solo el estado de rewatch.*

* **Respuestas:**
* **`200 OK`:** Registro editado con éxito. Si se modificó la fecha, las colas internas recalculan de forma automática si las rachas de días (*streaks*) del usuario fueron afectadas.
```json
{
  "status": "success",
  "message": "Diary entry updated successfully",
  "data": {
    "log_id": "watch-log-uuid-9999",
    "is_rewatch": true,
    "watched_at": "2026-05-19T21:00:00Z"
  }
}

```

* **`400 Bad Request`:** Formato de fecha ISO inválido.
* **`403 Forbidden`:** El usuario no es dueño de este registro de actividad.
* **`404 Not Found`:** El `logId` provisto no existe en el sistema.

---

## 8. DELETE `/api/v1/activity/reviews/:reviewId`

**Descripción:** Elimina físicamente una reseña del sistema. Esta acción dispara un evento asíncrono para recalcular el `rating_average` de la serie en el *Módulo de Catálogo* y remueve los contadores de *Likes* asociados en el *Módulo Social*.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `reviewId` (UUIDv4 de la reseña).
* **Respuestas:**
* **`200 OK`:** Reseña eliminada correctamente del sistema.
```json
{
  "status": "success",
  "message": "Review deleted successfully. Show metrics are being updated in background."
}

```

* **`403 Forbidden`:** El token del usuario no coincide con el creador de la reseña (`user_id`).
* **`404 Not Found`:** La reseña ya no existe o el ID es erróneo.

```