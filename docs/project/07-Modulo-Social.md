# Módulo Social

Este módulo maneja todas las interacciones de redes entre los perfiles de usuarios de la aplicación, controlando aspectos como seguidores, recomendaciones y el panel de actividad (Feed).

## Funcionalidades Principales

1. **Follow/Unfollow Toggles:**
   - Permite seguir o dejar de seguir a un usuario determinado interactuando a manera de "interruptor" (Toggle).
   - Se actualizan los conteos totales de `followers_count` y `following_count` de manera desfasada (asincrónica) en Redis.

2. **Likes en Reviews:**
   - Actúa de forma análoga a un Toggle. Un usuario solo puede dejar un `like` en un `Review` y volver a pulsarlo lo eliminará.
   - Incrementa un contador que permite a la aplicación posicionar reviews destacadas en un set de popularidad (`community:popular_reviews`) alojado en Redis cuando pasan cierta cuota.

3. **Activity Feed (Fan-out Híbrido):**
   El sistema maneja un híbrido para poblar el muro de un usuario en base a dos conceptos arquitectónicos de sistemas distribuidos:
   - **Usuarios Activos (Fan-out on Write):** A medida que los eventos de usuarios suceden (crear reseña o ver episodio), sus identificadores se envían activamente (Push) a una lista de Redis temporal de sus seguidores inmediatos activos, reduciendo el costo de consulta para la experiencia predeterminada de carga rápida.
   - **Usuarios Pasivos (Fan-out on Read):** Si la consulta excede la caché en Redis (paginaciones o usuarios que recién inician sesión luego de mucho tiempo), la base de datos se consulta explícitamente vía Pull desde PostgreSQL. Ambos resultados se ordenan cronológicamente.
