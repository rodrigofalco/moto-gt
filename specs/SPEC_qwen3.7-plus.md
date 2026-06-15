# MotoGT — Especificacion Tecnica (V1)

> **Version:** 1.0
> **Idioma:** Espanol (castellano)
> **Fecha:** 2025-06-15
> **Objetivo:** Documento de especificacion tecnica completo e independiente para la primera version jugable del juego.

---

## Tabla de Contenidos

1. [Introduccion y Vision General](#1-introduccion-y-vision-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
   - 2.1 Stack Tecnologico
   - 2.2 Estructura de Archivos del Proyecto
   - 2.3 Ciclo de Escenas (Scene Graph)
   - 2.4 Gestion de Estado
   - 2.5 Flujo de Datos
3. [Modelos de Datos](#3-modelos-de-datos)
   - 3.1 RiderStats
   - 3.2 Rider
   - 3.3 Track
   - 3.4 RidingStyle
   - 3.5 FinishingPosition
   - 3.6 RaceResult
   - 3.7 SeasonState
   - 3.8 PointsTable
4. [Logica del Juego](#4-logica-del-juego)
   - 4.1 Ciclo Principal (Game Loop)
   - 4.2 Generacion de la Temporada
   - 4.3 Generacion de Rivales IA
   - 4.4 Seleccion de Estilo para Pilotos IA
   - 4.5 Algoritmo de Simulacion de Carrera
   - 4.6 Sistema de Puntuacion
   - 4.7 Tabla de Posiciones del Campeonato
   - 4.8 Desempates en el Campeonato
   - 4.9 Fin de Temporada
5. [Algoritmo de Simulacion — Detalle Exhaustivo](#5-algoritmo-de-simulacion--detalle-exhaustivo)
   - 5.1 Formula General
   - 5.2 Modificador por Estilo de Pilotaje
   - 5.3 Contribucion del Cornering y Factor Tecnico
   - 5.4 Ruido Aleatorio (Random Noise)
   - 5.5 Sistema de Errores (Mistake System)
   - 5.6 Penalizacion por Error
   - 5.7 Ordenamiento Final y Desempate Intra-Carrera
   - 5.8 Ejemplo Numerico Paso a Paso
   - 5.9 Calibracion de Constantes
6. [Escenas y UI](#6-escenas-y-ui)
   - 6.1 MainMenuScene
   - 6.2 SeasonScene
   - 6.3 RaceResultScene
   - 6.4 Transiciones entre Escenas
   - 6.5 Estados de UI por Escena
   - 6.6 Guia de Estilo Visual
7. [Casos de Borde](#7-casos-de-borde)
   - 7.1 Empates en la Carrera
   - 7.2 Empates en el Campeonato
   - 7.3 Campeonato Definido Anticipadamente
   - 7.4 Jugador Matematicamente Eliminado
   - 7.5 Todos los Pilotos con Estadisticas Iguales
   - 7.6 Valores Limite de Estadisticas (1 y 10)
   - 7.7 Probabilidad de Error en Casos Extremos
   - 7.8 Interaccion del Usuario — Validaciones
   - 7.9 Sin Navegador / Sin WebGL
   - 7.10 Cierre Inesperado del Navegador
8. [Consideraciones de Implementacion](#8-consideraciones-de-implementacion)
   - 8.1 Generacion de Numeros Aleatorios
   - 8.2 Phaser Game Config
   - 8.3 Sin Persistencia (No Save)
   - 8.4 Internacionalizacion Futura (i18n)
   - 8.5 Pruebas y Balance
9. [Apendices](#9-apendices)
   - A. Lista de Tracks (Pistas)
   - B. Tabla de Puntuacion FIA MotoGP
   - C. Glosario

---

## 1. Introduccion y Vision General

### 1.1 Descripcion del Producto

**MotoGT** es un videojuego minimalista de gestion de carreras de motociclismo. El jugador dirige a **un unico piloto** a lo largo de una temporada de **6 carreras** compitiendo contra **9 pilotos controlados por IA** en una grilla de 10 participantes. No hay fisica en tiempo real ni reflejos — el nucleo del juego consiste en **una decision por carrera** (elegir el estilo de pilotaje) y los resultados simulados que se derivan de esa eleccion.

### 1.2 Filosofia V1

La version 1.0 sigue el principio de *"terminar primero, expandir despues"*. Se excluyen deliberadamente sistemas que sobrecargaron intentos anteriores: presupuesto, I+D, mejoras de moto, personal, contratos, patrocinadores, clima, estrategia de neumaticos, multiples temporadas ni vista vuelta-a-vuelta.

El unico objetivo es **una temporada completa jugable de principio a fin**, en aproximadamente cinco minutos.

### 1.3 Genero y Referencias

- **Genero:** Racing Manager / Sports Management (text-based / menu-driven)
- **Inspiracion:** Motorsport Manager (Playsport Games / SEGA)
- **Modalidad:** Un jugador, sesion unica (sin guardado)

---

## 2. Arquitectura del Sistema

### 2.1 Stack Tecnologico

| Componente  | Tecnologia      | Version    | Justificacion                                      |
|-------------|-----------------|------------|----------------------------------------------------|
| Lenguaje    | TypeScript      | 5.x        | Tipado estatico, mantenibilidad, tooling moderno   |
| Motor       | Phaser 3        | 3.80+      | Renderizado 2D, escenas, input, amplia comunidad   |
| Bundler     | Vite            | 5.x        | HMR rapido, soporte nativo TS, builds optimizados  |
| Runtime     | Navegador web   | —          | Ejecucion en cliente, sin backend                  |
| Testing     | Vitest (opc.)   | —          | Tests unitarios para el algoritmo de simulacion    |

### 2.2 Estructura de Archivos del Proyecto

```
moto-gt/
├── index.html                  # Entry point HTML
├── package.json                # Dependencias y scripts
├── tsconfig.json               # Configuracion de TypeScript
├── vite.config.ts              # Configuracion de Vite
├── public/                     # Assets estaticos
│   └── favicon.ico
├── src/
│   ├── main.ts                 # Punto de entrada, crea Phaser.Game
│   ├── config.ts               # Configuracion global de Phaser
│   ├── constants.ts            # Constantes del juego (puntos, stats, etc.)
│   ├── types/                  # Interfaces y tipos
│   │   ├── index.ts
│   │   ├── rider.ts
│   │   ├── track.ts
│   │   ├── race.ts
│   │   └── season.ts
│   ├── models/                 # Clases / factories de datos
│   │   ├── RiderFactory.ts     # Creacion de pilotos (jugador + IA)
│   │   ├── TrackFactory.ts     # Creacion de pistas y calendario
│   │   └── SeasonFactory.ts    # Inicializacion de temporada
│   ├── simulation/             # Motor de simulacion
│   │   ├── RaceSimulator.ts    # Algoritmo principal de simulacion
│   │   ├── MistakeSystem.ts    # Logica de errores / penalizaciones
│   │   ├── PaceCalculator.ts   # Calculo del pace efectivo
│   │   └── AIStyleSelector.ts  # Seleccion de estilo para pilotos IA
│   ├── scenes/                 # Escenas de Phaser
│   │   ├── BootScene.ts        # Carga inicial (fuentes, assets minimos)
│   │   ├── MainMenuScene.ts    # Pantalla de titulo y nuevo juego
│   │   ├── SeasonScene.ts      # Hub de la temporada
│   │   └── RaceResultScene.ts  # Resultados de carrera
│   ├── ui/                     # Componentes reutilizables de UI
│   │   ├── Button.ts
│   │   ├── Panel.ts
│   │   ├── Table.ts
│   │   ├── StatBar.ts
│   │   └── StandingTable.ts
│   └── utils/                  # Utilidades
│       ├── random.ts           # Generacion de numeros aleatorios
│       └── format.ts           # Formateo de texto y numeros
└── specs/                      # Documentos de especificacion
    └── SPEC.md                 # Este documento
```

### 2.3 Ciclo de Escenas (Scene Graph)

El juego se compone de **cuatro escenas** de Phaser:

```
BootScene ──► MainMenuScene ──► SeasonScene ──► RaceResultScene
                   ▲                                    │
                   │                                    │
                   └────────────────────────────────────┘
                        (solo al finalizar temporada)
```

| Escena            | Proposito                                                       | Transicion a                |
|-------------------|-----------------------------------------------------------------|-----------------------------|
| `BootScene`       | Carga assets minimos (fuentes, colores, configuracion base).    | `MainMenuScene` (automatica)|
| `MainMenuScene`   | Pantalla de titulo. Input de nombre de piloto y equipo.         | `SeasonScene`               |
| `SeasonScene`     | Calendario, tabla de posiciones, seleccion de estilo, simular.  | `RaceResultScene`           |
| `RaceResultScene` | Tabla de resultados de carrera, puntos, clasificacion.          | `SeasonScene` o `MainMenuScene` |

La transicion `RaceResultScene → SeasonScene` ocurre tras cada carrera excepto la ultima.
La transicion `RaceResultScene → MainMenuScene` ocurre solo al finalizar la 6ta carrera (fin de temporada).

### 2.4 Gestion de Estado

Dado que V1 no tiene persistencia (no guarda/carga partida), el estado completo de la temporada vive en memoria durante la sesion.

**Mecanismo de paso de estado entre escenas:**

Se utiliza el metodo `this.scene.start('SceneName', data)` de Phaser, donde `data` es un objeto `SeasonState`.

- `MainMenuScene` construye el `SeasonState` inicial y lo pasa a `SeasonScene`.
- `SeasonScene` actualiza el `SeasonState` tras cada simulacion y lo pasa a `RaceResultScene`.
- `RaceResultScene` reenvia el `SeasonState` modificado de vuelta a `SeasonScene` (o a `MainMenuScene` si la temporada termino).

**Alternativa:** Utilizar `this.registry` de Phaser como almacen global compartido. Para V1, el paso explicito por parametro es suficiente y mas facil de razonar.

### 2.5 Diagrama de Flujo de Datos (Simplificado)

```
MainMenuScene
  │
  │  Usuario ingresa: riderName, teamName
  │  Se genera: playerRider, aiRiders[], tracks[]
  ▼
SeasonState (creado)
  │
  ▼
SeasonScene
  │
  │  Usuario elige: ridingStyle
  │  Se ejecuta: RaceSimulator.simulate(state, style)
  │  Se actualiza: raceResults[], puntos de riders
  ▼
SeasonState (actualizado)
  │
  ▼
RaceResultScene
  │
  │  Muestra resultados
  │  Si raceIndex < 6 → vuelve a SeasonScene con SeasonState
  │  Si raceIndex = 6 → muestra campeon, vuelve a MainMenuScene
  ▼
```

---

## 3. Modelos de Datos

### 3.1 RiderStats

```typescript
/**
 * Estadisticas base de un piloto.
 * Todos los valores son enteros en el rango [1, 10].
 */
interface RiderStats {
  /** Velocidad pura. Factor mas determinante en la posicion final. */
  pace: number;        // 1..10
  /** Rendimiento en secciones tecnicas / curvas. */
  cornering: number;   // 1..10
  /** Resistencia a cometer errores. Mitiga el riesgo de estilos agresivos. */
  consistency: number; // 1..10
}
```

**Reglas de integridad:**
- Cada valor debe ser un entero entre 1 y 10 inclusive.
- La suma de los tres stats para un piloto generado aleatoriamente nunca debe exceder 25 ni ser menor a 6 (para evitar extremos no balanceados).
- El piloto del jugador siempre recibe stats fijos o personalizables (por definir si se permite distribucion de puntos en V1 o si son fijos balanceados, ej. 6/6/6).

### 3.2 Rider

```typescript
interface Rider {
  /** Identificador unico (UUID v4 o indice). */
  id: string;
  /** Nombre del piloto. */
  name: string;
  /** Nombre del equipo al que pertenece. */
  team: string;
  /** Indica si este piloto es controlado por el jugador. */
  isPlayer: boolean;
  /** Estadisticas base del piloto. */
  stats: RiderStats;
  /** Puntos acumulados en el campeonato actual. */
  points: number;
  /** Desglose de posiciones obtenidas (para desempates). */
  positionCounts: number[];   // posicion 1 en indice 0, posicion 2 en indice 1, ...
}
```

**Notas:**
- `positionCounts` es un array de largo 10 donde `positionCounts[0]` cuenta primeros puestos, `positionCounts[1]` segundos, etc. Se utiliza exclusivamente para desempates en la clasificacion del campeonato.
- `points` se inicializa en 0 y se acumula tras cada carrera.
- Para pilotos IA, `team` se genera aleatoriamente de un banco de nombres de equipos.

### 3.3 Track

```typescript
interface Track {
  /** Identificador unico. */
  id: string;
  /** Nombre de la pista (ej. "Mugello Circuit"). */
  name: string;
  /** Ubicacion geografica / pais (opcional, para sabor). */
  location: string;
  /** Factor tecnico (0.0 a 1.0). Que tanto premia la habilidad de cornering. */
  technicalFactor: number;
}
```

**Factor tecnico (`technicalFactor`):**
- `0.0`: Circuito completamente recto / de velocidad pura. El cornering no aporta nada.
- `0.5`: Circuito mixto balanceado.
- `1.0`: Circuito extremadamente tecnico (muchas curvas cerradas). El cornering es muy relevante.
- Valores recomendados: entre 0.25 y 0.85 para que ninguna pista anule completamente la influencia de una estadistica.

### 3.4 RidingStyle

```typescript
enum RidingStyle {
  Safe       = 'safe',
  Balanced   = 'balanced',
  Aggressive = 'aggressive',
}
```

| Estilo       | Modificador de Pace | Riesgo Base de Error | Descripcion                                   |
|--------------|---------------------|----------------------|-----------------------------------------------|
| Safe         | -2                  | 2% (0.02)            | Baja velocidad, muy baja probabilidad de error |
| Balanced     | 0                   | 10% (0.10)           | Velocidad y riesgo neutros                     |
| Aggressive   | +2                  | 25% (0.25)           | Alta velocidad, alta probabilidad de error     |

### 3.5 FinishingPosition

```typescript
interface FinishingPosition {
  /** Posicion en la carrera (1 = ganador, 10 = ultimo). */
  position: number;
  /** Referencia al piloto. */
  rider: Rider;
  /** Puntos otorgados por esta posicion. */
  pointsAwarded: number;
  /** Puntaje de rendimiento calculado por el simulador (para debug). */
  performanceScore: number;
  /** Indica si el piloto cometio un error durante la carrera. */
  hadMistake: boolean;
}
```

### 3.6 RaceResult

```typescript
interface RaceResult {
  /** Indice de la carrera en el calendario (0 a 5). */
  raceIndex: number;
  /** Pista donde se disputo la carrera. */
  track: Track;
  /** Estilo elegido por el jugador para esta carrera. */
  playerStyle: RidingStyle;
  /** Orden de llegada completo (10 posiciones). */
  finishingOrder: FinishingPosition[];
}
```

### 3.7 SeasonState

```typescript
interface SeasonState {
  /** Piloto controlado por el jugador. */
  playerRider: Rider;
  /** Lista de los 9 pilotos rivales controlados por IA. */
  aiRiders: Rider[];
  /** Calendario de 6 pistas en orden. */
  calendar: Track[];
  /** Indice de la proxima carrera a disputar (0..5). */
  currentRaceIndex: number;
  /** Resultados de carreras ya disputadas. */
  raceResults: RaceResult[];
  /** Indica si la temporada ha finalizado. */
  isSeasonComplete: boolean;
  /** Nombre del equipo del jugador. */
  playerTeam: string;
}
```

**Invariantes:**
- `aiRiders.length === 9`
- `calendar.length === 6`
- `raceResults.length === currentRaceIndex` (carreras disputadas = indice actual)
- `currentRaceIndex ∈ [0, 6]` (6 significa que ya se corrieron todas)
- `playerRider.points >= 0` y `playerRider.points <= 150` (maximo teorico: 6 * 25)
- `playerRider.isPlayer === true`
- `∀ r ∈ aiRiders: r.isPlayer === false`

### 3.8 PointsTable

```typescript
/** Puntos otorgados por posicion final (indice 0 = 1er lugar). */
const POINTS_TABLE: readonly number[] = [
  25, 18, 15, 12, 10, 8, 6, 4, 2, 1
];
```

**Regla:** Solo los 10 primeros reciben puntos. Si en V2+ la grilla se expande mas alla de 10, las posiciones 11+ reciben 0 puntos.

---

## 4. Logica del Juego

### 4.1 Ciclo Principal (Game Loop)

```
INICIO
  │
  ▼
[MainMenu] Esperar input de nombre de piloto y equipo
  │
  ▼
[Generar Temporada] Crear SeasonState:
  - Elegir 6 pistas aleatorias del banco
  - Generar 9 pilotos IA con stats aleatorios
  - Crear piloto jugador con stats fijos
  │
  ▼
┌─────────────────────────────────────────┐
│ BUCLE DE CARRERA (repetir 6 veces)       │
│                                          │
│  [SeasonScene]                           │
│    - Mostrar calendario y clasificacion  │
│    - Recibir seleccion de estilo         │
│    - Boton "Correr"                      │
│         │                                │
│         ▼                                │
│  [Simulacion]                            │
│    - Elegir estilo para cada IA          │
│    - Calcular Performance Score para c/u │
│    - Determinar posiciones               │
│    - Asignar puntos                      │
│         │                                │
│         ▼                                │
│  [RaceResultScene]                       │
│    - Mostrar tabla de posiciones         │
│    - Mostrar puntos ganados              │
│    - Mostrar clasificacion actualizada   │
│    - Si currentRace < 5: "Siguiente"     │
│    - Si currentRace = 5: "Finalizar"     │
│                                          │
└─────────────────────────────────────────┘
  │
  ▼
[Fin de Temporada]
  - Determinar campeon
  - Mostrar resumen final
  - Boton "Jugar de nuevo" → volver a MainMenu
```

### 4.2 Generacion de la Temporada

La funcion `SeasonFactory.create(playerName, teamName)` ejecuta los siguientes pasos:

1. **Crear piloto jugador:**
   - `id`: UUID v4
   - `name`: ingresado por el usuario
   - `team`: ingresado por el usuario
   - `isPlayer`: true
   - `stats`: { pace: 6, cornering: 6, consistency: 6 }
   - `points`: 0
   - `positionCounts`: [0,0,0,0,0,0,0,0,0,0]

   *Nota: En V1, el jugador tiene stats fijos balanceados. Futuras versiones pueden permitir distribucion de puntos.*

2. **Generar pilotos IA:**
   - Se crean 9 pilotos con nombres aleatorios de un banco de nombres.
   - Cada piloto recibe stats aleatorios con las siguientes reglas:
     - Cada stat ∈ [2, 9] (evitando extremos 1 y 10 para IA en V1)
     - Suma de stats ∈ [14, 21] (para mantener balance)
     - Algoritmo: generar aleatoriamente hasta cumplir restricciones, o usar distribucion dirigida.
   - Nombres de equipos IA de un banco predefinido (sin repetir).

3. **Generar calendario:**
   - Se seleccionan 6 pistas del banco (ver Apendice A) sin repeticion.
   - El orden es aleatorio (shuffle).
   - Se garantiza variedad de factores tecnicos (al menos una pista con technicalFactor < 0.3 y al menos una > 0.7).

4. **Ensamblar `SeasonState`:**
   ```
   {
     playerRider: ...,
     aiRiders: [...9],
     calendar: [...6],
     currentRaceIndex: 0,
     raceResults: [],
     isSeasonComplete: false,
     playerTeam: teamName
   }
   ```

### 4.3 Generacion de Rivales IA

**Banco de nombres de pilotos** (20+ nombres ficticios):
```
Marco Rossi, Alex Rivas, Luca Bianchi, Kenji Tanaka, Diego Marquez,
Sven Larsson, Yuki Matsuda, Carlos Oliveira, Jean Dubois, Oliver Weber,
Hana Kimura, Pedro Castillo, Thomas Fischer, Rafael Souza, Erik Johansson,
Sara Lindqvist, Mateo Vargas, Anya Petrov, Liam O'Connor, Fatima Al-Rashid
```

**Banco de nombres de equipos** (12+ nombres ficticios):
```
Velocita Racing, Apex Motorsport, Omega GP, Titan Moto, Storm Riders,
Phantom Speed, Nova Racing, Iron Horse GP, Blue Thunder, Redline Moto,
Shadow Racers, Pinnacle GP
```

**Algoritmo de generacion de stats para IA:**

```typescript
function generateAIStats(): RiderStats {
  let pace: number, cornering: number, consistency: number;
  let attempts = 0;
  do {
    // Distribucion: media 5-6, desviacion que favorece valores intermedios
    pace        = randomInt(2, 9);
    cornering   = randomInt(2, 9);
    consistency = randomInt(2, 9);
    const sum = pace + cornering + consistency;
    attempts++;
    if (attempts > 100) break; // safety valve
  } while (sum < 14 || sum > 21);
  return { pace, cornering, consistency };
}
```

*Nota de balance: Si los tests muestran que el jugador con 6/6/6 gana muy facil o nunca gana, ajustar el rango de suma de IA o los stats fijos del jugador.*

### 4.4 Seleccion de Estilo para Pilotos IA

Cada piloto IA elige un estilo de pilotaje para cada carrera. El algoritmo debe producir comportamiento variado pero con cierta coherencia respecto a sus estadisticas.

**Algoritmo:**

```typescript
function selectAIStyle(rider: Rider): RidingStyle {
  // Calcular puntaje de agresividad: pace alto - consistency bajo = mas agresivo
  const aggressionScore = rider.stats.pace - rider.stats.consistency;
  // Normalizar al rango [-8, 8] aprox. (pace 2..9, consistency 2..9)
  // Mapear a pesos para cada estilo

  let safeWeight: number, balancedWeight: number, aggressiveWeight: number;

  if (aggressionScore <= -4) {
    // Muy defensivo: prefiere Safe
    safeWeight = 60;
    balancedWeight = 30;
    aggressiveWeight = 10;
  } else if (aggressionScore <= -1) {
    safeWeight = 35;
    balancedWeight = 45;
    aggressiveWeight = 20;
  } else if (aggressionScore <= 1) {
    safeWeight = 20;
    balancedWeight = 55;
    aggressiveWeight = 25;
  } else if (aggressionScore <= 4) {
    safeWeight = 10;
    balancedWeight = 45;
    aggressiveWeight = 45;
  } else {
    // Muy agresivo: prefiere Aggressive
    safeWeight = 5;
    balancedWeight = 30;
    aggressiveWeight = 65;
  }

  // Seleccion ponderada
  const roll = randomInt(1, 100);
  if (roll <= safeWeight) return RidingStyle.Safe;
  if (roll <= safeWeight + balancedWeight) return RidingStyle.Balanced;
  return RidingStyle.Aggressive;
}
```

### 4.5 Algoritmo de Simulacion de Carrera

Ver [Seccion 5](#5-algoritmo-de-simulacion--detalle-exhaustivo) para el detalle completo. Aqui el resumen:

1. Determinar estilo de cada piloto (jugador usa el elegido, IA usa `selectAIStyle`).
2. Calcular `performanceScore` para cada piloto usando la formula de la Seccion 5.
3. Ordenar pilotos por `performanceScore` descendente.
4. Asignar posiciones y puntos.
5. Actualizar `raceResults` y `points` / `positionCounts`.

### 4.6 Sistema de Puntuacion

Se utiliza el sistema estandar de puntuacion de MotoGP / FIM:

| Posicion | 1  | 2  | 3  | 4  | 5  | 6  | 7  | 8  | 9  | 10 |
|----------|----|----|----|----|----|----|----|----|----|----|
| Puntos   | 25 | 18 | 15 | 12 | 10 | 8  | 6  | 4  | 2  | 1  |

Los puntos se acumulan carrera a carrera. El maximo teorico por temporada es 150 puntos (6 victorias).

### 4.7 Tabla de Posiciones del Campeonato

La clasificacion (`Standings`) es una lista ordenada de todos los riders (10) segun:
1. **Puntos totales** (descendente).
2. **Criterios de desempate** — ver Seccion 4.8.

Cada vez que se completa una carrera, se recalcula el orden de la tabla.

### 4.8 Desempates en el Campeonato

Si dos o mas pilotos tienen los mismos puntos al final de la temporada (o en cualquier momento), se aplican los siguientes criterios en orden:

1. **Mayor cantidad de primeros puestos** (`positionCounts[0]`).
2. **Mayor cantidad de segundos puestos** (`positionCounts[1]`).
3. **Mayor cantidad de terceros puestos** (`positionCounts[2]`).
4. ... y asi sucesivamente hasta la posicion 10.
5. **Mayor estadistica de Pace** (si todo lo anterior empata, gana el piloto con mayor Pace base).
6. **Mayor estadistica de Cornering**.
7. **Mayor estadistica de Consistency**.
8. **Aleatorio** (moneda al aire). Este caso es extremadamente improbable.

### 4.9 Fin de Temporada

Cuando `currentRaceIndex === 6` (todas las carreras disputadas):
- Se determina el campeon: primer lugar en la clasificacion final.
- Se determina el subcampeon y tercer lugar.
- Se muestra una pantalla de resumen con:
  - Podio del campeonato (top 3).
  - Posicion final del jugador.
  - Estadisticas: puntos totales, victorias, podios, promedio de posicion.
- Boton "Jugar de nuevo" reinicia el flujo desde `MainMenuScene`.

---

## 5. Algoritmo de Simulacion — Detalle Exhaustivo

Esta seccion describe el corazon del juego: como se determina el orden de llegada a partir de las estadisticas de los pilotos, el estilo de pilotaje elegido y la aleatoriedad.

### 5.1 Formula General

Para cada piloto `r` en la carrera `race`, con estilo `s`, en pista `t`:

```
performanceScore(r, s, t) = paceBase
                           + modEstilo(s)
                           + contribucionCornering(r, t)
                           + ruidoAleatorio()
                           - penalizacionError(r, s)
```

Donde:

| Termino                    | Descripcion                                               | Rango aprox.   |
|----------------------------|-----------------------------------------------------------|----------------|
| `paceBase`                 | `r.stats.pace` (1..10)                                    | 1 a 10         |
| `modEstilo(s)`             | Modificador fijo por estilo                               | -2, 0, o +2    |
| `contribucionCornering`    | Depende de `cornering` y `technicalFactor` de la pista    | 0 a 3.0        |
| `ruidoAleatorio`           | Variabilidad normal/Gaussiana                             | -3.5 a +3.5 aprox. |
| `penalizacionError`        | Si el piloto comete un error, penalizacion significativa  | 0 o 4..10      |

### 5.2 Modificador por Estilo de Pilotaje (`modEstilo`)

```typescript
const STYLE_PACE_MODIFIER: Record<RidingStyle, number> = {
  [RidingStyle.Safe]:       -2,
  [RidingStyle.Balanced]:    0,
  [RidingStyle.Aggressive]: +2,
};
```

Es un valor fijo, determinista, que se suma directamente al pace base.

### 5.3 Contribucion del Cornering y Factor Tecnico

```typescript
function corneringContribution(corneringStat: number, technicalFactor: number): number {
  // corneringStat: 1..10
  // technicalFactor: 0..1
  //
  // En una pista con technicalFactor = 1.0 y cornering = 10:
  //   contribucion = (10 / 10) * 1.0 * 3.0 = 3.0
  // En una pista con technicalFactor = 0.0 y cornering = 1:
  //   contribucion = (1 / 10) * 0.0 * 3.0 = 0.0
  //
  return (corneringStat / 10) * technicalFactor * CORNERING_MULTIPLIER;
}

const CORNERING_MULTIPLIER = 3.0;
```

**Interpretacion:** Un piloto con cornering maximo (10) en la pista mas tecnica (1.0) obtiene una bonificacion de +3.0 a su performance score. Esto equivale a la diferencia entre un pace 7 y un pace 10, por lo que es significativo pero no dominante.

### 5.4 Ruido Aleatorio (Random Noise)

Se utiliza una distribucion **normal (Gaussiana)** para modelar la variabilidad del rendimiento: algunos dias un piloto esta inspirado, otros tiene un mal dia.

```typescript
function randomNoise(): number {
  // Distribucion normal con media 0 y desviacion estandar NOISE_STD_DEV
  // Implementacion: Box-Muller o metodo de suma de uniformes
  // Para simplicidad en V1 se puede usar:
  //   (random() + random() + random() + random() - 2) * NOISE_STD_DEV
  // que aproxima una normal con media 0 y varianza ajustada.
  return gaussianRandom(0, NOISE_STD_DEV);
}

const NOISE_STD_DEV = 1.5;
```

**Propiedades:**
- ~68% de los valores caen en [-1.5, +1.5]
- ~95% de los valores caen en [-3.0, +3.0]
- ~99.7% de los valores caen en [-4.5, +4.5]

El ruido asegura que una carrera nunca sea completamente determinista y que un piloto con stats inferiores tenga una chance (aunque baja) de ganar.

### 5.5 Sistema de Errores (Mistake System)

Un piloto puede cometer un **error** (caida, salida de pista, fallo mecanico por exceso de exigencia) durante la carrera. La probabilidad depende del estilo y de la estadistica de `consistency`.

**Formula de probabilidad de error:**

```typescript
function mistakeProbability(style: RidingStyle, consistency: number): number {
  const BASE_MISTAKE_PROB: Record<RidingStyle, number> = {
    [RidingStyle.Safe]:       0.02,  // 2%
    [RidingStyle.Balanced]:   0.10,  // 10%
    [RidingStyle.Aggressive]: 0.25,  // 25%
  };

  // Factor de consistencia: reduce la probabilidad base
  // consistency = 1  → factor ≈ 1.0   (probabilidad completa, sin reduccion)
  // consistency = 5  → factor ≈ 0.72
  // consistency = 10 → factor ≈ 0.40  (60% de reduccion)
  const consistencyFactor = Math.max(
    0.01,  // piso minimo: siempre hay al menos 1% de la probabilidad base
    1.0 - (consistency - 1) / 15.0
  );

  return BASE_MISTAKE_PROB[style] * consistencyFactor;
}
```

**Tabla de probabilidades de error resultantes:**

| Estilo     | Consistency=1 | Consistency=3 | Consistency=5 | Consistency=7 | Consistency=10 |
|------------|---------------|---------------|---------------|---------------|----------------|
| Safe       | 2.00%         | 1.73%         | 1.47%         | 1.20%         | 0.80%          |
| Balanced   | 10.00%        | 8.67%         | 7.33%         | 6.00%         | 4.00%          |
| Aggressive | 25.00%        | 21.67%        | 18.33%        | 15.00%        | 10.00%         |

**Interpretacion de diseno:**
- Un piloto con consistency=10 en modo Aggressive tiene la misma probabilidad de error (10%) que uno con consistency=1 en modo Balanced.
- El piso minimo garantiza que incluso consistency=10 nunca reduzca el riesgo a cero. Siempre hay imponderables.
- La diferencia entre Safe con alta consistency (~0.8%) y Aggressive con baja consistency (25%) es de mas de 30x, creando un espectro amplio de riesgo/recompensa.

### 5.6 Penalizacion por Error

Si un piloto comete un error, se le aplica una penalizacion a su `performanceScore`:

```typescript
function mistakePenalty(): number {
  // Penalizacion base + componente aleatorio
  // Rango: 4.0 a 10.0
  return MISTAKE_PENALTY_BASE + randomFloat(0, MISTAKE_PENALTY_RANGE);
}

const MISTAKE_PENALTY_BASE = 4.0;
const MISTAKE_PENALTY_RANGE = 6.0;
```

**Impacto:** Un piloto que comete un error pierde entre 4 y 10 puntos de performance score. Dado que el rango total de performance sin error esta aproximadamente entre -3 (peor piloto, Safe) y 15 (mejor piloto, Aggressive, pista tecnica), una penalizacion de 4-10 puntos practicamente garantiza que el piloto termine entre las ultimas posiciones, simulando una caida o un incidente grave que arruina su carrera.

### 5.7 Ordenamiento Final y Desempate Intra-Carrera

```typescript
function determineFinishingOrder(performanceScores: Map<string, number>): FinishingPosition[] {
  // Ordenar por performanceScore descendente
  const sorted = [...riders].sort((a, b) => {
    const scoreA = performanceScores.get(a.id)!;
    const scoreB = performanceScores.get(b.id)!;

    if (scoreA !== scoreB) return scoreB - scoreA;

    // Criterios de desempate si los scores son identicos:
    // 1. Mayor Pace
    if (a.stats.pace !== b.stats.pace) return b.stats.pace - a.stats.pace;
    // 2. Mayor Cornering
    if (a.stats.cornering !== b.stats.cornering) return b.stats.cornering - a.stats.cornering;
    // 3. Mayor Consistency
    if (a.stats.consistency !== b.stats.consistency) return b.stats.consistency - a.stats.consistency;
    // 4. Aleatorio (praxcticamente nunca se alcanza)
    return Math.random() - 0.5;
  });

  // Asignar posiciones y puntos
  return sorted.map((rider, index) => {
    const position = index + 1;
    const pointsAwarded = position <= 10 ? POINTS_TABLE[position - 1] : 0;
    return {
      position,
      rider,
      pointsAwarded,
      performanceScore: performanceScores.get(rider.id)!,
      hadMistake: mistakeFlags.get(rider.id)!,  // boolean registrado durante la simulacion
    };
  });
}
```

### 5.8 Ejemplo Numerico Paso a Paso

**Condiciones de la carrera:**
- Pista: "Mugello Circuit" (`technicalFactor = 0.45`)
- Jugador: "Alex" (pace=6, cornering=6, consistency=6), estilo **Aggressive**
- IA 1: "Marco Rossi" (pace=8, cornering=4, consistency=3)
- IA 2: "Luca Bianchi" (pace=5, cornering=8, consistency=7)

**Paso 1: Determinar estilos IA**
- Marco Rossi: aggressionScore = 8 - 3 = 5 → alta agresividad → probablemente Aggressive (supongamos que sale Balanced)
- Luca Bianchi: aggressionScore = 5 - 7 = -2 → moderado-defensivo → supongamos que sale Balanced

**Paso 2: Calcular performance scores**

| Piloto       | paceBase | modEstilo | corneringContrib (6/10 * 0.45 * 3.0) | ruido (ej.) | error? | penalizacion | **Score** |
|--------------|----------|-----------|---------------------------------------|-------------|--------|--------------|-----------|
| Alex (Jug)   | 6        | +2 (Aggr) | 0.81                                  | -0.3        | No     | 0            | **8.51**  |
| Marco Rossi   | 8        | 0 (Bal)   | (4/10*0.45*3)=0.54                    | +1.2        | Si (rolled < 7.33%) | -5.5 | **4.24**  |
| Luca Bianchi  | 5        | 0 (Bal)   | (8/10*0.45*3)=1.08                    | -0.7        | No     | 0            | **5.38**  |

**Paso 3: Ordenar**
1. Alex (Jugador): 8.51
2. Luca Bianchi: 5.38
3. Marco Rossi: 4.24 (error)

**Resultado:**
- Alex gana la carrera (25 pts)
- Luca 2do (18 pts)
- Marco 3ro (15 pts) a pesar del error, porque su pace base 8 le dio suficiente colchon

*Observacion: Marco cometio un error pero aun asi quedo 3ro. Esto es intencional: un error no siempre significa ultimo puesto si el piloto es muy superior. La penalizacion compite con las ventajas de stats.*

### 5.9 Calibracion de Constantes

Todas las constantes del algoritmo son parametros ajustables definidos en `src/constants.ts`:

```typescript
// constants.ts

/** Multiplicador para la contribucion del cornering. */
export const CORNERING_MULTIPLIER = 3.0;

/** Desviacion estandar del ruido Gaussiano. */
export const NOISE_STD_DEV = 1.5;

/** Probabilidades base de error por estilo. */
export const BASE_MISTAKE_PROB: Record<RidingStyle, number> = {
  safe: 0.02,
  balanced: 0.10,
  aggressive: 0.25,
};

/** Divisor para el factor de consistencia. Valores mas altos = consistencia menos efectiva. */
export const CONSISTENCY_DIVISOR = 15.0;

/** Piso del factor de consistencia (nunca reduce a 0%). */
export const CONSISTENCY_FLOOR = 0.01;

/** Penalizacion base por error (se suma ruido). */
export const MISTAKE_PENALTY_BASE = 4.0;

/** Rango aleatorio adicional de penalizacion. */
export const MISTAKE_PENALTY_RANGE = 6.0;

/** Modificador de pace por estilo. */
export const STYLE_PACE_MODIFIER: Record<RidingStyle, number> = {
  safe: -2,
  balanced: 0,
  aggressive: +2,
};
```

Estas constantes deben ser **faciles de modificar** para iterar en el balance del juego sin tocar la logica.

---

## 6. Escenas y UI

### 6.1 MainMenuScene

**Proposito:** Pantalla de inicio. El jugador ingresa su nombre y el de su equipo, y da comienzo a la temporada.

**Elementos de UI:**

```
┌──────────────────────────────────────────┐
│                                          │
│           ███╗   ███╗ ██████╗ ████████╗  │
│           ████╗ ████║██╔═══██╗╚══██╔══╝  │
│           ██╔████╔██║██║   ██║   ██║     │
│           ██║╚██╔╝██║██║   ██║   ██║     │
│           ██║ ╚═╝ ██║╚██████╔╝   ██║     │
│           ╚═╝     ╚═╝ ╚═════╝    ╚═╝     │
│             G R A N D   T U R I S M O     │
│                                          │
│        Motorcycle Racing Manager         │
│                                          │
│   Nombre del Piloto: [_______________]   │
│   Nombre del Equipo: [_______________]   │
│                                          │
│        ┌──────────────────────┐          │
│        │  INICIAR TEMPORADA   │          │
│        └──────────────────────┘          │
│                                          │
│              v1.0 — 2025                 │
└──────────────────────────────────────────┘
```

**Comportamiento:**
- Los campos de texto aceptan entre 1 y 20 caracteres alfanumericos (incluyendo espacios).
- Validacion: ambos campos deben estar completos para habilitar el boton "Iniciar Temporada".
- Si el campo esta vacio, el boton aparece deshabilitado (gris).
- Al presionar "Iniciar Temporada", se llama a `SeasonFactory.create(nombrePiloto, nombreEquipo)` y se transiciona a `SeasonScene` con el `SeasonState` resultante.

**Implementacion Phaser:**
- Los campos de texto se implementan usando `DOMElement` de Phaser (elementos HTML sobrepuestos al canvas) o mediante `rexUI` plugin para campos de texto. Alternativa V1: `prompt()` nativo del navegador en lugar de UI custom, pero la UI custom es preferible.
- El titulo usa `Phaser.GameObjects.Text` con fuente bitmap o web font (estilo "carreras", bold, color blanco/rojo).

### 6.2 SeasonScene

**Proposito:** Hub central de la temporada. Muestra el calendario, la tabla de posiciones, los detalles de la proxima carrera, y permite seleccionar el estilo de pilotaje.

**Disposicion (Layout):**

```
┌──────────────────────────────────────────────────────────────┐
│  Temporada 2025              Carrera 3 de 6                  │
├──────────────────────┬───────────────────┬───────────────────┤
│                      │                   │                   │
│    CALENDARIO        │   PROXIMA CARRERA │   CLASIFICACION   │
│                      │                   │                   │
│  ✓ Mugello           │  Phillip Island   │  1. Rossi     75  │
│  ✓ Assen             │  (Australia)      │  2. Tanaka    62  │
│  ► Phillip Island    │  Tecnico: 0.65    │  3. TU        58  │
│    Jerez             │                   │  4. Bianchi   50  │
│    Sachsenring       │  Tu piloto:       │  5. ...           │
│    Silverstone       │  Pace: 6          │                   │
│                      │  Cornering: 6     │                   │
│                      │  Consistency: 6   │                   │
│                      │                   │                   │
│                      │  Estilo:          │                   │
│                      │  ○ Safe           │                   │
│                      │  ● Balanced       │                   │
│                      │  ○ Aggressive     │                   │
│                      │                   │                   │
│                      │  [ SIMULAR ]      │                   │
│                      │                   │                   │
├──────────────────────┴───────────────────┴───────────────────┤
│  Pista rapida con curvas rapidas. Favorece velocidad pura.   │
└──────────────────────────────────────────────────────────────┘
```

**Secciones y su comportamiento:**

#### Calendario (izquierda)
- Lista vertical de las 6 pistas en orden.
- Pistas ya disputadas: icono ✓, texto gris.
- Pista actual: icono ►, texto resaltado (amarillo/dorado).
- Pistas futuras: texto blanco tenue.
- Cada item muestra: nombre de la pista, ubicacion, indicador visual de factor tecnico (barra).

#### Proxima Carrera (centro)
- **Nombre de la pista** y ubicacion.
- **Indicador de factor tecnico:** barra horizontal etiquetada "Tecnico" con valor numerico (ej. "0.65 / 1.00").
- **Descripcion breve** de la pista (sabor).
- **Estadisticas del piloto jugador:** display de Pace, Cornering, Consistency con barras o numeros.
- **Selector de estilo de pilotaje:** tres botones radio (Safe, Balanced, Aggressive) con descripcion de cada uno al seleccionarlo:
  - Safe: "Ritmo conservador (-2 pace). Riesgo de error: ~2%."
  - Balanced: "Ritmo normal. Riesgo de error: ~10%."
  - Aggressive: "Ritmo agresivo (+2 pace). Riesgo de error: ~25%."
- **Boton "SIMULAR CARRERA":** grande, central, habilitado siempre que haya un estilo seleccionado.

#### Clasificacion (derecha)
- Tabla con columnas: Pos, Piloto, Equipo, Puntos.
- Fila del jugador resaltada (fondo de color distinto, ej. azul claro).
- Maximo 10 filas.
- Ordenado por puntos descendente (con desempates aplicados).
- Si es la carrera 1 (antes de simular), todos tienen 0 puntos. Mostrar orden alfabetico o por stats.

#### Barra inferior
- Texto descriptivo/ambiental sobre la pista actual.

**Comportamiento al presionar "SIMULAR":**
1. Se deshabilita el boton (evitar doble click).
2. Se ejecuta `RaceSimulator.simulate(seasonState, selectedStyle)`.
3. Se actualiza `seasonState`: se agrega `RaceResult` a `raceResults`, se incrementa `currentRaceIndex`, se actualizan puntos y `positionCounts` de cada rider.
4. Se transiciona a `RaceResultScene` con el `SeasonState` actualizado.

### 6.3 RaceResultScene

**Proposito:** Mostrar los resultados de la carrera recien simulada, incluyendo orden de llegada, puntos otorgados, y la clasificacion actualizada del campeonato.

**Disposicion (Layout):**

```
┌──────────────────────────────────────────────────────────────┐
│              RESULTADOS — Phillip Island                      │
│                  Carrera 3 de 6                                │
├───────────────────────────────────┬───────────────────────────┤
│                                   │                           │
│   ORDEN DE LLEGADA                │   CLASIFICACION ACTUAL.   │
│                                   │                           │
│   #  Piloto          Pts  Error   │   #  Piloto         Pts   │
│  ───────────────────────────────  │  ───────────────────────  │
│   1  Marco Rossi      25          │   1  Marco Rossi     75   │
│   2  TU (Alex)        18          │   2  Kenji Tanaka    64   │
│   3  Kenji Tanaka     15          │   3  TU (Alex)       58 ▲ │
│   4  Luca Bianchi     12    ⚠     │   4  Luca Bianchi    50   │
│   5  Diego Marquez    10          │   5  Diego Marquez    40  │
│   6  Sven Larsson      8    ⚠     │   6  Sven Larsson    34   │
│   7  Yuki Matsuda      6          │   7  Yuki Matsuda    28   │
│   8  Carlos Oliveira   4          │   8  Carlos Oliveira  16   │
│   9  Jean Dubois       2          │   9  Jean Dubois      8   │
│  10  Oliver Weber      1    ⚠     │  10  Oliver Weber     6   │
│                                   │                           │
├───────────────────────────────────┴───────────────────────────┤
│                                                                │
│     Has ganado 18 puntos. ¡Podio!                              │
│                                                                │
│     ┌─────────────────────────────┐                            │
│     │     SIGUIENTE CARRERA →     │                            │
│     └─────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

**Elementos y comportamiento:**

#### Orden de Llegada (izquierda)
- Columnas: Posicion (#), Piloto, Puntos ganados, Indicador de error (⚠ si `hadMistake === true`).
- Fila del jugador resaltada.
- Si el jugador tuvo un error, mostrar texto adicional: "¡Tu piloto cometio un error! Perdiste posiciones valiosas."

#### Clasificacion (derecha)
- Similar a la de `SeasonScene` pero actualizada con los puntos de esta carrera.
- Incluir flechas de cambio de posicion respecto a la carrera anterior (▲ subio, ▼ bajo, — se mantuvo).
- En la carrera 1, no hay flechas (no hay referencia previa).

#### Mensaje de desempeno (barra inferior)
- Texto dinamico basado en el resultado:
  - Posicion 1: "¡Victoria! Has sumado 25 puntos."
  - Posicion 2-3: "¡Podio! Has sumado X puntos."
  - Posicion 4-6: "Buen resultado. Has sumado X puntos."
  - Posicion 7-8: "Carrera discreta. Has sumado X puntos."
  - Posicion 9-10: "Carrera dificil. Has sumado X puntos."
  - Si tuvo error: "Un error costo caro hoy."

#### Boton de continuar
- **Si `currentRaceIndex < 6`:** Boton "SIGUIENTE CARRERA →". Transiciona a `SeasonScene`.
- **Si `currentRaceIndex === 6`:** Boton "VER RESULTADOS FINALES". Transiciona a... (ver abajo).

#### Pantalla de Fin de Temporada (dentro de RaceResultScene o escena aparte)

Cuando `currentRaceIndex === 6` y `isSeasonComplete === true`, en lugar del layout normal se muestra:

```
┌──────────────────────────────────────────────────────────────┐
│                 ╔══════════════════════╗                      │
│                 ║  TEMPORADA FINALIZADA ║                    │
│                 ╚══════════════════════╝                      │
│                                                               │
│                      🏆 CAMPEON 🏆                            │
│                    [Nombre del campeon]                        │
│                     [Equipo campeon]                           │
│                     [Puntos totales]                           │
│                                                               │
│              ┌───────── PODIO ─────────┐                      │
│              │  2do: [Nombre]  [Pts]   │                      │
│              │  3ro: [Nombre]  [Pts]   │                      │
│              └─────────────────────────┘                      │
│                                                               │
│          Tu posicion final: [X]° con [Y] puntos               │
│          Victorias: [N]  |  Podios: [M]  |  Errores: [E]      │
│                                                               │
│              ┌──────────────────────────┐                     │
│              │     JUGAR DE NUEVO       │                     │
│              └──────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

Al presionar "JUGAR DE NUEVO", se destruye el estado actual y se transiciona a `MainMenuScene`.

### 6.4 Transiciones entre Escenas

Todas las transiciones utilizan `this.scene.start('SceneName', data)`. No se usan efectos de transicion (fade, wipe) en V1 por simplicidad, aunque pueden agregarse facilmente con `this.cameras.main.fadeOut`.

```typescript
// Ejemplo: SeasonScene → RaceResultScene
this.scene.start('RaceResultScene', {
  seasonState: this.seasonState,  // SeasonState actualizado
});
```

### 6.5 Estados de UI por Escena

Cada escena tiene un conjunto finito de estados:

**MainMenuScene:**
- `idle`: Campos de texto visibles. Boton deshabilitado si campos vacios, habilitado si completos.

**SeasonScene:**
- `ready`: Estilo seleccionado, boton "SIMULAR" habilitado.
- `no_style`: Ningun estilo seleccionado, boton deshabilitado.
- `simulating`: (Opcional) breve animacion o texto "Simulando..." tras presionar el boton, antes de la transicion.

**RaceResultScene:**
- `race_result`: Mostrando resultados de una carrera normal (carrera 1-5).
- `season_end`: Mostrando pantalla de fin de temporada (carrera 6 completada).

### 6.6 Guia de Estilo Visual

- **Paleta de colores:**
  - Fondo principal: `#1a1a2e` (azul muy oscuro)
  - Fondo de paneles: `#16213e` (azul oscuro)
  - Texto principal: `#e0e0e0` (gris claro)
  - Texto resaltado: `#f5c518` (dorado/amarillo)
  - Acento / botones: `#e94560` (rojo carreras)
  - Fila del jugador: `#0f3460` (azul medio)
  - Exito / Positivo: `#00c853` (verde)
  - Error / Negativo: `#ff1744` (rojo)

- **Tipografia:**
  - Titulos: Fuente bold, sans-serif, estilo "racing" (ej. Google Font "Racing Sans One" o "Kanit").
  - Cuerpo: Fuente monoespaciada o sans-serif legible (ej. "Roboto Mono" o "Courier New").

- **Tamanos de pantalla objetivo:**
  - Resolucion base: 1024 x 768 (Phaser config).
  - Escalado: `Phaser.Scale.FIT` con `autoCenter: Phaser.Scale.CENTER_BOTH`.
  - Soporte para mobile: el layout se adapta via escalado, pero la experiencia esta optimizada para desktop/tablet.

---

## 7. Casos de Borde

### 7.1 Empates en la Carrera

Dos pilotos obtienen exactamente el mismo `performanceScore`.

**Resolucion:**
1. Mayor `pace` gana.
2. Mayor `cornering` gana.
3. Mayor `consistency` gana.
4. Aleatorio (moneda).

En la practica, con ruido Gaussiano de precision float, los empates exactos son extremadamente raros (probabilidad < 0.001%). Sin embargo, el codigo debe manejarlos.

### 7.2 Empates en el Campeonato

Dos o mas pilotos terminan la temporada con los mismos puntos.

**Resolucion** (en orden):
1. Mayor cantidad de 1eros puestos (`positionCounts[0]`).
2. Mayor cantidad de 2dos puestos.
3. ... sucesivamente hasta 10mos puestos.
4. Mayor `pace`.
5. Mayor `cornering`.
6. Mayor `consistency`.
7. Aleatorio.

Este criterio se aplica en **todas** las visualizaciones de la clasificacion (no solo al final), para que el orden mostrado durante la temporada sea consistente con el orden final.

### 7.3 Campeonato Definido Anticipadamente

**Escenario:** El jugador (o un piloto IA) tiene una ventaja de puntos tal que, aun ganando las carreras restantes, ningun otro piloto puede alcanzarlo matematicamente. Ejemplo: tras la carrera 4, el jugador tiene 100 puntos y el segundo tiene 50. Quedan 2 carreras (maximo 50 puntos en juego). Ventaja = 50, puntos en juego = 50. El titulo esta matematicamente asegurado.

**Comportamiento:**
- **No se hace nada especial.** Las carreras restantes se disputan normalmente. Esto refleja el automovilismo/motociclismo real, donde las carreras siguen aun cuando el titulo esta decidido.
- Opcional: mostrar un indicador "🏆 CAMPEON" junto al piloto en la clasificacion si es matematicamente imposible que pierda el titulo.
- Si el jugador gana el titulo anticipadamente, mostrar un mensaje de felicitacion pero permitir continuar.

### 7.4 Jugador Matematicamente Eliminado

**Escenario:** Al jugador le resulta matematicamente imposible ganar el campeonato (esta muy lejos en puntos con pocas carreras restantes).

**Comportamiento:**
- Igual que 7.3: **no se hace nada especial.** El juego continua normalmente.
- El jugador aun puede aspirar a mejorar su posicion en la clasificacion, ganar carreras individuales, o simplemente terminar la temporada.

### 7.5 Todos los Pilotos con Estadisticas Iguales

**Escenario extremadamente improbable** (pero posible con una seed aleatoria muy particular): los 10 pilotos tienen stats identicos (ej. todos 6/6/6).

**Comportamiento esperado del algoritmo:**
- Sin ruido, todos tendrian el mismo performance score si eligen el mismo estilo.
- Con ruido Gaussiano (`σ = 1.5`), se produce dispersion: las posiciones se deciden principalmente por el ruido aleatorio.
- Esto es aceptable: en un escenario de paridad total, el azar decide, lo cual es razonable.
- Si el jugador elige un estilo diferente a los demas, el modificador de estilo (+2 / -2) crea una diferencia real que lo separa del peloton.

### 7.6 Valores Limite de Estadisticas (1 y 10)

**Caso: Piloto con pace=10, cornering=10, consistency=10 en modo Aggressive, pista con technicalFactor=1.0 y sin error:**

```
performanceScore = 10 (pace) + 2 (Aggressive) + (10/10 * 1.0 * 3.0) + ruido - 0
                 = 10 + 2 + 3.0 + ruido
                 = 15.0 + ruido
```

Valor maximo teorico: ~19.5 (con ruido +4.5).

**Caso: Piloto con pace=1, cornering=1, consistency=1 en modo Safe, pista con technicalFactor=0.0 y con error maximo:**

```
performanceScore = 1 (pace) - 2 (Safe) + (1/10 * 0.0 * 3.0) + ruido - 10.0
                 = 1 - 2 + 0 + ruido - 10.0
                 = -11.0 + ruido
```

Valor minimo teorico: ~-15.5 (con ruido -4.5).

**Rango total teorico:** ~35 puntos de diferencia entre el mejor y el peor caso posible. Esto da un margen muy amplio y asegura que las diferencias de stats se sientan significativas.

### 7.7 Probabilidad de Error en Casos Extremos

**Maxima probabilidad de error:** consistency=1, estilo Aggressive.
```
P = 0.25 * max(0.01, 1.0 - (1-1)/15) = 0.25 * 1.0 = 25%
```

**Minima probabilidad de error:** consistency=10, estilo Safe.
```
P = 0.02 * max(0.01, 1.0 - (10-1)/15) = 0.02 * max(0.01, 0.4) = 0.02 * 0.4 = 0.8%
```

**Garantia:** La probabilidad de error nunca es 0. Incluso el piloto mas consistente en modo Safe tiene un 0.8% de probabilidad de error por carrera. En 6 carreras, la probabilidad de al menos un error es 1 - (1-0.008)^6 ≈ 4.7%.

### 7.8 Interaccion del Usuario — Validaciones

| Condicion | Comportamiento |
|-----------|---------------|
| Nombre de piloto vacio | Boton "Iniciar Temporada" deshabilitado |
| Nombre de equipo vacio | Boton "Iniciar Temporada" deshabilitado |
| Nombre con solo espacios | Tratado como vacio (trim) |
| Nombre > 20 caracteres | Truncar a 20 (o limitar input) |
| Caracteres especiales / inyeccion | Sanitizar: solo permitir alfanumerico + espacios + guiones |
| Doble click en "Simular" | Boton se deshabilita inmediatamente al primer click |
| Navegador refrescado durante carrera | Se pierde el progreso (sin save). Mostrar mensaje en MainMenu si se detecta estado inconsistente (no aplica en V1) |

### 7.9 Sin Navegador / Sin WebGL

- Phaser 3 intentara usar WebGL. Si no esta disponible, hara fallback a Canvas2D.
- El juego debe funcionar correctamente en ambos modos (solo usa texto y formas basicas, no shaders ni efectos avanzados).
- Si ni WebGL ni Canvas estan disponibles, el `window.onload` de Phaser fallara. No se requiere manejo especial para V1.

### 7.10 Cierre Inesperado del Navegador

- Como no hay sistema de guardado, **todo el progreso se pierde**.
- Esto es aceptable para V1. La experiencia completa dura ~5 minutos, por lo que reiniciar no es una friccion significativa.
- En V2 se implementara `localStorage` o `IndexedDB` para auto-guardado.

---

## 8. Consideraciones de Implementacion

### 8.1 Generacion de Numeros Aleatorios

Para la simulacion se necesita:
- **Aleatoriedad uniforme:** `Math.random()` es suficiente para V1.
- **Aleatoriedad Gaussiana:** Implementar Box-Muller:

```typescript
function gaussianRandom(mean: number = 0, stdDev: number = 1): number {
  let u1 = 0, u2 = 0;
  // Evitar el caso u1 === 0 (aunque es extremadamente raro)
  while (u1 === 0) u1 = Math.random();
  u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z * stdDev + mean;
}
```

**Nota sobre seeds:** V1 no requiere semillas deterministas, pero si en el futuro se desea un modo "replay" o debug, envolver el generador en una clase `Random` con seed.

### 8.2 Phaser Game Config

```typescript
// main.ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SeasonScene } from './scenes/SeasonScene';
import { RaceResultScene } from './scenes/RaceResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,           // WebGL con fallback a Canvas
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, SeasonScene, RaceResultScene],
};

new Phaser.Game(config);
```

### 8.3 Sin Persistencia (No Save)

- No se utiliza `localStorage`, `IndexedDB`, cookies, ni backend.
- El estado `SeasonState` es un objeto plano en memoria (facilmente serializable a JSON, lo cual facilitara la implementacion de guardado en V2).
- Todas las interfaces estan disenadas como objetos serializables (sin referencias circulares, sin metodos de clase en los datos).

### 8.4 Internacionalizacion Futura (i18n)

Aunque V1 esta en espanol (o ingles segun configuracion), se recomienda:
- Todos los strings de UI visibles deben estar en un archivo o mapa de traducciones (ej. `strings.ts`) en lugar de hardcodeados.
- Esto no agrega complejidad significativa y prepara para i18n en V2+.

```typescript
// strings.ts (ejemplo)
export const STRINGS = {
  mainMenu: {
    title: 'MotoGT',
    subtitle: 'Motorcycle Racing Manager',
    riderNameLabel: 'Nombre del Piloto:',
    teamNameLabel: 'Nombre del Equipo:',
    startButton: 'INICIAR TEMPORADA',
  },
  // ...
};
```

### 8.5 Pruebas y Balance

**Pruebas unitarias recomendadas:**
- `RaceSimulator.simulate()` con datos controlados (stats fijos, ruido deterministico) para verificar que el ordenamiento es correcto.
- `MistakeSystem`: verificar que las probabilidades empiricas se aproximan a las teoricas con 10,000 iteraciones.
- `SeasonFactory`: verificar invariantes (9 IA + 1 jugador, 6 pistas, stats en rango).
- Desempates del campeonato: casos de prueba con pilotos empatados en puntos pero distinta distribucion de posiciones.

**Balance:**
- Con stats del jugador 6/6/6, el jugador deberia terminar aproximadamente 3ro-6to en el campeonato en promedio.
- Ajustar constantes (`CORNERING_MULTIPLIER`, `NOISE_STD_DEV`, `MISTAKE_PENALTY_BASE`) hasta lograr que:
  - Elegir el estilo correcto para cada pista sea significativo (~2-3 posiciones de diferencia).
  - Un error no arruine automaticamente la temporada pero sea un golpe importante.
  - Ganar el campeonato sea posible pero no trivial (~20-40% de probabilidad para un jugador que optimiza sus decisiones).

---

## 9. Apendices

### A. Lista de Pistas (Tracks)

Banco de 10 pistas. De estas se seleccionan 6 aleatoriamente para cada temporada.

| # | Nombre              | Ubicacion      | Factor Tecnico | Descripcion                                    |
|---|---------------------|----------------|----------------|------------------------------------------------|
| 1 | Mugello             | Italia         | 0.55           | Circuito ondulado con curvas rapidas. Mixto.   |
| 2 | Assen               | Paises Bajos   | 0.70           | "La Catedral". Curvas tecnicas y cambios rapidos|
| 3 | Phillip Island      | Australia      | 0.65           | Costero, fluido pero con curvas exigentes.     |
| 4 | Jerez               | Espana         | 0.75           | Tecnico y revirado. Premia el cornering.       |
| 5 | Sachsenring         | Alemania       | 0.85           | Muy revirado. El mas tecnico del calendario.   |
| 6 | Silverstone         | Reino Unido    | 0.40           | Rapido y ancho. Favorece la potencia pura.     |
| 7 | Misano              | Italia         | 0.60           | Mixto con curvas de media velocidad.           |
| 8 | Sepang              | Malasia        | 0.50           | Ancho, dos rectas largas, curvas tecnicas.     |
| 9 | Termas de Rio Hondo | Argentina      | 0.55           | Fluido con curvas rapidas y una recta larga.   |
|10 | COTA                | EE.UU.         | 0.45           | Moderno, cambios de elevacion, sectores mixtos.|

**Variedad garantizada en el calendario generado:**
- Al menos 1 pista con `technicalFactor < 0.35` (favorece pace).
- Al menos 1 pista con `technicalFactor > 0.70` (favorece cornering).
- El resto distribuidas uniformemente.

### B. Tabla de Puntuacion FIA MotoGP

| Pos | 1  | 2  | 3  | 4  | 5  | 6  | 7  | 8  | 9  | 10 |
|-----|----|----|----|----|----|----|----|----|----|----|
| Pts | 25 | 18 | 15 | 12 | 10 | 8  | 6  | 4  | 2  | 1  |

Maximo por temporada (6 carreras): 150 puntos.
Minimo (sin puntuar): 0 puntos.

### C. Glosario

| Termino              | Definicion                                                                 |
|----------------------|----------------------------------------------------------------------------|
| **Pace**             | Velocidad pura del piloto. La estadistica mas importante.                  |
| **Cornering**        | Habilidad en curvas y secciones tecnicas.                                  |
| **Consistency**      | Capacidad de evitar errores. Mitiga el riesgo de estilos agresivos.        |
| **Riding Style**     | Estilo de pilotaje: Safe, Balanced o Aggressive.                           |
| **Performance Score**| Puntaje numerico calculado por el simulador para ordenar a los pilotos.    |
| **Mistake**          | Error durante la carrera (caida, salida de pista) que penaliza el resultado.|
| **Technical Factor** | Que tan tecnica es una pista (0=pura velocidad, 1=maxima tecnica).         |
| **Season State**     | Objeto que contiene todo el estado de la temporada en curso.               |
| **Standings**        | Tabla de clasificacion del campeonato ordenada por puntos.                 |

---

## Historial de Cambios

| Version | Fecha       | Autor | Cambios                                |
|---------|-------------|-------|----------------------------------------|
| 1.0     | 2025-06-15  | —     | Especificacion tecnica inicial para V1. |

---

*Fin del documento.*
