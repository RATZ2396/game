# 🎮 Game Design Document (GDD)
## Neon Survivors 3D

---

## 1. Visión del Proyecto

| Aspecto | Descripción |
|---------|-------------|
| **Género** | Survivor / Roguelite / Bullet Heaven |
| **Inspiración** | Vampire Survivors, Yet Another Zombie Survivors |
| **Motor** | Three.js (WebGL) |
| **Estilo Visual** | Neon Arcade / Cyberpunk / Tron |
| **Plataformas** | PC (WASD) + Móvil (Joystick Virtual) |

### Objetivo del Juego
Sobrevivir oleadas infinitas de enemigos, recolectar XP, subir de nivel, elegir mejoras, y derrotar al Boss "The Cube King" al minuto 1:00.

---

## 2. Arquitectura de Código

### Clases Principales

```
┌─────────────────────────────────────────────────────────────┐
│                      GameManager                            │
│  - Bucle principal (animate)                                │
│  - Estados: MENU, PLAYING, PAUSED, GAME_OVER, VICTORY       │
│  - Inicialización de escena, cámara, renderer               │
│  - Post-processing (EffectComposer + UnrealBloomPass)       │
└─────────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────┬──────────┬──────────┬──────────┬──────────┐
    ▼             ▼          ▼          ▼          ▼          ▼
┌────────┐  ┌─────────┐  ┌────────┐  ┌────────┐  ┌─────────┐  ┌─────────┐
│  Time  │  │InputMgr │  │ Player │  │UIMgr   │  │SoundMgr │  │MenuMgr  │
└────────┘  └─────────┘  └────────┘  └────────┘  └─────────┘  └─────────┘
```

### Flujo de Estados del Juego

```
MENU ──(START)──► PLAYING ──(HP=0)──► GAME_OVER
                     │                     │
                     │                (Play Again)
                     ▼                     │
              (Kill Boss)                  ▼
                     │              ┌──────────┐
                     └──────────────► VICTORY  │
                                    └──────────┘
```

### Detalle de Clases

| Clase | Responsabilidad |
|-------|-----------------|
| **Time** | `deltaTime` para movimiento frame-independiente |
| **InputManager** | Híbrido WASD + nipplejs. `getMovementVector()` unificado |
| **MenuManager** | Main Menu, HUD visibility, startGame callback |
| **GAME_STATE** | Enum: MENU, PLAYING, PAUSED, GAME_OVER, VICTORY |
| **Player** | Movimiento, HP, XP, Weapons, SkillManager |
| **Weapon** | Pistola/Escopeta. Auto-aim al enemigo más cercano |
| **Projectile** | Balas con daño, velocidad, lifetime |
| **Enemy** | Tipos: Normal/Runner/Tank. Persigue al jugador |
| **Boss** | "The Cube King": 5000 HP, dorado, spawn a 60s |
| **EnemySpawner** | Oleadas dinámicas con escalado de dificultad |
| **WaveManager** | Tiempo de juego, multiplicadores de HP/spawn |
| **Skill (base)** | Clase abstracta para habilidades pasivas |
| **OrbitalShield** | Esferas cyan orbitando, daño + knockback |
| **ThunderStrike** | Rayo aleatorio cada 3s |
| **SkillManager** | Gestiona skills activas del jugador |
| **UIManager** | HUD, barras HP/XP, menús, floating text |
| **SoundManager** | WebAudio API, sintetizador sin archivos |
| **ParticleSystem** | Explosiones de partículas |
| **FloatingTextManager** | Números de daño 3D |
| **CameraController** | Sigue al jugador con smoothing |

---

## 3. Mecánicas Implementadas

### ⚔️ Combate
- **Auto-disparo**: El jugador dispara automáticamente al objetivo válido más cercano
- **Sistema de Targeting Dinámico** (3 fases):
  1. **Filtrado por Rango**: Solo candidatos cuya superficie esté dentro del rango del arma
  2. **Ordenamiento**: Por distancia de superficie (`rawDist - radius`)
  3. **Selección**: El enemigo con menor distancia de superficie
- **Radios de Hitbox**:
  - Normal: 0.5, Runner: 0.35, Tank: 0.75, **Boss: 2.5**
- **Piercing**: Pistola atraviesa 1 enemigo, Escopeta no atraviesa
- **Colisiones**: `hitDist = projectileHitDist + enemy.radius`
- **Daño por contacto**: (cooldown 0.5s)
- **Flash de daño**: Enemigos brillan blanco al recibir daño

### 📈 Progresión
- **Gemas de XP**: Caen al matar enemigos, efecto "imán" a 3 unidades
- **Level Up**: XP necesaria escala x1.5 por nivel
- **Menú de mejoras**: 4 opciones aleatorias al subir de nivel

### 🎯 Mejoras Disponibles
| ID | Nombre | Efecto |
|----|--------|--------|
| `pistol` | Mejorar Pistola | +Daño, -Cooldown |
| `shotgun` | Equipar/Mejorar Escopeta | 3 balas en arco |
| `orbital` | Orbital Shield | Esferas giratorias con knockback |
| `thunder` | Thunder Strike | Rayo cada 3s |
| `heal` | Curar Vida | +50% HP |

### 👾 Tipos de Enemigos
| Tipo | Color | HP | Velocidad | Peso Spawn |
|------|-------|----|-----------| -----------|
| Normal | Rojo | 30 | 3 | 60% |
| Runner | Naranja | 15 | 6 | 25% |
| Tank | Violeta | 80 | 1.5 | 15% |
| **Boss** | Dorado | 5000 | 1.5 | Evento 60s |

### 🎉 Eventos
- **Boss Fight** (60s): "The Cube King" aparece con alerta
- **Victoria**: Slow-mo, explosión dorada, pantalla de victoria

### 👑 Mecánicas de Jefe (Duel Mode)
- **Limpieza de Arena**: Al spawnear el boss, todos los enemigos son eliminados con explosiones
- **Spawn Reducido**: Durante el boss fight, nuevos enemigos aparecen cada 4s (vs 0.8s normal)
- **Retorno Normal**: Al matar al boss, el spawn rate vuelve a la velocidad frenética

---

## 4. Sistema de Audio

Todos los sonidos son **sintetizados** con WebAudio API:

| Método | Descripción |
|--------|-------------|
| `playShoot()` | Beep corto, pitch variable |
| `playHit()` | White noise 50ms |
| `playExplosion()` | Low-pass noise 300ms |
| `playLevelUp()` | Arpegio ascendente C-E-G-C |
| `playGameOver()` | Notas descendentes tristes |
| `playBossAlert()` | 3 tonos graves de advertencia |
| `playVictory()` | Arpegio triunfal extendido |

---

## 5. Post-Processing

| Pass | Parámetros |
|------|------------|
| **RenderPass** | Escena principal |
| **UnrealBloomPass** | Strength: 1.5, Radius: 0.4, Threshold: 0.1 |

### Materiales Emisivos
- Proyectiles: `emissiveIntensity: 2.0`
- Gemas XP: `emissiveIntensity: 1.5`
- Orbital Shield: `emissiveIntensity: 2.0`
- Boss: `emissiveIntensity: 1.5`
- Enemy Flash: `emissiveIntensity: 3.0`

---

## 6. Controles

### PC
| Tecla | Acción |
|-------|--------|
| W/A/S/D | Movimiento |
| (Automático) | Disparo |

### Móvil
| Control | Acción |
|---------|--------|
| Joystick Virtual (izq) | Movimiento |
| (Automático) | Disparo |

---

## 7. Estructura de Archivos

```
proyecto-i/
├── index.html          # Entry point, viewport, CSS
├── package.json        # Dependencias (three, vite, nipplejs)
├── GDD.md              # Este documento
└── src/
    └── main.js         # Todo el código del juego (~2000 líneas)
```

---

## 8. Dependencias

```json
{
  "three": "^0.170.0",
  "nipplejs": "^0.10.2",
  "vite": "^6.2.0"
}
```

---

## 9. Regla de Oro para la IA

> **⚠️ IMPORTANTE:** Cada vez que se añada una nueva funcionalidad, clase, mecánica o sistema al código, **ESTE DOCUMENTO (GDD.md) debe ser actualizado automáticamente** para reflejar el cambio.

### Checklist de Actualización
- [ ] Nueva clase → Agregar a tabla de clases
- [ ] Nueva mecánica → Agregar a sección de mecánicas
- [ ] Nuevo sonido → Agregar a tabla de audio
- [ ] Nuevo enemigo → Agregar a tabla de enemigos
- [ ] Nueva mejora → Agregar a tabla de mejoras
- [ ] Nuevo control → Agregar a sección de controles

---

## 10. Próximos Pasos (Backlog)

- [ ] Más tipos de armas (Láser, Bomba, etc.)
- [ ] Más habilidades pasivas
- [ ] Sistema de achievements
- [ ] Leaderboard local
- [ ] Más bosses en intervalos
- [ ] Tienda de mejoras permanentes
- [ ] Mapa procedural

---

*Última actualización: 2026-01-03*
*Versión: 1.0.0*
