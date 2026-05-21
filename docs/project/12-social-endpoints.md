# API Contracts: Módulo 5 - Social y de Listas

Este documento define el contrato estricto de los endpoints para el módulo Social de **Binger**. Los endpoints de interacción implementan un patrón *Toggle* para reducir la complejidad en el cliente móvil. El generador de feed está fuertemente acoplado a Redis para garantizar cargas instantáneas.

---

## 1. POST `/api/v1/social/follow/toggle`
**Descripción:** Sigue o deja de seguir a un usuario de la comunidad. El sistema verifica si el registro existe en la tabla `follows`: si no existe, lo crea (Follow); si existe, lo elimina (Unfollow). Incrementa/decrementa los contadores cacheados en Redis en background.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body (Payload):**
```json
{
  "target_user_id": "user-uuid-8888"
}

```

* **Respuestas:**
* **`200 OK`:** Acción procesada correctamente. Devuelve el estado final para que la UI actualice el botón ("Seguir" / "Siguiendo").
```json
{
  "status": "success",
  "data": {
    "target_user_id": "user-uuid-8888",
    "action": "followed"
  }
}

```

*Nota: El campo `action` será `"followed"` o `"unfollowed"`.*
* **`400 Bad Request`:** `target_user_id` es igual al ID del usuario actual (no puede seguirse a sí mismo).
* **`404 Not Found`:** El usuario objetivo no existe.

---

## 2. POST `/api/v1/social/reviews/:reviewId/like/toggle`

**Descripción:** Agrega o quita un "Me gusta" a una reseña. Dispara un evento asíncrono para incrementar el contador de popularidad de la reseña en Redis.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `reviewId` (UUIDv4 de la reseña).
* **Body:** Vacío.
* **Respuestas:**
* **`200 OK`:** Interacción registrada.
```json
{
  "status": "success",
  "data": {
    "review_id": "review-uuid-5555",
    "action": "liked"
  }
}

```

*Nota: El campo `action` será `"liked"` o `"unliked"`.*

---

## 3. GET `/api/v1/social/feed`

**Descripción:** Devuelve la línea de tiempo cronológica de las personas a las que sigue el usuario actual. El backend resuelve esto leyendo la Lista de Redis (`user:feed:ID`) si el usuario es activo, o haciendo un query indexado si es pasivo.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Query Parameters:**
* `page` (integer, default `1`): Página actual para paginación infinita (*Infinite Scroll*).
* `limit` (integer, default `20`): Cantidad de items por página.


* **Respuestas:**
* **`200 OK`:** Retorna un array mixto de actividades (Registros de diario y Reseñas publicadas).
```json
{
  "status": "success",
  "pagination": {
    "current_page": 1,
    "has_next_page": true
  },
  "data": [
    {
      "activity_type": "watch_log",
      "id": "watch-log-uuid-9999",
      "user": {
        "id": "user-uuid-8888",
        "username": "rodrigo_dev",
        "avatar_url": "[https://api.binger.com/assets/avatars/rodrigo.webp](https://api.binger.com/assets/avatars/rodrigo.webp)"
      },
      "series": {
        "id": "series-uuid-7890",
        "title": "Severance"
      },
      "episode": {
        "season_number": 1,
        "episode_number": 9,
        "title": "The We We Are"
      },
      "is_rewatch": false,
      "created_at": "2026-05-20T14:15:00Z"
    },
    {
      "activity_type": "review",
      "id": "review-uuid-5555",
      "user": {
        "id": "user-uuid-1111",
        "username": "susan_prof",
        "avatar_url": "[https://api.binger.com/assets/avatars/susan.webp](https://api.binger.com/assets/avatars/susan.webp)"
      },
      "series": {
        "id": "series-uuid-3333",
        "title": "The Bear"
      },
      "rating": 5.0,
      "content": "A masterclass in tension and pacing.",
      "contains_spoilers": false,
      "likes_count": 42,
      "created_at": "2026-05-20T10:00:00Z"
    }
  ]
}

```

---

## 4. POST `/api/v1/social/lists`

**Descripción:** Crea una nueva lista personalizada de series vacía.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Body (Payload):**

```json
{
  "name": "Temporadas perfectas de inicio a fin",
  "description": "Series que no tienen ni un solo capítulo de relleno.",
  "is_private": false
}

```

* **Respuestas:**
* **`201 Created`:** Lista generada con éxito.
```json
{
  "status": "success",
  "data": {
    "list_id": "list-uuid-4444",
    "name": "Temporadas perfectas de inicio a fin",
    "is_private": false,
    "items_count": 0
  }
}

```

---

## 5. PUT `/api/v1/social/lists/:listId/items`

**Descripción:** Actualiza de forma masiva (Bulk) el contenido y el orden de una lista. Utiliza transacciones SQL para borrar los ítems anteriores y reinsertarlos con las nuevas posiciones asignadas por el comportamiento de *Drag and Drop* del cliente móvil.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `listId` (UUIDv4 de la lista).
* **Body (Payload):**

```json
{
  "items": [
    { "series_id": "series-uuid-7890", "position": 1 },
    { "series_id": "series-uuid-3333", "position": 2 },
    { "series_id": "series-uuid-9999", "position": 3 }
  ]
}

```

* **Respuestas:**
* **`200 OK`:** Lista sincronizada y reordenada correctamente.
```json
{
  "status": "success",
  "message": "List items updated and reordered successfully."
}

```

* **`403 Forbidden`:** El usuario intenta modificar una lista que no le pertenece.

```