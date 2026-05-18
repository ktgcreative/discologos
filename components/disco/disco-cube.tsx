"use client";

import { createElement, useEffect, useRef, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export type DiscoShape = "torusKnot" | "icosahedron" | "torus" | "roundedSquare";

export type DiscoSpinAxis = "x" | "y" | "z" | "xz";

// react-icons exports each icon as a React component. We only need to render it
// to a static SVG string and parse out the path data, so anything that renders
// an <svg> works.
export type DiscoIcon = ComponentType<{ size?: number | string }>;

/** A multicolor SVG fetched from a URL (e.g. a brand logo with multiple fills). */
export interface DiscoSvgIcon {
  svgUrl: string;
  /** Used when paths have no inline fill (e.g. Illustrator CSS classes). */
  fill?: string;
}

export type DiscoFaceIcon = DiscoIcon | DiscoSvgIcon | null | undefined;

function isSvgUrlIcon(icon: DiscoFaceIcon): icon is DiscoSvgIcon {
  return typeof icon === "object" && icon !== null && "svgUrl" in icon;
}

export interface DiscoSceneProps {
  shape: DiscoShape;
  mirrorSize: number;
  tint?: string;
  /** Optional gradient stops (hex). When provided, each mirror tile is colored
   *  by sampling this gradient along {@link gradientDirection}, overriding `tint`. */
  tintGradient?: string[];
  /** Direction the gradient sweeps across the shape, in object space. Default diagonal. */
  gradientDirection?: [number, number, number];
  matcapUrl?: string;
  innerColor?: number;
  spinAxis?: DiscoSpinAxis;
  spinSpeed?: number;
  autoRotateSpeed?: number;
  closeness?: number;
  className?: string;
  /** Optional icons to emboss on each face of the rounded cube (order: +X, -X, +Y, -Y, +Z, -Z). Each entry can be a react-icon component (single-color, tinted) or `{ svgUrl }` for a multicolor SVG. Pass `null` to leave a face blank. */
  faceIcons?: DiscoFaceIcon[];
  /** Tint multiplier for the icon matcap. Default brightens the base tint. */
  iconTint?: string;
  /** Fraction of the face width the icon should occupy. 0.5 = half the face. */
  iconScale?: number;
  /** How far the icon sits above the cube face. */
  iconRaise?: number;
  /** Extrusion depth of the icon geometry. */
  iconDepth?: number;
}

const DEFAULT_MATCAP = "https://assets.codepen.io/959327/matcap-crystal.png";

interface FaceTilesOptions {
  size: number;
  cornerInset: number;
  tileSize: number;
  material: THREE.Material;
  /** Optional per-tile color sampler (object-space position → THREE.Color). */
  colorAt?: (pos: THREE.Vector3, out: THREE.Color) => void;
}

function buildFaceTiles({ size, cornerInset, tileSize, material, colorAt }: FaceTilesOptions) {
  const half = size / 2;
  const fieldHalf = half - cornerInset;
  const field = fieldHalf * 2;
  // Keep the cube just a touch denser than the base mirror mesh so the flat
  // planes do not show obvious gaps.
  const faceTileSize = tileSize * 0.55;
  const tilesPerSide = Math.max(6, Math.floor(field / (faceTileSize * 0.98)));
  const step = field / tilesPerSide;
  const start = -fieldHalf + step / 2;
  const raise = 0.003;
  const perFace = tilesPerSide * tilesPerSide;
  const total = perFace * 6;

  const tileGeom = new THREE.PlaneGeometry(faceTileSize, faceTileSize);
  const mesh = new THREE.InstancedMesh(tileGeom, material, total);
  const dummy = new THREE.Object3D();
  const tiltAxis = new THREE.Vector3();

  const faces = [
    { normal: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
    { normal: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
    { normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
  ];

  let idx = 0;
  const right = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const color = new THREE.Color();
  const tiltAmount = 0.18;
  for (const face of faces) {
    right.crossVectors(face.up, face.normal).normalize();
    const base = face.normal.clone().multiplyScalar(half + raise);
    for (let i = 0; i < tilesPerSide; i++) {
      for (let j = 0; j < tilesPerSide; j++) {
        const u = start + i * step;
        const v = start + j * step;
        pos.copy(base)
          .addScaledVector(right, u)
          .addScaledVector(face.up, v);

        dummy.position.copy(pos);
        dummy.lookAt(pos.clone().add(face.normal));
        dummy.rotateZ(Math.random() * Math.PI * 2);
        tiltAxis.set(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
        dummy.rotateOnAxis(tiltAxis, (Math.random() - 0.5) * tiltAmount);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        if (colorAt) {
          colorAt(pos, color);
          mesh.setColorAt(idx, color);
        }
        idx++;
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (colorAt && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function buildEdgeTiles({ size, cornerInset, tileSize, material, colorAt }: FaceTilesOptions) {
  const half = size / 2;
  const innerHalf = half - cornerInset;
  const r = cornerInset;
  const raise = 0.003;
  const faceTileSize = tileSize * 0.55;
  const arcLen = (Math.PI / 2) * r;
  const lengthSegs = Math.max(6, Math.floor((innerHalf * 2) / (faceTileSize * 0.98)));
  const angleSegs = Math.max(4, Math.floor(arcLen / (faceTileSize * 0.98)));
  const totalPerEdge = lengthSegs * angleSegs;
  const total = totalPerEdge * 12;

  const tileGeom = new THREE.PlaneGeometry(faceTileSize, faceTileSize);
  const mesh = new THREE.InstancedMesh(tileGeom, material, total);

  const axes = [
    { axis: new THREE.Vector3(1, 0, 0), p1: new THREE.Vector3(0, 1, 0), p2: new THREE.Vector3(0, 0, 1) },
    { axis: new THREE.Vector3(0, 1, 0), p1: new THREE.Vector3(1, 0, 0), p2: new THREE.Vector3(0, 0, 1) },
    { axis: new THREE.Vector3(0, 0, 1), p1: new THREE.Vector3(1, 0, 0), p2: new THREE.Vector3(0, 1, 0) },
  ];

  const dummy = new THREE.Object3D();
  const pos = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const center = new THREE.Vector3();
  const tiltAxis = new THREE.Vector3();
  const color = new THREE.Color();
  const tiltAmount = 0.18;
  let idx = 0;

  for (const a of axes) {
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        center.copy(a.p1).multiplyScalar(s1 * innerHalf)
          .addScaledVector(a.p2, s2 * innerHalf);

        for (let li = 0; li < lengthSegs; li++) {
          const along = -innerHalf + ((li + 0.5) / lengthSegs) * (innerHalf * 2);
          for (let ai = 0; ai < angleSegs; ai++) {
            const angle = ((ai + 0.5) / angleSegs) * (Math.PI / 2);
            normal.copy(a.p1).multiplyScalar(s1 * Math.cos(angle))
              .addScaledVector(a.p2, s2 * Math.sin(angle));
            pos.copy(center)
              .addScaledVector(a.axis, along)
              .addScaledVector(normal, r + raise);

            dummy.position.copy(pos);
            dummy.lookAt(pos.clone().add(normal));
            dummy.rotateZ(Math.random() * Math.PI * 2);
            tiltAxis.set(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
            dummy.rotateOnAxis(tiltAxis, (Math.random() - 0.5) * tiltAmount);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            if (colorAt) {
              colorAt(pos, color);
              mesh.setColorAt(idx, color);
            }
            idx++;
          }
        }
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (colorAt && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function buildCornerTiles({ size, cornerInset, tileSize, material, colorAt }: FaceTilesOptions) {
  const half = size / 2;
  const innerHalf = half - cornerInset;
  const r = cornerInset;
  const raise = 0.003;
  const faceTileSize = tileSize * 0.55;
  const arcLen = (Math.PI / 2) * r;
  const segs = Math.max(4, Math.floor(arcLen / (faceTileSize * 0.98)));
  const total = segs * segs * 8;

  const tileGeom = new THREE.PlaneGeometry(faceTileSize, faceTileSize);
  const mesh = new THREE.InstancedMesh(tileGeom, material, total);

  const dummy = new THREE.Object3D();
  const center = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tiltAxis = new THREE.Vector3();
  const color = new THREE.Color();
  const tiltAmount = 0.18;
  let idx = 0;

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        center.set(sx * innerHalf, sy * innerHalf, sz * innerHalf);
        for (let i = 0; i < segs; i++) {
          const theta = ((i + 0.5) / segs) * (Math.PI / 2); // polar from corner axis
          for (let j = 0; j < segs; j++) {
            const phi = ((j + 0.5) / segs) * (Math.PI / 2); // azimuth in face plane
            const sinT = Math.sin(theta);
            normal.set(
              sx * sinT * Math.cos(phi),
              sy * sinT * Math.sin(phi),
              sz * Math.cos(theta)
            );
            pos.copy(center).addScaledVector(normal, r + raise);

            dummy.position.copy(pos);
            dummy.lookAt(pos.clone().add(normal));
            dummy.rotateZ(Math.random() * Math.PI * 2);
            tiltAxis.set(Math.random() - 0.5, Math.random() - 0.5, 0).normalize();
            dummy.rotateOnAxis(tiltAxis, (Math.random() - 0.5) * tiltAmount);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            if (colorAt) {
              colorAt(pos, color);
              mesh.setColorAt(idx, color);
            }
            idx++;
          }
        }
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (colorAt && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function buildBaseGeometry(shape: DiscoShape): THREE.BufferGeometry {
  switch (shape) {
    case "torusKnot":
      return new THREE.TorusKnotGeometry(0.3, 0.2, 64, 12);
    case "icosahedron":
      return new THREE.IcosahedronGeometry(0.5, 3);
    case "torus":
      return new THREE.TorusGeometry(0.4, 0.2, 10, 20).rotateX(-0.4);
    case "roundedSquare":
      return new RoundedBoxGeometry(0.8, 0.8, 0.8, 6, 0.18);
  }
}

interface IconGeometryGroup {
  geometry: THREE.BufferGeometry;
  /** Per-path fill color from the SVG, or null if the path has no explicit fill (use tint). */
  color: THREE.Color | null;
}

interface IconGeometryResult {
  groups: IconGeometryGroup[];
  /** Half-width of the icon's combined bounds (after centering) for scaling to the face. */
  halfExtent: number;
}

/**
 * Build extruded geometry from raw SVG markup. Paths are grouped by fill color
 * so multicolor logos (Slack, Google, etc.) produce one mesh per color, while
 * single-color icons collapse into one mesh that picks up the tint.
 */
function iconToGeometry(svgMarkup: string, depth: number): IconGeometryResult | null {
  const loader = new SVGLoader();
  const data = loader.parse(svgMarkup);
  if (data.paths.length === 0) return null;
  const subPathCount = data.paths.reduce((count, path) => count + path.subPaths.length, 0);
  const isComplexLogo = data.paths.length > 8 || subPathCount > 24;
  const curveSegments = isComplexLogo ? 4 : 12;

  // Bucket paths by their fill color (or "__default" if none). Within each
  // bucket, merge every subpath and use evenodd so inner negative-space
  // subpaths (Notion's slash, X's inner triangles, Slack blob cutouts) become
  // real holes through the geometry rather than getting filled.
  type Bucket = { color: THREE.Color | null; subPaths: typeof data.paths[number]["subPaths"] };
  const buckets = new Map<string, Bucket>();
  for (const path of data.paths) {
    const fill = (path.userData?.style as { fill?: string } | undefined)?.fill;
    const hasColor = fill && fill !== "none" && fill !== "currentColor";
    const key = hasColor ? fill! : "__default";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        color: hasColor ? new THREE.Color(fill!) : null,
        subPaths: [],
      };
      buckets.set(key, bucket);
    }
    for (const sub of path.subPaths) bucket.subPaths.push(sub);
  }

  // Build a geometry per bucket. We collect a single union bounding box so the
  // caller can center & scale the whole icon as a unit.
  const groups: IconGeometryGroup[] = [];
  const union = new THREE.Box3();
  for (const bucket of buckets.values()) {
    if (bucket.subPaths.length === 0) continue;
    const combined = new (data.paths[0].constructor as new () => typeof data.paths[0])();
    combined.subPaths = bucket.subPaths;
    combined.userData = { style: { fillRule: "evenodd" } };
    const shapes = SVGLoader.createShapes(combined);
    if (shapes.length === 0) continue;

    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: !isComplexLogo,
      bevelThickness: isComplexLogo ? 0 : depth * 0.35,
      bevelSize: isComplexLogo ? 0 : depth * 0.18,
      bevelSegments: isComplexLogo ? 0 : 3,
      curveSegments,
    });

    // SVG y-down → 3D y-up. Scaling inverts triangle winding, so reverse the
    // index buffer to keep caps & side walls front-facing.
    geometry.scale(1, -1, 1);
    const index = geometry.getIndex();
    if (index) {
      const arr = index.array as Uint16Array | Uint32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i];
        arr[i] = arr[i + 2];
        arr[i + 2] = t;
      }
      index.needsUpdate = true;
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    if (geometry.boundingBox) union.union(geometry.boundingBox);
    groups.push({ geometry, color: bucket.color });
  }
  if (groups.length === 0) return null;

  // Center every group in X/Y and rest the icon's back flush with z=0 so +Z is "out".
  const cx = (union.min.x + union.max.x) / 2;
  const cy = (union.min.y + union.max.y) / 2;
  const cz = union.min.z;
  for (const g of groups) g.geometry.translate(-cx, -cy, -cz);
  const halfExtent = Math.max(union.max.x - union.min.x, union.max.y - union.min.y) / 2;
  return { groups, halfExtent };
}

export function DiscoScene({
  shape,
  mirrorSize,
  tint = "#ffffff",
  tintGradient,
  gradientDirection = [1, -1, 0.4],
  matcapUrl = DEFAULT_MATCAP,
  innerColor = 0x222222,
  spinAxis = "y",
  spinSpeed = 0,
  autoRotateSpeed = 6,
  closeness = 2,
  className,
  faceIcons,
  iconTint,
  iconScale = 0.55,
  iconRaise = 0.00999,
  iconDepth = 0.0125,
}: DiscoSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const initialWidth = Math.max(1, mount.clientWidth);
    const initialHeight = Math.max(1, mount.clientHeight);
    renderer.setSize(initialWidth, initialHeight);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      initialWidth / initialHeight,
      1,
      10
    );
    const _initSpherical = new THREE.Spherical(closeness, -1.3, 0);
    camera.position.setFromSpherical(_initSpherical);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = closeness;
    controls.maxDistance = closeness;
    controls.autoRotate = true;
    controls.autoRotateSpeed = autoRotateSpeed;
    controls.enableZoom = false;
    controls.enableDamping = true;

    const clock = new THREE.Clock();
    const group = new THREE.Group();
    scene.add(group);


    let disposed = false;
    let rafId = 0;
    const disposables: Array<{ dispose: () => void }> = [];

    new THREE.TextureLoader().load(matcapUrl, (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }

      let geometryOriginal = buildBaseGeometry(shape);
      geometryOriginal.deleteAttribute("normal");
      geometryOriginal.deleteAttribute("uv");
      geometryOriginal = BufferGeometryUtils.mergeVertices(geometryOriginal);
      geometryOriginal.computeVertexNormals();

      // When a gradient is supplied, the material color stays white so the
      // per-instance colors set via setColorAt drive the look. Otherwise the
      // single `tint` multiplies the matcap as before.
      const useGradient = !!(tintGradient && tintGradient.length >= 2);
      const gradientStops = useGradient
        ? tintGradient!.map((c) => new THREE.Color(c))
        : null;
      const gradientDir = new THREE.Vector3(...gradientDirection).normalize();
      // Cube reaches ~half-diagonal in object space (0.8 cube → ~0.7). Use the
      // base geometry bounding box so non-cube shapes also map cleanly.
      let gradientHalfExtent = 0.7;
      const sampleGradient = (pos: THREE.Vector3, out: THREE.Color) => {
        if (!gradientStops) return;
        const d = pos.dot(gradientDir);
        const t = Math.max(0, Math.min(1, (d / gradientHalfExtent + 1) / 2));
        const scaled = t * (gradientStops.length - 1);
        const i = Math.floor(scaled);
        const f = scaled - i;
        const a = gradientStops[Math.min(i, gradientStops.length - 1)];
        const b = gradientStops[Math.min(i + 1, gradientStops.length - 1)];
        out.copy(a).lerp(b, f);
      };

      const mirrorMaterial = new THREE.MeshMatcapMaterial({
        matcap: texture,
        color: new THREE.Color(useGradient ? "#ffffff" : tint),
      });
      const mirrorGeometry = new THREE.PlaneGeometry(mirrorSize, mirrorSize);
      const instancedMirrorMesh = new THREE.InstancedMesh(
        mirrorGeometry,
        mirrorMaterial,
        geometryOriginal.attributes.position.count
      );

      // Update extent to the actual base geometry so the gradient stretches
      // edge-to-edge for whichever shape is current.
      geometryOriginal.computeBoundingSphere();
      if (geometryOriginal.boundingSphere) {
        gradientHalfExtent = Math.max(0.05, geometryOriginal.boundingSphere.radius);
      }

      const dummy = new THREE.Object3D();
      const positions = geometryOriginal.attributes.position.array as ArrayLike<number>;
      const normals = geometryOriginal.attributes.normal.array as ArrayLike<number>;
      const vertPos = new THREE.Vector3();
      const vertColor = new THREE.Color();
      for (let i = 0; i < positions.length; i += 3) {
        dummy.position.set(positions[i], positions[i + 1], positions[i + 2]);
        dummy.lookAt(
          positions[i] + normals[i],
          positions[i + 1] + normals[i + 1],
          positions[i + 2] + normals[i + 2]
        );
        dummy.updateMatrix();
        const idx = i / 3;
        instancedMirrorMesh.setMatrixAt(idx, dummy.matrix);
        if (useGradient) {
          vertPos.set(positions[i], positions[i + 1], positions[i + 2]);
          sampleGradient(vertPos, vertColor);
          instancedMirrorMesh.setColorAt(idx, vertColor);
        }
      }
      if (useGradient && instancedMirrorMesh.instanceColor) {
        instancedMirrorMesh.instanceColor.needsUpdate = true;
      }

      // Inner shell: pick a dark mid-gradient color so it reads as a unified
      // backing rather than clashing with whichever face is facing camera.
      const midColor = new THREE.Color();
      if (useGradient) {
        sampleGradient(new THREE.Vector3(0, 0, 0), midColor);
      } else {
        midColor.set(tint);
      }
      const tintedInner = midColor.clone().multiplyScalar(0.18);
      const innerMesh = new THREE.Mesh(
        geometryOriginal.clone(),
        new THREE.MeshBasicMaterial({ color: tintedInner })
      );

      group.add(innerMesh, instancedMirrorMesh);
      disposables.push(
        texture,
        geometryOriginal,
        mirrorGeometry,
        mirrorMaterial,
        instancedMirrorMesh.geometry,
        innerMesh.geometry,
        innerMesh.material as THREE.Material
      );

      if (shape === "roundedSquare") {
        const cubeSize = 0.8;
        const opts = {
          size: cubeSize,
          cornerInset: 0.15,
          tileSize: mirrorSize,
          material: mirrorMaterial,
          colorAt: useGradient ? sampleGradient : undefined,
        };
        const faceMesh = buildFaceTiles(opts);
        const edgeMesh = buildEdgeTiles(opts);
        const cornerMesh = buildCornerTiles(opts);
        group.add(faceMesh, edgeMesh, cornerMesh);
        disposables.push(faceMesh.geometry, edgeMesh.geometry, cornerMesh.geometry);

        if (faceIcons && faceIcons.length > 0) {
          // Default (tinted) material for icons without per-path SVG fills.
          const fallbackColor = new THREE.Color(iconTint ?? tint).lerp(
            new THREE.Color(0xffffff),
            iconTint ? 0 : 0.4
          );
          const fallbackMaterial = new THREE.MeshMatcapMaterial({
            matcap: texture,
            color: fallbackColor,
          });
          disposables.push(fallbackMaterial);

          // Cache one matcap material per unique SVG fill color so multicolor
          // logos (Slack, etc.) keep their brand colors instead of being tinted.
          const colorMaterials = new Map<number, THREE.MeshMatcapMaterial>();
          const materialForColor = (color: THREE.Color | null): THREE.MeshMatcapMaterial => {
            if (!color) return fallbackMaterial;
            const hex = color.getHex();
            let mat = colorMaterials.get(hex);
            if (!mat) {
              mat = new THREE.MeshMatcapMaterial({ matcap: texture, color: color.clone() });
              colorMaterials.set(hex, mat);
              disposables.push(mat);
            }
            return mat;
          };

          const half = cubeSize / 2;
          const faces = [
            { normal: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
            { normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
            { normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
            { normal: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
            { normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
            { normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
          ];

          const targetHalfWidth = (cubeSize * iconScale) / 2;

          // Resolve each face's SVG markup (sync for react-icons, async for URLs)
          // then place geometry once everything is ready.
          const markupPromises = faces.map((_, faceIndex): Promise<string | null> => {
            const icon = faceIcons[faceIndex];
            if (!icon) return Promise.resolve(null);
            if (isSvgUrlIcon(icon)) {
              return fetch(icon.svgUrl)
                .then((r) => (r.ok ? r.text() : null))
                .catch(() => null);
            }
            return Promise.resolve(renderToStaticMarkup(createElement(icon)));
          });

          Promise.all(markupPromises).then((markups) => {
            if (disposed) return;
            markups.forEach((markup, faceIndex) => {
              if (!markup) return;
              const result = iconToGeometry(markup, iconDepth);
              if (!result) return;

              const icon = faceIcons[faceIndex];
              const svgFillOverride =
                icon && isSvgUrlIcon(icon) && icon.fill
                  ? new THREE.Color(icon.fill)
                  : null;

              const face = faces[faceIndex];
              const scale = targetHalfWidth / result.halfExtent;
              const lookTarget = face.normal.clone();
              const tmpObj = new THREE.Object3D();
              tmpObj.up.copy(face.up);
              tmpObj.position.set(0, 0, 0);
              tmpObj.lookAt(lookTarget);

              // One parent Object3D per face holds every color sub-mesh so the
              // whole icon transforms as a unit.
              const faceGroup = new THREE.Object3D();
              faceGroup.quaternion.copy(tmpObj.quaternion);
              faceGroup.position
                .copy(face.normal)
                .multiplyScalar(half + iconRaise);

              for (const g of result.groups) {
                g.geometry.scale(scale, scale, 1);
                const mesh = new THREE.Mesh(
                  g.geometry,
                  materialForColor(g.color ?? svgFillOverride)
                );
                faceGroup.add(mesh);
                disposables.push(g.geometry);
              }
              group.add(faceGroup);
            });
          });
        }
      }
    });

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    const tick = () => {
      if (disposed) return;
      const delta = 0.1 * clock.getDelta();
      controls.update();
      if (spinSpeed !== 0) {
        const s = delta * spinSpeed;
        if (spinAxis === "x" || spinAxis === "xz") group.rotateX(s);
        if (spinAxis === "y") group.rotateY(s);
        if (spinAxis === "z" || spinAxis === "xz") group.rotateZ(s);
      }
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [shape, mirrorSize, tint, tintGradient, gradientDirection, matcapUrl, innerColor, spinAxis, spinSpeed, autoRotateSpeed, closeness, faceIcons, iconTint, iconScale, iconRaise, iconDepth]);

  return <div ref={mountRef} className={className} />;
}
