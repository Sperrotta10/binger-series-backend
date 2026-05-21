# Idea del Proyecto

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:44
Categoría: Propuesta
Última edición por: Santiago Perrotta
Fecha de última actualización: 17 de mayo de 2026 12:55
Fecha de creación: 17 de mayo de 2026 12:44
Última edición: 17 de mayo de 2026 12:55

# **PROPUESTA DE PROYECTO: "Binger"**

**Plataforma Social de Gestión, Registro y Descubrimiento de Series de Televisión**

---

# **1. Descripción del Proyecto**

**Binger** es una plataforma móvil orientada a la comunidad y a la gamificación, inspirada en el exitoso modelo de *Letterboxd*, pero diseñada exclusivamente para el formato y la dinámica de las series de televisión.

A diferencia de las plataformas tradicionales de bases de datos cinematográficas, que suelen ser poco intuitivas y rígidas en el ámbito de la televisión, **Binger** resuelve la necesidad de los usuarios de llevar un control detallado, visual y cronológico de su consumo diario de televisión. La aplicación permitirá rastrear episodios individuales, calificar temporadas completas, escribir reseñas detalladas con control de spoilers, interactuar con otros usuarios a través de un *feed* social dinámico y generar estadísticas personalizadas sobre el tiempo invertido en la plataforma.

### **El Problema de los Datos (Solución de Costo Cero)**

Para garantizar la viabilidad comercial y económica del proyecto desde su fase de Producto Mínimo Viable (MVP) sin incurrir en los altos costos de licencias comerciales de plataformas como TMDB, el sistema utilizará la **API de TVmaze**. Esta API es totalmente gratuita para uso comercial bajo atribución y está optimizada específicamente para el formato episódico. Los datos se consumirán de forma progresiva y se almacenarán en una infraestructura híbrida de caché y base de datos local para minimizar las peticiones externas y garantizar la independencia del sistema.

---

# **2. Características Clave del Sistema**

- **El Diario (*Diary*):** Un calendario visual donde el usuario registra qué capítulos específicos vio cada día, permitiendo marcar visualizaciones repetidas (*rewatches*).
- **Gamificación y Estadísticas:** Cálculo en tiempo real de rachas de días activos (*streaks*), minutos totales de televisión consumidos y gráficos de barras por días de la semana o meses.
- **Reseñas Flexibles:** Capacidad de calificar (escala de 5 estrellas con incrementos de 0.5) y escribir críticas tanto de series completas como de temporadas específicas, incluyendo etiquetas de advertencia de *spoilers*.
- **Capa Social Activa:** Capacidad de seguir a otros usuarios, interactuar mediante un *feed* cronológico con la actividad de amigos y dar "Me gusta" a sus reseñas.
- **Listas Curadas:** Herramienta para crear colecciones personalizadas de series (públicas o privadas) con ordenamiento posicional dinámico.

---

# 3. Stack Tecnológico

### Frontend (Aplicación Móvil)

- **Framework principal:** **React Native** (con TypeScript para robustez en el tipado). Permite un desarrollo ágil multiplataforma (iOS y Android) compartiendo una única base de código.
- **Gestión de Estado:** **Redux Toolkit** o **Zustand**, para manejar de manera eficiente la caché local de la app, el estado de autenticación y la sincronización de la actividad del usuario.
- **Estilos y Componentes:** **Tailwind CSS (NativeWind)**, asegurando una interfaz minimalista, limpia, oscura y altamente scannable al estilo Letterboxd.

### Backend (Capa de Servicios)

- **Entorno de Ejecución y Framework:** **Node.js con Express**. Se estructurará bajo una Arquitectura Limpia (*Clean Architecture*) dividida en controladores, servicios y repositorios independientes.
- **Pasarela de Entrada:** **API Gateway** para centralizar el enrutamiento de peticiones del cliente, control de tráfico (*rate limiting*) y la inyección del middleware de autenticación.

### **Almacenamiento y Gestión de Datos**

- **Base de Datos Relacional:** **PostgreSQL con Supabase**. Ideal para garantizar la integridad referencial de datos complejos (Usuarios —>  Logs de Visualización  —> Capítulos —> Temporadas —> Series).
- **Capa de Caché y Colas:** **Redis**. Utilizado en doble funcionalidad:
    - Como caché en memoria para las series y búsquedas más populares del *Catalog Service*.
    - Como motor para **BullMQ** para gestionar la cola de tareas en segundo plano del servicio de ingesta de datos.
- **ORM / Query Builder:** **Prisma** o **Sequelize** para agilizar las migraciones y consultas seguras a PostgreSQL.

### Infraestructura y Comunicación entre Módulos

- **Comunicación Síncrona:** **HTTP/REST** con tokens **JWT** (Access Token de corta duración y Refresh Tokens seguros) para la autenticación y peticiones directas.
- **Comunicación Asíncrona (Event-Driven):** **RabbitMQ** o eventos internos de Redis para notificar acciones entre servicios (por ejemplo, cuando el servicio de actividad detecta que un usuario vio un capítulo, emite un evento para que el servicio social actualice el feed de sus seguidores).

---

# 4. Módulos del Ecosistema Backend

1. **Auth Service:** Administra el registro, inicio de sesión (local y mediante **Google Sign-In**) y el flujo criptográfico seguro de recuperación de contraseñas expirables por correo electrónico.
2. **Catalog Service:** Sirve la información de las series estructuradas desde la base de datos local. Almacena en caché los resultados de búsqueda para mitigar la latencia.
3. **Ingestion Worker:** Microservicio en segundo plano dedicado exclusivamente a conectarse con la API externa de TVmaze. Pobla la base de datos local bajo demanda y ejecuta un proceso automatizado (*Cron Job*) cada madrugada para sincronizar los capítulos nuevos emitidos en el mundo.
4. **Activity & Diary Service:** Gestiona el flujo continuo de escrituras del usuario: inserciones en el diario, creación de reseñas, calificaciones y la actualización de su lista de seguimiento (*Watchlist*).
5. **Social & List Service:** Procesa las relaciones de seguimiento (*follows*), los "Me gusta" de la comunidad y la creación de listas personalizadas de series.