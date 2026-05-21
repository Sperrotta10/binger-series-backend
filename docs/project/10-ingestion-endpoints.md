# API Contracts: Módulo 3 - Sincronización Externa (Ingestion Worker)

Este documento define las interfaces de comunicación y los contratos de carga para el módulo de Ingestión de **Binger**. Centraliza la lógica asíncrona de comunicación con TVmaze utilizando BullMQ para garantizar la resiliencia del sistema.

---

## 1. POST `/api/v1/ingestion/trigger`
**Descripción:** Endpoint de uso estrictamente interno (inter-módulo). Es invocado de forma asíncrona por el *Módulo de Catálogo* cuando un usuario busca una serie que no existe en la base de datos local. Inserta un trabajo (*Job*) en la cola de Redis de manera inmediata.

* **Headers:** * `Content-Type: application/json`
  * `X-Internal-Secret: <api_secret_token>` (Middleware de seguridad para evitar ejecuciones externas)
* **Body (Payload):**
```json
{
  "external_source": "tvmaze",
  "external_id": 431,
  "series_title": "Succession"
}

```

* **Respuestas:**
* **`202 Accepted`:** El trabajo ha sido encolado con éxito en BullMQ bajo la cola `ingestion:series:import`. El cliente no espera a que termine la descarga; el backend responde al instante.
```json
{
  "status": "success",
  "message": "Import job successfully enqueued",
  "data": {
    "job_id": "bull:ingestion:series:import:105",
    "status": "queued",
    "timestamp": 1779282000000
  }
}

```

* **`401 Unauthorized`:** Token secreto interno inválido o ausente.
* **`409 Conflict`:** Ya existe un trabajo activo en la cola procesando ese mismo `external_id`.

---

## 2. Estructura Interna del Job Payload (BullMQ)

**Descripción:** Contrato de datos que maneja el Worker de Node.js de forma interna cuando saca un elemento de la cola de Redis para procesarlo.

* **Queue Name:** `ingestion:series:import`
* **Data Object (Contexto de procesamiento):**

```json
{
  "jobId": "105",
  "attemptsMade": 0,
  "data": {
    "externalId": 431,
    "targetTables": ["series", "seasons", "episodes"]
  }
}

```

---

## 3. Contrato de Mapeo Inter-API (TVmaze JSON a Binger DB)

**Descripción:** Estructura técnica de normalización de datos. Define cómo el Worker transforma la respuesta cruda de TVmaze antes de ejecutar el *Bulk Insert* en PostgreSQL.

* **Payload de Entrada (Ejemplo recortado de TVmaze API):**

```json
{
  "id": 431,
  "name": "Succession",
  "status": "Ended",
  "premiered": "2018-06-03",
  "genres": ["Drama"],
  "summary": "<p>The Logan family is known for controlling...</p>",
  "image": {
    "medium": "[http://static.tvmaze.com/...medium.jpg](http://static.tvmaze.com/...medium.jpg)",
    "original": "[http://static.tvmaze.com/...original.jpg](http://static.tvmaze.com/...original.jpg)"
  }
}

```

* **Objeto Mapeado de Salida (Guardado Directo en PostgreSQL):**

```json
{
  "id": "uuid-generado-por-backend",
  "tvmaze_id": 431,
  "title": "Succession",
  "status": "Ended",
  "premiered": "2018-06-03",
  "genres": ["Drama"],
  "summary": "The Logan family is known for controlling...", 
  "poster_url": "[https://api.binger.com/assets/posters/succession.webp](https://api.binger.com/assets/posters/succession.webp)",
  "backdrop_url": "[https://api.binger.com/assets/backdrops/succession_bg.webp](https://api.binger.com/assets/backdrops/succession_bg.webp)"
}

```

*Nota: El Worker limpia las etiquetas HTML `<p>` del summary usando expresiones regulares y descarga/optimiza las imágenes a formato WebP de manera asíncrona.*

---

## 4. POST `/api/v1/ingestion/cron/daily-sync`

**Descripción:** Endpoint expuesto únicamente para ser disparado por un *Cron Job* del sistema operativo o un planificador en la nube cada madrugada (03:00 AM). Busca novedades de capítulos de series en emisión.

* **Headers:** `X-Internal-Secret: <api_secret_token>`
* **Body:** Vacío.
* **Respuestas:**
* **`200 OK`:** Sincronización iniciada. El Worker consulta el endpoint `/updates/shows` de TVmaze del día anterior y encola las series que requieran actualización.
```json
{
  "status": "success",
  "message": "Daily catalog synchronization triggered",
  "data": {
    "affected_shows_found": 14
  }
}

```