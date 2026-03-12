"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

import styles from "./WhelmRitualScene.module.css";

type RitualSceneProps = {
  variant?: "orb" | "totem";
  className?: string;
};

function OrbScene() {
  const groupRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const orbitRef = useRef<Mesh>(null);
  const shellRef = useRef<Mesh>(null);
  const wGroupRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.08;
      groupRef.current.position.y = Math.sin(t * 0.75) * 0.05;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.35) * 0.04;
      ringRef.current.rotation.y = t * 0.16;
    }
    if (orbitRef.current) {
      orbitRef.current.position.x = Math.cos(t * 0.75) * 1.04;
      orbitRef.current.position.y = Math.sin(t * 0.75) * 0.18;
      orbitRef.current.position.z = Math.sin(t * 0.75) * 0.24;
    }
    if (shellRef.current) {
      shellRef.current.scale.setScalar(1 + Math.sin(t * 0.72) * 0.015);
    }
    if (wGroupRef.current) {
      const scale = 1 + Math.sin(t * 1.1) * 0.02;
      wGroupRef.current.scale.setScalar(scale);
      wGroupRef.current.rotation.z = Math.sin(t * 0.52) * 0.018;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.9, 0]} receiveShadow>
        <circleGeometry args={[2.35, 48]} />
        <meshBasicMaterial color="#f3ecff" transparent opacity={0.22} />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.08, 0]}>
        <torusGeometry args={[1.14, 0.018, 20, 100]} />
        <meshStandardMaterial color="#dbeafe" emissive="#a78bfa" emissiveIntensity={0.68} />
      </mesh>

      <mesh ref={shellRef} position={[0, 0.04, -0.02]}>
        <sphereGeometry args={[0.96, 56, 56]} />
        <meshStandardMaterial
          color="#f8fbff"
          emissive="#dbeafe"
          emissiveIntensity={0.22}
          metalness={0.04}
          roughness={0.16}
          transparent
          opacity={0.32}
        />
      </mesh>

      <group ref={wGroupRef} position={[0, 0.03, 0.22]}>
        <mesh position={[-0.38, 0.06, 0]}>
          <boxGeometry args={[0.16, 0.82, 0.14]} />
          <meshStandardMaterial color="#92b0ff" emissive="#5b5cf6" emissiveIntensity={0.96} />
        </mesh>
        <mesh position={[0.38, 0.06, 0]}>
          <boxGeometry args={[0.16, 0.82, 0.14]} />
          <meshStandardMaterial color="#92b0ff" emissive="#5b5cf6" emissiveIntensity={0.96} />
        </mesh>
        <mesh rotation={[0, 0, -0.34]} position={[-0.19, -0.04, 0]}>
          <boxGeometry args={[0.16, 0.96, 0.14]} />
          <meshStandardMaterial color="#7aa8ff" emissive="#6d28d9" emissiveIntensity={1.08} />
        </mesh>
        <mesh rotation={[0, 0, 0.34]} position={[0.19, -0.04, 0]}>
          <boxGeometry args={[0.16, 0.96, 0.14]} />
          <meshStandardMaterial color="#7aa8ff" emissive="#6d28d9" emissiveIntensity={1.08} />
        </mesh>
        <mesh position={[0, -0.34, -0.02]}>
          <boxGeometry args={[0.82, 0.12, 0.1]} />
          <meshStandardMaterial color="#c5d9ff" emissive="#4f7dff" emissiveIntensity={0.34} />
        </mesh>
      </group>

      <mesh ref={orbitRef} position={[1.04, 0, 0]}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshBasicMaterial color="#eef6ff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function TotemScene() {
  const groupRef = useRef<Group>(null);
  const frontRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.32) * 0.28;
      groupRef.current.position.y = Math.sin(t * 0.95) * 0.07;
    }
    if (frontRef.current) {
      frontRef.current.rotation.z = Math.sin(t * 0.85) * 0.05;
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = t * 0.22;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.88, 0]} receiveShadow>
        <circleGeometry args={[1.85, 48]} />
        <meshBasicMaterial color="#efeaff" transparent opacity={0.24} />
      </mesh>

      <mesh position={[0, -0.12, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.68, 0.16, 40]} />
        <meshStandardMaterial color="#fbf9ff" emissive="#d8c6ff" emissiveIntensity={0.14} />
      </mesh>

      <mesh ref={haloRef} position={[0, 0.16, 0]}>
        <torusGeometry args={[0.98, 0.03, 20, 100]} />
        <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={0.7} />
      </mesh>

      <group ref={frontRef} position={[0, 0.15, 0.02]}>
        <mesh position={[-0.22, 0, 0]}>
          <boxGeometry args={[0.22, 0.74, 0.12]} />
          <meshStandardMaterial color="#f6f3ff" emissive="#8b5cf6" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.22, 0, 0]}>
          <boxGeometry args={[0.22, 0.74, 0.12]} />
          <meshStandardMaterial color="#f6f3ff" emissive="#8b5cf6" emissiveIntensity={0.4} />
        </mesh>
        <mesh rotation={[0, 0, -0.5]} position={[-0.04, -0.05, 0]}>
          <boxGeometry args={[0.22, 0.72, 0.12]} />
          <meshStandardMaterial color="#a78bfa" emissive="#6d28d9" emissiveIntensity={0.95} />
        </mesh>
        <mesh rotation={[0, 0, 0.5]} position={[0.04, -0.05, 0]}>
          <boxGeometry args={[0.22, 0.72, 0.12]} />
          <meshStandardMaterial color="#a78bfa" emissive="#6d28d9" emissiveIntensity={0.95} />
        </mesh>
      </group>
    </group>
  );
}

export default function WhelmRitualScene({
  variant = "orb",
  className,
}: RitualSceneProps) {
  return (
    <div className={[styles.scene, className].filter(Boolean).join(" ")}>
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 34 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.45} />
        <directionalLight position={[2.2, 3.6, 2.8]} intensity={2.9} color="#ffffff" />
        <pointLight position={[-2, 1.4, 2]} intensity={10} color="#8b5cf6" />
        <pointLight position={[1.7, -0.4, 2]} intensity={8} color="#c4b5fd" />
        <pointLight position={[0, 0.4, 2.6]} intensity={5.4} color="#dbeafe" />
        {variant === "totem" ? <TotemScene /> : <OrbScene />}
      </Canvas>
      <div className={styles.overlayGlow} aria-hidden="true" />
    </div>
  );
}
