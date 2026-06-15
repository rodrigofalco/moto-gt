# Especificación Técnica - MotoGT V1

## 1. Visión general

MotoGT es un **gestor de carreras de motociclismo minimalista**, inspirado en *Motorsport Manager*. La versión 1 se centra en un bucle de temporada corto, jugable en una única sesión, y deliberadamente excluye sistemas complejos (economía, I+D, personal, patrocinadores, etc.).

### Datos clave del producto

| Elemento | Valor |
|----------|-------|
| Jugadores | 1 usuario + 9 rivales controlados por IA |
| Temporada | 6 carreras fijas |
| Decisión principal por carrera | 1 estilo de conducción (Safe / Balanced / Aggressive) |
| Duración estimada | ~5 minutos por temporada |
| Idioma de implementación | TypeScript |
| Motor de juego | Phaser 3 |
| Empaquetador | Vite |
| Entorno de ejecución | Navegador web moderno |

---

## 2. Arquitectura

### 2.1 Patrón arquitectónico

El proyecto sigue una arquitectura **escena-componente** propia de Phaser 3, complementada con una capa de lógica pura (sin dependencia de Phaser) que contiene:

- Generación de datos de temporada.
- Simulación de carrera.
- Cálculo de puntos y clasificaciones.

Phaser se utiliza únicamente para:

- Renderizado de escenas.
- Gestión de entrada (ratón / táctil).
- Transiciones visuales simples.

### 2.2 Estructura de carpetas propuesta

```
src/
├── main.ts                 # Punto de entrada: configura Phaser y arranca el juego
├── config/
│   └── gameConfig.ts       # Constantes globales (puntuación, estilos, número de carreras, etc.)
├── data/
│   ├── tracks.ts           # Lista fija de circuitos
│   └── names.ts            // Bancos de nombres para pilotos, equipos y países
├── logic/
│   ├── seasonGenerator.ts  # Crea una temporada nueva (calendario + rivales)
│   ├── raceSimulator.ts    # Algoritmo de simulación de una carrera
│   └── standingsCalculator.ts # Cálculo de puntos y orden de clasificación
├── model/
│   └── types.ts            # Interfaces y tipos del dominio
├── scenes/
│   ├── BaseScene.ts        # Escena base con utilidades comunes (fuentes, paleta, transiciones)
│   ├── MainMenuScene.ts    # Menú inicial
│   ├── SeasonScene.ts      # Vista de temporada: calendario, clasificación, próxima carrera
│   └── RaceResultScene.ts  # Resultados de la carrera y tabla de clasificación actualizada
└── ui/
    ├── components/
    │   ├── Button.ts       # Botón reutilizable con texto
    │   ├── StandingsTable.ts # Tabla de clasificación
    │   └── RaceCard.ts     # Tarjeta de circuito
    └── styles.ts           # Paleta de colores, tamaños de fuente, etc.
```

### 2.3 Flujo de escenas

```
MainMenuScene
      │
      ▼
SeasonScene  ──▶  RaceResultScene
      ▲                  │
      └──────────────────┘
```

- **MainMenuScene**: pantalla de inicio con botón "Nueva Temporada".
- **SeasonScene**: información de la temporada, calendario, clasificación y botón para correr la siguiente carrera.
- **RaceResultScene**: muestra resultados de la carrera recién simulada y el estado de la clasificación; incluye botón para volver a `SeasonScene`.

### 2.4 Ciclo de vida del estado

El estado de la temporada se guarda en memoria dentro de una instancia compartida de `GameState`. No hay persistencia en V1.

```
GameState
├── player: Rider
├── rivals: Rider[]
├── calendar: RaceEvent[]
├── currentRaceIndex: number
├── completedRaces: RaceResult[]
└── standings: ChampionshipStanding[]
```

---

## 3. Modelo de datos

### 3.1 Tipos principales

```typescript
// Estilo de conducción disponible
export type RidingStyle = 'safe' | 'balanced' | 'aggressive';

// Un circuito del calendario
export interface Track {
  id: string;
  name: string;
  country: string;
  technicality: number; // 1–10: importancia de la stat Cornering
}

// Piloto
export interface Rider {
  id: string;
  name: string;
  team: string;
  country: string;
  isPlayer: boolean;
  stats: RiderStats;
}

// Estadísticas de un piloto
export interface RiderStats {
  pace: number;        // 1–10
  cornering: number;   // 1–10
  consistency: number; // 1–10
}

// Evento de carrera en el calendario
export interface RaceEvent {
  id: string;
  round: number;       // 1–6
  track: Track;
  completed: boolean;
}

// Decisión del jugador para una carrera
export interface RaceDecision {
  riderId: string;
  style: RidingStyle;
}

// Resultado individual de un piloto en una carrera
export interface RiderRaceResult {
  riderId: string;
  position: number;
  points: number;
  style: RidingStyle;
  effectivePace: number; // Valor interno usado para ordenar (no visible al jugador)
  mistakeSeverity: number; // 0 = sin error; >0 = penalización aplicada
}

// Resultado completo de una carrera
export interface RaceResult {
  raceEventId: string;
  round: number;
  results: RiderRaceResult[];
}

// Clasificación del campeonato
export interface ChampionshipStanding {
  riderId: string;
  points: number;
  bestFinish: number;       // Mejor posición obtenida (1 es la mejor)
  wins: number;             // Victorias
  podiums: number;          // Top 3
  finishedRaces: number;
}

// Estado global del juego
export interface GameState {
  player: Rider;
  rivals: Rider[];
  calendar: RaceEvent[];
  currentRaceIndex: number;
  completedRaces: RaceResult[];
  standings: ChampionshipStanding[];
  seasonFinished: boolean;
}
```

### 3.2 Constantes de configuración

```typescript
export const CONFIG = {
  SEASON_LENGTH: 6,
  GRID_SIZE: 10,
  PLAYER_COUNT: 1,
  AI_COUNT: 9,
  MIN_STAT: 1,
  MAX_STAT: 10,

  RIDING_STYLES: {
    safe: {
      paceModifier: -0.5,
      mistakeBaseChance: 0.05,
      mistakeSeverityMultiplier: 1.0,
      label: 'Safe',
      description: 'Menor ritmo, muy bajo riesgo de error.',
    },
    balanced: {
      paceModifier: 0.0,
      mistakeBaseChance: 0.12,
      mistakeSeverityMultiplier: 1.0,
      label: 'Balanced',
      description: 'Ritmo y riesgo equilibrados.',
    },
    aggressive: {
      paceModifier: 0.8,
      mistakeBaseChance: 0.22,
      mistakeSeverityMultiplier: 1.3,
      label: 'Aggressive',
      description: 'Mayor ritmo, mayor riesgo de error costoso.',
    },
  },

  // Tabla de puntuación por posición (índice 0 = 1ª posición)
  POINTS_TABLE: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],

  // Rango de aleatoriedad aplicado al ritmo efectivo
  PACE_RANDOM_RANGE: 1.2,

  // Penalización base por error (unidades de tiempo equivalentes)
  MISTAKE_BASE_PENALTY: 3.0,

  // Factor de reducción de probabilidad de error por punto de consistencia
  CONSISTENCY_MISTAKE_REDUCTION: 0.018,

  // Contribución del cornering al ritmo efectivo
  CORNERING_WEIGHT: 0.4,
};
```

### 3.3 Generación de pilotos rivales

- Cada rival tiene `pace`, `cornering` y `consistency` generadas con una distribución aleatoria entre 1 y 10.
- Se recomienda un **presupuesto total de stats** para evitar rivales excesivamente dominantes o débiles; por ejemplo, suma base de 15 ± 3 distribuida entre las tres stats.
- El piloto del usuario introduce manualmente:
  - Nombre del piloto.
  - Nombre del equipo.
- Las stats del jugador se asignan de forma fija para V1 (por ejemplo, `pace: 7`, `cornering: 6`, `consistency: 6`) para garantizar una experiencia equilibrada.

### 3.4 Generación del calendario

- El calendario consta de exactamente 6 circuitos seleccionados de una lista predefinida.
- Se puede generar:
  - Aleatoriamente sin repetición.
  - O con una lista fija para garantizar variedad y equilibrio.
- Cada circuito tiene un campo `technicality` que modera cuánto influye `cornering` en la carrera.

---

## 4. Lógica del juego

### 4.1 Inicio de temporada

1. El jugador introduce nombre de piloto y equipo en `MainMenuScene`.
2. Se genera el `GameState`:
   - Piloto del jugador.
   - 9 rivales aleatorios.
   - 6 carreras de calendario.
   - Clasificación inicial con 0 puntos para todos.
3. Se transita a `SeasonScene`.

### 4.2 Fin de semana de carrera

1. `SeasonScene` muestra la carrera actual (`currentRaceIndex`).
2. El jugador selecciona un estilo de conducción.
3. Se llama a `raceSimulator.simulateRace(...)`.
4. Se actualiza `GameState`:
   - Se añade el resultado a `completedRaces`.
   - Se recalcula la clasificación.
   - Se incrementa `currentRaceIndex`.
   - Si `currentRaceIndex === SEASON_LENGTH`, se marca `seasonFinished = true`.
5. Se muestra `RaceResultScene`.

### 4.3 Fin de temporada

- Tras la sexta carrera, `SeasonScene` indica que la temporada ha terminado.
- Se muestra el campeón y la clasificación final.
- Se ofrece un botón "Jugar otra temporada" que reinicia el estado y vuelve a `MainMenuScene`.

---

## 5. Algoritmo de simulación de carrera

### 5.1 Entradas

- Lista de pilotos: jugador + 9 rivales.
- Decisión de estilo del jugador.
- Circuito actual (`Track`).
- Configuración de estilos y constantes.
- Generador de números aleatorios (Math.random o semilla opcional para reproducibilidad en pruebas).

### 5.2 Decisión de estilo de la IA

Cada rival elige un estilo de conducción antes de simular. En V1 se recomienda una asignación ponderada simple:

| Estilo | Peso base |
|--------|-----------|
| safe | 25% |
| balanced | 50% |
| aggressive | 25% |

Opcionalmente, la consistencia del rival puede sesgar la elección: pilotos con baja consistencia tienden más a `safe`, y pilotos con alta consistencia a `aggressive`.

### 5.3 Cálculo del ritmo efectivo por piloto

Para cada piloto se calcula un valor numérico que representa su rendimiento en la carrera. Un valor **menor** equivale a un mejor resultado (como un tiempo total de carrera).

```typescript
function calculateEffectivePace(
  rider: Rider,
  style: RidingStyle,
  track: Track,
  random: () => number
): { value: number; mistakeSeverity: number } {
  const styleConfig = CONFIG.RIDING_STYLES[style];

  // 1. Ritmo base invertido: mayor stat de pace => menor valor (mejor)
  const basePace = 10 - rider.stats.pace;

  // 2. Contribución del cornering según la técnica del circuito
  const corneringContribution =
    (10 - rider.stats.cornering) * CONFIG.CORNERING_WEIGHT * (track.technicality / 10);

  // 3. Modificador de estilo de conducción
  const stylePaceModifier = -styleConfig.paceModifier; // estilos agresivos reducen el valor

  // 4. Aleatoriedad de carrera a carrera
  const randomFactor = (random() * 2 - 1) * CONFIG.PACE_RANDOM_RANGE;

  // 5. Probabilidad y severidad del error
  const mistakeChance = Math.max(
    0.01,
    styleConfig.mistakeBaseChance -
      rider.stats.consistency * CONFIG.CONSISTENCY_MISTAKE_REDUCTION
  );

  let mistakeSeverity = 0;
  if (random() < mistakeChance) {
    // Severidad aleatoria entre 1.0 y 3.0
    const rawSeverity = 1.0 + random() * 2.0;
    mistakeSeverity =
      rawSeverity *
      CONFIG.MISTAKE_BASE_PENALTY *
      styleConfig.mistakeSeverityMultiplier;
  }

  const effectivePace =
    basePace +
    corneringContribution +
    stylePaceModifier +
    randomFactor +
    mistakeSeverity;

  return { value: effectivePace, mistakeSeverity };
}
```

### 5.4 Ordenación y asignación de posiciones

1. Se calcula el ritmo efectivo de los 10 pilotos.
2. Se ordenan de menor a mayor valor.
3. El primer elemento es el ganador, el segundo el segundo, etc.
4. Se asignan posiciones 1 a 10.

```typescript
function simulateRace(
  riders: Rider[],
  playerStyle: RidingStyle,
  track: Track,
  raceEventId: string,
  round: number
): RaceResult {
  const entries = riders.map((rider) => {
    const style = rider.isPlayer ? playerStyle : pickAIStyle(rider);
    const { value, mistakeSeverity } = calculateEffectivePace(rider, style, track, Math.random);
    return {
      riderId: rider.id,
      style,
      effectivePace: value,
      mistakeSeverity,
    };
  });

  entries.sort((a, b) => a.effectivePace - b.effectivePace);

  const results: RiderRaceResult[] = entries.map((entry, index) => ({
    riderId: entry.riderId,
    position: index + 1,
    points: CONFIG.POINTS_TABLE[index] ?? 0,
    style: entry.style,
    effectivePace: entry.effectivePace,
    mistakeSeverity: entry.mistakeSeverity,
  }));

  return { raceEventId, round, results };
}
```

### 5.5 Consideraciones del algoritmo

- El ritmo base se invierte para que pilotos más rápidos tengan valores menores.
- La aleatoriedad permite que pilotos con stats inferiores ganen ocasionalmente.
- `cornering` solo tiene peso parcial (40%) y se escala por la técnica del circuito.
- `consistency` reduce la probabilidad de error, no añade velocidad directa.
- Los estilos agresivos otorgan más velocidad pero aumentan tanto la probabilidad como la penalización del error.

---

## 6. Sistema de puntuación y clasificación

### 6.1 Puntuación por carrera

Se utiliza la tabla de puntos del `CONFIG.POINTS_TABLE`:

| Posición | Puntos |
|----------|--------|
| 1 | 25 |
| 2 | 18 |
| 3 | 15 |
| 4 | 12 |
| 5 | 10 |
| 6 | 8 |
| 7 | 6 |
| 8 | 4 |
| 9 | 2 |
| 10 | 1 |

### 6.2 Actualización de la clasificación

Tras cada carrera se recalculan las estadísticas acumuladas:

```typescript
function updateStandings(
  standings: ChampionshipStanding[],
  raceResult: RaceResult
): ChampionshipStanding[] {
  const next = standings.map((s) => ({ ...s }));

  for (const riderResult of raceResult.results) {
    const standing = next.find((s) => s.riderId === riderResult.riderId);
    if (!standing) continue;

    standing.points += riderResult.points;
    standing.finishedRaces += 1;
    standing.bestFinish = Math.min(standing.bestFinish, riderResult.position);

    if (riderResult.position === 1) standing.wins += 1;
    if (riderResult.position <= 3) standing.podiums += 1;
  }

  return next;
}
```

### 6.3 Orden final de clasificación

La clasificación se ordena por los siguientes criterios, en orden descendente de prioridad:

1. **Mayor número de puntos**.
2. **Mayor número de victorias**.
3. **Mayor número de podios**.
4. **Mejor posición individual obtenida** (menor valor numérico).
5. **Orden alfabético del nombre** (último recurso determinista).

### 6.4 Desempate por el campeonato

Si dos pilotos empatan a puntos al final de la temporada, se aplica la lista anterior. Si persiste el empate, se considera **posición compartida** o se usa el orden alfabético según decida el diseño. En V1 se recomienda mostrar ambos pilotos con la misma posición y el mismo título opcionalmente.

---

## 7. Escenas y UI

### 7.1 MainMenuScene

**Objetivo**: recoger datos iniciales e iniciar la temporada.

**Elementos visuales**:

- Título del juego.
- Campo de texto para el nombre del piloto.
- Campo de texto para el nombre del equipo.
- Botón "Empezar temporada".

**Comportamiento**:

- Validar que ambos campos no estén vacíos (mínimo 1 carácter, máximo 30).
- Al pulsar el botón, generar `GameState` y cambiar a `SeasonScene`.
- Mostrar instrucciones breves opcionales.

### 7.2 SeasonScene

**Objetivo**: mostrar el estado de la temporada y permitir correr la siguiente carrera.

**Elementos visuales**:

- Encabezado con nombre del piloto, equipo y ronda actual.
- Tarjeta de la próxima carrera: nombre del circuito, país, número de ronda.
- Selector de estilo de conducción (3 botones mutuamente excluyentes).
- Tabla de clasificación del campeonato (top 10).
- Mini-calendario con las 6 carreras y estado (pendiente / completada).
- Botón "Correr carrera" / "Ver resultados" / "Temporada finalizada" según el estado.

**Comportamiento**:

- Si `seasonFinished === false`:
  - Se muestra la próxima carrera.
  - El jugador debe elegir un estilo antes de pulsar "Correr carrera".
  - Por defecto puede estar seleccionado `balanced`.
- Si `seasonFinished === true`:
  - Se muestra un mensaje de campeón.
  - El botón principal cambia a "Jugar otra temporada".

### 7.3 RaceResultScene

**Objetivo**: mostrar el resultado de la carrera recién simulada.

**Elementos visuales**:

- Nombre del circuito y ronda.
- Tabla de resultados con posición, piloto, equipo, estilo y puntos.
- Indicador visual si el jugador ha cometido un error (opcional).
- Clasificación del campeonato actualizada.
- Botón "Continuar" que vuelve a `SeasonScene`.

**Comportamiento**:

- Animación opcional de revelación de posiciones (de último a primero o de primero a último).
- Destacar al jugador en la tabla.
- Si es la última carrera, mostrar mensaje "Temporada completada" y el campeón.

### 7.4 Componentes UI reutilizables

#### Button

```typescript
interface ButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
}
```

#### StandingsTable

- Recibe un array de `ChampionshipStanding` y un `Map<string, Rider>`.
- Renderiza filas con posición, nombre, equipo, puntos, victorias y podios.
- Resalta la fila del jugador.

#### RaceCard

- Muestra nombre del circuito, país, bandera (opcional) y estado de completitud.

---

## 8. Casos límite y manejo de errores

### 8.1 Entrada del jugador

- **Nombre vacío o solo espacios**: mostrar mensaje de error y no iniciar la temporada.
- **Nombre demasiado largo**: truncar o impedir más de 30 caracteres.
- **Caracteres especiales**: sanitizar para evitar problemas de renderizado; permitir letras, números, espacios y guiones.

### 8.2 Simulación

- **Empate técnico en ritmo efectivo**: añadir un desempate aleatorio minúsculo (`random() * 0.0001`) para garantizar orden total.
- **Piloto con stats mínimas (1,1,1)**: debe poder terminar carreras, aunque generalmente en últimas posiciones.
- **Piloto con stats máximas (10,10,10)**: debe ser competitivo, pero no ganar siempre gracias a la aleatoriedad.
- **Probabilidad de error reducida por consistencia**: nunca permitir probabilidad negativa; usar `Math.max(0.01, ...)`.

### 8.3 Puntuación

- **Todos los pilotos a 0 puntos al inicio**: correcto.
- **Posiciones fuera del top 10**: no se dan porque la parrilla siempre es de 10 pilotos, pero si se expande en el futuro, asignar 0 puntos.
- **Empate a puntos en la clasificación**: aplicar criterios de desempate descritos en 6.3.

### 8.4 Navegación

- **Volver atrás desde resultados**: siempre redirigir a `SeasonScene`, que mostrará la siguiente carrera o el final de temporada.
- **Reinicio de temporada**: al pulsar "Jugar otra temporada", descartar el `GameState` actual y crear uno nuevo.
- **Recarga de página**: el progreso se pierde (no hay guardado en V1).

### 8.5 Rendimiento

- El juego no requiere bucle de actualización complejo. La mayoría de las escenas pueden desactivar `update()` o dejarlo vacío.
- Las animaciones deben ser simples para mantener 60 FPS en dispositivos de gama media.

---

## 9. Estilo visual y experiencia de usuario

### 9.1 Paleta sugerida

| Uso | Color |
|-----|-------|
| Fondo principal | `#0f172a` (azul muy oscuro) |
| Paneles / tarjetas | `#1e293b` |
| Acento primario | `#f59e0b` (ámbar, estilo motociclismo) |
| Acento secundario | `#38bdf8` (cian) |
| Texto principal | `#f8fafc` |
| Texto secundario | `#94a3b8` |
| Éxito / victoria | `#22c55e` |
| Error / advertencia | `#ef4444` |

### 9.2 Tipografía

- Usar fuentes del sistema o una fuente web sans-serif legible (por ejemplo, Inter o Roboto).
- Tamaños sugeridos:
  - Título: 48 px
  - Encabezados de escena: 32 px
  - Texto de tabla: 18 px
  - Texto pequeño: 14 px

### 9.3 Feedback al jugador

- El estilo seleccionado debe resaltarse visualmente.
- Al pasar el ratón sobre un botón, cambiar ligeramente el color.
- En `RaceResultScene`, resaltar la fila del jugador con un color diferente.
- Mostrar mensajes de "Nueva victoria", "Podio" o "Error costoso" cuando corresponda.

---

## 10. Testing

### 10.1 Tests unitarios recomendados

- `seasonGenerator.ts`: verifica que se generen 6 carreras, 9 rivales y 1 jugador.
- `raceSimulator.ts`: ejecuta 1000 simulaciones y comprueba que:
  - Siempre hay 10 resultados.
  - Las posiciones van de 1 a 10 sin repetir.
  - El estilo agresivo produce más errores en promedio que el seguro.
  - Pilotos con mayor pace ganan más frecuentemente.
- `standingsCalculator.ts`: verifica que la suma de puntos asignados coincida con la suma de puntos de la clasificación.

### 10.2 Tests manuales

- Completar una temporada completa sin errores visuales.
- Verificar que la clasificación final se ordena correctamente.
- Probar en diferentes resoluciones de escritorio y móvil.

---

## 11. Roadmap y expansiones futuras

Las siguientes características están **expresamente fuera de V1** y se reservan para futuras versiones:

- Sistema económico (presupuesto, salarios).
- Mejoras de moto e I+D.
- Personal técnico e ingenieros.
- Contratos de pilotos.
- Patrocinadores.
- Múltiples temporadas y categorías de carrera.
- Clima y estrategia de neumáticos.
- Avatares de pilotos.
- Vista carrera a carrera vuelta por vuelta.

---

## 12. Glosario

| Término | Significado |
|---------|-------------|
| **Pace** | Velocidad bruta del piloto. |
| **Cornering** | Habilidad en secciones técnicas del circuito. |
| **Consistency** | Capacidad de evitar errores bajo presión. |
| **Riding style** | Estrategia de conducción elegida antes de cada carrera. |
| **Effective pace** | Valor numérico interno usado para ordenar los resultados. |
| **Mistake severity** | Magnitud de la penalización aplicada tras un error. |

---

## 13. Resumen de implementación

1. Configurar proyecto Vite + TypeScript + Phaser 3.
2. Definir tipos en `src/model/types.ts` y constantes en `src/config/gameConfig.ts`.
3. Implementar generadores de temporada y pilotos en `src/logic/`.
4. Implementar el simulador de carreras con fórmula documentada.
5. Implementar calculadora de clasificación y desempates.
6. Crear las tres escenas de Phaser y los componentes UI.
7. Conectar el flujo de escenas y el estado global.
8. Añadir validaciones, casos límite y pruebas.
9. Pulir estilo visual y feedback.
10. Entregar V1 funcional y lista para iterar.
