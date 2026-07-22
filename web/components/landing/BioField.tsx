"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * BioField — WebGL animated DNA double-helix + molecular particle field.
 * On-theme for a nutrition/biology product. Reacts to mouse and scroll.
 * Fully cleaned up on unmount; respects prefers-reduced-motion; degrades gracefully.
 */
export default function BioField() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // WebGL unavailable — hero still renders with CSS background
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 22);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // ── DNA double helix ────────────────────────────────────────────────────
    const helix = new THREE.Group();
    group.add(helix);

    const N = 90;                 // rungs
    const radius = 4.2;
    const height = 34;
    const turns = 3.4;

    const blue = new THREE.Color("#2563EB");
    const cyan = new THREE.Color("#00E5D0");
    const violet = new THREE.Color("#a78bfa");
    const ember = new THREE.Color("#FF6B35");

    // Two backbones as instanced spheres
    const nodeGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const strandA = new THREE.InstancedMesh(nodeGeo, new THREE.MeshBasicMaterial({ color: blue }), N);
    const strandB = new THREE.InstancedMesh(nodeGeo, new THREE.MeshBasicMaterial({ color: cyan }), N);
    helix.add(strandA, strandB);

    const dummy = new THREE.Object3D();
    const rungMat = new THREE.LineBasicMaterial({ color: 0x2a6cf0, transparent: true, opacity: 0.28 });
    const rungPositions: THREE.Vector3[][] = [];

    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const angle = t * Math.PI * 2 * turns;
      const y = (t - 0.5) * height;

      const ax = Math.cos(angle) * radius;
      const az = Math.sin(angle) * radius;
      const bx = Math.cos(angle + Math.PI) * radius;
      const bz = Math.sin(angle + Math.PI) * radius;

      dummy.position.set(ax, y, az); dummy.updateMatrix(); strandA.setMatrixAt(i, dummy.matrix);
      dummy.position.set(bx, y, bz); dummy.updateMatrix(); strandB.setMatrixAt(i, dummy.matrix);

      rungPositions.push([new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz)]);
    }
    strandA.instanceMatrix.needsUpdate = true;
    strandB.instanceMatrix.needsUpdate = true;

    // Rungs (base pairs) — every 3rd for cleanliness
    for (let i = 0; i < N; i += 3) {
      const geo = new THREE.BufferGeometry().setFromPoints(rungPositions[i]);
      helix.add(new THREE.Line(geo, rungMat));
    }

    // ── Floating molecular particle field ───────────────────────────────────
    const P = 900;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(P * 3);
    const pCol = new Float32Array(P * 3);
    const palette = [blue, cyan, violet, ember];
    for (let i = 0; i < P; i++) {
      const r = 14 + Math.random() * 26;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pPos[i * 3 + 2] = r * Math.cos(ph);
      const c = palette[(Math.random() * palette.length) | 0];
      pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true })
    );
    group.add(points);

    // ── Interaction state ───────────────────────────────────────────────────
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let scrollY = 0;

    const onMove = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => { scrollY = window.scrollY; };
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      current.x += (target.x - current.x) * 0.05;
      current.y += (target.y - current.y) * 0.05;

      const scrollNorm = Math.min(scrollY / 900, 1);

      if (!reduce) {
        helix.rotation.y = t * 0.25 + current.x * 0.6;
        helix.rotation.x = current.y * 0.35 - scrollNorm * 0.5;
        helix.position.y = scrollNorm * 8;
        points.rotation.y = t * 0.04;
        points.rotation.x = t * 0.02;
      } else {
        helix.rotation.y = current.x * 0.4;
      }

      group.scale.setScalar(1 - scrollNorm * 0.25);
      camera.position.z = 22 + scrollNorm * 6;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      nodeGeo.dispose();
      pGeo.dispose();
      (strandA.material as THREE.Material).dispose();
      (strandB.material as THREE.Material).dispose();
      rungMat.dispose();
      (points.material as THREE.Material).dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden />;
}
