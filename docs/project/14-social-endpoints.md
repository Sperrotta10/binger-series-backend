# Social Endpoints

**Ruta base:** `/api/v1/social`

Todos los endpoints requieren autenticación (JWT).

## 1. Toggle Follow/Unfollow
- **Método:** `POST`
- **Ruta:** `/follow/toggle`
- **Descripción:** Comienza o deja de seguir a un perfil objetivo. Modifica Redis asincrónicamente para mantener los conteos generales.
- **Body:**
  ```json
  {
    "target_user_id": "uuid-here"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "action": "followed",
      "target_user_id": "uuid-here"
    }
  }
  ```

## 2. Toggle Like Review
- **Método:** `POST`
- **Ruta:** `/reviews/:reviewId/like/toggle`
- **Descripción:** Aplica o elimina un Like a la reseña referenciada.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "action": "liked",
      "review_id": "uuid-here"
    }
  }
  ```

## 3. Activity Feed Híbrido
- **Método:** `GET`
- **Ruta:** `/feed`
- **Query Params:** `?page=1&limit=20`
- **Descripción:** Genera el Feed personal de un usuario interceptando datos pre-calculados (Fan-out on Write de Redis) y combinándolos con consultas manuales (Fan-out on Read en DB) para usuarios inactivos.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "success",
    "pagination": {
      "current_page": 1,
      "has_next_page": true
    },
    "data": [
      {
        "activity_type": "review",
        "id": "uuid",
        "user": {
          "id": "uuid",
          "username": "...",
          "avatar_url": "..."
        },
        "series": {
          "id": "uuid",
          "title": "Mr. Robot"
        },
        "rating": 5.0,
        "content": "A masterpiece",
        "contains_spoilers": false,
        "likes_count": 0,
        "created_at": "..."
      }
    ]
  }
  ```
