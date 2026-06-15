# MotoGT — Especificación Técnica Detallada V1

> Versión: 1.0  
> Fecha: 2026-06-15  
> Estado: Borrador inicial

---

## 1. Visión general

MotoGT es un juego de gestión de carreras de motociclismo minimalista. El jugador controla un único piloto a lo largo de una temporada de 6 carreras, tomando una decisión por carrera (estilo de conducción) y observando los resultados simulados. Sin física, sin reflejos — pura decisión estratégica.

### 1.1 Filosofía V1

- **Completar antes de expandir.** Todo lo que provocó el estancamiento de intentos anteriores (presupuestos, I+D, personal, contratos, patrocinadores) queda fuera.
- El objetivo es un bucle de temporada completo, jugable y publicable, del que se pueda crecer después.

### 1.2 Restricciones de alcance V1

| Incluido | Excluido (V2+) |
|----------|----------------|
| 1 piloto jugador + 9 IA | Dinero y presupuesto |
| 6 carreras, temporada única | Mejoras de moto / I+D |
| Una decisión por carrera (estilo) | Personal, ingenieros, contratos |
| Simulación por stats + estilo + aleatoriedad | Patrocinadores |
| Clasificación de campeonato en vivo | Múltiples temporadas / carreras |
| Sesión única (sin guardado) | Clima y estrategia de neumáticos |
| | Avatares de piloto |
| | Vista vuelta por vuelta en vivo |

---

## 2. Arquitectura del sistema

### 2.1 Stack tecnológico

| Componente | Tecnología | Versión recomendada |
|------------|-----------|-------------------|
| Lenguaje | TypeScript | 5.x |
| Motor de juego | Phaser 3 | 3.80+ |
| Build tool | Vite | 5.x |
| Runtime | Navegador (ES2020+) | Chrome/Firefox/Safari modernos |
| Gestor de paquetes | npm | 10.x |

### 2.2 Estructura de proyecto

```
moto-gt/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.png
└── src/
    ├── main.ts                  # Punto de entrada Phaser
    ├── config.ts                 # Constantes y configuración global
    ├── scenes/
    │   ├── MainMenuScene.ts      # Pantalla de título y creación de piloto
    │   ├── SeasonScene.ts         # Calendario, standings, selección de estilo
    │   └── RaceResultScene.ts     # Resultados de carrera y clasificación
    ├── models/
    │   ├── Rider.ts              # Clase/entity Rider
    │   ├── Track.ts              # Clase/entity Track
    │   ├── Season.ts             # Gestión de temporada y calendario
    │   └── Championship.ts       # Cálculo de clasificación y puntuación
    ├── simulation/
    │   ├── RaceSimulator.ts      # Motor de simulación de carrera
    │   └── RNG.ts                # Generador de números aleatorios (seeded)
    ├── generators/
    │   ├── RiderGenerator.ts     # Generación de pilotos IA
    │   └── TrackGenerator.ts    # Generación del calendario de pistas
    ├── ui/
    │   ├── StyleSelector.ts      # Widget de selección de estilo
    │   ├── StandingsTable.ts     # Tabla de clasificación reutilizable
    │   └── RiderCard.ts          # Tarjeta de stats de piloto
    └── constants/
        ├── points.ts             # Tabla de puntuación
        ├── tracks.ts             # Datos de pistas predefinidas
        └── names.ts              # Bancos de nombres para IA
```

### 2.3 Flujo de escenas

```
┌──────────────┐     startSeason()     ┌──────────────────┐
│  MainMenuScene│──────────────────────│   SeasonScene     │
│              │                       │                  │
│  - Nombre    │                       │  - Calendario    │
│  - Equipo    │                       │  - Standings     │
│  - Comenzar  │                       │  - Estilo [↓]    │
└──────────────┘                       │  - Siguiente Carr│
                                       └────────┬─────────┘
                                                │ simulateRace()
                                                ▼
                                       ┌──────────────────┐
                                       │ RaceResultScene   │
                                       │                  │
                                       │  - Posiciones    │
                                       │  - Puntos        │
                                       │  - Standings     │
                                       │  - [Siguiente]   │
                                       └────────┬─────────┘
                                                │
                                    ┌───────────┴──────────┐
                                    │                       │
                              raceIndex < 6           raceIndex >= 6
                                    │                       │
                                    ▼                       ▼
                           SeasonScene              (Pantalla de Campeón)
                           (siguiente carrera)      dentro de RaceResultScene
```

**Transiciones:**
1. `MainMenuScene` → `SeasonScene`: al confirmar nombre/equipo y pulsar "Comenzar Temporada".
2. `SeasonScene` → `RaceResultScene`: al seleccionar estilo y pulsar "Simular Carrera".
3. `RaceResultScene` → `SeasonScene`: al pulsar "Siguiente Carrera" (si quedan carreras).
4. `RaceResultScene` → `MainMenuScene`: al pulsar "Jugar de Nuevo" (tras coronar campeón, o en cualquier momento).

---

## 3. Modelos de datos

### 3.1 `Rider`

```typescript
interface RiderStats {
  pace: number;         // 1-10, velocidad pura
  cornering: number;    // 1-10, rendimiento en secciones técnicas
  consistency: number;  // 1-10, resistencia a errores
}

type RidingStyle = "safe" | "balanced" | "aggressive";

interface Rider {
  id: string;           // UUID o identificador único
  name: string;         // Nombre completo
  team: string;         // Nombre del equipo
  stats: RiderStats;    // Stats fijas durante V1 (no evolucionan)
  isPlayer: boolean;    // true para el piloto del jugador
}
```

**Restricciones de dominio:**
- `pace`, `cornering`, `consistency` son enteros en `[1, 10]` inclusive.
- Exactamente un piloto tiene `isPlayer === true`.
- El nombre del piloto IA se genera del banco de nombres; no se permite duplicado.

### 3.2 `Track`

```typescript
interface Track {
  id: string;
  name: string;          // Ej: "Circuito de Valencia"
  country: string;        // Ej: "España"
  corners: number;        // Cantidad de curvas (8-16), afecta peso de cornering
  straightLength: number; // Longitud de recta principal (0.6-1.4), pondera pace
}
```

**Nota de diseño:** Cada pista tiene atributos que modulan el peso de cada stat en la simulación. Más curvas = más peso a `cornering`; recta más larga = más peso a `pace`. Esto asegura que ciertos pilotos sean mejores en ciertos circuitos.

### 3.3 `RaceEntry` (resultado de una carrera para un piloto)

```typescript
interface RaceEntry {
  riderId: string;
  style: RidingStyle;
  rawScore: number;      // Score calculado pre-aleatoriedad
  mistakeRoll: number;   // Resultado de tirada de error (0 si no hubo error)
  finalScore: number;    // rawScore - mistakeRoll (puesto determinado por orden desc.)
  position: number;      // 1-10, posición final en carrera (1 = ganador)
  points: number;        // Puntos según tabla de puntuación
  hadMistake: boolean;   // Si sufrió un error en la carrera
}
```

### 3.4 `Season`

```typescript
interface Season {
  id: string;
  riders: Rider[];            // 10 pilotos (1 jugador + 9 IA)
  tracks: Track[];             // 6 pistas en orden de calendario
  results: RaceEntry[][];     // results[raceIndex][riderIndex], crece con cada carrera
  currentRaceIndex: number;    // 0-5, índice de la próxima carrera (-1 si no ha comenzado)
  isFinished: boolean;
}
```

### 3.5 `ChampionshipStanding`

```typescript
interface ChampionshipStanding {
  riderId: string;
  riderName: string;
  teamName: string;
  totalPoints: number;
  positions: (number | null)[];  // Posición en cada carrera (null si no corrió aún)
}
```

---

## 4. Configuración y constantes

### 4.1 Tabla de puntuación

```typescript
const POINTS_TABLE: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};
```

### 4.2 Parámetros de estilo de conducción

```typescript
interface StyleParams {
  paceModifier: number;      // Multiplicador aplicado al pace efectivo
  mistakeProbability: number; // Probabilidad base de cometer un error (0-1)
  mistakePenaltyRange: [number, number]; // Rango de penalización al score si hay error
}

const STYLE_PARAMS: Record<RidingStyle, StyleParams> = {
  safe: {
    paceModifier: 0.80,        // -20% pace efectivo
    mistakeProbability: 0.05,   // 5% de probabilidad de error
    mistakePenaltyRange: [5, 15], // Penalización leve si ocurre
  },
  balanced: {
    paceModifier: 1.00,        // Sin modificación
    mistakeProbability: 0.15,  // 15% de probabilidad de error
    mistakePenaltyRange: [10, 30],
  },
  aggressive: {
    paceModifier: 1.20,        // +20% pace efectivo
    mistakeProbability: 0.35,  // 35% de probabilidad de error
    mistakePenaltyRange: [20, 50], // Penalización severa si ocurre
  },
};
```

**Nota:** Los modificadores de pace se aplican al score antes de la comparación, no directamente al stat del piloto. Esto preserva el stat original para uso en cálculos futuros.

### 4.3 Configuración de generación de pilotos IA

```typescript
const AI_RIDER_CONFIG = {
  count: 9,
  totalBudget: 18,           // Suma objetivo de stats (pace+cornering+consistency)
  budgetVariance: 4,         // ±4 variación permitida sobre el presupuesto
  minStat: 1,
  maxStat: 10,
};
```

### 4.4 Calendario de pistas (6 predefinidas)

```typescript
const TRACK_SCHEDULE: Track[] = [
  { id: "t1", name: "Circuito de Valencia",  country: "España",    corners: 14, straightLength: 0.8 },
  { id: "t2", name: "Mugello",               country: "Italia",     corners: 10, straightLength: 1.1 },
  { id: "t3", name: "Sachsenring",           country: "Alemania",   corners: 13, straightLength: 0.7 },
  { id: "t4", name: "Phillip Island",         country: "Australia",  corners: 12, straightLength: 0.9 },
  { id: "t5", name: "Termas de Río Hondo",   country: "Argentina",  corners: 9,  straightLength: 1.3 },
  { id: "t6", name: "Circuito de Jerez",      country: "España",    corners: 15, straightLength: 0.6 },
];
```

### 4.5 Configuración del algoritmo de simulación

```typescript
const SIM_CONFIG = {
  // Pesos base de cada stat en el score crudo
  paceWeight: 0.45,
  corneringWeight: 0.30,
  consistencyWeight: 0.25,
  
  // Factores de ajuste por pista
  corneringTrackFactor: 0.06,   // Cada curva sobre 10 agrega +6% peso a cornering
  straightTrackFactor: 0.15,     // Cada 0.1 de straightLength sobre 0.8 agrega +15% peso a pace
  
  // Aleatoriedad
  randomnessMin: 0,              // Rango uniforme de ruido
  randomnessMax: 12,
  
  // Consistencia y errores
  consistencyMistakeReduction: 0.07, // Cada punto de consistencia reduce prob. de error en 7%
};
```

---

## 5. Lógica de juego — Algoritmos detallados

### 5.1 Generación de pilotos IA

**Algoritmo `generateAIRiders()`:**

1. Para cada uno de los 9 pilotos IA:
   a. Seleccionar un nombre único del banco de nombres (`firstNames` × `lastNames`).
   b. Generar un nombre de equipo del banco de equipos.
   c. Asignar stats:
      - Calcular presupuesto: `budget = totalBudget + random(-budgetVariance/2, +budgetVariance/2)`.
      - Distribuir `budget` puntos entre `pace`, `cornering`, `consistency` usando asignación aleatoria con restricción de que cada stat esté en `[minStat, maxStat]`.
      - **Algoritmo de distribución:**
        1. Asignar a cada stat `minStat` (1). Gastar `3` del presupuesto.
        2. Distribuir los puntos restantes uno a uno, eligiendo un stat aleatorio uniformemente (si no ha llegado a `maxStat`).
   d. Crear `Rider` con `isPlayer: false`.

**Validación post-generación:**
- No puede haber dos pilotos con el mismo nombre completo.
- Cada stat está en `[1, 10]`.
- La suma de stats está en `[totalBudget - budgetVariance, totalBudget + budgetVariance]`.

### 5.2 Asignación de estilo a pilotos IA

Antes de cada carrera, cada piloto IA selecciona un estilo automáticamente:

**Algoritmo `selectAIStyle(rider: Rider): RidingStyle`:**

```
60% probabilidad → "balanced"
20% probabilidad → "safe"
20% probabilidad → "aggressive"
```

**Variante estratégica (recomendada):** Los pilotos IA ajustan ligeramente su preferencia según su stat de consistencia:

- Si `consistency >= 7`: 15% safe, 45% balanced, 40% aggressive
- Si `consistency <= 3`: 35% safe, 50% balanced, 15% aggressive
- Si `3 < consistency < 7`: usar probabilidades base (20/60/20)

Esto crea IA que "toman decisiones razonables" basadas en sus propias fortalezas.

### 5.3 Simulación de carrera — Algoritmo central

**Algoritmo `simulateRace(season: Season, style: RidingStyle): RaceEntry[]`**

Pseudo-código detallado:

```
function simulateRace(season, playerStyle):
  track = season.tracks[season.currentRaceIndex]
  entries = []

  for each rider in season.riders:
    // 1. Determinar estilo
    style = rider.isPlayer ? playerStyle : selectAIStyle(rider)
    styleParams = STYLE_PARAMS[style]

    // 2. Calcular peso efectivo por pista
    paceW = SIM_CONFIG.paceWeight 
             + (track.straightLength - 0.8) * SIM_CONFIG.straightTrackFactor * (1/SIM_CONFIG.paceWeight)
    cornerW = SIM_CONFIG.corneringWeight 
              + (track.corners - 10) * SIM_CONFIG.corneringTrackFactor * (1/SIM_CONFIG.corneringWeight)
    consistW = 1.0 - paceW - cornerW  // consistencia absorbe el resto
    
    // Normalizar pesos para que sumen 1.0
    total = paceW + cornerW + consistW
    paceW /= total
    cornerW /= total
    consistW /= total

    // 3. Score base (stats × pesos × modificador de estilo)
    baseScore = rider.stats.pace * paceW
               + rider.stats.cornering * cornerW
               + rider.stats.consistency * consistW
    
    styleModifiedScore = baseScore * styleParams.paceModifier

    // 4. Componente aleatorio
    randomComponent = uniformRandom(SIM_CONFIG.randomnessMin, SIM_CONFIG.randomnessMax)

    // 5. Verificar error
    mistakeProbability = styleParams.mistakeProbability 
                         - (rider.stats.consistency * SIM_CONFIG.consistencyMistakeReduction)
    mistakeProbability = clamp(mistakeProbability, 0.01, 0.99)  // nunca 0 ni 1
    
    hadMistake = randomFloat(0, 1) < mistakeProbability
    mistakePenalty = 0
    if hadMistake:
      mistakePenalty = uniformRandom(
        styleParams.mistakePenaltyRange[0], 
        styleParams.mistakePenaltyRange[1]
      )

    // 6. Score final
    finalScore = styleModifiedScore + randomComponent - mistakePenalty
    
    entries.push({
      riderId: rider.id,
      style: style,
      rawScore: styleModifiedScore + randomComponent,
      mistakeRoll: mistakePenalty,
      finalScore: finalScore,
      position: 0, // se asigna después
      points: 0,   // se asigna después
      hadMistake: hadMistake,
    })

  // 7. Ordenar por finalScore descendente y asignar posiciones
  sort entries descending by finalScore
  
  for i = 0 to entries.length - 1:
    entries[i].position = i + 1
    entries[i].points = POINTS_TABLE[entries[i].position] or 0

  return entries
```

### 5.4 Casos especiales y edge cases en la simulación

| Caso | Tratamiento |
|------|------------|
| **Empate en finalScore** | Desempatar por: (1) pace más alto del piloto, (2) aleatorio. Los empates son raros pero posibles con valores continuos. |
| **Piloto con consistency = 10 en estilo aggressive** | La probabilidad de error queda en `0.35 - (10 × 0.07) = 0.35 - 0.70 = -0.35`, clamp a `0.01`. Esto significa que incluso el piloto más consistente tiene un 1% de probabilidad de error cuando es aggressive. |
| **Piloto con consistency = 1 en estilo safe** | La probabilidad de error queda en `0.05 - (1 × 0.07) = -0.02`, clamp a `0.01`. Safe es siempre seguro, con un mínimo de 1%. |
| **Piloto con todas stats = 1** | Score base bajo. Puede ganar solo con mucha suerte (randomness alto) y errores de rivales. |
| **Piloto con todas stats = 10** | Dominante pero no invencible. Un piloto con stats medias en aggressive puede ganar si no comete errores. |
| **Todos los pilotos eligen safe** | Menos variabilidad, las stats dominan más. Carreras más predecibles. |
| **Piloto IA siempre elige aggressive** | No ocurre por diseño (máximo 40% de probabilidad, solo si consistency >= 7). |

### 5.5 Clasificación de campeonato

**Algoritmo `getStandings(season: Season): ChampionshipStanding[]`**

```
function getStandings(season):
  standings = []
  for each rider in season.riders:
    totalPoints = 0
    positions = array of 6 nulls
    for raceIndex = 0 to season.results.length - 1:
      entry = find entry where entry.riderId == rider.id in season.results[raceIndex]
      totalPoints += entry.points
      positions[raceIndex] = entry.position
    standings.push({
      riderId: rider.id,
      riderName: rider.name,
      teamName: rider.team,
      totalPoints: totalPoints,
      positions: positions,
    })
  sort standings descending by totalPoints
  return standings
```

**Desempate en campeonato:**
1. Más puntos gana.
2. Si hay empate en puntos: mayor cantidad de victorias (posición 1).
3. Si persiste: mayor cantidad de podios (posición 1-3).
4. Si persiste: mejor posición en la última carrera disputada.

---

## 6. Generación de números pseudoaleatorios

Se debe usar un RNG con semilla (**seeded RNG**) para garantizar reproducibilidad en testing y depuración. Se recomienda implementar un generador xorshift32 o similar.

```typescript
class SeededRNG {
  private state: number;
  
  constructor(seed: number) {
    this.state = seed;
  }
  
  // Retorna un entero en [min, max] inclusive
  nextInt(min: number, max: number): number;
  
  // Retorna un flotante en [0, 1)
  nextFloat(): number;
  
  // Retorna un flotante en [min, max)
  nextFloatRange(min: number, max: number): number;
}
```

**Uso:**
- La semilla se genera al inicio de la temporada usando `Date.now()` o similar.
- La misma semilla se almacena en `Season` para reproducibilidad en debugging.
- En modo de desarrollo, se puede pasar una semilla fija para testing determinista.

---

## 7. Escenas de UI — Detalle de implementación

### 7.1 `MainMenuScene`

**Propósito:** Pantalla de título, ingreso de nombre del piloto y equipo, inicio de temporada.

**Elementos UI:**
- Logo/título "MotoGT" (texto Phaser, formato grande).
- Campo de texto para nombre del piloto (por defecto: "Player").
- Campo de texto para nombre del equipo (por defecto: "Team Alpha").
- Botón "Comenzar Temporada" → transición a `SeasonScene`.

**Validaciones:**
- Nombre del piloto: 1-20 caracteres, no vacío.
- Nombre del equipo: 1-25 caracteres, no vacío.
- Si los campos están vacíos al pulsar el botón, usar los valores por defecto.

**Interacción:** Solo teclado o clic según la plataforma. No se requiere gamepad para V1.

**Estado almacenado:** Al pulsar "Comenzar Temporada", se crea un objeto `Season` con:
- `riders[0]` = piloto del jugador (stats por defecto: 6/6/6 o elección del jugador — ver sección 7.1.1).
- `riders[1-9]` = pilotos IA generados.
- `tracks` = las 6 pistas del calendario fijo.
- `currentRaceIndex = 0`.
- `results = []`.

**7.1.1 Stats del piloto del jugador:**

Opción A (recomendada para V1): Stats fijas equilibradas `pace: 6, cornering: 6, consistency: 6`. Esto mantiene el juego simple y predictible.

Opción B (alternativa): Distribución de puntos. Presupuesto de 18 puntos a repartir entre las 3 stats, mínimo 1, máximo 10 cada una. Se implementa con tres sliders o selectores numéricos.

> **Decisión de diseño:** Se recomienda la Opción A para V1. La distribución de puntos agrega complejidad de UI sin agregar profundidad estratégica significativa en un juego de 6 carreras.

### 7.2 `SeasonScene`

**Propósito:** Centro del juego. Muestra calendario, standings, stats del piloto, y permite seleccionar estilo para la próxima carrera.

**Elementos UI:**

1. **Panel de calendario (izquierda/arriba):**
   - Lista de 6 carreras con: nombre de pista, país, número de curvas, longitud de recta.
   - Carreras ya completadas muestran la posición del jugador (ej: "P3").
   - La próxima carrera está resaltada.
   - Carreras futuras aparecen atenuadas.

2. **Panel del piloto (centro):**
   - Nombre del piloto, equipo.
   - Stats: Pace, Cornering, Consistency — mostradas como barras con valor numérico.
   - Indicador de posición actual en el campeonato.

3. **Selector de estilo (centro/abajo):**
   - Tres botones: `🔒 Safe`, `⚖️ Balanced`, `🔥 Aggressive`.
   - Al seleccionar uno, se muestra un tooltip/resumen:
     - Pace efectivo estimado (modificador).
     - Probabilidad de error estimada (basada en consistencia del piloto).
   - Solo se puede seleccionar para la carrera actual.

4. **Panel de standings (derecha/abajo):**
   - Tabla: Posición | Nombre | Equipo | Puntos | [Diferencia con líder]
   - Actualizada en tiempo real tras cada carrera.
   - El piloto del jugador resaltado en color.

5. **Botón "Simular Carrera" (abajo):**
   - Solo activo si se ha seleccionado un estilo.
   - Al pulsar → transición a `RaceResultScene`.

**Consideraciones de layout:**
- En pantallas estrechas (móvil), usar layout vertical con scroll.
- Los paneles de calendario y standings pueden ser colapsables con tabs.
- Se recomienda un diseño de dos columnas en desktop: izquierda para calendario+piloto, derecha para standings.

### 7.3 `RaceResultScene`

**Propósito:** Mostrar resultados de la carrera recién simulada y actualizar la clasificación.

**Elementos UI:**

1. **Resultados de carrera (principal):**
   - Tabla: Posición | Nombre | Equipo | Estilo | ¿Error? | Tiempo/Gap | Puntos
   - El piloto del jugador resaltado.
   - Pilotos que cometieron error marcados con icono ⚠️.
   - Gap mostrado como diferencia con el líder (el líder muestra "WINNER").

2. **Clasificación actualizada de campeonato:**
   - Tabla similar a la de `SeasonScene`.
   - Animación de actualización si es posible (puntos nuevos iluminados).

3. **Indicadores de carrera:**
   - Texto: "Carrera X de 6 — [Nombre de Pista]".
   - Si es la última carrera: "¡Final de temporada!".

4. **Botones de navegación:**
   - Si `currentRaceIndex < 5`: botón "Siguiente Carrera →" → transición a `SeasonScene`.
   - Si `currentRaceIndex === 5` (última carrera completada): 
     - Mostrar título de campeón.
     - Botón "Jugar de Nuevo" → transición a `MainMenuScene`.
   - Botón "Abandonar Temporada" disponible siempre → confirmación → `MainMenuScene`.

**7.3.1 Anuncio del campeón:**

Tras la última carrera, si el piloto del jugador es campeón:
- Texto grande: "¡CAMPEÓN DEL MUNDO!" con animación de celebración.
- Mostrar stats de la temporada: victorias, podios, puntos totales.

Si no es campeón:
- Texto: "Posición final: P[X]" con el nombre del campeón.
- Motivación para reintentar.

---

## 8. Bucle de juego — Flujo de estado detallado

```
state: {
  season: Season | null,
  selectedStyle: RidingStyle | null,
  gamePhase: 'menu' | 'season' | 'result'
}
```

### 8.1 Ciclo de vida completo

```
1. [Inicio] → MainMenuScene
   - season = null
   - gamePhase = 'menu'

2. [Crear temporada] → SeasonScene
   - season = createSeason(playerName, teamName)
   - season.currentRaceIndex = 0
   - gamePhase = 'season'
   - selectedStyle = null

3. [Seleccionar estilo] → (permanece en SeasonScene)
   - selectedStyle = 'safe' | 'balanced' | 'aggressive'
   - Botón "Simular" se habilita

4. [Simular] → RaceResultScene
   - season.results[currentRaceIndex] = simulateRace(season, selectedStyle)
   - season.currentRaceIndex++
   - gamePhase = 'result'

5a. [Siguiente carrera (si currentRaceIndex < 6)] → SeasonScene
    - gamePhase = 'season'
    - selectedStyle = null

5b. [Fin de temporada (si currentRaceIndex === 6)] → RaceResultScene (permanece)
    - season.isFinished = true
    - Mostrar campeón
    - Botón "Jugar de Nuevo"

6. [Reiniciar] → MainMenuScene
   - season = null
   - gamePhase = 'menu'
```

### 8.2 Estado no persistido

V1 no implementa guardado. Todo el estado vive en memoria (en los objetos Phaser Scene y el objeto `Season`). Al recargar la página, el juego se reinicia completamente.

---

## 9. Detalles de implementación de Phaser 3

### 9.1 Configuración del juego

```typescript
// main.ts
import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainMenuScene, SeasonScene, RaceResultScene],
};

const game = new Phaser.Game(config);
```

### 9.2 Gestión de datos entre escenas

Se usa el sistema de `registry` de Phaser para compartir el estado del `Season` y el `SeededRNG` entre escenas:

```typescript
// Al crear la temporada en MainMenuScene:
this.registry.set('season', season);
this.registry.set('rng', rng);

// Al acceder desde cualquier escena:
const season = this.registry.get('season') as Season;
```

Alternativamente, se puede crear una clase `GameDataManager` singleton accesible desde todas las escenas.

### 9.3 Sistema de UI

V1 usa **solo elementos DOM叠加 sobre Phaser** o **Phaser GameObjects** (Texto, Rect, Container). No se usa un framework UI externo.

**Opción recomendada para V1:** Phaser GameObjects exclusivamente. Esto mantiene todo dentro del canvas y simplifica el despliegue.

**Componentes UI base:**
- `UITextButton`: Botón clickeable con estado hover/pressed.
- `UIPanel`: Panel con fondo y borde.
- `UITable`: Tabla con filas y columnas para standings y resultados.
- `UIStatBar`: Barra visual para mostrar stats (1-10).

### 9.4 Fuentes y estilos

```typescript
const STYLES = {
  title: { fontSize: '48px', fontFamily: 'Arial', color: '#ffffff' },
  heading: { fontSize: '24px', fontFamily: 'Arial', color: '#e0e0e0' },
  body: { fontSize: '16px', fontFamily: 'Arial', color: '#cccccc' },
  small: { fontSize: '12px', fontFamily: 'Arial', color: '#999999' },
  accent: { fontSize: '16px', fontFamily: 'Arial', color: '#4fc3f7' },
  warning: { fontSize: '16px', fontFamily: 'Arial', color: '#ff7043' },
  success: { fontSize: '24px', fontFamily: 'Arial', color: '#66bb6a' },
};

const COLORS = {
  background: 0x1a1a2e,
  panel: 0x16213e,
  panelBorder: 0x0f3460,
  accent: 0x4fc3f7,
  warning: 0xff7043,
  success: 0x66bb6a,
  text: 0xffffff,
  textMuted: 0x999999,
};
```

---

## 10. Banco de datos de IA

### 10.1 Nombres de piloto

Se deben incluir al menos 40 nombres y 40 apellidos para combinaciones únicas.

```typescript
const FIRST_NAMES = [
  "Marco", "Luca", "Alex", "Dani", "Jorge", "Fabio", "Andrea", "Miguel",
  "Taka", "Ai", "Ryu", "Ken", "Jack", "Sam", "Tyler", "Jake",
  "Pierre", "Louis", "Hans", "Kurt", "Stefan", "Nikolai", "Viktor", "Dmitri",
  "Chen", "Wei", "Hiro", "Yuki", "Park", "Kim", "Ravi", "Arjun",
  "Liam", "Oscar", "Ethan", "Noah", "Finn", "Omar", "Karim", "Rashid",
];

const LAST_NAMES = [
  "Rossi", "Lopez", "Smith", "Müller", "Tanaka", "Nakamura", "Chen", "Kim",
  "Dubois", "Moreau", "Fischer", "Weber", "Ivanov", "Petrov", "Park", "Singh",
  "Patel", "Khan", "Williams", "Johnson", "Anderson", "Taylor", "Brown", "Davis",
  "Martinez", "Garcia", "Rodriguez", "Hernandez", "Silva", "Santos", "Costa", "Ferreira",
  "Johansson", "Eriksson", "Nielsen", "Hansen", "Murphy", "O'Brien", "Campbell", "Stewart",
];
```

### 10.2 Nombres de equipo

```typescript
const TEAM_NAMES = [
  "Storm Racing", "Thunder Motors", "Eagle Squad", "Falcon Team",
  "Titan Racing", "Apex Motors", "Nova Squad", "Blaze Racing",
  "Vortex Team", "Phantom Racing",
];
```

**Asignación:** El jugador siempre recibe `TEAM_NAMES[0]` ("Storm Racing") a menos que ingrese un nombre personalizado. Los 9 equipos IA reciben los demás en orden aleatorio.

---

## 11. Casos límite y manejo de errores

### 11.1 Casos límite de simulación

| Caso | Manejo |
|------|--------|
| Dos pilotos con mismo `finalScore` | Desempate por `pace` stat, luego por random. |
| `mistakeProbability <= 0` tras aplicar consistencia | Clamp a `0.01` (siempre hay riesgo mínimo). |
| `mistakeProbability >= 1` | Clamp a `0.99` (siempre hay chance de no errar). |
| `finalScore < 0` (tras error grave) | Permitir. El piloto queda detrás de todos los que no erraron, pero aún tiene posición registrada (último lugar). |
| Error del piloto del jugador | Mostrar indicador visual claro en `RaceResultScene`. |
| Todas las carreras ya simuladas | La temporada marca `isFinished = true`. No se puede simular más. |

### 11.2 Casos límite de UI

| Caso | Manejo |
|------|--------|
| Nombre vacío del piloto | Usar valor por defecto "Player". |
| Nombre vacío del equipo | Usar valor por defecto "Team Alpha". |
| No se selecciona estilo y se pulsa "Simular" | Botón deshabilitado / mensaje "Selecciona un estilo". |
| Navegador con pantalla muy pequeña | V1 no guarantee de soporte móvil, pero usar Scale.FIT para adaptación básica. |
| Piloto del jugador queda último | Mostrar resultado sin glorificar; la clasificación refleja la posición real. |
| Empate por el título en la última carrera | Aplicar reglas de desempate (ver 5.5). |

### 11.3 Errores de runtime

| Error | Manejo |
|-------|--------|
| `simulateRace` llamada con `currentRaceIndex >= 6` | Lanzar error explícito: "All races have been simulated." |
| Piloto no encontrado en resultados | Lanzar error: "Rider {id} not found in race results." |
| Stats fuera de rango [1, 10] | Validar al crear; lanzar error si se viola. |
| Nombre de piloto IA duplicado | Regenerar nombre hasta que sea único (máximo 100 intentos, luego lanzar error). |

---

## 12. Testing

### 12.1 Tests unitarios (prioridad alta)

1. **`RiderGenerator`**: Verificar que stats están en [1,10], suma en rango esperado, nombres únicos.
2. **`RaceSimulator.simulateRace()`**: Con semilla fija, verificar determinismo. Verificar que posiciones están en [1,10] sin duplicados.
3. **`Championship.getStandings()`**: Verificar cálculo de puntos y orden.
4. **Desempate de campeonato**: Verificar que desempates se resuelven correctamente.
5. **Probabilidad de error**: Verificar clamp a [0.01, 0.99].
6. **Modificadores de estilo**: Verificar que safe reduce pace, aggressive lo aumenta.

### 12.2 Tests de integración

1. **Bucle completo de temporada**: Simular 6 carreras, verificar que `isFinished` es true y hay un campeón.
2. **Piloto del jugador siempre en resultados**: Verificar que el piloto del jugador aparece en cada `RaceEntry[]`.
3. **Total de puntos por carrera**: Verificar que la suma de puntos de una carrera es `25+18+15+12+10+8+6+4+2+1 = 101`.

### 12.3 Tests de regresión

1. Con semilla `12345`, piloto `"Test Rider"`, estilo `"balanced"`, los resultados deben ser idénticos en cada ejecución.
2. Un piloto con stats `{pace: 10, cornering: 10, consistency: 10}` en estilo `"safe"` debe terminar en el top 3 en al menos el 90% de las simulaciones (verificado con 1000 iteraciones).

---

## 13. Estructura de archivos — Detalle por módulo

### 13.1 `src/models/Rider.ts`

```typescript
export interface RiderStats {
  pace: number;
  cornering: number;
  consistency: number;
}

export type RidingStyle = "safe" | "balanced" | "aggressive";

export interface Rider {
  id: string;
  name: string;
  team: string;
  stats: RiderStats;
  isPlayer: boolean;
}

export function createRider(
  id: string, 
  name: string, 
  team: string, 
  stats: RiderStats, 
  isPlayer: boolean
): Rider;

export function totalStats(rider: Rider): number;
```

### 13.2 `src/models/Track.ts`

```typescript
export interface Track {
  id: string;
  name: string;
  country: string;
  corners: number;
  straightLength: number;
}

export function getTrackWeights(track: Track): { paceW: number; cornerW: number; consistW: number };
```

### 13.3 `src/models/Season.ts`

```typescript
export interface Season {
  id: string;
  riders: Rider[];
  tracks: Track[];
  results: RaceEntry[][];
  currentRaceIndex: number;
  isFinished: boolean;
  seed: number;
}

export function createSeason(playerName: string, teamName: string, seed?: number): Season;
export function getCurrentTrack(season: Season): Track;
export function advanceToNextRace(season: Season): void;
```

### 13.4 `src/models/Championship.ts`

```typescript
export interface ChampionshipStanding {
  riderId: string;
  riderName: string;
  teamName: string;
  totalPoints: number;
  positions: (number | null)[];
  wins: number;
  podiums: number;
}

export function getStandings(season: Season): ChampionshipStanding[];
export function getChampion(season: Season): ChampionshipStanding;
export function getPlayerStanding(season: Season, playerId: string): ChampionshipStanding;
```

### 13.5 `src/simulation/RaceSimulator.ts`

```typescript
export interface RaceEntry {
  riderId: string;
  style: RidingStyle;
  rawScore: number;
  mistakeRoll: number;
  finalScore: number;
  position: number;
  points: number;
  hadMistake: boolean;
}

export function simulateRace(season: Season, playerStyle: RidingStyle, rng: SeededRNG): RaceEntry[];
```

### 13.6 `src/simulation/RNG.ts`

```typescript
export class SeededRNG {
  constructor(seed: number);
  nextInt(min: number, max: number): number;
  nextFloat(): number;
  nextFloatRange(min: number, max: number): number;
  pickRandom<T>(array: T[]): T;
}
```

### 13.7 `src/generators/RiderGenerator.ts`

```typescript
export function generateAIRiders(count: number, rng: SeededRNG, existingNames: string[]): Rider[];
export function generateStats(rng: SeededRNG): RiderStats;
export function generateName(rng: SeededRNG, existingNames: string[]): string;
```

---

## 14. Consideraciones de rendimiento

- **Simulación:** O(n) donde n=10. Sin preocupaciones de rendimiento.
- **Clasificación:** O(n log n) con n=10. Despreciable.
- **UI:** Phaser maneja 60 FPS sin problemas con esta cantidad de elementos.
- **Memoria:** El estado completo de la temporada es < 10KB. Sin preocupaciones.

---

## 15. Internacionalización (i18n)

V1 no requiere soporte de internacionalización, pero se recomienda:

- Centralizar todos los strings de UI en un archivo `src/constants/strings.ts`.
- Estructurar los strings como un diccionario para facilitar la futura adición de idiomas:

```typescript
const STRINGS = {
  en: {
    title: "MotoGT",
    startSeason: "Start Season",
    safe: "Safe",
    balanced: "Balanced",
    aggressive: "Aggressive",
    // ...
  },
  es: {
    title: "MotoGT",
    startSeason: "Comenzar Temporada",
    safe: "Seguro",
    balanced: "Equilibrado",
    aggressive: "Agresivo",
    // ...
  }
};
```

V1 implementa solo `en`.

---

## 16. Plan de implementación sugerido

| Fase | Tarea | Estimación |
|------|-------|-----------|
| 1 | Setup de proyecto (Vite + Phaser + TS) | 1 hora |
| 2 | Modelos de datos (`Rider`, `Track`, `Season`, `Championship`) | 2 horas |
| 3 | RNG y generadores (`SeededRNG`, `RiderGenerator`, `TrackGenerator`) | 2 horas |
| 4 | Motor de simulación (`RaceSimulator`) | 3 horas |
| 5 | `MainMenuScene` (título + inputs) | 2 horas |
| 6 | `SeasonScene` (calendario + stats + selector de estilo) | 4 horas |
| 7 | `RaceResultScene` (resultados + standings) | 3 horas |
| 8 | Integración de flujo entre escenas | 2 horas |
| 9 | Tests unitarios | 3 horas |
| 10 | Pulido visual y UX | 4 horas |
| **Total** | | **~26 horas** |

---

## 17. Apéndice — Fórmulas resumidas

### Score final de un piloto en una carrera:

```
finalScore = (pace × paceW + cornering × cornerW + consistency × consistW) 
           × stylePaceModifier 
           + U(randomnessMin, randomnessMax)
           - mistakePenalty (si hubo error)

donde:
  paceW, cornerW, consistW = pesos ajustados por pista (normalizados a 1.0)
  stylePaceModifier = {0.80 | 1.00 | 1.20} según estilo
  mistakePenalty = U(mistakePenaltyRange[0], mistakePenaltyRange[1]) si randomFloat < mistakeProbability
  mistakeProbability = clamp(styleMistakeProbability - consistency × 0.07, 0.01, 0.99)
```

### Posición final:

```
posición = rank(finalScore, descendente) 
  desempate: pace stat, luego random
```

### Puntos de campeonato:

```
puntos(posición) = {25, 18, 15, 12, 10, 8, 6, 4, 2, 1} para posiciones 1-10
```

### Clasificación:

```
standing = suma de puntos en todas las carreras disputadas
  desempate: victorias > podios > mejor posición en última carrera
```