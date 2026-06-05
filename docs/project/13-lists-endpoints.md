# Lists Endpoints (CRUD & Curation)

**Ruta base:** `/api/v1/lists`

Todos los endpoints requieren el token de acceso JWT (`Authenticate Middleware`).

## 1. Crear Lista
- **Método:** `POST`
- **Ruta:** `/`
- **Descripción:** Crea una nueva lista para el usuario autenticado.
- **Body:**
  ```json
  {
    "name": "Mis Favoritas",
    "description": "Las mejores series que he visto",
    "is_private": false
  }
  ```
- **Respuesta Exitosa (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "list_id": "uuid-here",
      "name": "Mis Favoritas",
      "is_private": false,
      "items_count": 0
    }
  }
  ```

## 2. Obtener Mis Listas
- **Método:** `GET`
- **Ruta:** `/me`
- **Query Params:** `?page=1&limit=20`
- **Descripción:** Devuelve las listas generadas por el perfil con `_count` de elementos.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "success",
    "pagination": {
      "current_page": 1,
      "has_next_page": false
    },
    "data": [
      {
        "id": "uuid-here",
        "name": "Mis Favoritas",
        "description": "Las mejores series que he visto",
        "is_private": false,
        "items_count": 5,
        "created_at": "...",
        "updated_at": "..."
      }
    ]
  }
  ```

## 3. Ver Detalle de Lista
- **Método:** `GET`
- **Ruta:** `/:listId`
- **Descripción:** (Soportado por **Redis Cache-Aside**). Obtiene el detalle de la lista y la colección de series ordenadas ascendentemente. Devuelve `403 Forbidden` si es privada y no pertenece al usuario.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Mis Favoritas",
      "description": "...",
      "is_private": false,
      "created_at": "...",
      "updated_at": "...",
      "items": [
        {
          "series_id": "uuid",
          "position": 1,
          "added_at": "...",
          "series": {
            "id": "uuid",
            "title": "Breaking Bad",
            "poster_url": "..."
          }
        }
      ]
    }
  }
  ```

## 4. Actualizar Metadatos
- **Método:** `PUT`
- **Ruta:** `/:listId`
- **Descripción:** Modifica metadatos (nombre, descripción o estatus de privacidad). Invalida la caché de Redis.
- **Body:**
  ```json
  {
    "name": "Mis Tops"
  }
  ```

## 5. Eliminar Lista
- **Método:** `DELETE`
- **Ruta:** `/:listId`
- **Descripción:** Borra permanentemente una lista y los list items (en cascada). Invalida la caché de Redis.
- **Respuesta Exitosa:** `204 No Content`

## 6. Actualizar Ítems de la Lista (Reorder Drag & Drop)
- **Método:** `PUT`
- **Ruta:** `/:listId/items`
- **Descripción:** Recibe el arreglo absoluto y ordenado de IDs y reemplaza atómicamente todos los elementos. Invalida la caché de Redis.
- **Body:**
  ```json
  {
    "items": [
      { "series_id": "uuid-1", "position": 1 },
      { "series_id": "uuid-2", "position": 2 }
    ]
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "success",
    "message": "List items updated and reordered successfully."
  }
  ```
