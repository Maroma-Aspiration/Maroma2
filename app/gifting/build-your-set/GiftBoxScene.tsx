"use client";

import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { GiftBox, GiftElement, PackedGift } from "../../../lib/gift-builder-types";
import type { Gift3dPublicAsset } from "../../../lib/gift-3d-assets-store";
import { resolveGiftShapeFamily, type GiftShapeFamily } from "../../../lib/gift-shape-family";

export type GiftBoxSceneProps = {
  box: GiftBox;
  elements: GiftElement[];
  packed: PackedGift[];
  activeElementId?: string | null;
  onSelectElement?: (elementId: string) => void;
  cameraPreset?: "angled" | "top" | "reset";
  reducedMotion?: boolean;
  /** Approved reconstructed meshes keyed by commerce productId. */
  assetsByProductId?: Record<string, Gift3dPublicAsset>;
};

const CM = 0.04;
const BOX_COLOR = "#b7a78d";
const BOX_LINING = "#ebe8dc";
const WALL_THICKNESS = 0.35 * CM;

function toScenePos(packed: PackedGift, box: GiftBox) {
  const x = (packed.x + packed.lengthCm / 2 - box.lengthCm / 2) * CM;
  const z = (packed.y + packed.widthCm / 2 - box.widthCm / 2) * CM;
  const y = (packed.heightCm / 2) * CM;
  const rotationY = packed.rotated ? Math.PI / 2 : 0;
  return { x, y, z, rotationY };
}

function sameOriginModelUrl(url: string): string {
  if (!url) return url;
  if (typeof window === "undefined") return url;
  if (url.startsWith("/") || url.startsWith(window.location.origin)) return url;
  return `/api/gift-3d-model?src=${encodeURIComponent(url)}`;
}

function catalogTextureUrl(src?: string | null): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  if (typeof window !== "undefined" && src.startsWith(window.location.origin)) return src;
  return `/api/gift-3d-texture?src=${encodeURIComponent(src)}`;
}

function useCatalogTexture(src?: string | null) {
  const { invalidate, gl } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const url = catalogTextureUrl(src);
    if (!url) {
      setTexture(null);
      return;
    }

    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    const image = new Image();
    const sameOrigin = url.startsWith("/") || (typeof window !== "undefined" && url.startsWith(window.location.origin));
    if (!sameOrigin) image.crossOrigin = "anonymous";

    image.onload = () => {
      if (cancelled) return;
      const tex = new THREE.Texture(image);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      loaded = tex;
      setTexture(tex);
      invalidate();
    };
    image.onerror = () => {
      if (!cancelled) {
        setTexture(null);
        invalidate();
      }
    };
    image.src = url;

    return () => {
      cancelled = true;
      loaded?.dispose();
      setTexture(null);
    };
  }, [gl, invalidate, src]);

  useEffect(() => {
    if (texture) invalidate();
  }, [invalidate, texture]);

  return texture;
}

class GlbBoundary extends Component<{ resetKey: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ProductGlb({
  url,
  length,
  width,
  height,
}: {
  url: string;
  length: number;
  width: number;
  height: number;
}) {
  const { scene } = useGLTF(url);
  const { invalidate } = useThree();
  const clone = useMemo(() => {
    const next = scene.clone(true);
    next.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => material.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });
    return next;
  }, [scene]);

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = Math.min(
      length / Math.max(size.x, 1e-4),
      height / Math.max(size.y, 1e-4),
      width / Math.max(size.z, 1e-4)
    );
    return { scale, offset: center.multiplyScalar(-1) };
  }, [clone, height, length, width]);

  useEffect(() => {
    invalidate();
  }, [fit, invalidate]);

  return (
    <group scale={fit.scale}>
      <primitive object={clone} position={[fit.offset.x, fit.offset.y, fit.offset.z]} />
    </group>
  );
}

function ProductPhotos({
  length,
  height,
  depth,
  texture,
  includeTop,
}: {
  length: number;
  height: number;
  depth: number;
  texture: THREE.Texture;
  includeTop: boolean;
}) {
  const lift = 0.003;
  return (
    <group>
      <mesh position={[0, 0, depth / 2 + lift]} castShadow>
        <planeGeometry args={[length * 0.94, height * 0.94]} />
        <meshStandardMaterial map={texture} roughness={0.45} metalness={0} toneMapped={false} />
      </mesh>
      <mesh position={[length / 2 + lift, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <planeGeometry args={[depth * 0.94, height * 0.94]} />
        <meshStandardMaterial map={texture} roughness={0.45} metalness={0} toneMapped={false} />
      </mesh>
      {includeTop ? (
        <mesh position={[0, height / 2 + lift, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <planeGeometry args={[length * 0.94, depth * 0.94]} />
          <meshStandardMaterial map={texture} roughness={0.45} metalness={0} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function CylinderLabel({
  radius,
  height,
  texture,
  thetaLength = Math.PI * 1.2,
  y = 0,
}: {
  radius: number;
  height: number;
  texture: THREE.Texture;
  thetaLength?: number;
  y?: number;
}) {
  const thetaStart = -thetaLength / 2;
  return (
    <mesh rotation={[0, Math.PI * 0.32, 0]} position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[radius, radius, height, 48, 1, true, thetaStart, thetaLength]} />
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.42}
        metalness={0}
        side={THREE.FrontSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

function TexturedShape({
  family,
  length,
  width,
  height,
  color,
  imageSrc,
}: {
  family: GiftShapeFamily;
  length: number;
  width: number;
  height: number;
  color: string;
  imageSrc?: string | null;
}) {
  const texture = useCatalogTexture(imageSrc);
  const radius = Math.min(length, width) / 2;
  const depthScale = family === "pouch" ? 0.55 : 1;
  const boxHeight = height * (family === "pouch" ? 0.7 : 1);
  const boxDepth = width * depthScale;

  if (family === "bottle" || family === "tube") {
    const r = family === "tube" ? radius * 0.55 : radius * 0.85;
    const labelH = height * (family === "tube" ? 0.62 : 0.5);
    return (
      <group>
        <mesh castShadow>
          <cylinderGeometry args={[r * 0.92, r, height, 24]} />
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
        </mesh>
        {texture ? (
          <CylinderLabel
            radius={r * 1.02}
            height={labelH}
            texture={texture}
            thetaLength={family === "tube" ? Math.PI * 1.35 : Math.PI * 1.18}
            y={family === "bottle" ? -height * 0.04 : 0}
          />
        ) : null}
        <mesh position={[0, height * 0.42, 0]} castShadow>
          <cylinderGeometry args={[r * 0.35, r * 0.42, height * 0.18, 16]} />
          <meshStandardMaterial color="#d9d2c5" roughness={0.4} />
        </mesh>
      </group>
    );
  }

  if (family === "jar" || family === "candle") {
    const r = radius * 0.95;
    return (
      <group>
        <mesh castShadow>
          <cylinderGeometry args={[r, r, height, 28]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.08} />
        </mesh>
        {texture ? (
          <CylinderLabel
            radius={r * 1.015}
            height={height * (family === "jar" ? 0.52 : 0.58)}
            texture={texture}
            thetaLength={Math.PI * 1.28}
          />
        ) : null}
        {family === "jar" ? (
          <mesh position={[0, height * 0.48, 0]} castShadow>
            <cylinderGeometry args={[r * 0.78, r * 0.78, height * 0.12, 24]} />
            <meshStandardMaterial color="#cfc7b8" roughness={0.35} metalness={0.15} />
          </mesh>
        ) : null}
      </group>
    );
  }

  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[length, boxHeight, boxDepth]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {texture ? (
        <ProductPhotos
          length={length}
          height={boxHeight}
          depth={boxDepth}
          texture={texture}
          includeTop={family === "bar" || family === "pouch"}
        />
      ) : null}
    </group>
  );
}

function ProductMesh({
  element,
  packed,
  box,
  active,
  onSelect,
  asset,
}: {
  element: GiftElement;
  packed: PackedGift;
  box: GiftBox;
  active: boolean;
  onSelect?: (elementId: string) => void;
  asset?: Gift3dPublicAsset;
}) {
  const family = resolveGiftShapeFamily(element, asset?.shapeFamily);
  const { x, y, z, rotationY } = toScenePos(packed, box);
  const l = packed.lengthCm * CM;
  const w = packed.widthCm * CM;
  const h = packed.heightCm * CM;
  const bodyColor = family === "candle" ? "#f2ebe0" : family === "bar" ? "#e8f0e6" : "#f7f5f0";
  const glbUrl = asset?.glbUrl ? sameOriginModelUrl(asset.glbUrl) : "";
  const placeholder = (
    <TexturedShape
      family={family}
      length={l}
      width={w}
      height={h}
      color={bodyColor}
      imageSrc={element.image}
    />
  );

  return (
    <group
      position={[x, y, z]}
      rotation={[0, rotationY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(element.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {glbUrl ? (
        <GlbBoundary resetKey={glbUrl} fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <ProductGlb url={glbUrl} length={l} width={w} height={h} />
          </Suspense>
        </GlbBoundary>
      ) : (
        placeholder
      )}
      {active ? (
        <mesh position={[0, -h / 2 + 0.01 * CM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(l, w) * 0.55, Math.max(l, w) * 0.72, 32]} />
          <meshBasicMaterial color="#2f6f7a" transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

function OpenGiftBox({ box }: { box: GiftBox }) {
  const length = box.lengthCm * CM;
  const width = box.widthCm * CM;
  const height = box.heightCm * CM;
  const t = WALL_THICKNESS;
  const outerL = length + t * 2;
  const outerW = width + t * 2;

  return (
    <group>
      <mesh position={[0, -t / 2, 0]} receiveShadow>
        <boxGeometry args={[outerL, t, outerW]} />
        <meshStandardMaterial color={BOX_LINING} roughness={0.85} />
      </mesh>
      <mesh position={[0, height / 2, -(width / 2 + t / 2)]} castShadow receiveShadow>
        <boxGeometry args={[outerL, height, t]} />
        <meshStandardMaterial color={BOX_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, height / 2, width / 2 + t / 2]} castShadow receiveShadow>
        <boxGeometry args={[outerL, height, t]} />
        <meshStandardMaterial color={BOX_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[-(length / 2 + t / 2), height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, height, width]} />
        <meshStandardMaterial color={BOX_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[length / 2 + t / 2, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, height, width]} />
        <meshStandardMaterial color={BOX_COLOR} roughness={0.8} />
      </mesh>
      <mesh
        position={[0, height * 0.15, -(width / 2 + t * 2 + width * 0.35)]}
        rotation={[-Math.PI / 2.6, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[outerL, t, width * 0.95]} />
        <meshStandardMaterial color={BOX_COLOR} roughness={0.82} />
      </mesh>
    </group>
  );
}

function CameraRig({
  box,
  preset,
  reducedMotion,
}: {
  box: GiftBox;
  preset: "angled" | "top" | "reset";
  reducedMotion?: boolean;
}) {
  const { camera, invalidate } = useThree();
  const controls = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const span = Math.max(box.lengthCm, box.widthCm) * CM;

  useEffect(() => {
    const look = new THREE.Vector3(0, box.heightCm * CM * 0.25, 0);
    if (preset === "top") {
      camera.position.set(0, span * 2.1, 0.02);
    } else {
      camera.position.set(span * 1.15, span * 0.95, span * 1.25);
    }
    camera.lookAt(look);
    if (controls.current) {
      controls.current.target.copy(look);
      controls.current.update();
    }
    invalidate();
  }, [box.heightCm, box.lengthCm, box.widthCm, camera, invalidate, preset, span]);

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      enableZoom={!reducedMotion}
      enableRotate={!reducedMotion}
      minDistance={span * 1.1}
      maxDistance={span * 3.2}
      maxPolarAngle={Math.PI / 2.05}
      target={[0, box.heightCm * CM * 0.25, 0]}
      onChange={() => invalidate()}
    />
  );
}

function SceneContent(props: GiftBoxSceneProps) {
  const {
    box,
    elements,
    packed,
    activeElementId,
    onSelectElement,
    cameraPreset = "angled",
    reducedMotion,
    assetsByProductId,
  } = props;
  const elementMap = useMemo(() => {
    const map = new Map<string, GiftElement>();
    elements.forEach((el) => map.set(el.id, el));
    return map;
  }, [elements]);
  const { invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [packed, activeElementId, cameraPreset, assetsByProductId, invalidate]);

  return (
    <>
      <color attach="background" args={["#eef2ec"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 8, 3]} intensity={1.05} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={["#f5f7f2", "#c5cbbd", 0.45]} />
      <OpenGiftBox box={box} />
      {packed.map((item) => {
        const element = elementMap.get(item.elementId);
        if (!element) return null;
        return (
          <ProductMesh
            key={item.elementId}
            element={element}
            packed={item}
            box={box}
            active={activeElementId === item.elementId}
            onSelect={onSelectElement}
            asset={assetsByProductId?.[element.productId]}
          />
        );
      })}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={Math.max(box.lengthCm, box.widthCm) * CM * 3} blur={2.2} />
      <CameraRig box={box} preset={cameraPreset} reducedMotion={reducedMotion} />
    </>
  );
}

export default function GiftBoxScene(props: GiftBoxSceneProps) {
  const span = Math.max(props.box.lengthCm, props.box.widthCm) * CM;

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      shadows
      camera={{ position: [span * 1.15, span * 0.95, span * 1.25], fov: 42, near: 0.05, far: 80 }}
      gl={{ antialias: true, powerPreference: "default", alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#eef2ec");
      }}
      aria-hidden
    >
      <Suspense fallback={null}>
        <SceneContent {...props} />
      </Suspense>
    </Canvas>
  );
}
