"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Text, Box, Sphere, Plane, Sky, Environment, Html } from "@react-three/drei"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useState, useRef, useEffect, Suspense } from "react"
import type * as THREE from "three"

// Game State Management
interface GameState {
  level: number
  experience: number
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  inventory: {
    diamonds: number
    emeralds: number
    gold: number
    iron: number
    redstone: number
    wood: number
  }
  equipment: {
    weapon: string
    armor: string
    shield: string
  }
  unlockedSections: string[]
  isInBattle: boolean
  dragonHealth: number
  maxDragonHealth: number
  playerPosition: [number, number, number]
  dragonPosition: [number, number, number]
  isAttacking: boolean
  isDodging: boolean
  lastAttackTime: number
  invulnerable: boolean
}

interface DragonAttack {
  id: string
  type: "fireball" | "breath" | "charge" | "aoe"
  position: [number, number, number]
  target: [number, number, number]
  startTime: number
  duration: number
  damage: number
}

// Fireball Projectile Component
function Fireball({ attack, onHit }: { attack: DragonAttack; onHit: (damage: number) => void }) {
  const meshRef = useRef<THREE.Group>(null)
  const [hasHit, setHasHit] = useState(false)

  useFrame((state) => {
    if (meshRef.current && !hasHit) {
      const elapsed = (state.clock.elapsedTime * 1000 - attack.startTime) / 1000
      const progress = Math.min(elapsed / (attack.duration / 1000), 1)

      // Move towards target
      const startPos = attack.position
      const targetPos = attack.target

      meshRef.current.position.x = startPos[0] + (targetPos[0] - startPos[0]) * progress
      meshRef.current.position.y = startPos[1] + (targetPos[1] - startPos[1]) * progress
      meshRef.current.position.z = startPos[2] + (targetPos[2] - startPos[2]) * progress

      // Check collision with player (simplified)
      const distance = Math.sqrt(
        Math.pow(meshRef.current.position.x - targetPos[0], 2) + Math.pow(meshRef.current.position.z - targetPos[2], 2),
      )

      if (distance < 1.5 && progress > 0.8) {
        setHasHit(true)
        onHit(attack.damage)
      }

      // Rotation for effect
      meshRef.current.rotation.x += 0.1
      meshRef.current.rotation.y += 0.1
    }
  })

  if (hasHit) return null

  return (
    <group ref={meshRef}>
      <Sphere args={[0.3]}>
        <meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={1} />
      </Sphere>
      {/* Fire trail effect */}
      <Sphere args={[0.2]} position={[-0.5, 0, 0]}>
        <meshStandardMaterial color="#ff6500" emissive="#ff6500" emissiveIntensity={0.8} transparent opacity={0.7} />
      </Sphere>
    </group>
  )
}

// AOE Attack Indicator
function AOEIndicator({
  position,
  radius,
  duration,
}: { position: [number, number, number]; radius: number; duration: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 10) * 0.1 + 0.9
      meshRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <Plane ref={meshRef} args={[radius * 2, radius * 2]} rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <meshStandardMaterial color="#ff0000" transparent opacity={0.3} emissive="#ff0000" emissiveIntensity={0.5} />
    </Plane>
  )
}

// Character Component with Combat
function Character({
  position,
  equipment,
  isInBattle,
  onMove,
  onAttack,
  isAttacking,
  isDodging,
  invulnerable,
}: {
  position: [number, number, number]
  equipment: any
  isInBattle: boolean
  onMove: (pos: [number, number, number]) => void
  onAttack: () => void
  isAttacking: boolean
  isDodging: boolean
  invulnerable: boolean
}) {
  const meshRef = useRef<THREE.Group>(null)
  const [movement, setMovement] = useState({ w: false, a: false, s: false, d: false })
  const [isMoving, setIsMoving] = useState(false)
  const [direction, setDirection] = useState(0)

  useFrame((state, delta) => {
    if (meshRef.current) {
      let newX = meshRef.current.position.x
      let newZ = meshRef.current.position.z
      let moved = false

      if (isInBattle) {
        const speed = isDodging ? 8 : 4 // Faster when dodging

        if (movement.w) {
          newZ -= speed * delta
          moved = true
        }
        if (movement.s) {
          newZ += speed * delta
          moved = true
        }
        if (movement.a) {
          newX -= speed * delta
          moved = true
        }
        if (movement.d) {
          newX += speed * delta
          moved = true
        }

        // Battle arena boundaries
        newX = Math.max(-12, Math.min(12, newX))
        newZ = Math.max(-12, Math.min(12, newZ))
      } else {
        // Normal exploration movement
        if (isMoving) {
          const speed = 3
          const newXExplore = meshRef.current.position.x + Math.cos(direction) * speed * delta
          const newZExplore = meshRef.current.position.z + Math.sin(direction) * speed * delta

          if (newXExplore > -25 && newXExplore < 25 && newZExplore > -25 && newZExplore < 25) {
            newX = newXExplore
            newZ = newZExplore
            moved = true
          }
        }
      }

      if (moved) {
        meshRef.current.position.x = newX
        meshRef.current.position.z = newZ
        onMove([newX, position[1], newZ])

        // Walking animation
        meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 8) * 0.1
      }

      // Attack animation
      if (isAttacking) {
        meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 20) * 0.3
      }

      // Dodge animation
      if (isDodging) {
        meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 15) * 0.2
      }

      // Invulnerability effect
      if (invulnerable) {
        meshRef.current.visible = Math.sin(state.clock.elapsedTime * 20) > 0
      } else {
        meshRef.current.visible = true
      }
    }
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (isInBattle) {
        switch (key) {
          case "w":
          case "arrowup":
            setMovement((prev) => ({ ...prev, w: true }))
            break
          case "s":
          case "arrowdown":
            setMovement((prev) => ({ ...prev, s: true }))
            break
          case "a":
          case "arrowleft":
            setMovement((prev) => ({ ...prev, a: true }))
            break
          case "d":
          case "arrowright":
            setMovement((prev) => ({ ...prev, d: true }))
            break
          case " ":
          case "enter":
            event.preventDefault()
            onAttack()
            break
        }
      } else {
        setIsMoving(true)
        switch (key) {
          case "w":
          case "arrowup":
            setDirection(Math.PI / 2)
            break
          case "s":
          case "arrowdown":
            setDirection(-Math.PI / 2)
            break
          case "a":
          case "arrowleft":
            setDirection(Math.PI)
            break
          case "d":
          case "arrowright":
            setDirection(0)
            break
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (isInBattle) {
        switch (key) {
          case "w":
          case "arrowup":
            setMovement((prev) => ({ ...prev, w: false }))
            break
          case "s":
          case "arrowdown":
            setMovement((prev) => ({ ...prev, s: false }))
            break
          case "a":
          case "arrowleft":
            setMovement((prev) => ({ ...prev, a: false }))
            break
          case "d":
          case "arrowright":
            setMovement((prev) => ({ ...prev, d: false }))
            break
        }
      } else {
        setIsMoving(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [isInBattle, onAttack])

  const getWeaponColor = (weapon: string) => {
    switch (weapon) {
      case "Diamond Sword":
        return "#00ffff"
      case "Iron Sword":
        return "#c0c0c0"
      case "Golden Sword":
        return "#ffd700"
      default:
        return "#8b4513"
    }
  }

  const getArmorColor = (armor: string) => {
    switch (armor) {
      case "Diamond Armor":
        return "#00ffff"
      case "Iron Armor":
        return "#c0c0c0"
      case "Golden Armor":
        return "#ffd700"
      default:
        return "#4a90e2"
    }
  }

  return (
    <group ref={meshRef} position={position}>
      {/* Character Head */}
      <Box args={[0.8, 0.8, 0.8]} position={[0, 2.4, 0]}>
        <meshStandardMaterial color="#ffdbac" />
      </Box>

      {/* Character Body with Armor */}
      <Box args={[0.8, 1.2, 0.4]} position={[0, 1.4, 0]}>
        <meshStandardMaterial color={getArmorColor(equipment.armor)} />
      </Box>

      {/* Arms */}
      <Box args={[0.4, 1.2, 0.4]} position={[-0.6, 1.4, 0]}>
        <meshStandardMaterial color="#ffdbac" />
      </Box>
      <Box args={[0.4, 1.2, 0.4]} position={[0.6, 1.4, 0]}>
        <meshStandardMaterial color="#ffdbac" />
      </Box>

      {/* Legs */}
      <Box args={[0.4, 1.2, 0.4]} position={[-0.2, 0.4, 0]}>
        <meshStandardMaterial color="#2c3e50" />
      </Box>
      <Box args={[0.4, 1.2, 0.4]} position={[0.2, 0.4, 0]}>
        <meshStandardMaterial color="#2c3e50" />
      </Box>

      {/* Weapon */}
      <Box args={[0.1, 1.5, 0.1]} position={[1, 1.8, 0]} rotation={[0, 0, Math.PI / 4]}>
        <meshStandardMaterial
          color={getWeaponColor(equipment.weapon)}
          emissive={getWeaponColor(equipment.weapon)}
          emissiveIntensity={0.2}
        />
      </Box>

      {/* Shield */}
      {equipment.shield && (
        <Box args={[0.6, 0.8, 0.1]} position={[-0.8, 1.4, 0]}>
          <meshStandardMaterial color="#8b4513" />
        </Box>
      )}

      {/* Power Aura */}
      <Sphere args={[1.5]} position={[0, 1.5, 0]}>
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={invulnerable ? 0.3 : 0.1}
          emissive={invulnerable ? "#00ff00" : "#ffffff"}
          emissiveIntensity={invulnerable ? 0.8 : Math.min(equipment.level * 0.1, 0.5)}
        />
      </Sphere>

      {/* Attack Effect */}
      {isAttacking && (
        <group position={[1.5, 1.5, 0]}>
          <Sphere args={[0.5]}>
            <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={1} transparent opacity={0.7} />
          </Sphere>
        </group>
      )}
    </group>
  )
}

// Dragon Boss with Advanced Combat
function DragonBoss({
  health,
  maxHealth,
  position,
  playerPosition,
  onAttack,
  attacks,
}: {
  health: number
  maxHealth: number
  position: [number, number, number]
  playerPosition: [number, number, number]
  onAttack: (attack: DragonAttack) => void
  attacks: DragonAttack[]
}) {
  const meshRef = useRef<THREE.Group>(null)
  const [attackCooldown, setAttackCooldown] = useState(0)
  const [currentAttackPattern, setCurrentAttackPattern] = useState(0)

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Flying animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 2
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2

      // Look at player
      const dx = playerPosition[0] - meshRef.current.position.x
      const dz = playerPosition[2] - meshRef.current.position.z
      const angle = Math.atan2(dx, dz)
      meshRef.current.rotation.y = angle

      // Attack patterns
      setAttackCooldown((prev) => Math.max(0, prev - delta))

      if (attackCooldown <= 0) {
        const patterns = ["fireball", "breath", "aoe", "charge"]
        const attackType = patterns[currentAttackPattern % patterns.length] as DragonAttack["type"]

        const newAttack: DragonAttack = {
          id: `attack_${Date.now()}`,
          type: attackType,
          position: [meshRef.current.position.x, meshRef.current.position.y, meshRef.current.position.z],
          target: [...playerPosition],
          startTime: state.clock.elapsedTime * 1000,
          duration: attackType === "fireball" ? 2000 : attackType === "aoe" ? 3000 : 1500,
          damage: 20 + Math.floor(Math.random() * 10),
        }

        onAttack(newAttack)
        setAttackCooldown(2 + Math.random() * 2) // 2-4 seconds between attacks
        setCurrentAttackPattern((prev) => prev + 1)
      }
    }
  })

  const healthPercentage = (health / maxHealth) * 100

  return (
    <group ref={meshRef} position={position}>
      {/* Dragon Body */}
      <Box args={[4, 2, 8]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#4a0080" emissive="#4a0080" emissiveIntensity={0.3} />
      </Box>

      {/* Dragon Head */}
      <Box args={[2, 2, 3]} position={[0, 0, 4]}>
        <meshStandardMaterial color="#6a0099" emissive="#6a0099" emissiveIntensity={0.4} />
      </Box>

      {/* Dragon Wings */}
      <Box args={[8, 0.2, 4]} position={[0, 1, 0]} rotation={[0, 0, Math.sin(Date.now() * 0.01) * 0.3]}>
        <meshStandardMaterial color="#2a0040" transparent opacity={0.8} />
      </Box>

      {/* Dragon Eyes */}
      <Sphere args={[0.3]} position={[-0.5, 0.5, 5]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1} />
      </Sphere>
      <Sphere args={[0.3]} position={[0.5, 0.5, 5]}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1} />
      </Sphere>

      {/* Health Bar */}
      <Html position={[0, 3, 0]} center>
        <div className="bg-black/80 text-white p-2 rounded min-w-[200px]">
          <div className="text-center font-bold text-red-400 mb-1">🐉 ENDER DRAGON</div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-red-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${healthPercentage}%` }}
            ></div>
          </div>
          <div className="text-center text-sm mt-1">
            {health} / {maxHealth} HP
          </div>
        </div>
      </Html>
    </group>
  )
}

// 3D Scene Component
function Scene({
  gameState,
  onStationInteract,
  onPlayerAttack,
  onPlayerHit,
  dragonAttacks,
  onDragonAttack,
}: {
  gameState: GameState
  onStationInteract: (station: string) => void
  onPlayerAttack: () => void
  onPlayerHit: (damage: number) => void
  dragonAttacks: DragonAttack[]
  onDragonAttack: (attack: DragonAttack) => void
}) {
  const portfolioStations = [
    {
      position: [-10, 0, -8] as [number, number, number],
      title: "About Me",
      color: "#3498db",
      unlocked: gameState.unlockedSections.includes("about"),
    },
    {
      position: [10, 0, -8] as [number, number, number],
      title: "Experience",
      color: "#e74c3c",
      unlocked: gameState.unlockedSections.includes("experience"),
    },
    {
      position: [-10, 0, 8] as [number, number, number],
      title: "Skills",
      color: "#f39c12",
      unlocked: gameState.unlockedSections.includes("skills"),
    },
    {
      position: [10, 0, 8] as [number, number, number],
      title: "Projects",
      color: "#27ae60",
      unlocked: gameState.unlockedSections.includes("projects"),
    },
  ]

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 10, 0]} intensity={0.5} />

      {/* Environment */}
      <Sky sunPosition={[100, 20, 100]} />
      <Environment preset={gameState.isInBattle ? "night" : "sunset"} />

      {/* Ocean */}
      <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <meshStandardMaterial color="#006994" transparent opacity={0.8} />
      </Plane>

      {/* Beach */}
      <Plane args={[50, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 5]}>
        <meshStandardMaterial color="#f4e4bc" />
      </Plane>

      {/* Character */}
      <Character
        position={gameState.playerPosition}
        equipment={gameState.equipment}
        isInBattle={gameState.isInBattle}
        onMove={(pos) => {
          // Update player position in parent component
        }}
        onAttack={onPlayerAttack}
        isAttacking={gameState.isAttacking}
        isDodging={gameState.isDodging}
        invulnerable={gameState.invulnerable}
      />

      {/* Portfolio Stations (only when not in battle) */}
      {!gameState.isInBattle &&
        portfolioStations.map((station, index) => (
          <group key={index} position={station.position}>
            <Box
              args={[3, 0.5, 3]}
              onClick={() => station.unlocked && onStationInteract(station.title)}
              onPointerEnter={() => station.unlocked && (document.body.style.cursor = "pointer")}
              onPointerLeave={() => (document.body.style.cursor = "default")}
            >
              <meshStandardMaterial
                color={station.unlocked ? station.color : "#666666"}
                emissive={station.unlocked ? station.color : "#333333"}
                emissiveIntensity={station.unlocked ? 0.2 : 0.1}
              />
            </Box>

            <Text position={[0, 2, 0]} fontSize={0.5} color="white" anchorX="center" anchorY="middle">
              {station.unlocked ? station.title : "🔒 LOCKED"}
            </Text>

            {station.unlocked && (
              <Sphere args={[0.1]} position={[0, 3, 0]}>
                <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={1} />
              </Sphere>
            )}
          </group>
        ))}

      {/* Dragon Boss (only in battle) */}
      {gameState.isInBattle && (
        <DragonBoss
          health={gameState.dragonHealth}
          maxHealth={gameState.maxDragonHealth}
          position={gameState.dragonPosition}
          playerPosition={gameState.playerPosition}
          onAttack={onDragonAttack}
          attacks={dragonAttacks}
        />
      )}

      {/* Dragon Attacks */}
      {dragonAttacks.map((attack) => {
        if (attack.type === "fireball") {
          return <Fireball key={attack.id} attack={attack} onHit={onPlayerHit} />
        } else if (attack.type === "aoe") {
          return <AOEIndicator key={attack.id} position={attack.target} radius={3} duration={attack.duration} />
        }
        return null
      })}

      {/* Battle Arena */}
      {gameState.isInBattle && (
        <group>
          {/* Arena Floor */}
          <Plane args={[30, 30]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
            <meshStandardMaterial color="#2c3e50" />
          </Plane>

          {/* Arena Walls */}
          {[
            [0, 5, 15],
            [0, 5, -15],
            [15, 5, 0],
            [-15, 5, 0],
          ].map((pos, i) => (
            <Box key={i} args={[30, 10, 1]} position={pos as [number, number, number]}>
              <meshStandardMaterial color="#34495e" transparent opacity={0.3} />
            </Box>
          ))}

          {/* Arena Boundary Indicators */}
          <Plane args={[26, 26]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
            <meshStandardMaterial color="#ff0000" transparent opacity={0.1} wireframe />
          </Plane>
        </group>
      )}
    </>
  )
}

// Main Portfolio Component
export default function Portfolio() {
  const [gameState, setGameState] = useState<GameState>({
    level: 1,
    experience: 0,
    health: 100,
    maxHealth: 100,
    mana: 50,
    maxMana: 50,
    inventory: {
      diamonds: 0,
      emeralds: 0,
      gold: 0,
      iron: 0,
      redstone: 0,
      wood: 0,
    },
    equipment: {
      weapon: "Wooden Sword",
      armor: "Leather Armor",
      shield: "",
    },
    unlockedSections: [],
    isInBattle: false,
    dragonHealth: 1000,
    maxDragonHealth: 1000,
    playerPosition: [0, 0, 0],
    dragonPosition: [0, 15, -10],
    isAttacking: false,
    isDodging: false,
    lastAttackTime: 0,
    invulnerable: false,
  })

  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [showParticles, setShowParticles] = useState(false)
  const [battleStarted, setBattleStarted] = useState(false)
  const [dragonAttacks, setDragonAttacks] = useState<DragonAttack[]>([])

  // Combat functions
  const handlePlayerAttack = () => {
    const now = Date.now()
    if (now - gameState.lastAttackTime < 500) return // Attack cooldown

    setGameState((prev) => ({ ...prev, isAttacking: true, lastAttackTime: now }))

    // Check if player is close enough to dragon
    const distance = Math.sqrt(
      Math.pow(gameState.playerPosition[0] - gameState.dragonPosition[0], 2) +
        Math.pow(gameState.playerPosition[2] - gameState.dragonPosition[2], 2),
    )

    if (distance < 8) {
      // Attack range
      const damage = gameState.level * 10 + (gameState.equipment.weapon === "Diamond Sword" ? 50 : 20)
      setGameState((prev) => ({
        ...prev,
        dragonHealth: Math.max(0, prev.dragonHealth - damage),
      }))
    }

    // Reset attack animation
    setTimeout(() => {
      setGameState((prev) => ({ ...prev, isAttacking: false }))
    }, 300)
  }

  const handlePlayerHit = (damage: number) => {
    if (gameState.invulnerable) return

    setGameState((prev) => ({
      ...prev,
      health: Math.max(0, prev.health - damage),
      invulnerable: true,
    }))

    // Invulnerability frames
    setTimeout(() => {
      setGameState((prev) => ({ ...prev, invulnerable: false }))
    }, 1000)
  }

  const handleDragonAttack = (attack: DragonAttack) => {
    setDragonAttacks((prev) => [...prev, attack])

    // Remove attack after duration
    setTimeout(() => {
      setDragonAttacks((prev) => prev.filter((a) => a.id !== attack.id))

      // Check for AOE damage
      if (attack.type === "aoe") {
        const distance = Math.sqrt(
          Math.pow(gameState.playerPosition[0] - attack.target[0], 2) +
            Math.pow(gameState.playerPosition[2] - attack.target[2], 2),
        )

        if (distance < 3) {
          handlePlayerHit(attack.damage)
        }
      }
    }, attack.duration)
  }

  // Dodge mechanic
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "shift" && gameState.isInBattle) {
        setGameState((prev) => ({ ...prev, isDodging: true }))
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "shift") {
        setGameState((prev) => ({ ...prev, isDodging: false }))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState.isInBattle])

  // Portfolio functions
  const gainExperience = (amount: number) => {
    setGameState((prev) => {
      const newExp = prev.experience + amount
      const newLevel = Math.floor(newExp / 1000) + 1
      const leveledUp = newLevel > prev.level

      if (leveledUp) {
        setShowParticles(true)
        setTimeout(() => setShowParticles(false), 2000)
      }

      return {
        ...prev,
        experience: newExp,
        level: newLevel,
        maxHealth: leveledUp ? prev.maxHealth + 20 : prev.maxHealth,
        health: leveledUp ? prev.maxHealth + 20 : prev.health,
        maxMana: leveledUp ? prev.maxMana + 10 : prev.maxMana,
        mana: leveledUp ? prev.maxMana + 10 : prev.mana,
      }
    })
  }

  const addToInventory = (items: Partial<GameState["inventory"]>) => {
    setGameState((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        ...Object.keys(items).reduce((acc, key) => {
          acc[key as keyof typeof acc] =
            (prev.inventory[key as keyof typeof prev.inventory] || 0) + (items[key as keyof typeof items] || 0)
          return acc
        }, {} as any),
      },
    }))
  }

  const unlockSection = (section: string) => {
    setGameState((prev) => ({
      ...prev,
      unlockedSections: [...prev.unlockedSections, section],
    }))
  }

  const craftEquipment = (item: string, cost: Partial<GameState["inventory"]>) => {
    const canCraft = Object.keys(cost).every(
      (key) => gameState.inventory[key as keyof typeof gameState.inventory] >= (cost[key as keyof typeof cost] || 0),
    )

    if (canCraft) {
      setGameState((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          ...Object.keys(cost).reduce((acc, key) => {
            acc[key as keyof typeof acc] =
              (prev.inventory[key as keyof typeof prev.inventory] || 0) - (cost[key as keyof typeof cost] || 0)
            return acc
          }, {} as any),
        },
        equipment: {
          ...prev.equipment,
          weapon: item.includes("Sword") ? item : prev.equipment.weapon,
          armor: item.includes("Armor") ? item : prev.equipment.armor,
          shield: item.includes("Shield") ? item : prev.equipment.shield,
        },
      }))
      gainExperience(100)
    }
  }

  const startBattle = () => {
    setGameState((prev) => ({
      ...prev,
      isInBattle: true,
      playerPosition: [0, 0, 0], // Reset player position for battle
    }))
    setBattleStarted(true)
  }

  // Check if ready for battle
  const readyForBattle = gameState.unlockedSections.length >= 4 && gameState.level >= 5

  // Portfolio data
  const experiences = [
    {
      company: "Capy Labs",
      position: "Developer",
      period: "Aug 2024 - Present",
      description: "Developing NFT games for Android and Web using Unity Engine and Phaser Framework.",
      technologies: ["Unity", "Phaser", "TypeScript", "React", "NextJS"],
      rewards: { diamonds: 10, emeralds: 5, experience: 500 },
    },
    {
      company: "EGD Group",
      position: "Unity Game Developer",
      period: "Jul 2023 - Jul 2024",
      description: "Developed mobile games from concept to release.",
      technologies: ["Unity", "Mobile Development", "Game Design"],
      rewards: { diamonds: 8, gold: 10, experience: 400 },
    },
    {
      company: "Dinosys Corporation",
      position: "Unity Game Developer",
      period: "Jul 2022 - Jul 2023",
      description: "Built NFT game 'Hellven' using Unity Engine.",
      technologies: ["Unity", "NFT Games", "Multiplayer"],
      rewards: { emeralds: 8, iron: 15, experience: 300 },
    },
  ]

  const projects = [
    {
      title: "Basoho Real Estate Platform",
      description: "Real estate platform with VIP listings and location-based search.",
      technologies: ["React", "TypeScript", "SEO"],
      rewards: { diamonds: 15, experience: 300 },
    },
    {
      title: "VR Tour Projects",
      description: "Interactive VR tours for businesses.",
      technologies: ["WebGL", "VR", "3D Graphics"],
      rewards: { emeralds: 12, experience: 250 },
    },
    {
      title: "Tapout: Unlock Anime",
      description: "Android mobile game with optimized performance.",
      technologies: ["Unity", "Android", "AdMob"],
      rewards: { gold: 20, experience: 200 },
    },
  ]

  const skills = [
    { name: "Unity Engine", level: 95, category: "Game Development" },
    { name: "C# Programming", level: 90, category: "Game Development" },
    { name: "React", level: 88, category: "Web Development" },
    { name: "TypeScript", level: 85, category: "Web Development" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-green-400 relative overflow-hidden">
      {/* Particle Effects */}
      {showParticles && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce text-3xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1000}ms`,
              }}
            >
              ⭐
            </div>
          ))}
        </div>
      )}

      {/* Game HUD */}
      <div className="fixed top-4 left-4 z-50 space-y-2">
        <Card className="bg-black/90 text-white border-2 border-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl">⚔️</div>
              <div>
                <div className="font-bold text-yellow-400">Level {gameState.level}</div>
                <div className="text-sm">EXP: {gameState.experience}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/90 text-white border-2 border-red-500">
          <CardContent className="p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-red-500">❤️</span>
                <Progress value={(gameState.health / gameState.maxHealth) * 100} className="flex-1" />
                <span className="text-sm">
                  {gameState.health}/{gameState.maxHealth}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-500">💙</span>
                <Progress value={(gameState.mana / gameState.maxMana) * 100} className="flex-1" />
                <span className="text-sm">
                  {gameState.mana}/{gameState.maxMana}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory */}
      <div className="fixed top-4 right-4 z-50">
        <Card className="bg-black/90 text-white border-2 border-green-500">
          <CardContent className="p-4">
            <div className="text-center text-yellow-400 font-bold mb-2">📦 Inventory</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-2xl">💎</div>
                <div className="text-xs">{gameState.inventory.diamonds}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">💚</div>
                <div className="text-xs">{gameState.inventory.emeralds}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🟨</div>
                <div className="text-xs">{gameState.inventory.gold}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">⚪</div>
                <div className="text-xs">{gameState.inventory.iron}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🔴</div>
                <div className="text-xs">{gameState.inventory.redstone}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🟫</div>
                <div className="text-xs">{gameState.inventory.wood}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equipment */}
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="bg-black/90 text-white border-2 border-purple-500">
          <CardContent className="p-4">
            <div className="text-center text-yellow-400 font-bold mb-2">⚔️ Equipment</div>
            <div className="space-y-1 text-sm">
              <div>🗡️ {gameState.equipment.weapon}</div>
              <div>🛡️ {gameState.equipment.armor}</div>
              {gameState.equipment.shield && <div>🛡️ {gameState.equipment.shield}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Battle Controls */}
      {gameState.isInBattle && (
        <div className="fixed bottom-4 left-4 z-50">
          <Card className="bg-black/90 text-white border-2 border-red-500">
            <CardContent className="p-4">
              <div className="text-center text-yellow-400 font-bold mb-2">⚔️ Battle Controls</div>
              <div className="space-y-1 text-sm">
                <div>🎮 WASD - Move</div>
                <div>⚔️ SPACE - Attack (when close)</div>
                <div>🏃 SHIFT - Dodge (faster movement)</div>
                <div>👁️ Watch for red indicators!</div>
              </div>
              <div className="mt-2 text-xs text-gray-300">
                Distance to Dragon:{" "}
                {Math.floor(
                  Math.sqrt(
                    Math.pow(gameState.playerPosition[0] - gameState.dragonPosition[0], 2) +
                      Math.pow(gameState.playerPosition[2] - gameState.dragonPosition[2], 2),
                  ),
                )}
                m
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3D Scene */}
      <div className="w-full h-screen">
        <Canvas shadows camera={{ position: [0, 10, 15], fov: 60 }}>
          <Suspense fallback={null}>
            <Scene
              gameState={gameState}
              onStationInteract={setSelectedStation}
              onPlayerAttack={handlePlayerAttack}
              onPlayerHit={handlePlayerHit}
              dragonAttacks={dragonAttacks}
              onDragonAttack={handleDragonAttack}
            />
            <OrbitControls
              enablePan={!gameState.isInBattle}
              enableZoom={true}
              enableRotate={!gameState.isInBattle}
              maxPolarAngle={Math.PI / 2}
              minDistance={5}
              maxDistance={30}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Portfolio Sections */}
      <div className="absolute inset-0 overflow-y-auto z-10 pointer-events-none">
        <div className="min-h-screen flex flex-col">
          {/* Hero Section */}
          <section className="h-screen flex items-center justify-center pointer-events-auto">
            <div className="text-center space-y-8 bg-black/50 p-8 rounded-lg">
              <h1 className="text-6xl font-bold text-white">
                <span className="text-green-400">GAME</span> <span className="text-yellow-400">DEVELOPER</span>
              </h1>
              <p className="text-xl text-white max-w-2xl">
                🎮 Crafting immersive gaming experiences with Unity Engine and modern web technologies!
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => {
                    unlockSection("about")
                    gainExperience(100)
                    addToInventory({ wood: 5, iron: 2 })
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  disabled={gameState.unlockedSections.includes("about")}
                >
                  {gameState.unlockedSections.includes("about") ? "✅ Unlocked" : "🔓 Unlock About"}
                </Button>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="min-h-screen flex items-center justify-center pointer-events-auto">
            <div className="max-w-4xl mx-auto p-8">
              <Card className="bg-black/80 text-white border-4 border-blue-500">
                <CardHeader>
                  <CardTitle className="text-4xl text-center text-blue-400">📖 ABOUT ME</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-lg">
                    I am a dedicated game developer with over 4 years of experience in Unity Engine and modern web
                    technologies. My journey spans from intern to developer, working on diverse projects.
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-blue-900/50 p-4 rounded border-2 border-blue-600">
                      <h3 className="font-bold text-blue-400 mb-2">🎮 Game Development</h3>
                      <p>Unity, C#, Mobile Games, NFT Platforms</p>
                    </div>
                    <div className="bg-green-900/50 p-4 rounded border-2 border-green-600">
                      <h3 className="font-bold text-green-400 mb-2">🌐 Web Development</h3>
                      <p>React, TypeScript, Next.js, TailwindCSS</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <Button
                      onClick={() => {
                        unlockSection("experience")
                        gainExperience(150)
                        addToInventory({ iron: 5, gold: 2 })
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold"
                      disabled={gameState.unlockedSections.includes("experience")}
                    >
                      {gameState.unlockedSections.includes("experience") ? "✅ Unlocked" : "🔓 Unlock Experience"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Experience Section */}
          <section className="min-h-screen flex items-center justify-center pointer-events-auto">
            <div className="max-w-6xl mx-auto p-8">
              <h2 className="text-5xl font-bold text-center mb-12 text-red-400">🏰 EXPERIENCE WORLDS</h2>
              <div className="space-y-6">
                {experiences.map((exp, index) => (
                  <Card key={index} className="bg-black/80 text-white border-4 border-red-500">
                    <CardContent className="p-6">
                      <div className="grid md:grid-cols-3 gap-6">
                        <div>
                          <h3 className="text-xl font-bold text-yellow-400">{exp.company}</h3>
                          <p className="text-red-400">{exp.position}</p>
                          <p className="text-sm text-gray-300">{exp.period}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="mb-4">{exp.description}</p>
                          <div className="flex flex-wrap gap-2 mb-4">
                            {exp.technologies.map((tech, i) => (
                              <Badge key={i} className="bg-blue-600 text-white">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                          <Button
                            onClick={() => {
                              gainExperience(exp.rewards.experience)
                              addToInventory(exp.rewards)
                            }}
                            className="bg-green-600 hover:bg-green-500 text-white"
                          >
                            🎁 Claim Rewards
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="text-center mt-8">
                <Button
                  onClick={() => {
                    unlockSection("skills")
                    gainExperience(200)
                    addToInventory({ emeralds: 5, redstone: 3 })
                  }}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold"
                  disabled={gameState.unlockedSections.includes("skills")}
                >
                  {gameState.unlockedSections.includes("skills") ? "✅ Unlocked" : "🔓 Unlock Skills"}
                </Button>
              </div>
            </div>
          </section>

          {/* Skills Section */}
          <section className="min-h-screen flex items-center justify-center pointer-events-auto">
            <div className="max-w-4xl mx-auto p-8">
              <h2 className="text-5xl font-bold text-center mb-12 text-orange-400">🛠️ SKILL MASTERY</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {skills.map((skill, index) => (
                  <Card key={index} className="bg-black/80 text-white border-4 border-orange-500">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold">{skill.name}</span>
                        <span className="text-green-400">{skill.level}%</span>
                      </div>
                      <Progress value={skill.level} className="mb-2" />
                      <p className="text-sm text-gray-300">{skill.category}</p>
                      <Button
                        onClick={() => {
                          gainExperience(skill.level)
                          addToInventory({ diamonds: 1 })
                        }}
                        className="mt-2 bg-purple-600 hover:bg-purple-500 text-white"
                      >
                        ⚡ Power Up
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="text-center mt-8">
                <Button
                  onClick={() => {
                    unlockSection("projects")
                    gainExperience(250)
                    addToInventory({ diamonds: 3, emeralds: 3 })
                  }}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold"
                  disabled={gameState.unlockedSections.includes("projects")}
                >
                  {gameState.unlockedSections.includes("projects") ? "✅ Unlocked" : "🔓 Unlock Projects"}
                </Button>
              </div>
            </div>
          </section>

          {/* Projects Section */}
          <section className="min-h-screen flex items-center justify-center pointer-events-auto">
            <div className="max-w-6xl mx-auto p-8">
              <h2 className="text-5xl font-bold text-center mb-12 text-green-400">🏗️ MY BUILDS</h2>
              <div className="grid gap-8">
                {projects.map((project, index) => (
                  <Card key={index} className="bg-black/80 text-white border-4 border-green-500">
                    <CardContent className="p-6">
                      <h3 className="text-2xl font-bold text-yellow-400 mb-2">{project.title}</h3>
                      <p className="mb-4">{project.description}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.technologies.map((tech, i) => (
                          <Badge key={i} className="bg-blue-600 text-white">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        onClick={() => {
                          gainExperience(project.rewards.experience)
                          addToInventory(project.rewards)
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white"
                      >
                        🎁 Claim Project Rewards
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Crafting Section */}
          <section className="min-h-screen flex items-center justify-center pointer-events-auto">
            <div className="max-w-4xl mx-auto p-8">
              <h2 className="text-5xl font-bold text-center mb-12 text-purple-400">🔨 CRAFTING TABLE</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-black/80 text-white border-4 border-purple-500">
                  <CardHeader>
                    <CardTitle className="text-center">⚔️ Weapons</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => craftEquipment("Iron Sword", { iron: 5, wood: 2 })}
                      className="w-full bg-gray-600 hover:bg-gray-500"
                      disabled={gameState.inventory.iron < 5 || gameState.inventory.wood < 2}
                    >
                      🗡️ Iron Sword (5⚪ 2🟫)
                    </Button>
                    <Button
                      onClick={() => craftEquipment("Diamond Sword", { diamonds: 3, iron: 2 })}
                      className="w-full bg-cyan-600 hover:bg-cyan-500"
                      disabled={gameState.inventory.diamonds < 3 || gameState.inventory.iron < 2}
                    >
                      💎 Diamond Sword (3💎 2⚪)
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-black/80 text-white border-4 border-purple-500">
                  <CardHeader>
                    <CardTitle className="text-center">🛡️ Armor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => craftEquipment("Iron Armor", { iron: 8 })}
                      className="w-full bg-gray-600 hover:bg-gray-500"
                      disabled={gameState.inventory.iron < 8}
                    >
                      🛡️ Iron Armor (8⚪)
                    </Button>
                    <Button
                      onClick={() => craftEquipment("Diamond Armor", { diamonds: 5 })}
                      className="w-full bg-cyan-600 hover:bg-cyan-500"
                      disabled={gameState.inventory.diamonds < 5}
                    >
                      💎 Diamond Armor (5💎)
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Battle Section */}
          <section className="min-h-screen flex items-center justify-center pointer-events-auto">
            <div className="max-w-4xl mx-auto p-8 text-center">
              <h2 className="text-6xl font-bold mb-8 text-red-400">🐉 FINAL BOSS BATTLE</h2>
              {!readyForBattle ? (
                <div className="bg-black/80 p-8 rounded-lg border-4 border-red-500">
                  <p className="text-2xl text-white mb-4">You need to be stronger to face the dragon!</p>
                  <div className="space-y-2 text-lg">
                    <p className="text-yellow-400">Requirements:</p>
                    <p className="text-white">✅ Unlock all sections: {gameState.unlockedSections.length}/4</p>
                    <p className="text-white">
                      {gameState.level >= 5 ? "✅" : "❌"} Reach Level 5: {gameState.level}/5
                    </p>
                  </div>
                </div>
              ) : !gameState.isInBattle ? (
                <div className="bg-black/80 p-8 rounded-lg border-4 border-red-500">
                  <p className="text-2xl text-white mb-6">You are ready to face the Ender Dragon!</p>
                  <p className="text-lg text-yellow-400 mb-4">🎮 Use WASD to move, SPACE to attack, SHIFT to dodge!</p>
                  <Button
                    onClick={startBattle}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-xl px-8 py-4"
                  >
                    ⚔️ START BATTLE
                  </Button>
                </div>
              ) : gameState.dragonHealth <= 0 ? (
                <div className="bg-black/80 p-8 rounded-lg border-4 border-green-500">
                  <h3 className="text-4xl text-green-400 mb-4">🏆 VICTORY!</h3>
                  <p className="text-2xl text-white mb-4">You have defeated the Ender Dragon!</p>
                  <p className="text-lg text-yellow-400">Thank you for exploring my portfolio!</p>
                </div>
              ) : gameState.health <= 0 ? (
                <div className="bg-black/80 p-8 rounded-lg border-4 border-red-500">
                  <h3 className="text-4xl text-red-400 mb-4">💀 DEFEAT!</h3>
                  <p className="text-2xl text-white mb-4">The dragon has defeated you!</p>
                  <Button
                    onClick={() =>
                      setGameState((prev) => ({
                        ...prev,
                        health: prev.maxHealth,
                        isInBattle: false,
                        dragonHealth: prev.maxDragonHealth,
                      }))
                    }
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
                  >
                    🔄 Try Again
                  </Button>
                </div>
              ) : (
                <div className="bg-black/80 p-8 rounded-lg border-4 border-red-500">
                  <p className="text-2xl text-white mb-4">⚔️ BATTLE IN PROGRESS!</p>
                  <p className="text-lg text-yellow-400 mb-2">Move close to the dragon and press SPACE to attack!</p>
                  <p className="text-sm text-red-400">Watch out for fireballs and red AOE indicators!</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
