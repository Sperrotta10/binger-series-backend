# INSTRUCTIONS.md - Context & Repository Governance for AI Companions

Este documento establece las reglas de gobernanza, lectura y actualización de contexto para cualquier Inteligencia Artificial (Copilot, Cursor, LLMs externos) que asista en el desarrollo de **Binger**. 

El objetivo de esta estructura es optimizar el consumo de tokens, evitar la pérdida de memoria del proyecto y garantizar que el código se mantenga alineado con la arquitectura modular y la visión de diseño establecidas.

---

## 📂 Estructura de Documentación (`docs/`)

Para no saturar la ventana de contexto, no leas todo el repositorio. Guíate estrictamente por la jerarquía de la carpeta `docs/`:

```text
docs/
├── INSTRUCTIONS.md          # Este archivo (Reglas de gobernanza e indexación)
├── project/                 # MEMORIA A LARGO PLAZO (Inmutable a menos que cambie el diseño)
│   ├── 01_proposal.md       # Visión del producto, alcance del MVP y competidores
│   └── 02_architecture.md   # Monolito Modular, ruteo Express, e indexación de base de datos
└── history/                 # MEMORIA CRONOLÓGICA (Historial fragmentado por sesiones)
    ├── template_state.md    # PLANTILLA MAESTRA (Inmutable, sirve de molde para nuevos logs)
    ├── log_001_init.md      # Ejemplo de log histórico de la sesión 1 (Atómico y corto)
    └── log_002_xyz.md       # Ejemplo de log histórico de la sesión 2
└── reference/               # RECURSOS DE APOYO (Esquemas, payloads de APIs y contratos)
    ├── tvmaze_payloads.json # Respuestas de ejemplo de la API externa
    └── database_schema.sql  # Estructura física de las tablas y sus índices compuestos
```

---

## 🛠️ Reglas de Actuación para la IA

### 1. Fase de Lectura (Antes de Escribir Código)

* **Paso Obligatorio 1:** Revisa los últimos 2 o 3 archivos de tipo log_XXX_*.md dentro de docs/history/ ordenados por número para entender exactamente en qué punto encalla el código actual y qué se intentó hacer en la última sesión.
* **Paso Obligatorio 2:** Si la tarea implica modificar la estructura de un módulo o crear un nuevo endpoint, consulta `docs/project/02_architecture.md` para asegurar que respetas el patrón de **Monolito Modular** y la arquitectura de capas (Routes -> Controllers -> Services -> Repositories).

### 2. Estilo de Código y Buenas Prácticas

* **Backend (Node.js + Express):** Código asíncrono estricto (`async/await`), manejo global de excepciones mediante middlewares, y desacoplamiento de lógica de negocio en la capa de servicios.

### 3. Fase de Cierre (Creación del Historial Inmutable)

Al finalizar con éxito una sesión de trabajo, **no debes sobreescribir un archivo existente**. Debes crear un documento nuevo siguiendo estrictamente estos pasos:

1. Lee la plantilla base ubicada en `docs/history/template_state.md`.
2. Identifica el número de secuencia correspondiente para el nuevo archivo (ej: si el último es `log_002`, el tuyo será `log_003_nombre_corto_de_la_tarea.md`).
3. Genera el nuevo archivo rellenando la plantilla con el contexto real de lo que acabas de programar.
4. **Regla de Oro:** Cada archivo de log debe ser conciso (máximo 1 página) para optimizar la lectura y no inflar el consumo de tokens en el futuro.