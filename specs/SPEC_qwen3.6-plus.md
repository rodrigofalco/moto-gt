# Especificación Técnica — MotoGT

> Especificación para la implementación de MotoGT v1: un juego de gestión de motociclismo minimalista construido con TypeScript + Phaser 3 + Vite.

---

## 1. Introducción y alcance

### 1.1 Propósito

MotoGT es un juego de gestión de carreras de motos de una sola temporada. El jugador controla un único piloto en una parrilla de 10 competidores a lo largo de 6 carreras. No hay física ni reflejos rápidos — solo una decisión por carrera (estilo de pilotaje) y los resultados que se derivan.

### 1.2 Filosofía v1

> *Finish first, expand later.*

Esta versión es deliberadamente mínima. Se excluyen presupuestos, I+D, personal, contratos y patrocinadores. El objetivo es un bucle de temporada completo y jugable que se pueda publicar y luego expandir.

### 1.3 Stack tecnológico

| Componente | Tecnología |
|---|---|
| Lenguaje | TypeScript (strict mode) |
| Motor de juego | Phaser 3 |
| Herramienta de compilación | Vite |
| Entorno de ejecución | Navegador web moderno |

### 1.4 Alcance de v1

**Incluido:**
- 1 piloto del jugador + 9 pilotos IA
- Calendario fijo de 6 carreras, una sola temporada
- Una decisión de estilo de pilotaje por carrera
- Resultados simulados a partir de estadísticas + estilo + aleatoriedad
- Clasificación del campeonato en vivo
- Sesión única sin guardado

**Excluido (diferido a v2+):**
Presupuesto y dinero, mejoras de moto/I+D, personal/ingenieros/contratos, patrocinadores, múltiples temporadas/carreras de categorías, clima/estrategia de neumáticos, avatares de pilotos, vista carrera a vuelta.

---

## 2. Arquitectura general

### 2.1 Estructura de directorios

```
moto-gt/
├── src/
│   ├── main.ts                    # Punto de entrada, inicializa Phaser Game
│   ├── config.ts                  # Configuración global de Phaser
│   ├── constants.ts               # Constantes inmutables del juego
│   │
│   ├── core/                      # Lógica de dominio pura (sin dependencias de Phaser)
│   │   ├── types.ts               # Interfaces y tipos TypeScript
│   │   ├── Rider.ts               # Modelo de piloto
│   │   ├── Championship.ts        # Estado del campeonato
│   │   ├── RaceSimulator.ts       # Motor de simulación de carreras
│   │   ├── Calendar.ts            # Generación y gestión del calendario
│   │   └── PointsSystem.ts        # Sistema de puntuación
│   │
│   ├── scenes/                    # Escenas de Phaser
│   │   ├── MainMenuScene.ts
│   │   ├── SeasonScene.ts
│   │   └── RaceResultScene.ts
│   │
│   ├── ui/                        # Componentes UI reutilizables
│   │   ├── StandingTable.ts       # Tabla de clasificación renderizada
│   │   ├── RiderCard.ts           # Tarjeta informativa de piloto
│   │   ├── ProgressBar.ts         # Barra de progreso visual
│   │   └── DialogBox.ts           # Caja de diálogo/entrada de texto
│   │
│   ├── services/                  # Servicios transversales
│   │   ├── EventBus.ts            # Bus de eventos para comunicación entre módulos
│   │   └── RNG.ts                 # Generador de números aleatorios (seeds opcionales)
│   │
│   └── assets/                    # Referencias a assets
│       └── preload.ts             # Carga de assets (gráficos, fuentes)
│
├── public/                        # Assets estáticos (imágenes, fuentes)
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 2.2 Flujo de control de alto nivel

```
main.ts
  └─ Phaser.Game(config)
       ├─ MainMenuScene      →  Pantalla de título, nombre de piloto/equipo
       ├─ SeasonScene        →  Calendario, clasificación, decisión de estilo
       └─ RaceResultScene    →  Resultados de carrera, actualización de standings
              ↑__________________________________________________________|
              (loop hasta completar las 6 carreras)
```

### 2.3 Patrón de gestión de estado

El estado global del juego (`GameState`) se mantiene en un objeto singleton inmutable que se reemplaza completamente en cada transición significativa. Se almacena en `window.__MOTO_GT_STATE__` para acceso desde cualquier escena.

```
GameState = {
  season: SeasonState
  currentRaceIndex: number (0..5)
  selectedStyle: RidingStyle | null
  simulationResult: RaceResult | null
}
```

Alternativamente, se usa un patrón de **estado concentrado en `SeasonScene`**, que es la escena central y persiste durante toda la temporada, creando y destruyendo `RaceResultScene` como overlay.

---

## 3. Modelos de datos

### 3.1 Tipos base (`src/core/types.ts`)

```typescript
// === Identificadores ===
type RiderId = string;    // e.g. "rider_0", "rider_1", ...
type TrackId = string;    // e.g. "track_0", "track_1", ...

// === Estadísticas del piloto ===
interface RiderStats {
  pace: number;        // 1-10: velocidad pura
  cornering: number;   // 1-10: rendimiento en secciones técnicas
  consistency: number; // 1-10: resistencia a errores
}

// === Estilo de pilotaje ===
type RidingStyle = 'safe' | 'balanced' | 'aggressive';

// === Piloto ===
interface Rider {
  id: RiderId;
  name: string;
  teamName: string;
  stats: RiderStats;
  isPlayer: boolean;
}

// === Circuito ===
interface Track {
  id: TrackId;
  name: string;
  technicality: number; // 1-10: qué tan técnico es el circuito (afecta el peso de cornering)
}

// === Carrera ===
interface RaceEntry {
  raceNumber: number;      // 1-6
  track: Track;
}

// === Resultado de una carrera individual ===
interface RaceFinishingPosition {
  riderId: RiderId;
  position: number;        // 1-10
  points: number;          // puntos obtenidos
  madeMistake: boolean;    // si el piloto cometió un error
}

interface RaceResult {
  raceNumber: number;
  track: Track;
  finishingOrder: RaceFinishingPosition[]; // ordenado por position ascendente
}

// === Puntuación acumulada ===
interface ChampionshipStanding {
  riderId: RiderId;
  name: string;
  teamName: string;
  totalPoints: number;
  raceResults: (number | null)[]; // puntos por carrera, null = aún no disputada
}

// === Estado de la temporada ===
interface SeasonState {
  playerRider: Rider;
  rivalRiders: Rider[];      // siempre 9
  allRiders: Rider[];        // playerRider + rivalRiders (10 total)
  calendar: RaceEntry[];     // siempre 6 carreras
  standings: ChampionshipStanding[];
  currentRaceIndex: number;  // 0-5, índice de la próxima carrera
  isSeasonComplete: boolean;
}

// === Estado global de la aplicación ===
interface GameState {
  season: SeasonState;
  selectedStyle: RidingStyle | null;
  lastRaceResult: RaceResult | null;
}
```

### 3.2 Constantes del juego (`src/constants.ts`)

```typescript
// Puntuación por posición (índice 0 = posición 1)
export const POINTS_TABLE: ReadonlyArray<number> = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Número de carreras por temporada
export const SEASON_RACE_COUNT = 6;

// Número total de pilotos en parrilla
export const GRID_SIZE = 10;

// Número de rivales IA
export const AI_RIDER_COUNT = 9;

// Rango de estadísticas
export const STAT_MIN = 1;
export const STAT_MAX = 10;

// Modificadores por estilo de pilotaje
export const STYLE_MODIFIERS: Record<RidingStyle, {
  paceMultiplier: number;
  mistakeBaseChance: number;
}> = {
  safe:      { paceMultiplier: 0.85, mistakeBaseChance: 0.03 },
  balanced:  { paceMultiplier: 1.00, mistakeBaseChance: 0.10 },
  aggressive:{ paceMultiplier: 1.15, mistakeBaseChance: 0.25 },
};

// Peso de cada estadística en la simulación
export const STAT_WEIGHTS = {
  pace: 0.50,
  cornering: 0.30,
  consistency: 0.20,
};
```

### 3.3 Circuitos predeterminados

```typescript
export const DEFAULT_TRACKS: ReadonlyArray<Track> = [
  { id: 'track_0', name: 'Circuit de Jerez',           technicality: 6 },
  { id: 'track_1', name: 'Mugello Circuit',            technicality: 7 },
  { id: 'track_2', name: 'Circuit de Barcelona-Catalunya', technicality: 8 },
  { id: 'track_3', name: 'Sachsenring',                technicality: 5 },
  { id: 'track_4', name: 'Silverstone Circuit',        technicality: 7 },
  { id: 'track_5', name: 'Phillip Island',             technicality: 9 },
];
```

---

## 4. Motor de simulación de carreras

### 4.1 Responsabilidad

`RaceSimulator` toma el estado actual de todos los pilotos, el estilo de pilotaje elegido por el jugador, y produce un orden de llegada determinista-aleatorio.

### 4.2 Algoritmo de puntuación compuesta (composite score)

Para cada piloto se calcula un **composite score** que determina su rendimiento base:

```
compositeScore = (pace * W_pace + cornering * W_cornering + consistency * W_consistency)
                 * stylePaceMultiplier
                 * trackTechnicalityFactor
```

Donde:

- `W_pace = 0.50`, `W_cornering = 0.30`, `W_consistency = 0.20`
- `stylePaceMultiplier` proviene de `STYLE_MODIFIERS[selectedStyle].paceMultiplier` (para el jugador) o `stylePaceMultiplier = 1.0` (para IA)
- `trackTechnicalityFactor` modula el peso de cornering según la technicality del circuito:

```
trackTechnicalityFactor = 1.0 + (track.technicality - 5) * 0.03 * (cornering / 10)
```

Esto significa que en circuitos muy técnicos (technicality > 5), los pilotos con buen cornering obtienen un bonus adicional, y en circuitos sencillos (technicality < 5), el bonus se reduce.

### 4.3 Modelo de errores (mistake model)

Un error es un evento binario que penaliza severamente la posición del piloto. La probabilidad de error se calcula así:

```
mistakeChance = mistakeBaseChance * (1.0 - consistency * 0.08)
```

Donde:
- `mistakeBaseChance` proviene de `STYLE_MODIFIERS[selectedStyle].mistakeBaseChance` (para el jugador) o se calcula para la IA usando `balanced` como base.
- `consistency * 0.08` es el factor de reducción: un piloto con consistency=10 reduce su chance de error en un 80%, uno con consistency=1 solo un 8%.
- El resultado se clampa entre `[0.01, 0.45]`.

Para los rivales IA, se usa un modelo simplificado: cada rival tiene un `mistakeChance` fijo basado en su propia estadística de consistency, sin dependencia de estilo:

```
aiMistakeChance = 0.12 * (1.0 - rider.stats.consistency * 0.08)
```
Clampeado a `[0.02, 0.35]`.

### 4.4 Penalización por error

Si un piloto comete un error, su composite score se multiplica por un factor de penalización:

```
penaltyMultiplier = 0.55 + (Math.random() * 0.15)  // entre 0.55 y 0.70
adjustedScore = compositeScore * penaltyMultiplier
```

Esto simula la pérdida de tiempo variable según la gravedad del error.

### 4.5 Factor aleatorio (noise)

Para evitar resultados deterministas, se añade un factor de ruido a cada piloto:

```
noiseFactor = 0.85 + (Math.random() * 0.30)  // entre 0.85 y 1.15
finalScore = adjustedScore * noiseFactor
```

Este rango asegura que:
- Un piloto significativamente mejor gana la mayoría de las veces.
- Un piloto inferior tiene una oportunidad realista (upset posible pero improbable).
- Pilotos de nivel similar producen resultados variados.

### 4.6 Algoritmo completo paso a paso

```
function simulateRace(season: SeasonState, playerStyle: RidingStyle, raceIndex: number): RaceResult

  1. Obtener el Track del raceIndex actual.

  2. Para cada piloto en season.allRiders:
     a. Determinar el RidingStyle:
        - Si es el jugador → usar playerStyle.
        - Si es IA → asignar aleatoriamente con distribución:
          safe: 25%, balanced: 50%, aggressive: 25%
     b. Calcular compositeScore según §4.2.
     c. Determinar si comete error según §4.3 usando Math.random().
     d. Si hay error, aplicar penaltyMultiplier según §4.4.
     e. Aplicar noiseFactor según §4.5.
     f. Almacenar { rider, finalScore, madeMistake }.

  3. Ordenar todos los pilotos por finalScore descendente.

  4. Asignar posiciones 1-10 según el orden.

  5. Asignar puntos usando POINTS_TABLE[posicion - 1].

  6. Construir y devolver RaceResult con:
     - raceNumber: raceIndex + 1
     - track: el circuito actual
     - finishingOrder: array ordenado de RaceFinishingPosition
```

### 4.7 Validación de resultados

- Cada posición del 1 al 10 debe estar ocupada exactamente una vez.
- La suma de puntos repartidos debe ser exactamente: 25+18+15+12+10+8+6+4+2+1 = 101.
- El piloto del jugador debe estar presente en el resultado.
- No puede haber empates en posición (el desempate se resuelve por score; si hay empate numérico exacto, se desempata por `pace` mayor; si persiste, por `riderId` alfabético).

### 4.8 Casos borde del simulador

| Caso | Manejo |
|---|---|
| Piloto con stats mínimos (1,1,1) y estilo Aggressive | `mistakeChance` muy alto (~23%), pero `noiseFactor` puede salvarlo ocasionalmente. Resultado realista: último la mayoría de las veces. |
| Piloto con stats máximos (10,10,10) y estilo Safe | `mistakeChance` mínimo (~2%), composite score alto. Resultado realista: pódium la mayoría de las veces. |
| Todos los pilotos empatan en score | Desempate por pace, luego riderId. Probabilidad extremadamente baja pero manejada. |
| `track.technicality` en extremos (1 o 10) | `trackTechnicalityFactor` produce modificaciones moderadas (±15% máx), nunca domina sobre pace. |
| RNG produce secuencias extremas | Aceptable — es parte de la simulación. Para debugging, se puede usar un RNG con seed. |
| Estilo no definido para un piloto | Usar `balanced` como fallback seguro. |

---

## 5. Lógica del juego

### 5.1 Inicialización de temporada

```
function initializeSeason(playerName: string, playerTeamName: string): GameState

  1. Crear playerRider:
     - id: "rider_0"
     - name: playerName
     - teamName: playerTeamName
     - stats: generar aleatoriamente (cada stat 1-10, distribución uniforme)
     - isPlayer: true

  2. Crear 9 rivalRiders:
     - id: "rider_1" a "rider_9"
     - name: extraído de un pool de nombres predefinidos
     - teamName: extraído de un pool de nombres de equipos
     - stats: generar aleatoriamente (cada stat 1-10, distribución uniforme)
     - isPlayer: false

  3. Crear calendar:
     - Usar DEFAULT_TRACKS (6 circuitos) en orden fijo.

  4. Inicializar standings:
     - Para cada uno de los 10 pilotos, crear ChampionshipStanding:
       - totalPoints: 0
       - raceResults: [null, null, null, null, null, null]

  5. Retornar GameState con:
     - season con todos los datos anteriores
     - selectedStyle: null
     - lastRaceResult: null
```

### 5.2 Bucle principal de temporada

```
for raceIndex from 0 to 5:
  1. Mostrar SeasonScene con:
     - Info del próximo circuito
     - Stats del piloto del jugador
     - Clasificación actual del campeonato
     - Prompt para seleccionar RidingStyle

  2. Jugador selecciona RidingStyle (safe/balanced/aggressive).

  3. Llamar RaceSimulator.simulateRace().

  4. Transicionar a RaceResultScene mostrando:
     - Tabla de resultados de la carrera
     - Destacar la posición del jugador
     - Indicadores de errores cometidos

  5. Al continuar desde RaceResultScene:
     a. Actualizar standings con los puntos de la carrera.
     b. Incrementar currentRaceIndex.
     c. Si currentRaceIndex >= 6:
        - Marcar isSeasonComplete = true
        - Transicionar a pantalla de fin de temporada (puede ser RaceResultScene con variante "Champion crowned").
     d. Si no, volver al paso 1.
```

### 5.3 Actualización de clasificación

```
function updateStandings(season: SeasonState, raceResult: RaceResult): void

  Para cada entry en raceResult.finishingOrder:
    - Encontrar el ChampionshipStanding correspondiente a entry.riderId.
    - Añadir entry.points a standing.totalPoints.
    - Establecer standing.raceResults[raceResult.raceNumber - 1] = entry.points.

  Reordenar standings por totalPoints descendente.
  Desempate: mayor número de victorias (posición 1), luego mejor resultado individual más alto.
```

### 5.4 Determinación del campeón

```
function determineChampion(season: SeasonState): ChampionshipStanding

  - Retornar standings[0] (ya ordenado por puntos descendente).
  - Si isSeasonComplete es false, lanzar error.
```

### 5.5 Casos borde de la lógica del juego

| Caso | Manejo |
|---|---|
| Jugador no selecciona estilo | Bloquear botón "Simulate" hasta que se seleccione un estilo. El estilo por defecto visualmente seleccionado es `balanced`. |
| Navegación atrás durante la temporada | No se permite navegar atrás a carreras anteriores. El estado es lineal e irreversible. |
| Recarga del navegador | Se pierde todo el progreso. Sin sistema de guardado en v1. Se muestra advertencia si el jugador intenta cerrar la pestaña con carreras en curso. |
| Nombres de piloto/equipo vacíos o solo espacios | Validar en MainMenuScene: requerir al menos 1 carácter no-espacio. Longitud máxima: 20 caracteres para nombre, 30 para equipo. |
| Nombres duplicados de rivales | El pool de nombres debe tener al menos 9 nombres únicos. Si el pool se agota, generar nombres genéricos ("Piloto 1", "Piloto 2", etc.). |

---

## 6. Escenas y UI

### 6.1 MainMenuScene

#### 6.1.1 Descripción

Pantalla de título con formulario de registro del piloto. Es la primera escena que se carga.

#### 6.1.2 Elementos visuales

```
┌──────────────────────────────────────┐
│                                      │
│          ╔══════════════╗            │
│          ║   MotoGT     ║            │
│          ╚══════════════╝            │
│                                      │
│   Nombre del Piloto: [__________]    │
│   Nombre del Equipo: [__________]    │
│                                      │
│        ╔══════════════════╗          │
│        ║  INICIAR TEMPORADA ║         │
│        ╚══════════════════╝          │
│                                      │
└──────────────────────────────────────┘
```

#### 6.1.3 Comportamiento

1. Al entrar: mostrar título y formulario.
2. Validar campos en tiempo real (borde rojo si vacío, verde si válido).
3. Botón "INICIAR TEMPORADA" deshabilitado hasta que ambos campos sean válidos.
4. Al validar y hacer clic:
   - Llamar `initializeSeason(playerName, teamName)`.
   - Transicionar a `SeasonScene` con efecto de fade.

#### 6.1.4 Eventos emitidos

| Evento | Datos | Destino |
|---|---|---|
| `season_initialized` | `GameState` | `SeasonScene` |

---

### 6.2 SeasonScene

#### 6.2.1 Descripción

Escena central del juego. Muestra el calendario, la clasificación, los stats del piloto y permite seleccionar el estilo de pilotaje para la próxima carrera.

#### 6.2.2 Layout

```
┌───────────────────────────────────────────────────────┐
│  TEMPORADA — Carrera X de 6                           │
├──────────────────────────┬────────────────────────────┤
│                          │                            │
│  PRÓXIMA CARRERA         │  CLASIFICACIÓN DEL CAMPEONATO│
│                          │                            │
│  🏁 Mugello Circuit       │  Pos  Piloto        Pts    │
│  Technicality: ██████░░░  │   1   Rossi           43   │
│                          │   2   Tú              38   │
│                          │   3   Márquez         35   │
│  PILOTO                  │   4   ...             ...   │
│  Nombre: Rossi           │  ...                       │
│  Equipo: Yamaha Racing   │                            │
│                          │                            │
│  Pace:       ████████░░   │                            │
│  Cornering:  ██████░░░░   │                            │
│  Consistency:█████████░   │                            │
│                          │                            │
├──────────────────────────┴────────────────────────────┤
│                                                       │
│  ESTILO DE PILOTAJE                                   │
│                                                       │
│  ╔══════════╗  ╔══════════╗  ╔══════════╗            │
│  ║  SAFE    ║  ║ BALANCED ║  ║AGGRESSIVE║            │
│  ║ 🛡️ Bajo  ║  ║ ⚖️ Medio ║  ║ ⚡ Alto   ║            │
│  ║ riesgo   ║  ║ riesgo   ║  ║ riesgo   ║            │
│  ╚══════════╝  ╚══════════╝  ╚══════════╝            │
│                                                       │
│            ╔═══════════════════════╗                  │
│            ║     SIMULAR CARRERA    ║                  │
│            ╚═══════════════════════╝                  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### 6.2.3 Comportamiento de selección de estilo

- Los tres botones de estilo son mutuamente excluyentes (radio button visual).
- Al hacer clic en un estilo:
  - Resaltar el botón seleccionado (borde brillante, cambio de color de fondo).
  - Almacenar `selectedStyle` en el estado global.
  - Habilitar el botón "SIMULAR CARRERA".
- Al entrar por primera vez, `balanced` está preseleccionado visualmente pero `selectedStyle` es `null` (requiere confirmación explícita).

#### 6.2.4 Descripciones visuales de los estilos

| Estilo | Texto informativo | Indicador visual |
|---|---|---|
| Safe | "Ritmo conservador. Mínimo riesgo de error." | Escudo verde 🛡️ |
| Balanced | "Equilibrio entre ritmo y riesgo." | Balanza amarilla ⚖️ |
| Aggressive | "Máximo ritmo. Alto riesgo de error costoso." | Rayo rojo ⚡ |

#### 6.2.5 Tabla de clasificación

- Ordenada por puntos descendente.
- El piloto del jugador se resalta con un color de fondo diferente.
- Muestra: posición, nombre del piloto, nombre del equipo, puntos totales.
- Se actualiza dinámicamente después de cada carrera.

#### 6.2.6 Eventos emitidos

| Evento | Datos | Destino |
|---|---|---|
| `style_selected` | `RidingStyle` | Internamente en SeasonScene |
| `simulate_requested` | `{ style: RidingStyle, raceIndex: number }` | `RaceResultScene` |

---

### 6.3 RaceResultScene

#### 6.3.1 Descripción

Muestra los resultados de la carrera simulada y actualiza la clasificación. Funciona también como pantalla de fin de temporada cuando `isSeasonComplete` es `true`.

#### 6.3.2 Layout — Resultados de carrera

```
┌───────────────────────────────────────────────┐
│  RESULTADOS — Mugello Circuit                 │
├───────────────────────────────────────────────┤
│                                               │
│  Pos  Piloto           Estilo     Puntos      │
│   1   Rossi           Aggressive    25   🥇   │
│   2   Tú              Balanced      18   🥈   │
│   3   Márquez         Safe          15   🥉   │
│   4   ...             ...           ...       │
│  ...  ...              ...           ...      │
│  10   García          Aggressive     1   ⚠️   │
│                                               │
│  ⚠️ indica que el piloto cometió un error      │
│  ★ resalta al piloto del jugador               │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│  ╔═══════════════════════════════╗            │
│  ║       VER CLASIFICACIÓN        ║            │
│  ╚═══════════════════════════════╝            │
│                                               │
└───────────────────────────────────────────────┘
```

#### 6.3.3 Layout — Fin de temporada

```
┌───────────────────────────────────────────────┐
│                                               │
│     ╔═══════════════════════════════╗         │
│     ║   ¡TEMPORADA COMPLETADA!      ║         │
│     ║                               ║         │
│     ║   CAMPEÓN: Rossi              ║         │
│     ║   Yamaha Racing               ║         │
│     ║   132 puntos                  ║         │
│     ║                               ║         │
│     ║   Tu posición: 3° (98 pts)    ║         │
│     ╚═══════════════════════════════╝         │
│                                               │
│  CLASIFICACIÓN FINAL                           │
│  Pos  Piloto           Pts   Victorias        │
│   1   Rossi           132        3            │
│   2   Márquez         115        2            │
│   3   Tú               98        1            │
│  ...  ...              ...       ...           │
│                                               │
│  ╔═══════════════════════════════╗            │
│  ║       JUGAR DE NUEVO           ║            │
│  ╚═══════════════════════════════╝            │
│                                               │
└───────────────────────────────────────────────┘
```

#### 6.3.4 Comportamiento

1. Al entrar: recibir `RaceResult` como dato de entrada.
2. Animar la revelación de posiciones de arriba hacia abajo con un delay de 200ms entre cada fila.
3. Resaltar la fila del jugador con fondo dorado y prefijo ★.
4. Marcar con ⚠️ las filas de pilotos que cometieron error (`madeMistake === true`).
5. Botón "VER CLASIFICACIÓN":
   - Si `isSeasonComplete`: mostrar layout de fin de temporada con campeón.
   - Si no: mostrar clasificación actualizada y botón "SIGUIENTE CARRERA" que retorna a `SeasonScene` con el índice actualizado.
6. Botón "JUGAR DE NUEVO" (solo en fin de temporada):
   - Reiniciar todo el estado.
   - Transicionar a `MainMenuScene`.

#### 6.3.5 Eventos emitidos

| Evento | Datos | Destino |
|---|---|---|
| `race_result_displayed` | `RaceResult` | Internamente |
| `next_race_requested` | `{ raceIndex: number }` | `SeasonScene` |
| `restart_requested` | — | `MainMenuScene` |

---

### 6.6 Componentes UI reutilizables

#### 6.6.1 StandingTable

- Renderiza una tabla de clasificación con columnas: Pos, Piloto, Equipo, Puntos.
- Acepta un `highlightRiderId` para resaltar una fila.
- Soporta animación de entrada escalonada.
- Parámetros de configuración: número de columnas visible, tamaño de fuente.

#### 6.6.2 RiderCard

- Muestra la info de un piloto: nombre, equipo, tres barras de stats.
- Las barras usan colores: verde (>7), amarillo (4-7), rojo (<4).
- Puede mostrar un badge "TÚ" para el piloto del jugador.

#### 6.6.3 ProgressBar

- Barra genérica para mostrar valores numéricos como porcentaje.
- Soporta color dinámico basado en umbrales.
- Animación de llenado opcional.

#### 6.6.4 DialogBox

- Caja de texto con fondo semitransparente y borde.
- Soporta título, cuerpo de texto, y botones de acción.
- Usado para formularios en MainMenuScene y mensajes en RaceResultScene.

---

## 7. Generación de datos

### 7.1 Nombres de pilotos (pool)

```typescript
const RIDER_NAMES: ReadonlyArray<string> = [
  'Valentino', 'Marc', 'Jorge', 'Dani', 'Andrea',
  'Maverick', 'Johann', 'Alex', 'Jack', 'Fabio',
  'Francesco', 'Brad', 'Miguel', 'Pol', 'Takaaki',
  'Iker', 'Raul', 'Luca', 'Enea', 'Marco',
];
```

Se toman los primeros 9 nombres no usados por el jugador (si el jugador elige un nombre del pool, se salta).

### 7.2 Nombres de equipos (pool)

```typescript
const TEAM_NAMES: ReadonlyArray<string> = [
  'Yamaha Racing', 'Ducati Corse', 'Repsol Honda',
  'Aprilia Racing', 'KTM Factory', 'Suzuki Ecstar',
  'Gresini Racing', 'Pramac Racing', 'Tech3 KTM',
  'VR46 Racing', 'LCR Honda', 'RNF Racing',
];
```

Se asignan aleatoriamente a los 9 rivales IA (sin repetir).

### 7.3 Distribución de estadísticas

Para v1, todas las estadísticas se generan con **distribución uniforme** en [1, 10]. Esto significa que cualquier combinación es igualmente probable. En versiones futuras se podría usar una distribución normal centrada en 5-6 para crear una parrilla más realista.

```typescript
function randomStat(): number {
  return Math.floor(Math.random() * 10) + 1; // 1-10 inclusive
}
```

---

## 8. Sistema de eventos (EventBus)

### 8.1 Diseño

Un bus de eventos simple basado en el patrón Observer para desacoplar la comunicación entre módulos sin dependencias directas de Phaser.

```typescript
type EventName = string;
type EventHandler = (...args: any[]) => void;

class EventBus {
  private listeners: Map<EventName, Set<EventHandler>>;

  on(event: EventName, handler: EventHandler): void;
  off(event: EventName, handler: EventHandler): void;
  emit(event: EventName, ...args: any[]): void;
  once(event: EventName, handler: EventHandler): void;
}
```

### 8.2 Eventos definidos

| Evento | Payload | Emisor | Receptor(es) |
|---|---|---|---|
| `season_initialized` | `GameState` | `MainMenuScene` | `SeasonScene` |
| `style_selected` | `RidingStyle` | UI de SeasonScene | `SeasonScene` (lógica) |
| `simulate_requested` | `{ style, raceIndex }` | `SeasonScene` | `RaceResultScene` |
| `race_simulated` | `RaceResult` | `RaceSimulator` | `RaceResultScene` |
| `standings_updated` | `ChampionshipStanding[]` | Lógica de standings | UI de SeasonScene |
| `next_race_requested` | `{ raceIndex }` | `RaceResultScene` | `SeasonScene` |
| `restart_requested` | `void` | `RaceResultScene` | `MainMenuScene` |
| `season_completed` | `ChampionshipStanding[]` | Lógica de temporada | `RaceResultScene` |

---

## 9. Generador de números aleatorios (RNG)

### 9.1 Implementación base

Para v1, se usa `Math.random()` nativo. Se envuelve en un módulo `RNG` para facilitar el reemplazo por un RNG con seed en el futuro (para debugging o reproducibilidad).

```typescript
class RNG {
  private seed?: number;

  constructor(seed?: number) {
    this.seed = seed;
  }

  next(): number {
    if (this.seed !== undefined) {
      // Implementación simple de mulberry32 o similar
      this.seed = (this.seed * 1664525 + 1013904223) | 0;
      return (this.seed >>> 0) / 4294967296;
    }
    return Math.random();
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}
```

### 9.2 Uso

- Todas las llamadas a `Math.random()` en el simulador deben pasar por `RNG`.
- En v1, se instancia sin seed: `new RNG()`.
- La semilla se puede exponer en la consola de desarrollo para reproducir carreras específicas.

---

## 10. Consideraciones de rendimiento

### 10.1 Complejidad

| Operación | Complejidad | Justificación |
|---|---|---|
| Simulación de carrera | O(n log n) | Ordenamiento de 10 pilotos por score |
| Actualización de standings | O(n log n) | Reordenamiento de 10 pilotos |
| Inicialización de temporada | O(n) | Creación de 10 pilotos y 6 carreras |

Con n=10, todas las operaciones son efectivamente O(1). No se requieren optimizaciones.

### 10.2 Memoria

El estado completo del juego ocupa menos de 10KB en memoria. No se requiere gestión especial de memoria.

### 10.3 Renderizado

Phaser 3 maneja el renderizado a 60fps. Las escenas son predominantemente estáticas con transiciones puntuales. No se requieren técnicas avanzadas de optimización.

---

## 11. Casos de prueba y validación

### 11.1 Simulación

| Test | Descripción | Resultado esperado |
|---|---|---|
| Simulación con jugador stats máximos + Safe | Piloto con (10,10,10), estilo Safe | Debe terminar entre los 3 primeros >90% de las veces (en 1000 simulaciones) |
| Simulación con jugador stats mínimos + Aggressive | Piloto con (1,1,1), estilo Aggressive | Debe terminar último o con error >70% de las veces |
| Simulación con todos los pilotos idénticos | Todos con (5,5,5) | Distribución de posiciones debe ser uniforme en el largo plazo |
| 1000 carreras sin errores de lógica | Ejecutar 1000 simulaciones completas | Cada carrera tiene 10 posiciones únicas, suma de puntos = 101 |

### 11.2 Clasificación

| Test | Descripción | Resultado esperado |
|---|---|---|
| Tabla ordenada correctamente | Después de 3 carreras | standings ordenados por totalPoints descendente |
| Desempate por victorias | Dos pilotos con mismos puntos, uno con más victorias | El de más victorias va primero |
| Puntos acumulados correctamente | Después de 6 carreras | totalPoints = suma de raceResults no-null |

### 11.3 UI

| Test | Descripción | Resultado esperado |
|---|---|---|
| Nombre vacío bloquea inicio | Campo nombre = "" | Botón "INICIAR TEMPORADA" deshabilitado |
| Selección de estilo habilita simular | Clic en "Aggressive" | Botón "SIMULAR CARRERA" habilitado |
| Resaltado del jugador en tabla | Piloto del jugador en posición 5 | Fila 5 con fondo diferente |
| Indicador de error visible | Piloto cometió error | Símbolo ⚠️ visible junto al nombre |

---

## 12. Extensibilidad prevista (v2+)

Aunque fuera de alcance para v1, la arquitectura debe permitir:

### 12.1 Múltiples temporadas

- Extraer `SeasonState` a un array `SeasonState[]`.
- Añadir `CareerState` que contenga temporadas, historial y progresión.

### 12.2 Sistema de presupuesto

- Añadir `budget: number` a `SeasonState`.
- Añadir costos de mejoras y salarios.

### 12.3 Mejoras de moto (R&D)

- Añadir `BikeStats` independiente de `RiderStats`.
- Modificar el algoritmo de simulación para incluir `bikeStats` como factor adicional.

### 12.4 Clima y neumáticos

- Añadir `WeatherCondition` a cada `RaceEntry`.
- Añadir decisión de neumáticos como segunda decisión pre-carrera.
- Modificar `trackTechnicalityFactor` para depender del clima.

### 12.5 Vista carrera en vivo

- Reemplazar la simulación instantánea con un loop de vueltas.
- Cada vuelta: actualizar posiciones, posibilidad de error por vuelta.
- Mantener el mismo algoritmo base pero ejecutado progresivamente.

---

## 13. Referencias

- [Motorsport Manager](https://store.steampowered.com/app/415200/Motorsport_Manager/) — Inspiración principal
- [Phaser 3 Documentation](https://phaser.io/) — Motor de juego
- [Vite Documentation](https://vitejs.dev/) — Herramienta de compilación

---

## 14. Glosario

| Término | Definición |
|---|---|
| **Parrilla** | Conjunto de 10 pilotos que compiten en una carrera |
| **Estilo de pilotaje** | Decisión del jugador que afecta ritmo y riesgo (Safe/Balanced/Aggressive) |
| **Composite Score** | Puntuación numérica calculada que determina el rendimiento de un piloto en una carrera |
| **Error (Mistake)** | Evento aleatorio que penaliza severamente la posición de un piloto |
| **Technicality** | Propiedad del circuito que mide su complejidad técnica (1-10) |
| **Standings** | Clasificación acumulada del campeonato |
| **RNG** | Generador de Números Aleatorios |

---

*Documento versión 1.0 — 15 de junio de 2026*
