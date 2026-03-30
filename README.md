# Article Manager — Extensión de Chrome

Una extensión de Chrome para **gestionar, catalogar y analizar artículos web, newsletters y blogs**. Diseñada para investigadores y lectores que necesitan organizar contenido web con subrayados persistentes, notas in-situ e integración con inteligencia artificial.

---

## Características

- **Guardar artículos** — Guarda cualquier URL con un clic desde el menú contextual.
- **Subrayado persistente** — Selecciona texto, elige un color y el subrayado persiste entre visitas.
- **Notas in-situ** — Adjunta notas a cada subrayado directamente sobre la página, sin salir de ella.
- **Dashboard completo** — Vista a pantalla completa para catalogar artículos por estado (sin leer, leyendo, leído) y carpetas personalizadas.

---

## Tech Stack

| Capa | Tecnología |
|---|---|
| Framework UI | React 18 |
| Lenguaje | TypeScript (strict mode) |
| Build tool | Vite + `@crxjs/vite-plugin` |
| Estilos | Tailwind CSS v3 |
| Almacenamiento | Chrome Storage API |

---

## Arquitectura

La extensión sigue una arquitectura de tres capas que se comunican exclusivamente vía `chrome.runtime.sendMessage`:

```
┌─────────────────────────────────────────────────────────────┐
│  Background Service Worker                                  │
│  · Orquesta toda la lógica de negocio                       │
│  · Único que escribe en chrome.storage                      │
│  · Gestiona llamadas a Gemini API                           │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                ▼                         ▼
┌───────────────────────┐   ┌─────────────────────────────────┐
│  Content Script       │   │  Dashboard (React SPA)          │
│  · Subrayados en DOM  │   │  · Gestión de artículos         │
│  · Tooltip Shadow DOM │   │  · Carpetas y estados           │
└───────────────────────┘   └─────────────────────────────────┘
```

---

## Estructura del Proyecto

```
src/
├── background/       # Service Worker principal
├── content/          # Content Script (highlighter + tooltip)
├── dashboard/        # React SPA del Dashboard
│   └── components/   # ArticleList, FolderPanel, NoteViewer
└── shared/           # Tipos, mensajes y helpers compartidos
```

---

## Instalación y Desarrollo

### Requisitos

- Node.js 18+
- Google Chrome

### Pasos

```bash
# Instalar dependencias
npm install

# Build de desarrollo (con hot-reload)
npm run dev

# Build de producción
npm run build
```

### Cargar en Chrome

1. Ejecuta `npm run build`.
2. Abre Chrome y ve a `chrome://extensions`.
3. Activa el **Modo desarrollador**.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta `dist/`.

---

## Estado del Proyecto

| Fase | Descripción | Estado |
|---|---|---|
| Fase 0 | Scaffolding, tipos y configuración base | ✅ Completada |
| Fase 1 | Subrayado persistente y storage | ✅ Completada |
| Fase 2 | Dashboard base | ✅ Completada |
| Fase 3 | Notas in-situ | ✅ Completada |

---

## Licencia

MIT
