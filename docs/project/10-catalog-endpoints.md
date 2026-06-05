# API Contracts: Módulo 2 - Catálogo y Contenido

Este documento define el contrato estricto de los endpoints para el módulo de Catálogo de **Binger**. Todas las consultas implementan estrategias de optimización mediante Redis para garantizar respuestas inferiores a los 5ms en el cliente móvil.

---

## 1. GET `/api/v1/catalog/series/:id`
**Descripción:** Obtiene el detalle de una serie específica. Aplica una estrategia de Caché Read-Through: si los datos no están en Redis, los busca en PostgreSQL, los serializa en caché con un tiempo de expiración (TTL) de 24 horas y los retorna.

* **Headers:** `Authorization: Bearer <accessToken>` (Opcional, pero necesario para inyectar si el usuario tiene esta serie en su Watchlist).
* **Params:** `id` (UUIDv4 de la serie).
* **Respuestas:**
  * **`200 OK`:** Retorna el objeto detallado de la serie.
    ```json
    {
      "status": "success",
      "data": {
        "id": "789e4567-e89b-12d3-a456-426614174000",
        "title": "Succession",
        "summary": "The Logan family is known for controlling the biggest media and entertainment company in the world...",
        "premiered": "2018-06-03",
        "status": "Ended",
        "genres": ["Drama" , "Enterprise"],
        "rating_average": 4.7,
        "poster_url": "[https://api.binger.com/assets/posters/succession.webp](https://api.binger.com/assets/posters/succession.webp)",
        "backdrop_url": "[https://api.binger.com/assets/backdrops/succession_bg.webp](https://api.binger.com/assets/backdrops/succession_bg.webp)",
        "total_seasons": 4,
        "in_watchlist": true
      }
    }
    ```
  * **`404 Not Found`:** El ID no existe en la base de datos local. (Este error dispara de forma interna y asíncrona una tarea hacia el módulo de Ingestión para validar si existe en TVmaze).

---

## 2. GET `/api/v1/catalog/series/:id/seasons`
**Descripción:** Lista todas las temporadas pertenecientes a una serie con sus respectivos contadores de episodios para armar los selectores dinámicos en el frontend.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `id` (UUIDv4 de la serie).
* **Respuestas:**
  * **`200 OK`:** Array de temporadas ordenadas ascendentemente.
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": "season-uuid-1",
          "number": 1,
          "episode_count": 10,
          "premiere_date": "2018-06-03"
        },
        {
          "id": "season-uuid-2",
          "number": 2,
          "episode_count": 10,
          "premiere_date": "2019-08-11"
        }
      ]
    }
    ```

---

## 3. GET `/api/v1/catalog/seasons/:seasonId/episodes`
**Descripción:** Obtiene la lista completa de episodios de una temporada específica para desplegar el menú colapsable en la vista de registro.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Params:** `seasonId` (UUIDv4 de la temporada).
* **Respuestas:**
  * **`200 OK`:** Lista de episodios estructurada.
    ```json
    {
      "status": "success",
      "data": [
        {
          "id": "episode-uuid-1",
          "number": 1,
          "title": "Celebration",
          "runtime": 60,
          "airdate": "2018-06-03",
          "summary": "On his 80th birthday, media tycoon Logan Roy shocks his family..."
        }
      ]
    }
    ```

---

## 4. GET `/api/v1/catalog/search`
**Descripción:** Buscador indexado interno de la aplicación. Filtra por título y permite segmentar opcionalmente por género o año. Los resultados exactos frecuentes se almacenan en un string de Redis por 10 minutos.

* **Query Parameters:**
  * `q` (string, obligatorio): Término de búsqueda (ej: `?q=breaking`).
  * `genre` (string, opcional): Filtrar por categoría (ej: `&genre=Drama`).
  * `year` (integer, opcional): Año de estreno (ej: `&year=2008`).
* **Respuestas:**
  * **`200 OK`:** Array con coincidencias optimizadas para autocompletado en React Native.
    ```json
    {
      "status": "success",
      "results_count": 1,
      "data": [
        {
          "id": "breaking-bad-uuid",
          "title": "Breaking Bad",
          "premiered": "2008-01-20",
          "poster_url": "[https://api.binger.com/assets/posters/breaking_bad.webp](https://api.binger.com/assets/posters/breaking_bad.webp)",
          "rating_average": 4.9
        }
      ]
    }
    ```

---

## 5. GET `/api/v1/catalog/trending`
**Descripción:** Construye el feed de la pantalla de inicio obteniendo los 20 elementos con mayor puntuación en el Sorted Set de Redis (`series:popular:week`). Resuelve las tendencias globales al instante sin realizar un solo `JOIN` analítico en PostgreSQL.

* **Headers:** `Authorization: Bearer <accessToken>`
* **Respuestas:**
  * **`200 OK`:** Retorna el listado de las 20 series del momento con su metadata base comprimida para ahorrar ancho de banda.
    ```json
    {
      "status": "success",
      "timeframe": "weekly",
      "data": [
        {
          "id": "789e4567-e89b-12d3-a456-426614174000",
          "title": "Succession",
          "poster_url": "[https://api.binger.com/assets/posters/succession.webp](https://api.binger.com/assets/posters/succession.webp)",
          "rating_average": 4.7,
          "weekly_views_count": 1420
        }
      ]
    }
    ```