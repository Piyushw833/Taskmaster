import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader, GLTFLoader, FBXLoader } from 'three-stdlib';

const PRESET_VIEWS: { label: string; position: [number, number, number]; target: [number, number, number] }[] = [
  { label: 'Front', position: [0, 2, 5], target: [0, 0, 0] },
  { label: 'Top', position: [0, 8, 0.01], target: [0, 0, 0] },
  { label: 'Side', position: [5, 2, 0], target: [0, 0, 0] },
];

const SUPPORTED_FORMATS = '.obj,.gltf,.glb,.fbx';
const CACHE_PREFIX = 'threeDViewerModel_';
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB

function FpsMonitor({ setFps, setLowQuality, lowQuality }: { setFps: (fps: number) => void; setLowQuality: (v: boolean) => void; lowQuality: boolean }) {
  const fpsRef = useRef<number[]>([]);
  const lastDropRef = useRef<number | null>(null);
  useFrame(() => {
    const now = performance.now();
    fpsRef.current.push(now);
    while (fpsRef.current.length > 2 && now - fpsRef.current[0] > 1000) {
      fpsRef.current.shift();
    }
    const currentFps = fpsRef.current.length;
    setFps(currentFps);
    if (currentFps < 20) {
      if (!lastDropRef.current) lastDropRef.current = now;
      if (now - (lastDropRef.current || 0) > 2000 && !lowQuality) {
        setLowQuality(true);
      }
    } else {
      lastDropRef.current = null;
      if (lowQuality) setLowQuality(false);
    }
  });
  return null;
}

const AnnotationMarkers: React.FC<{ annotations: { pos: [number, number, number]; text: string }[] }> = ({ annotations }) => (
  <>
    {annotations.map((a, i) => (
      <mesh key={i} position={a.pos}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="magenta" />
        <Html center style={{ pointerEvents: 'none', color: 'white', fontWeight: 'bold', fontSize: 14 }}>{a.text}</Html>
      </mesh>
    ))}
  </>
);

const MeasurementLine: React.FC<{ points: THREE.Vector3[] }> = ({ points }) => {
  if (points.length !== 2) return null;
  const arr = new Float32Array([
    points[0].x, points[0].y, points[0].z,
    points[1].x, points[1].y, points[1].z,
  ]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={arr}
          count={2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial attach="material" color="yellow" linewidth={2} />
    </line>
  );
};

const AreaPolygon: React.FC<{ points: THREE.Vector3[] }> = ({ points }) => {
  if (points.length < 3) return null;
  const vertices = points.flatMap((p) => [p.x, p.y, p.z]);
  const arr = new Float32Array(vertices);
  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={arr}
          count={points.length}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial attach="material" color="cyan" linewidth={2} />
    </lineLoop>
  );
};

interface ViewerSceneProps {
  model: THREE.Object3D | null;
  measurementMode: boolean;
  areaMode: boolean;
  annotationMode: boolean;
  measurementPoints: THREE.Vector3[];
  setLastClicked: (e: { type: 'distance' | 'area' | 'annotation'; point: THREE.Vector3 }) => void;
  areaPoints: THREE.Vector3[];
  annotations: { pos: [number, number, number]; text: string }[];
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  controlsRef: React.RefObject<any>;
  lowQuality: boolean;
  setFps: (fps: number) => void;
  setLowQuality: (v: boolean) => void;
}

const ViewerScene: React.FC<ViewerSceneProps> = ({
  model,
  measurementMode,
  areaMode,
  annotationMode,
  measurementPoints,
  setLastClicked,
  areaPoints,
  annotations,
  cameraPosition,
  cameraTarget,
  controlsRef,
  lowQuality,
  setFps,
  setLowQuality,
}) => {
  const { camera } = useThree();

  const handlePointerDown = (e: any) => {
    if (!model) return;
    const mouse = new THREE.Vector2();
    mouse.x = (e.unprojectedPoint.x / camera.position.z) * 2 - 1;
    mouse.y = -(e.unprojectedPoint.y / camera.position.z) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      if (measurementMode) {
        setLastClicked({ type: 'distance', point });
      } else if (areaMode) {
        setLastClicked({ type: 'area', point });
      } else if (annotationMode) {
        setLastClicked({ type: 'annotation', point });
      }
    }
  };

  FpsMonitor({ setFps, setLowQuality, lowQuality });

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(...cameraPosition);
      controlsRef.current.target.set(...cameraTarget);
      controlsRef.current.update();
    }
  }, [model, cameraPosition, cameraTarget]);

  return (
    <>
      {model ? <primitive object={model} /> : (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      )}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7.5]} intensity={1} />
      <Suspense fallback={null}>
        <MeasurementLine points={measurementPoints} />
        <AreaPolygon points={areaPoints} />
        <AnnotationMarkers annotations={annotations} />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        minDistance={1}
        maxDistance={20}
        target={cameraTarget}
      />
      <Environment preset="sunset" />
      {(measurementMode || areaMode || annotationMode) && (
        <mesh
          onPointerDown={handlePointerDown}
          position={[0, -10, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
};

const ThreeDViewer = () => {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef(null);
  const controlsRef = useRef(null);
  const [cameraPosition, setCameraPosition] = useState([0, 2, 5]);
  const [cameraTarget, setCameraTarget] = useState([0, 0, 0]);
  const [fps, setFps] = useState(60);
  const [lowQuality, setLowQuality] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<THREE.Vector3[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [measurementLabelPos, setMeasurementLabelPos] = useState<THREE.Vector3 | null>(null);
  const [areaMode, setAreaMode] = useState(false);
  const [areaPoints, setAreaPoints] = useState<THREE.Vector3[]>([]);
  const [areaValue, setAreaValue] = useState<number | null>(null);
  const [areaLabelPos, setAreaLabelPos] = useState<THREE.Vector3 | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotations, setAnnotations] = useState<{ pos: [number, number, number]; text: string }[]>([]);
  const canvasRef = useRef(null);

  // Utility to detect mobile devices
  const isMobile = () => /Mobi|Android/i.test(navigator.userAgent);

  // Center and scale the model for better viewing
  const centerAndScale = (object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = isMobile() ? 1 / maxDim : 2 / maxDim;
      object.scale.setScalar(scale);
    }
    box.setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
    object.position.set(0, 0, 0);
  };

  // Auto-frame camera to fit model after load
  const frameModel = (object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = 60 * (Math.PI / 180);
    let cameraZ = maxDim / (2 * Math.tan(fov / 2));
    cameraZ *= 1.5;
    setCameraPosition([center.x, center.y, cameraZ]);
    setCameraTarget([center.x, center.y, center.z]);
  };

  // Handle file input and model loading (OBJ, GLTF, GLB, FBX) with caching and error handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setLoading(true);
    setProgress(null);
    setModel(null);
    setFileName(null);
    const file = e.target.files?.[0];
    if (!file) {
      setLoading(false);
      return;
    }
    const name = file.name.toLowerCase();
    setFileName(file.name);
    const cacheKey = CACHE_PREFIX + file.name;
    const cached = localStorage.getItem(cacheKey);
    const finishLoad = (obj: THREE.Object3D) => {
      centerAndScale(obj);
      setModel(obj);
      frameModel(obj);
      setLoading(false);
      setProgress(null);
    };
    try {
      if (cached && name.endsWith('.obj')) {
        const loader = new OBJLoader();
        const obj = loader.parse(cached);
        finishLoad(obj);
        return;
      }
      if (cached && name.endsWith('.gltf')) {
        const loader = new GLTFLoader();
        loader.parse(
          cached,
          '',
          (gltf) => finishLoad(gltf.scene || gltf.scenes[0]),
          () => setError('Failed to load cached GLTF model.' as string)
        );
        return;
      }
    } catch {
      localStorage.removeItem(cacheKey);
    }
    if (name.endsWith('.obj')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          if (text.length < MAX_CACHE_SIZE) localStorage.setItem(cacheKey, text);
          try {
            const loader = new OBJLoader();
            const obj = loader.parse(text);
            finishLoad(obj);
          } catch {
            setError('Failed to load OBJ model.' as string);
          }
        } else {
          setError('Failed to load OBJ model.' as string);
        }
      };
      reader.onerror = () => setError('Failed to read file.' as string);
      reader.readAsText(file);
    } else if (name.endsWith('.gltf')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          if (text.length < MAX_CACHE_SIZE) localStorage.setItem(cacheKey, text);
          try {
            const loader = new GLTFLoader();
            loader.parse(
              text,
              '',
              (gltf) => finishLoad(gltf.scene || gltf.scenes[0]),
              () => setError('Failed to load GLTF model.' as string)
            );
          } catch {
            setError('Failed to load GLTF model.' as string);
          }
        } else {
          setError('Failed to load GLTF model.' as string);
        }
      };
      reader.onerror = () => setError('Failed to read file.' as string);
      reader.readAsText(file);
    } else if (name.endsWith('.glb')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result;
        if (arrayBuffer instanceof ArrayBuffer) {
          try {
            const loader = new GLTFLoader();
            loader.parse(
              arrayBuffer,
              '',
              (gltf) => finishLoad(gltf.scene || gltf.scenes[0]),
              () => setError('Failed to load GLB model.' as string)
            );
          } catch {
            setError('Failed to load GLB model.' as string);
          }
        } else {
          setError('Failed to load GLB model.' as string);
        }
      };
      reader.onerror = () => setError('Failed to read file.' as string);
      reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.fbx')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result;
        if (arrayBuffer instanceof ArrayBuffer) {
          try {
            const loader = new FBXLoader();
            const obj = loader.parse(arrayBuffer, '');
            finishLoad(obj);
          } catch {
            setError('Failed to load FBX model.' as string);
          }
        } else {
          setError('Failed to load FBX model.' as string);
        }
      };
      reader.onerror = () => setError('Failed to read file.' as string);
      reader.readAsArrayBuffer(file);
    } else {
      setError('Only .obj, .gltf, .glb, and .fbx files are supported.' as string);
      setLoading(false);
      setProgress(null);
    }
  };

  // WebGL support check
  const isWebGLAvailable = () => {
    try {
      const canvas = document.createElement('canvas');
      return !!window.WebGLRenderingContext && !!(
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      );
    } catch {
      return false;
    }
  };

  // Handler for preset view buttons
  const handlePresetView = (view: { label: string; position: [number, number, number]; target: [number, number, number] }) => {
    setCameraPosition(view.position);
    setCameraTarget(view.target);
  };

  // Finish area measurement and calculate area
  const finishArea = () => {
    if (areaPoints.length < 3) return;
    const p0 = areaPoints[0], p1 = areaPoints[1], p2 = areaPoints[2];
    const normal = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)).normalize();
    const projected = areaPoints.map((p) => {
      const v = new THREE.Vector3().subVectors(p, p0);
      const d = v.dot(normal);
      return new THREE.Vector3().subVectors(p, normal.clone().multiplyScalar(d));
    });
    const absNormal = normal.clone().set(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
    let dropAxis: 'x' | 'y' | 'z' = 'z';
    if (absNormal.x > absNormal.y && absNormal.x > absNormal.z) dropAxis = 'x';
    else if (absNormal.y > absNormal.z) dropAxis = 'y';
    const pts2D = projected.map((p) => {
      if (dropAxis === 'x') return [p.y, p.z];
      if (dropAxis === 'y') return [p.x, p.z];
      return [p.x, p.y];
    });
    let area = 0;
    for (let i = 0; i < pts2D.length; i++) {
      const [x1, y1] = pts2D[i];
      const [x2, y2] = pts2D[(i + 1) % pts2D.length];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;
    setAreaValue(area);
    let cx = 0, cy = 0, cz = 0;
    areaPoints.forEach((p) => { cx += p.x; cy += p.y; cz += p.z; });
    cx /= areaPoints.length; cy /= areaPoints.length; cz /= areaPoints.length;
    setAreaLabelPos(new THREE.Vector3(cx, cy, cz));
  };

  const resetArea = () => {
    setAreaPoints([]);
    setAreaValue(null);
    setAreaLabelPos(null);
  };

  const deleteAnnotation = (idx: number) => {
    setAnnotations((prev) => prev.filter((_, i) => i !== idx));
  };
  const editAnnotation = (idx: number) => {
    const newText = window.prompt('Edit annotation text:', annotations[idx].text);
    if (newText && newText.trim()) {
      setAnnotations((prev) => prev.map((a, i) => i === idx ? { ...a, text: newText.trim() } : a));
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('threeDViewerAnnotations');
    if (saved) {
      try {
        setAnnotations(JSON.parse(saved));
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('threeDViewerAnnotations', JSON.stringify(annotations));
  }, [annotations]);

  const exportData = () => {
    const data = {
      annotations,
      lastDistanceMeasurement: measurementPoints.length === 2 ? {
        points: measurementPoints.map((p) => [p.x, p.y, p.z]),
        distance: measuredDistance
      } : null,
      lastAreaMeasurement: areaPoints.length >= 3 && areaValue ? {
        points: areaPoints.map((p) => [p.x, p.y, p.z]),
        area: areaValue
      } : null
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations_and_measurements.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!model) {
      const loader = new OBJLoader();
      fetch('https://threejs.org/examples/models/obj/walt/WaltHead.obj')
        .then(res => res.text())
        .then(text => {
          const obj = loader.parse(text);
          centerAndScale(obj);
          setModel(obj);
          frameModel(obj);
        })
        .catch(() => setError('Failed to load default OBJ model.'));
    }
  }, [model]);

  if (!isWebGLAvailable()) {
    return <div style={{ color: 'red', padding: 16 }}>WebGL is not supported in this browser.</div>;
  }

  return (
    <div ref={canvasRef} style={{ width: '100%', height: '80vh', background: '#222', position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <input
        type="file"
        accept={SUPPORTED_FORMATS}
        ref={inputRef}
        style={{ position: 'absolute', zIndex: 2, margin: 8 }}
        onChange={handleFileChange}
      />
      <div style={{ position: 'absolute', zIndex: 2, top: 8, right: 8, display: 'flex', gap: 8 }}>
        {PRESET_VIEWS.map((view) => (
          <button
            key={view.label}
            style={{ padding: '4px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            onClick={() => handlePresetView(view)}
            title={`View: ${view.label}`}
          >
            {view.label}
          </button>
        ))}
      </div>
      {fileName && <div style={{ color: '#fff', position: 'absolute', zIndex: 2, top: 40, left: 8 }}>Loaded: {fileName}</div>}
      {loading && (
        <div style={{ color: '#fff', position: 'absolute', zIndex: 2, top: 64, left: 8 }}>
          {progress !== null ? `Loading model... ${progress}%` : 'Loading model...'}
        </div>
      )}
      {error && <div style={{ color: 'red', position: 'absolute', zIndex: 2, top: 88, left: 8 }}>{error}</div>}
      <button
        disabled={!model}
        style={{ position: 'absolute', zIndex: 4, top: 8, left: 120, padding: '4px 12px', background: measurementMode ? '#ff0' : '#444', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        onClick={() => {
          setMeasurementMode((m) => !m);
          setMeasurementPoints([]);
          setMeasuredDistance(null);
          setMeasurementLabelPos(null);
        }}
        title="Toggle distance measurement mode"
      >
        {measurementMode ? 'Exit Measurement' : 'Measurement Mode'}
      </button>
      <button
        disabled={!model}
        style={{ position: 'absolute', zIndex: 4, top: 8, left: 260, padding: '4px 12px', background: areaMode ? '#0ff' : '#444', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        onClick={() => {
          setAreaMode((m) => !m);
          resetArea();
        }}
        title="Toggle area measurement mode"
      >
        {areaMode ? 'Exit Area' : 'Area Measurement'}
      </button>
      {areaMode && areaPoints.length >= 3 && (
        <button
          disabled={!model}
          style={{ position: 'absolute', zIndex: 4, top: 8, left: 400, padding: '4px 12px', background: '#0ff', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          onClick={finishArea}
          title="Finish area measurement"
        >
          Finish Area
        </button>
      )}
      <button
        disabled={!model}
        style={{ position: 'absolute', zIndex: 4, top: 8, left: 540, padding: '4px 12px', background: annotationMode ? 'magenta' : '#444', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        onClick={() => setAnnotationMode((m) => !m)}
        title="Toggle annotation mode"
      >
        {annotationMode ? 'Exit Annotation' : 'Annotation Mode'}
      </button>
      {annotations.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 5, top: 8, right: 8, background: '#222', color: '#fff', padding: 12, borderRadius: 8, minWidth: 200, maxWidth: 320, boxShadow: '0 2px 8px #0008' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Annotations</div>
          <button style={{ background: '#0ff', color: '#000', border: 'none', borderRadius: 4, padding: '4px 12px', marginBottom: 8, cursor: 'pointer', width: '100%' }} onClick={exportData}>Export</button>
          {annotations.map((a, i) => (
            <div key={i} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{a.text}</span>
              <button style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }} onClick={() => editAnnotation(i)}>Edit</button>
              <button style={{ background: '#a00', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }} onClick={() => deleteAnnotation(i)}>Delete</button>
            </div>
          ))}
        </div>
      )}
      <Canvas camera={{ position: cameraPosition as [number, number, number], fov: 60 }} style={{ width: '100%', height: '100%' }}>
        <ViewerScene
          model={model}
          measurementMode={measurementMode}
          areaMode={areaMode}
          annotationMode={annotationMode}
          measurementPoints={measurementPoints}
          setLastClicked={(e) => {
            if (e.type === 'distance') {
              if (measurementPoints.length === 0) {
                setMeasurementPoints([e.point]);
              } else if (measurementPoints.length === 1) {
                const dist = measurementPoints[0].distanceTo(e.point);
                setMeasuredDistance(dist);
                setMeasurementLabelPos(new THREE.Vector3(
                  (measurementPoints[0].x + e.point.x) / 2,
                  (measurementPoints[0].y + e.point.y) / 2,
                  (measurementPoints[0].z + e.point.z) / 2,
                ));
                setMeasurementPoints([measurementPoints[0], e.point]);
              } else {
                setMeasuredDistance(null);
                setMeasurementLabelPos(null);
                setMeasurementPoints([e.point]);
              }
            } else if (e.type === 'area') {
              setAreaPoints((prev) => [...prev, e.point]);
            } else if (e.type === 'annotation') {
              const text = window.prompt('Enter annotation text:');
              if (text && text.trim()) {
                setAnnotations((prev) => [...prev, { pos: [e.point.x, e.point.y, e.point.z] as [number, number, number], text: text.trim() }]);
              }
            }
          }}
          areaPoints={areaPoints}
          annotations={annotations}
          cameraPosition={cameraPosition as [number, number, number]}
          cameraTarget={cameraTarget as [number, number, number]}
          controlsRef={controlsRef}
          lowQuality={lowQuality}
          setFps={setFps}
          setLowQuality={setLowQuality}
        />
      </Canvas>
      {measuredDistance && measurementLabelPos && (
        <div style={{ position: 'absolute', zIndex: 10, left: '50%', top: '90%', transform: 'translate(-50%, -50%)', background: '#222', color: '#ff0', padding: '6px 16px', borderRadius: 8, fontWeight: 'bold', fontSize: 18 }}>
          Distance: {measuredDistance.toFixed(2)} units
        </div>
      )}
      {areaValue && areaLabelPos && (
        <div style={{ position: 'absolute', zIndex: 10, left: '50%', top: '95%', transform: 'translate(-50%, -50%)', background: '#222', color: '#0ff', padding: '6px 16px', borderRadius: 8, fontWeight: 'bold', fontSize: 18 }}>
          Area: {areaValue.toFixed(2)} sq units
        </div>
      )}
      <div style={{ position: 'absolute', zIndex: 20, right: 16, bottom: 16, color: lowQuality ? '#f00' : '#0f0', fontWeight: 'bold', fontSize: 16 }}>
        FPS: {fps}
      </div>
    </div>
  );
};

export default ThreeDViewer; 