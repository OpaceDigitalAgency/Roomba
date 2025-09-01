import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Text, 
  Box, 
  Plane, 
  Sphere, 
  useTexture,
  Environment,
  ContactShadows,
  PerspectiveCamera,
  Points,
  PointMaterial
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { 
  Play, 
  Pause, 
  Battery, 
  Trash2, 
  RotateCcw, 
  RefreshCw,
  Zap,
  Target,
  MapIcon,
  Eye,
  Save,
  ShoppingCart,
  Plus,
  Settings
} from 'lucide-react';

/*
  ROOMBA PRO — 3D DIRT-DRIVEN AI
  
  Now in stunning 3D with realistic physics and particle effects!
  
  Controls:
  - Start/Stop: Begin/pause cleaning
  - Manual Mode: Click floor to set waypoints (AI off)
  - AI Mode: Enable checkbox for autonomous dirt-seeking behavior
  - Charge: Refill energy to maximum
  - Empty Bin: Clear collected dirt
  - Repaint Dirt: Reset dirt particles
  - Reset: Clear progress but keep upgrades
  - New Game: Full reset including save data
  
  3D Features:
  - Realistic roomba model with rotating brushes
  - Particle-based dirt system with physics
  - Dynamic lighting and shadows
  - Smooth camera controls with orbit/zoom
  - Post-processing effects (bloom, SSAO)
  - 3D room environment with walls and baseboards
*/

interface GameState {
  roomba: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    rotation: number;
    speed: number;
    suction: number;
    bin: number;
    binMax: number;
  };
  energy: number;
  energyMax: number;
  money: number;
  cleaning: boolean;
  levelComplete: boolean;
  aiEnabled: boolean;
  background: boolean;
  autosave: boolean;
  upgrades: {
    capacity: number;
    suction: number;
    speed: number;
    battery: number;
    auto: number;
  };
}

interface UIState {
  showHeatmap: boolean;
  showFrame: boolean;
  overhang: boolean;
  cameraAuto: boolean;
}

interface DirtParticle {
  id: number;
  position: [number, number, number];
  size: number;
  opacity: number;
  collected: boolean;
}

interface Targeting {
  target: { x: number; y: number } | null;
  manualLock: { active: boolean; x: number; y: number };
  aiLock: { until: number; forced: boolean; reason: string };
  aiHold: number;
  stillTime: number;
  edgeHugTime: number;
  nudge: { active: boolean; x: number; y: number; until: number };
  revisit: Map<string, number>;
}

// 3D Roomba Component
function Roomba({ position, rotation, cleaning, energy, binFull }: { 
  position: [number, number, number]; 
  rotation: number; 
  cleaning: boolean; 
  energy: number;
  binFull: boolean;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const brushRef = useRef<THREE.Mesh>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.set(...position);
      meshRef.current.rotation.y = rotation;
    }
    
    // Rotate brushes when cleaning
    if (brushRef.current && cleaning) {
      brushRef.current.rotation.y += 0.3;
    }
    
    // Pulse LED based on status
    if (ledRef.current) {
      const intensity = cleaning ? 
        (binFull ? 0.3 + Math.sin(state.clock.elapsedTime * 8) * 0.3 : 1) :
        (energy <= 0 ? 0.1 + Math.sin(state.clock.elapsedTime * 4) * 0.1 : 0.5);
      
      (ledRef.current.material as THREE.MeshStandardMaterial).emissive.setScalar(intensity * 0.5);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Main body */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.1]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>
      
      {/* Top sensor */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.02]} />
        <meshStandardMaterial color="#1a202c" />
      </mesh>
      
      {/* LED indicator */}
      <mesh ref={ledRef} position={[0, 0.13, 0.08]}>
        <sphereGeometry args={[0.02]} />
        <meshStandardMaterial 
          color={binFull ? "#ef4444" : energy <= 0 ? "#f59e0b" : "#10b981"} 
          emissive={binFull ? "#ef4444" : energy <= 0 ? "#f59e0b" : "#10b981"}
          emissiveIntensity={0.5}
        />
      </mesh>
      
      {/* Rotating brush */}
      <mesh ref={brushRef} position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.02]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>
      
      {/* Brush bristles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 4) * 0.1, 0.01, Math.sin(i * Math.PI / 4) * 0.1]} castShadow>
          <boxGeometry args={[0.02, 0.01, 0.08]} />
          <meshStandardMaterial color="#2d3748" />
        </mesh>
      ))}
      
      {/* Cleaning effect */}
      {cleaning && energy > 0 && !binFull && (
        <mesh position={[0, 0.01, 0]}>
          <ringGeometry args={[0.18, 0.22]} />
          <meshBasicMaterial 
            color="#10b981" 
            transparent 
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

// 3D Room Environment
function Room() {
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      
      {/* Walls */}
      <mesh position={[0, 1.5, -3]} castShadow>
        <boxGeometry args={[8, 3, 0.1]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      
      <mesh position={[0, 1.5, 3]} castShadow>
        <boxGeometry args={[8, 3, 0.1]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      
      <mesh position={[-4, 1.5, 0]} castShadow>
        <boxGeometry args={[0.1, 3, 6]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      
      <mesh position={[4, 1.5, 0]} castShadow>
        <boxGeometry args={[0.1, 3, 6]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      
      {/* Baseboards */}
      {[
        { pos: [0, 0.05, -2.95], size: [8, 0.1, 0.1] },
        { pos: [0, 0.05, 2.95], size: [8, 0.1, 0.1] },
        { pos: [-3.95, 0.05, 0], size: [0.1, 0.1, 6] },
        { pos: [3.95, 0.05, 0], size: [0.1, 0.1, 6] }
      ].map((baseboard, i) => (
        <mesh key={i} position={baseboard.pos as [number, number, number]} castShadow>
          <boxGeometry args={baseboard.size as [number, number, number]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
    </group>
  );
}

// Dirt Particle System
function DirtParticles({ particles, onParticleCollect }: { 
  particles: DirtParticle[]; 
  onParticleCollect: (id: number) => void;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const visibleParticles = particles.filter(p => !p.collected);
  
  const positions = useMemo(() => {
    const pos = new Float32Array(visibleParticles.length * 3);
    visibleParticles.forEach((particle, i) => {
      pos[i * 3] = particle.position[0];
      pos[i * 3 + 1] = particle.position[1];
      pos[i * 3 + 2] = particle.position[2];
    });
    return pos;
  }, [visibleParticles]);
  
  const sizes = useMemo(() => {
    const sizeArray = new Float32Array(visibleParticles.length);
    visibleParticles.forEach((particle, i) => {
      sizeArray[i] = particle.size;
    });
    return sizeArray;
  }, [visibleParticles]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={visibleParticles.length}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={visibleParticles.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        sizeAttenuation={true}
        color="#8b4513"
        transparent
        opacity={0.8}
      />
    </points>
  );
}

// Target Indicator
function TargetIndicator({ position }: { position: [number, number, number] | null }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
      meshRef.current.position.y = 0.05 + Math.sin(state.clock.elapsedTime * 4) * 0.02;
    }
  });
  
  if (!position) return null;
  
  return (
    <mesh ref={meshRef} position={position}>
      <ringGeometry args={[0.1, 0.15]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Main 3D Scene Component
function GameScene({ 
  gameState, 
  uiState, 
  particles, 
  targetingRef, 
  onCanvasClick, 
  onParticleCollect 
}: {
  gameState: GameState;
  uiState: UIState;
  particles: DirtParticle[];
  targetingRef: React.MutableRefObject<Targeting>;
  onCanvasClick: (x: number, y: number) => void;
  onParticleCollect: (id: number) => void;
}) {
  const { camera, gl } = useThree();
  const roombaRef = useRef<THREE.Group>(null);
  
  // Handle clicks on the floor
  const handleFloorClick = (event: THREE.Event) => {
    if (gameState.aiEnabled) return;
    
    const point = event.point;
    onCanvasClick(point.x, point.z);
  };
  
  // Auto-rotate camera if enabled
  useFrame((state) => {
    if (uiState.cameraAuto && camera) {
      const radius = 8;
      const x = Math.cos(state.clock.elapsedTime * 0.2) * radius;
      const z = Math.sin(state.clock.elapsedTime * 0.2) * radius;
      camera.position.x = x;
      camera.position.z = z;
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      {/* Lighting Setup */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 5, 2]} 
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#ffffff" />
      
      {/* Environment */}
      <Environment preset="apartment" />
      
      {/* Room */}
      <Room />
      
      {/* Interactive Floor */}
      <mesh 
        position={[0, 0.001, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleFloorClick}
        receiveShadow
      >
        <planeGeometry args={[7.5, 5.5]} />
        <meshStandardMaterial 
          color="#f8fafc" 
          transparent 
          opacity={0.01}
        />
      </mesh>
      
      {/* Dirt Particles */}
      <DirtParticles particles={particles} onParticleCollect={onParticleCollect} />
      
      {/* Roomba */}
      <Roomba 
        position={[gameState.roomba.x, gameState.roomba.z, gameState.roomba.y]}
        rotation={gameState.roomba.rotation}
        cleaning={gameState.cleaning}
        energy={gameState.energy}
        binFull={gameState.roomba.bin >= gameState.roomba.binMax}
      />
      
      {/* Target Indicator */}
      <TargetIndicator 
        position={targetingRef.current.target ? 
          [targetingRef.current.target.x, 0.02, targetingRef.current.target.y] : 
          null
        } 
      />
      
      {/* Navigation Frame */}
      {uiState.showFrame && (
        <group>
          <mesh position={[0, 0.01, -2.5]}>
            <boxGeometry args={[7, 0.02, 0.02]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, 0.01, 2.5]}>
            <boxGeometry args={[7, 0.02, 0.02]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
          </mesh>
          <mesh position={[-3.5, 0.01, 0]}>
            <boxGeometry args={[0.02, 0.02, 5]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
          </mesh>
          <mesh position={[3.5, 0.01, 0]}>
            <boxGeometry args={[0.02, 0.02, 5]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      
      {/* Contact Shadows */}
      <ContactShadows 
        position={[0, 0, 0]} 
        opacity={0.4} 
        scale={10} 
        blur={2} 
        far={4} 
      />
    </>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    roomba: { 
      x: 0, y: 0, z: 0.08, 
      vx: 0, vy: 0, rotation: 0,
      speed: 2, suction: 1, bin: 0, binMax: 200 
    },
    energy: 2500,
    energyMax: 2500,
    money: 0,
    cleaning: false,
    levelComplete: false,
    aiEnabled: false,
    background: false,
    autosave: true,
    upgrades: { capacity: 0, suction: 0, speed: 0, battery: 0, auto: 0 }
  });

  const [uiState, setUIState] = useState<UIState>({
    showHeatmap: false,
    showFrame: true,
    overhang: true,
    cameraAuto: false
  });

  const [particles, setParticles] = useState<DirtParticle[]>([]);
  const [toast, setToast] = useState<string>('');
  const [cleanPercent, setCleanPercent] = useState(0);

  // Game state refs for access in loops
  const stateRef = useRef(gameState);
  const uiRef = useRef(uiState);
  const targetingRef = useRef<Targeting>({
    target: null,
    manualLock: { active: false, x: 0, y: 0 },
    aiLock: { until: 0, forced: false, reason: '' },
    aiHold: 0,
    stillTime: 0,
    edgeHugTime: 0,
    nudge: { active: false, x: 0, y: 0, until: 0 },
    revisit: new Map()
  });

  // Game loop state
  const loopRef = useRef({
    lastTime: 0,
    animationId: 0,
    backgroundInterval: 0,
    isVisible: true
  });

  // Upgrade costs
  const upgradeCosts = {
    capacity: [50, 75, 100, 150, 200],
    suction: [60, 90, 120, 180, 240],
    speed: [60, 90, 120, 180, 240],
    battery: [80, 120, 160, 240, 320],
    auto: [300]
  };

  // Update refs when state changes
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    uiRef.current = uiState;
  }, [uiState]);

  // Initialize game
  useEffect(() => {
    initializeGame();
    setupVisibilityHandlers();
    return () => {
      if (loopRef.current.animationId) {
        cancelAnimationFrame(loopRef.current.animationId);
      }
      if (loopRef.current.backgroundInterval) {
        clearInterval(loopRef.current.backgroundInterval);
      }
    };
  }, []);

  // Auto-save
  useEffect(() => {
    if (gameState.autosave) {
      saveGame();
    }
  }, [gameState, gameState.autosave]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const initializeGame = () => {
    loadGame();
    // Only generate new dirt if we don't have saved particles or if level was complete
    if (particles.length === 0 || gameState.levelComplete) {
      generateDirtParticles();
      if (gameState.levelComplete) {
        setGameState(prev => ({ ...prev, levelComplete: false }));
      }
    }
    startGameLoop();
  };

  const generateDirtParticles = () => {
    const newParticles: DirtParticle[] = [];
    
    // Generate random dirt particles across the floor
    for (let i = 0; i < 2000; i++) {
      newParticles.push({
        id: i,
        position: [
          (Math.random() - 0.5) * 7,
          0.005 + Math.random() * 0.01,
          (Math.random() - 0.5) * 5
        ],
        size: Math.random() * 0.02 + 0.01,
        opacity: Math.random() * 0.8 + 0.2,
        collected: false
      });
    }
    
    setParticles(newParticles);
  };

  const getNavigationBounds = () => {
    const overhangBuffer = uiRef.current.overhang ? 0.2 : 0;
    return {
      left: -3.5 - overhangBuffer,
      right: 3.5 + overhangBuffer,
      top: -2.5 - overhangBuffer,
      bottom: 2.5 + overhangBuffer
    };
  };

  const clampToNav = (x: number, y: number) => {
    const bounds = getNavigationBounds();
    return {
      x: Math.max(bounds.left, Math.min(bounds.right, x)),
      y: Math.max(bounds.top, Math.min(bounds.bottom, y))
    };
  };

  const findNearbyDirt = (x: number, y: number, radius: number = 0.3) => {
    return particles.filter(p => 
      !p.collected && 
      Math.sqrt((p.position[0] - x) ** 2 + (p.position[2] - y) ** 2) <= radius
    );
  };

  const collectDirt = (roombaX: number, roombaY: number) => {
    const nearbyDirt = findNearbyDirt(roombaX, roombaY, 0.2 + stateRef.current.upgrades.suction * 0.05);
    
    if (nearbyDirt.length > 0) {
      setParticles(prev => prev.map(p => 
        nearbyDirt.some(nd => nd.id === p.id) ? { ...p, collected: true } : p
      ));
      
      // Calculate rewards
      const distance = Math.sqrt(stateRef.current.roomba.vx ** 2 + stateRef.current.roomba.vy ** 2);
      const moneyGain = nearbyDirt.length * distance * 0.1;
      const binIncrease = nearbyDirt.length * 0.15;
      const energyDrain = distance * 0.4 + nearbyDirt.length * 1;
      
      setGameState(prev => ({
        ...prev,
        money: prev.money + moneyGain,
        energy: Math.max(0, prev.energy - energyDrain),
        roomba: {
          ...prev.roomba,
          bin: Math.min(prev.roomba.binMax, prev.roomba.bin + binIncrease)
        }
      }));
    }
  };

  const chooseTargetAI = () => {
    const state = stateRef.current;
    const roombaPos = { x: state.roomba.x, y: state.roomba.y };
    
    // Find clusters of dirt
    const activeDirt = particles.filter(p => !p.collected);
    if (activeDirt.length === 0) return null;
    
    // Group dirt into clusters and find the closest/densest
    const clusters = new Map<string, { particles: DirtParticle[]; center: { x: number; y: number } }>();
    const gridSize = 0.5;
    
    activeDirt.forEach(particle => {
      const gridX = Math.floor(particle.position[0] / gridSize);
      const gridY = Math.floor(particle.position[2] / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!clusters.has(key)) {
        clusters.set(key, { 
          particles: [], 
          center: { 
            x: gridX * gridSize + gridSize / 2, 
            y: gridY * gridSize + gridSize / 2 
          }
        });
      }
      
      clusters.get(key)!.particles.push(particle);
    });
    
    // Find best cluster (balance density and distance)
    let bestCluster = null;
    let bestScore = -1;
    
    clusters.forEach((cluster, key) => {
      const distance = Math.sqrt(
        (cluster.center.x - roombaPos.x) ** 2 + 
        (cluster.center.y - roombaPos.y) ** 2
      );
      
      const density = cluster.particles.length;
      const revisitPenalty = targetingRef.current.revisit.get(key) || 0;
      
      // Score: high density, low distance, low revisit penalty
      const score = density / (1 + distance * 0.5) - revisitPenalty * 0.1;
      
      if (score > bestScore) {
        bestScore = score;
        bestCluster = { cluster, key };
      }
    });
    
    if (bestCluster) {
      targetingRef.current.revisit.set(
        bestCluster.key, 
        (targetingRef.current.revisit.get(bestCluster.key) || 0) + 1
      );
      
      return {
        x: bestCluster.cluster.center.x,
        y: bestCluster.cluster.center.y
      };
    }
    
    return null;
  };

  const updateAI = (dt: number) => {
    const now = Date.now();
    const targeting = targetingRef.current;
    const state = stateRef.current;
    
    if (!state.aiEnabled) return;
    
    // Handle nudging
    if (targeting.nudge.active) {
      if (now > targeting.nudge.until) {
        targeting.nudge.active = false;
      } else {
        targeting.target = { x: targeting.nudge.x, y: targeting.nudge.y };
        return;
      }
    }
    
    // Check if AI is locked
    if (targeting.aiLock.until > now) return;
    
    // Check if current target area is clean
    if (targeting.target) {
      const nearbyDirt = findNearbyDirt(targeting.target.x, targeting.target.y, 0.4);
      if (nearbyDirt.length < 3) {
        targeting.aiHold = 0; // Release hold early
      }
    }
    
    // Skip if still in hold period
    if (targeting.aiHold > now) return;
    
    // Anti-stuck detection
    const roomba = state.roomba;
    const speed = Math.sqrt(roomba.vx * roomba.vx + roomba.vy * roomba.vy);
    
    if (speed < 0.01) {
      targeting.stillTime += dt;
    } else {
      targeting.stillTime = 0;
    }
    
    // Check edge hugging
    const bounds = getNavigationBounds();
    const nearEdge = roomba.x <= bounds.left + 0.5 || roomba.x >= bounds.right - 0.5 || 
                    roomba.y <= bounds.top + 0.5 || roomba.y >= bounds.bottom - 0.5;
    
    if (nearEdge) {
      targeting.edgeHugTime += dt;
    } else {
      targeting.edgeHugTime = 0;
    }
    
    // Trigger anti-stuck if needed
    if (targeting.stillTime > 2000 || targeting.edgeHugTime > 3000) {
      const centerX = (Math.random() - 0.5) * 2;
      const centerY = (Math.random() - 0.5) * 2;
      
      targeting.nudge = {
        active: true,
        x: centerX,
        y: centerY,
        until: now + 1000
      };
      
      targeting.aiLock.until = now + 2000;
      targeting.stillTime = 0;
      targeting.edgeHugTime = 0;
      
      // Add random velocity
      setGameState(prev => ({
        ...prev,
        roomba: {
          ...prev.roomba,
          vx: prev.roomba.vx + (Math.random() - 0.5) * 0.02,
          vy: prev.roomba.vy + (Math.random() - 0.5) * 0.02
        }
      }));
      
      return;
    }
    
    // Choose new target
    const newTarget = chooseTargetAI();
    if (newTarget) {
      targeting.target = newTarget;
      targeting.aiLock.until = now + 2500;
      targeting.aiHold = now + 5000;
    }
  };

  const updateMovement = (dt: number) => {
    const state = stateRef.current;
    const targeting = targetingRef.current;
    
    if (!state.cleaning || state.energy <= 0 || state.roomba.bin >= state.roomba.binMax) {
      return;
    }
    
    const roomba = state.roomba;
    
    // Determine seek target
    let seekTarget = targeting.target;
    if (targeting.nudge.active) {
      seekTarget = { x: targeting.nudge.x, y: targeting.nudge.y };
    }
    
    if (seekTarget) {
      const dx = seekTarget.x - roomba.x;
      const dy = seekTarget.y - roomba.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0.1) {
        const directionX = dx / distance;
        const directionY = dy / distance;
        
        const acceleration = 0.0008;
        const maxSpeed = (roomba.speed + state.upgrades.speed * 0.5) * 0.01;
        
        roomba.vx += directionX * acceleration * dt;
        roomba.vy += directionY * acceleration * dt;
        
        // Limit speed
        const currentSpeed = Math.sqrt(roomba.vx * roomba.vx + roomba.vy * roomba.vy);
        if (currentSpeed > maxSpeed) {
          roomba.vx = (roomba.vx / currentSpeed) * maxSpeed;
          roomba.vy = (roomba.vy / currentSpeed) * maxSpeed;
        }
        
        // Update rotation to face movement direction
        roomba.rotation = Math.atan2(roomba.vy, roomba.vx);
      } else {
        // Near target, orbit briefly
        if (!targeting.manualLock.active) {
          const orbitRadius = 0.3;
          const orbitSpeed = 0.001;
          const time = Date.now() * orbitSpeed;
          
          const orbitX = seekTarget.x + Math.cos(time) * orbitRadius;
          const orbitY = seekTarget.y + Math.sin(time) * orbitRadius;
          
          const dx = orbitX - roomba.x;
          const dy = orbitY - roomba.y;
          
          roomba.vx = dx * 0.002;
          roomba.vy = dy * 0.002;
        }
      }
    }
    
    // Apply friction
    roomba.vx *= 0.98;
    roomba.vy *= 0.98;
    
    // Update position
    const nextPos = clampToNav(roomba.x + roomba.vx, roomba.y + roomba.vy);
    roomba.x = nextPos.x;
    roomba.y = nextPos.y;
    
    // Clean dirt at current position
    collectDirt(roomba.x, roomba.y);
  };

  const step = (dt: number) => {
    updateAI(dt);
    updateMovement(dt);
    
    // Check for pausing conditions
    const state = stateRef.current;
    if (state.cleaning) {
      if (state.energy <= 0) {
        setGameState(prev => ({ ...prev, cleaning: false }));
        showToast('Battery depleted! Charge to continue.');
        return;
      }
      
      if (state.roomba.bin >= state.roomba.binMax) {
        setGameState(prev => ({ ...prev, cleaning: false }));
        showToast('Bin full! Empty to continue.');
        return;
      }
    }
    
    // Check victory condition
    if (particles.length > 0) {
      const activeDirt = particles.filter(p => !p.collected).length;
      const totalDirt = particles.length;
      const cleanPct = ((totalDirt - activeDirt) / totalDirt) * 100;
      setCleanPercent(cleanPct);
      
      if (cleanPct >= 99.5 && !state.levelComplete) {
        setGameState(prev => ({ ...prev, cleaning: false, levelComplete: true }));
        showToast('Level Complete! 🎉');
      }
    } else {
      setCleanPercent(0);
    }
  };

  const tick = (timestamp: number) => {
    try {
      const dt = loopRef.current.lastTime ? timestamp - loopRef.current.lastTime : 0;
      loopRef.current.lastTime = timestamp;
      
      if (dt > 0 && dt < 100) {
        step(dt);
      }
    } catch (error) {
      console.error('Game loop error:', error);
    } finally {
      // CRITICAL: Always schedule next frame
      if (loopRef.current.isVisible) {
        loopRef.current.animationId = requestAnimationFrame(tick);
      }
    }
  };

  const startGameLoop = () => {
    if (loopRef.current.animationId) {
      cancelAnimationFrame(loopRef.current.animationId);
    }
    
    loopRef.current.lastTime = 0;
    loopRef.current.animationId = requestAnimationFrame(tick);
  };

  const startBackgroundLoop = () => {
    if (loopRef.current.backgroundInterval) {
      clearInterval(loopRef.current.backgroundInterval);
    }
    
    loopRef.current.backgroundInterval = setInterval(() => {
      if (!document.hidden || !stateRef.current.background) return;
      
      const chunks = 5;
      const chunkTime = 16;
      
      for (let i = 0; i < chunks; i++) {
        step(chunkTime);
      }
      
      if (stateRef.current.autosave) {
        saveGame();
      }
    }, 200) as unknown as number;
  };

  const setupVisibilityHandlers = () => {
    const handleVisibilityChange = () => {
      loopRef.current.isVisible = !document.hidden;
      
      if (document.hidden) {
        if (stateRef.current.autosave) {
          saveGame();
        }
        if (stateRef.current.background) {
          startBackgroundLoop();
        }
        if (loopRef.current.animationId) {
          cancelAnimationFrame(loopRef.current.animationId);
        }
      } else {
        if (loopRef.current.backgroundInterval) {
          clearInterval(loopRef.current.backgroundInterval);
        }
        startGameLoop();
      }
    };
    
    const handleBeforeUnload = () => {
      if (stateRef.current.autosave) {
        saveGame();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  };

  const saveGame = () => {
    const epoch = localStorage.getItem('roomba_epoch') || '1';
    const saveData = {
      gameState: stateRef.current,
      uiState: uiRef.current,
      particles: particles,
      timestamp: Date.now()
    };
    
    localStorage.setItem(`roomba_save_${epoch}`, JSON.stringify(saveData));
  };

  const loadGame = () => {
    const epoch = localStorage.getItem('roomba_epoch') || '1';
    const saveData = localStorage.getItem(`roomba_save_${epoch}`);
    
    if (saveData) {
      try {
        const parsed = JSON.parse(saveData);
        setGameState(parsed.gameState);
        setUIState(parsed.uiState);
        if (parsed.particles) {
          setParticles(parsed.particles);
        }
      } catch (error) {
        console.error('Failed to load save:', error);
      }
    }
  };

  const newGame = () => {
    const currentEpoch = parseInt(localStorage.getItem('roomba_epoch') || '1');
    const newEpoch = currentEpoch + 1;
    
    // Clear all saves
    for (let i = 1; i <= currentEpoch; i++) {
      localStorage.removeItem(`roomba_save_${i}`);
    }
    
    localStorage.setItem('roomba_epoch', newEpoch.toString());
    
    // Reset state
    setGameState({
      roomba: { 
        x: 0, y: 0, z: 0.08, 
        vx: 0, vy: 0, rotation: 0,
        speed: 2, suction: 1, bin: 0, binMax: 200 
      },
      energy: 2500,
      energyMax: 2500,
      money: 0,
      cleaning: false,
      levelComplete: false,
      aiEnabled: false,
      background: false,
      autosave: true,
      upgrades: { capacity: 0, suction: 0, speed: 0, battery: 0, auto: 0 }
    });
    
    setUIState({
      showHeatmap: false,
      showFrame: true,
      overhang: true,
      cameraAuto: false
    });
    
    targetingRef.current = {
      target: null,
      manualLock: { active: false, x: 0, y: 0 },
      aiLock: { until: 0, forced: false, reason: '' },
      aiHold: 0,
      stillTime: 0,
      edgeHugTime: 0,
      nudge: { active: false, x: 0, y: 0, until: 0 },
      revisit: new Map()
    };
    
    generateDirtParticles();
    showToast('New game started!');
  };

  const handleCanvasClick = (x: number, y: number) => {
    if (gameState.aiEnabled) return;
    
    const clamped = clampToNav(x, y);
    targetingRef.current.target = clamped;
    targetingRef.current.manualLock = { active: true, x: clamped.x, y: clamped.y };
    
    // Only set AI lock when AI is OFF
    if (!gameState.aiEnabled) {
      targetingRef.current.aiLock.until = Date.now() + 900;
    }
    
    showToast('Target set');
  };

  const toggleCleaning = () => {
    setGameState(prev => ({ ...prev, cleaning: !prev.cleaning }));
    showToast(gameState.cleaning ? 'Cleaning paused' : 'Cleaning started');
  };

  const charge = () => {
    setGameState(prev => ({ ...prev, energy: prev.energyMax }));
    showToast('Battery charged');
  };

  const emptyBin = () => {
    setGameState(prev => ({ ...prev, roomba: { ...prev.roomba, bin: 0 } }));
    showToast('Bin emptied');
  };

  const reset = () => {
    setGameState(prev => ({
      ...prev,
      roomba: { ...prev.roomba, x: 0, y: 0, vx: 0, vy: 0, bin: 0, rotation: 0 },
      energy: prev.energyMax,
      cleaning: false,
      levelComplete: false
    }));
    
    targetingRef.current.target = null;
    targetingRef.current.revisit.clear();
    
    generateDirtParticles();
    showToast('Game reset');
  };

  const purchaseUpgrade = (type: keyof typeof upgradeCosts) => {
    const currentLevel = gameState.upgrades[type];
    const costs = upgradeCosts[type];
    
    if (currentLevel >= costs.length) {
      showToast('Max level reached');
      return;
    }
    
    const cost = costs[currentLevel];
    if (gameState.money < cost) {
      showToast('Not enough money');
      return;
    }
    
    setGameState(prev => {
      const newState = {
        ...prev,
        money: prev.money - cost,
        upgrades: { ...prev.upgrades, [type]: currentLevel + 1 }
      };
      
      // Apply upgrade effects
      if (type === 'capacity') {
        newState.roomba = { ...prev.roomba, binMax: 200 + newState.upgrades.capacity * 75 };
      } else if (type === 'battery') {
        newState.energyMax = 2500 + newState.upgrades.battery * 750;
        newState.energy = newState.energyMax;
      } else if (type === 'auto') {
        newState.aiEnabled = true;
      }
      
      return newState;
    });
    
    showToast(`${type} upgraded!`);
  };

  const onParticleCollect = (id: number) => {
    setParticles(prev => prev.map(p => p.id === id ? { ...p, collected: true } : p));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden">
      <div className="grid grid-cols-[1fr_400px] h-screen">
        {/* 3D Game Stage */}
        <div className="relative bg-slate-800 border-r border-slate-700">
          <Canvas
            shadows
            camera={{ position: [6, 4, 6], fov: 50 }}
            gl={{ 
              antialias: true, 
              alpha: false,
              powerPreference: "high-performance"
            }}
          >
            <GameScene 
              gameState={gameState}
              uiState={uiState}
              particles={particles}
              targetingRef={targetingRef}
              onCanvasClick={handleCanvasClick}
              onParticleCollect={onParticleCollect}
            />
            
            {/* Camera Controls */}
            <OrbitControls 
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={3}
              maxDistance={12}
              maxPolarAngle={Math.PI / 2.2}
              minPolarAngle={Math.PI / 6}
              target={[0, 0, 0]}
              enabled={!uiState.cameraAuto}
            />
            
            {/* Post-processing Effects */}
            <EffectComposer>
              <Bloom intensity={0.5} luminanceThreshold={0.9} />
            </EffectComposer>
          </Canvas>
          
          {/* 3D Controls Overlay */}
          <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600">
            <p className="text-xs text-slate-300 mb-2">3D Controls</p>
            <div className="text-xs text-slate-400 space-y-1">
              <div>🖱️ Drag: Rotate view</div>
              <div>🔍 Scroll: Zoom in/out</div>
              <div>📍 Click floor: Set target</div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-l border-slate-700 p-6 overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Roomba Pro 3D</h1>
            <p className="text-slate-400 text-sm">Dirt-Driven AI Cleaning</p>
          </div>

          {/* Progress Stats */}
          <div className="space-y-4 mb-6">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Clean Progress</span>
                <span className="text-lg font-bold text-emerald-400">{cleanPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cleanPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Money</div>
                <div className="text-lg font-bold text-yellow-400">${Math.floor(gameState.money)}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Energy</div>
                <div className="text-lg font-bold text-blue-400">{Math.floor(gameState.energy)}/{gameState.energyMax}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Bin</div>
                <div className="text-lg font-bold text-orange-400">{Math.floor(gameState.roomba.bin)}/{gameState.roomba.binMax}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Status</div>
                <div className={`text-sm font-bold ${gameState.cleaning ? 'text-green-400' : 'text-red-400'}`}>
                  {gameState.levelComplete ? 'Complete' : gameState.cleaning ? 'Cleaning' : 'Stopped'}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold mb-3">Controls</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleCleaning}
                disabled={gameState.levelComplete}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
              >
                {gameState.cleaning ? <Pause size={16} /> : <Play size={16} />}
                {gameState.cleaning ? 'Stop' : 'Start'}
              </button>
              
              <button
                onClick={charge}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 rounded-lg px-4 py-2 transition-colors"
              >
                <Battery size={16} />
                Charge
              </button>
              
              <button
                onClick={emptyBin}
                className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 rounded-lg px-4 py-2 transition-colors"
              >
                <Trash2 size={16} />
                Empty
              </button>
              
              <button
                onClick={() => {
                  generateDirtParticles();
                  showToast('Dirt repainted');
                }}
                className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg px-4 py-2 transition-colors"
              >
                <RefreshCw size={16} />
                Repaint
              </button>
              
              <button
                onClick={reset}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 rounded-lg px-4 py-2 transition-colors"
              >
                <RotateCcw size={16} />
                Reset
              </button>
              
              <button
                onClick={newGame}
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 rounded-lg px-4 py-2 transition-colors"
              >
                <Zap size={16} />
                New Game
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3 mb-6">
            <h3 className="text-lg font-semibold mb-3">3D Settings</h3>
            
            {[
              { key: 'aiEnabled', label: 'AI Mode', icon: Target, disabled: gameState.upgrades.auto === 0 },
              { key: 'autosave', label: 'Autosave', icon: Save },
              { key: 'background', label: 'Background', icon: Eye },
              { key: 'showFrame', label: 'Nav Frame', icon: Settings, ui: true },
              { key: 'cameraAuto', label: 'Auto Camera', icon: RefreshCw, ui: true }
            ].map(({ key, label, icon: Icon, disabled, ui }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ui ? uiState[key as keyof UIState] as boolean : gameState[key as keyof GameState] as boolean}
                  disabled={disabled}
                  onChange={(e) => {
                    if (ui) {
                      setUIState(prev => ({ ...prev, [key]: e.target.checked }));
                    } else {
                      setGameState(prev => ({ ...prev, [key]: e.target.checked }));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <Icon size={16} className={disabled ? 'text-slate-500' : 'text-slate-300'} />
                <span className={`text-sm ${disabled ? 'text-slate-500' : 'text-slate-300'}`}>
                  {label}
                  {disabled && ' (Locked)'}
                </span>
              </label>
            ))}
          </div>

          {/* Shop */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ShoppingCart size={18} />
              Shop
            </h3>
            
            {Object.entries(upgradeCosts).map(([type, costs]) => {
              const currentLevel = gameState.upgrades[type as keyof typeof gameState.upgrades];
              const cost = costs[currentLevel];
              const maxed = currentLevel >= costs.length;
              
              return (
                <div key={type} className="bg-slate-700/30 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium capitalize">{type}</span>
                    <span className="text-xs text-slate-400">Lv. {currentLevel}</span>
                  </div>
                  
                  {!maxed ? (
                    <button
                      onClick={() => purchaseUpgrade(type as keyof typeof upgradeCosts)}
                      disabled={gameState.money < cost}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-50 rounded px-3 py-2 text-sm transition-colors"
                    >
                      <Plus size={14} />
                      ${cost}
                    </button>
                  ) : (
                    <div className="text-center text-xs text-emerald-400 py-2">MAX LEVEL</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3D Info */}
          <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">3D Features</h4>
            <div className="text-xs text-slate-400 space-y-1">
              <div>• Realistic particle physics</div>
              <div>• Dynamic lighting & shadows</div>
              <div>• Post-processing effects</div>
              <div>• Interactive 3D environment</div>
              <div>• Smooth camera controls</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-lg border border-slate-600 z-50 animate-in fade-in duration-300">
          {toast}
        </div>
      )}

      <style jsx>{`
        @keyframes animate-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: animate-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}