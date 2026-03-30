# CLAUDE.md — Gestor de Artículos (Chrome Extension)

## 1. Contexto del Proyecto

Eres un desarrollador Senior Full-Stack especializado en extensiones de Chrome (Manifest V3) y arquitecturas Frontend modernas.

El objetivo es construir desde cero una extensión de Chrome para **gestionar, catalogar y analizar artículos web, newsletters y blogs**. El usuario la utiliza para investigar temas complejos: puede guardar URLs, subrayar texto in-situ con colores, adjuntar notas a subrayados y organizar todo desde un Dashboard a pantalla completa. La extensión también se integra con Gemini AI para análisis de texto seleccionado.

---

## 2. Tech Stack

| Capa | Tecnología |
|---|---|
| Framework UI | React 18 |
| Lenguaje | TypeScript (strict mode) |
| Build tool | Vite + `@crxjs/vite-plugin` |
| Estilos | Tailwind CSS v3 |
| Almacenamiento | Chrome Storage API (`chrome.storage.local`) |
| IA | Google Gemini API (vía `fetch` directo desde Background SW) |
| Linting | ESLint + Prettier |

**Restricciones de dependencias:**
- NO usar librerías de componentes UI externas (shadcn, MUI, Radix, etc.). Solo Tailwind + componentes propios.
- NO usar React Context API para estado global. Usar props drilling o un store minimalista si es necesario.
- NO usar React Router. El Dashboard es una SPA sin rutas; el estado de navegación interna se maneja con `useState`.
- NO usar `any` en TypeScript. Siempre tipar explícitamente.
- NO usar `enum` de TypeScript. Usar `as const` en su lugar (ver sección 8). El proyecto tiene `erasableSyntaxOnly` activo en TypeScript 5.8+.

---

## 3. Arquitectura de la Extensión

La extensión tiene **tres componentes** que se comunican exclusivamente vía `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`. No hay comunicación directa entre Content Script y Dashboard.

```
┌─────────────────────────────────────────────────────────────┐
│  Background Service Worker (background.ts)                  │
│  · Orquesta toda la lógica de negocio                       │
│  · Único que escribe en chrome.storage                      │
│  · Gestiona llamadas a Gemini API                           │
│  · Maneja chrome.action.onClicked y contextMenus            │
└───────────────┬─────────────────────────┬───────────────────┘
                │ sendMessage             │ sendMessage
                ▼                         ▼
┌───────────────────────┐   ┌─────────────────────────────────┐
│  Content Script       │   │  Dashboard (dashboard.html)     │
│  (content.ts)         │   │  React SPA a pantalla completa  │
│  · Lee DOM            │   │  · Solo lectura de storage      │
│  · Pinta subrayados   │   │  · Envía acciones al Background  │
│  · Shadow DOM tooltips│   │  · NO escribe storage directo   │
└───────────────────────┘   └─────────────────────────────────┘
```

### 3.1 Background Service Worker
- Único punto de escritura en `chrome.storage.local`.
- Registra el menú contextual al instalarse (`chrome.runtime.onInstalled`).
- Abre `dashboard.html` en nueva pestaña al hacer clic en el ícono.
- Recibe mensajes de Content Script y Dashboard, los procesa y responde.

### 3.2 Content Script
- Inyectado en `<all_urls>` con `document_idle`.
- Lee `chrome.storage.local` solo para **pintar** subrayados existentes al cargar la página.
- Para cualquier escritura, envía un mensaje al Background y espera respuesta.
- Toda UI flotante (tooltip de notas) se monta dentro de un **Shadow DOM** para evitar colisión de estilos con la página host.

### 3.3 Dashboard
- Archivo de entrada: `src/dashboard/index.tsx` → genera `dashboard.html`.
- Lee `chrome.storage.local` directamente solo para mostrar datos.
- Para mutaciones (crear carpeta, cambiar estado, borrar artículo), siempre envía mensaje al Background.

---

## 4. Estructura de Carpetas

```
/
├── public/
│   └── icons/                  # icon-16.png, icon-48.png, icon-128.png
├── src/
│   ├── background/
│   │   └── index.ts            # Service Worker principal
│   ├── content/
│   │   ├── index.ts            # Entry point del Content Script
│   │   ├── highlighter.ts      # Lógica de subrayado y re-pintura
│   │   └── tooltip.ts          # Shadow DOM para notas in-situ
│   ├── dashboard/
│   │   ├── index.tsx           # Entry point React del Dashboard
│   │   ├── App.tsx             # Componente raíz
│   │   └── components/         # Componentes React del Dashboard
│   │       ├── ArticleList.tsx
│   │       ├── FolderPanel.tsx
│   │       └── NoteViewer.tsx
│   ├── shared/
│   │   ├── types.ts            # TODAS las interfaces TypeScript
│   │   ├── messages.ts         # Tipos de mensajes entre componentes
│   │   └── storage.ts          # Helpers de lectura de storage
│   └── styles/
│       └── tailwind.css
├── manifest.json
├── vite.config.ts
├── tsconfig.json
└── CLAUDE.md
```

**Regla:** Cualquier tipo, interfaz o constante que sea usado por más de un componente vive en `src/shared/types.ts`. Nunca duplicar tipos.

---

## 5. Convenciones de Código

### Nombrado
| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes React | PascalCase | `ArticleCard.tsx` |
| Hooks | camelCase con prefijo `use` | `useArticles.ts` |
| Funciones utilitarias | camelCase | `formatDate.ts` |
| Constantes globales | UPPER_SNAKE_CASE | `MAX_HIGHLIGHTS` |
| Tipos e interfaces | PascalCase | `Article`, `IStorageSchema` |
| Archivos de tipos | `types.ts` centralizado en `shared/` | |
| Mensajes entre componentes | `as const` + tipo derivado (ver sección 8) | `MessageType.SAVE_HIGHLIGHT` |

### Estilo de código
- Funciones flecha para componentes React: `const MyComponent = () => { ... }`.
- Siempre exportar con `export` nombrado, no `export default` (excepto en entry points de React como `App.tsx`).
- Comentarios en español. Nombres de variables y funciones en inglés. Textos de UI en español.
- Máximo 80 caracteres por línea.
- Siempre manejar el caso de error en `chrome.runtime.sendMessage` chequeando `chrome.runtime.lastError`.
- **Nunca usar `enum`**. Siempre usar `as const` (ver sección 8).

---

## 6. Interfaces TypeScript Base (`src/shared/types.ts`)

```typescript
// src/shared/types.ts

export type ReadStatus = 'unread' | 'reading' | 'read';
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';
export type FolderId = string;

export interface Article {
  id: string;
  url: string;
  title: string;
  domain: string;
  savedAt: number;
  status: ReadStatus;
  folderId: FolderId | null;
  highlights: Highlight[];
}

export interface Highlight {
  id: string;
  articleId: string;
  color: HighlightColor;
  selectedText: string;
  anchorStrategy: 'text-context' | 'xpath';
  anchor: TextContextAnchor | XPathAnchor;
  note: string | null;
  createdAt: number;
  geminiAnalysis: string | null;
}

export interface TextContextAnchor {
  type: 'text-context';
  prefix: string;
  exact: string;
  suffix: string;
}

export interface XPathAnchor {
  type: 'xpath';
  xpath: string;
  startOffset: number;
  endOffset: number;
}

export interface Folder {
  id: FolderId;
  name: string;
  createdAt: number;
  color: string;
}

export interface AppSettings {
  defaultHighlightColor: HighlightColor;
  geminiApiKey: string | null;
}

export interface IStorageSchema {
  articles: Record<string, Article>;
  folders: Record<string, Folder>;
  settings: AppSettings;
}
```

---

## 7. Esquema de Almacenamiento (`chrome.storage.local`)

Todo el estado persiste en un único objeto raíz para minimizar operaciones de I/O:

```typescript
// Estructura en storage:
// {
//   articles: Record<string, Article>,
//   folders:  Record<string, Folder>,
//   settings: AppSettings
// }
```

**Reglas de storage:**
- Siempre leer con `chrome.storage.local.get(null)` para obtener el schema completo, nunca por claves individuales (evita inconsistencias).
- Siempre escribir con `chrome.storage.local.set({ ...existingData, [key]: newValue })` para no sobreescribir otras claves.
- El Background es el **único** componente que ejecuta `.set()`. Content Script y Dashboard solo usan `.get()` para leer.
- Al inicializar la extensión (`chrome.runtime.onInstalled`), el Background escribe el schema vacío si no existe:
  ```typescript
  { articles: {}, folders: {}, settings: { defaultHighlightColor: 'yellow', geminiApiKey: null } }
  ```

---

## 8. Sistema de Mensajes (`src/shared/messages.ts`)

**IMPORTANTE:** No usar `enum`. Usar `as const` para compatibilidad con `erasableSyntaxOnly` (TypeScript 5.8+).

```typescript
// src/shared/messages.ts

export const MessageType = {
  // Content Script → Background
  SAVE_ARTICLE:           'SAVE_ARTICLE',
  SAVE_HIGHLIGHT:         'SAVE_HIGHLIGHT',
  UPDATE_HIGHLIGHT_NOTE:  'UPDATE_HIGHLIGHT_NOTE',
  DELETE_HIGHLIGHT:       'DELETE_HIGHLIGHT',
  ANALYZE_WITH_GEMINI:    'ANALYZE_WITH_GEMINI',

  // Dashboard → Background
  CREATE_FOLDER:          'CREATE_FOLDER',
  DELETE_FOLDER:          'DELETE_FOLDER',
  MOVE_ARTICLE:           'MOVE_ARTICLE',
  UPDATE_ARTICLE_STATUS:  'UPDATE_ARTICLE_STATUS',
  DELETE_ARTICLE:         'DELETE_ARTICLE',
  SAVE_API_KEY:           'SAVE_API_KEY',

  // Background → cualquiera (respuestas)
  SUCCESS:                'SUCCESS',
  ERROR:                  'ERROR',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 9. Funcionalidades Core

### F1 — Subrayado Persistente
- Usuario selecciona texto → clic derecho → elige color en el menú contextual.
- Content Script captura la selección y construye el `anchor` (preferir `text-context`, fallback a `xpath`).
- Envía `SAVE_HIGHLIGHT` al Background. El Background persiste y responde con el `Highlight` creado.
- Al cargar cualquier página, el Content Script llama `chrome.storage.local.get(null)`, filtra los highlights de esa URL y los vuelve a pintar en el DOM.

### F2 — Notas in-situ
- Hover sobre texto subrayado → aparece tooltip en Shadow DOM con el contenido de `highlight.note`.
- Click en el tooltip → modo edición. Al guardar, envía `UPDATE_HIGHLIGHT_NOTE` al Background.

### F3 — Dashboard (Catalogación)
- SPA React en `dashboard.html`. Vista principal: lista de artículos con filtros por estado y carpeta.
- Operaciones: crear/renombrar/eliminar carpetas, mover artículos, cambiar `ReadStatus`, eliminar artículos.
- Todas las mutaciones van vía mensaje al Background.

### F4 — Gemini AI
- Menú contextual incluye opción "Analizar con IA".
- Content Script envía `ANALYZE_WITH_GEMINI` con el texto seleccionado.
- Background llama a la API de Gemini y guarda la respuesta en `highlight.geminiAnalysis`.
- El resultado se muestra en el tooltip del subrayado correspondiente.

---

## 10. Instrucciones de Ejecución por Fases

### FASE 0 — Scaffolding ✅ COMPLETADA
Estructura de carpetas creada, `manifest.json`, `vite.config.ts`, `tsconfig.json` en strict mode y los archivos `src/shared/types.ts` y `src/shared/messages.ts` con todas las interfaces.

**Siguiente tarea de esta fase:**
1. Configurar entry points en `vite.config.ts` para generar `dashboard.html` con React.
2. Implementar `src/dashboard/index.tsx` y `src/dashboard/App.tsx` con un "Hola Mundo".
3. Implementar `src/background/index.ts`: abrir `dashboard.html` al hacer clic en el ícono.
4. Implementar lógica inicial del menú contextual: al seleccionar texto y usar el menú, el Content Script cambia temporalmente el color del texto en el DOM (sin persistencia).

### FASE 1 — Subrayado Persistente + Storage
Implementar F1 completo: captura de selección, construcción del anchor, persistencia en storage y re-pintura al recargar. Incluir el esquema de storage inicial.

### FASE 2 — Dashboard Base
Implementar F3: React SPA con lista de artículos, panel de carpetas y cambio de estado. Sin integración AI aún.

### FASE 3 — Notas in-situ
Implementar F2: Shadow DOM tooltip, lectura y escritura de notas.

### FASE 4 — Integración Gemini
Implementar F4: menú contextual de análisis, llamada a API, persistencia de resultado.

---

## 11. Reglas Generales para Claude

- **Siempre** leer este archivo antes de generar cualquier código nuevo.
- **Nunca** crear tipos nuevos sin primero verificar si ya existen en `src/shared/types.ts`.
- **Nunca** usar `enum`. Siempre usar `as const` con tipo derivado (sección 8).
- Cuando generes un archivo nuevo, incluir al inicio un comentario con la ruta completa: `// src/background/index.ts`.
- Si una decisión de arquitectura no está cubierta por este documento, **preguntar antes de implementar**.
- Al modificar storage, siempre seguir el patrón de lectura-modificación-escritura descrito en la sección 7.
- Generar código por fases según la sección 10. No adelantar funcionalidades de fases posteriores.
- El Background es el **único** componente autorizado a escribir en `chrome.storage.local`.
