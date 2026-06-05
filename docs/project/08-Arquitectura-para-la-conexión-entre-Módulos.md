# Arquitectura para la conexión entre Módulos

Creada por: Santiago Perrotta
Hora de creación: 17 de mayo de 2026 12:27
Categoría: Arquitectura
Última edición por: Santiago Perrotta
Fecha de última actualización: 19 de mayo de 2026 12:33
Fecha de creación: 17 de mayo de 2026 12:27
Última edición: 19 de mayo de 2026 12:33

## 1. Arquitectura de Comunicación General (Estructura de Rutas)

Al trabajar con una arquitectura de **Monolito Modular**, no requerimos un servicio externo de *API Gateway* para enrutar el tráfico a servidores físicos diferentes. En su lugar, el mismo servidor de Node.js + Express actúa como el único punto de entrada unificado mediante un sistema de **Sub-enrutadores por Módulos**. Esto encapsula los puertos de manera interna y expone una única API limpia hacia la aplicación móvil.

### Tabla de Enrutamiento del Sistema

| **Método** | **Endpoint Base** | **Módulo Interno Destino** | **Propósito** |
| --- | --- | --- | --- |
| **POST** | `/api/v1/auth/*` | Módulo de Autenticación | Registro, Login, OAuth2 (Google), Recuperación |
| **GET** | `/api/v1/catalog/*` | Módulo de Catálogo | Buscador indexado, Detalles de Series, Tendencias |
| **POST/PUT** | `/api/v1/activity/*` | Módulo de Actividad y Diario | Registro de capítulos vistos, Watchlist, Reseñas |
| **GET/POST** | `/api/v1/social/*` | Módulo Social y de Listas | Feed dinámico, Seguir usuarios, Likes, Listas Curadas |

### Flujo de la Arquitectura Interna

1. El cliente móvil realiza todas sus peticiones HTTP a una única URL base (ej: `api.binger.com`).
2. El enrutador principal de Express intercepta la petición, ejecuta el middleware global de verificación de tokens JWT (validando la identidad a través de la lógica del módulo de autenticación) y redirige el control al submódulo correspondiente.
3. **Comunicación Basada en Eventos Internos:** Para evitar un acoplamiento rígido entre componentes, el monolito utiliza un emisor de eventos en memoria (como `EventEmitter` nativo de Node.js o colas internas con Redis/BullMQ).
    - *Ejemplo:* Cuando un usuario marca un capítulo como visto, el *Módulo de Actividad* procesa la escritura y publica un evento interno (`"episode.watched"`). El *Módulo Social* escucha este evento en segundo plano para actualizar los feeds de los seguidores de forma asíncrona, garantizando que la aplicación móvil responda al instante al usuario principal sin bloquear la petición.

---

## 2. Arquitectura del Backend (Node.js + Express)

Para asegurar que sea un monolito verdaderamente modular, cada componente del negocio debe estructurarse de forma que su lógica interna esté completamente aislada de los demás módulos, de la base de datos y de las APIs externas (como TVmaze). El acceso a la base de datos relacional (PostgreSQL) se maneja a través de capas lógicas bien definidas, permitiendo cambiar componentes de infraestructura en el futuro sin romper el resto de la aplicación.

### Árbol de Directorios del Proyecto

```
backend-service/
├── src/
│   ├── config/          # Parámetros globales, variables de entorno y conexiones (DB, Redis)
│   ├── constants/       # Códigos de error globales y valores inmutables del sistema
│   ├── middlewares/     # Interceptores (Seguridad JWT, control de roles, manejo de errores)
│   ├── utils/           # Funciones de soporte genéricas (Criptografía, formateadores)
│   ├── modules/         # El núcleo del Monolito Modular
│   │   ├── auth/        # Controladores, rutas y servicios de identidad
│   │   ├── catalog/     # Lógica de series, temporadas y capítulos
│   │   ├── ingestion/   # Tareas en segundo plano y conexión con la API externa (TVmaze)
│   │   ├── activity/    # Gestión del diario, logs de visualización y reseñas
│   │   └── social/      # Relaciones de seguimiento, likes y listas curadas
│   └── app.js           # Inicialización y configuración central de Express
├── package.json
└── server.js            # Punto de entrada de la aplicación
```

### Explicación detallada de las Capas y Carpetas:

- **`server.js` (Raíz):** Es el punto de entrada del proceso de Node.js. Se encarga de levantar el servidor HTTP, escuchar el puerto asignado e inicializar las conexiones críticas de infraestructura (PostgreSQL y la caché de Redis).
- **`src/app.js`:** Configura la instancia central de Express. Aquí se importan y configuran los middlewares globales (CORS, compresión, parseo de JSON, Rate Limiters) y se vinculan las rutas de los diferentes módulos alojados en `src/modules/`.
- **`src/config/`:** Almacena la configuración del entorno del sistema. Centraliza el acceso seguro a las variables de entorno (`process.env`), la inicialización del ORM (Prisma/Sequelize) y los parámetros de conexión para Redis o BullMQ.
- **`src/middlewares/`:** Contiene funciones globales que interceptan las peticiones HTTP antes de que toquen los módulos. Aquí viven el validador de sesiones de tokens JWT y el manejador global de excepciones del sistema.
- **`src/modules/` (Estructura Modular):** Es el corazón del backend. Cada subcarpeta (auth, catalog, etc.) funciona como un "mini-proyecto" independiente que encapsula su propia estructura interna:
    - **`routes/`:** Define exclusivamente los endpoints del módulo (ej: `router.post('/login')`) y delega el control al controlador. No contiene lógica de negocio.
    - **`controllers/`:** La capa de transporte del módulo. Recibe el `req` y `res` de Express, extrae los parámetros necesarios, invoca la lógica de negocio y retorna la respuesta HTTP correspondiente (`200 OK`, `400 Bad Request`, etc.).
    - **`services/` (Capa Core):** Aloja la lógica de negocio pura y dura. Es el cerebro del módulo; procesa datos, calcula estados y orquesta las reglas de la aplicación sin saber nada sobre los detalles de las peticiones HTTP.
    - **`repositories/` o `models/` (Capa de Datos):** Abstrae las consultas directas a la base de datos. Si un servicio requiere persistir o consultar datos de PostgreSQL, interactúa directamente con esta capa.

---

## 3. Arquitectura del Frontend (React Native + TypeScript)

En el cliente móvil, la estructura tradicional basada en tipos de archivos de forma global tiende a volverse caótica a medida que el sistema escala. Para mantener una total sincronía con el diseño modular del backend, implementaremos una **Estructura basada en Características (Feature-driven Structure)**. Esto agrupa todo el código por intenciones de negocio específicas, optimizando el desarrollo y facilitando el mantenimiento.

### Árbol de Directorios del Frontend

```
frontend-app/
├── src/
│   ├── assets/          # Imágenes locales, fuentes y placeholders visuales
│   ├── components/      # Componentes atómicos e interfaces reutilizables globalmente
│   ├── context/         # Estado global de la sesión (Autenticación, perfil y estadísticas)
│   ├── features/        # Módulos visuales alineados al negocio
│   │   ├── auth/        # Pantallas de login, registro y recuperación de cuenta
│   │   ├── catalog/     # Vistas de detalles de series, temporadas y buscador
│   │   ├── diary/       # Calendario cronológico y logs visuales de capítulos vistos
│   │   └── social/      # Feed comunitario de actividad, perfiles mutuos y listas
│   ├── hooks/           # Custom hooks utilitarios globales (useDebounce, useKeyboard)
│   ├── navigation/      # Enrutamiento de pantallas (AuthNavigator y App Bottom Tab Bar)
│   ├── services/        # Cliente Axios centralizado con interceptores automáticos de JWT
│   ├── theme/           # Paleta cinematográfica premium (Deep Midnight, Oro/Azul Eléctrico)
│   ├── utils/           # Validadores y formateadores de datos auxiliares
│   └── App.tsx          # Componente raíz de React Native
├── index.js
└── package.json
```

### Explicación detallada de las Carpetas del Cliente móvil:

- **`src/assets/`:** Almacena los recursos estáticos globales que se compilarán directamente en el binario de la aplicación, como fuentes tipográficas personalizadas, logotipos y las imágenes de marcador de posición (*placeholders* en formato WebP) para gestionar de forma fluida los posters que vengan caídos de la API externa.
- **`src/theme/`:** Centraliza las variables de diseño de la interfaz mediante Tailwind CSS (NativeWind). Aquí se configura la paleta cinematográfica premium seleccionada (ej: fondos oscuros de alta gama basados en azul de medianoche o grafito profundo, combinados con los sutiles acentos eléctricos o ámbar para calificaciones y estados activos), garantizando una consistencia visual inmediata y una interfaz de alto contraste óptima para pantallas OLED.
- **`src/navigation/`:** Centraliza la navegación estructural de la aplicación mediante React Navigation. Define flujos aislados como el `AuthNavigator` (para las pantallas previas al login) y el `AppNavigator`, el cual estructura el menú inferior (*Bottom Tab Bar*) para dar acceso directo al Home, Buscador, Diario y Perfil.
- **`src/components/`:** Aloja componentes de interfaz puramente atómicos y reutilizables en cualquier sección de la app que carecen de lógica de negocio propia (ej: botones personalizados con estados de carga, inputs de texto con estilos estilizados, loaders o esqueletos de carga).
- **`src/context/` o `store/`:** Gestiona el estado global de la aplicación (usando Zustand, Redux Toolkit o la Context API). Sincroniza datos transversales como el estado de autenticación del usuario, la información de su sesión y el caché rápido de contadores de estadísticas (minutos vistos, rachas de actividad) que se comparten entre el perfil y el home.
- **`src/services/`:** Configura el cliente HTTP centralizado (usando Axios). Define la URL única del monolito e inyecta un *interceptor* que adjunta de forma automática el token JWT en las cabeceras de cada petición saliente y orquesta el refresco transparente de la sesión si el Access Token expira.
- **`src/features/` (El Núcleo de la Aplicación):** Cada subcarpeta representa una vertical de negocio y encapsula de forma aislada sus propias pantallas (`screens/`), componentes UI locales (`components/`) y ganchos de datos específicos (`hooks/` o llamadas a endpoints del backend).
    - *Ejemplo de encapsulamiento:* Dentro de `features/diary/`, coexistirán `DiaryScreen.tsx` (pantalla cronológica principal), `CalendarWidget.tsx` (componente visual exclusivo para filtrar el diario) y el custom hook `useFetchDiary.ts` (encargado de consultar los capítulos vistos de un día en particular). Esto previene fugas de lógica y evita por completo contaminar o generar dependencias cruzadas en el resto del proyecto.