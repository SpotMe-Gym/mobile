/* eslint-disable react/no-unknown-property -- react-three-fiber intrinsic elements take three.js props */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as THREE from 'three';
import { colors as theme } from '@/theme/colors';
import { OrbitController } from '@/features/body/components/orbit';

interface BodyViewerProps {
  /** Morphed positions (metres, Y up). Same length on every render. */
  positions: Float32Array;
  /** Linear RGB per vertex. */
  colors: Float32Array;
  indices: Uint16Array;
  /** Body height in metres — frames the camera and sets the zoom limits. */
  heightM: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

function Body({ positions, colors, indices }: Pick<BodyViewerProps, 'positions' | 'colors' | 'indices'>) {
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    return g;
  }, [indices]);

  useEffect(() => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (pos && pos.array.length === positions.length) {
      (pos.array as Float32Array).set(positions);
      pos.needsUpdate = true;
    } else {
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions.slice(), 3).setUsage(THREE.DynamicDrawUsage),
      );
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    invalidate();
  }, [geometry, positions, invalidate]);

  useEffect(() => {
    const col = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (col && col.array.length === colors.length) {
      (col.array as Float32Array).set(colors);
      col.needsUpdate = true;
    } else {
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors.slice(), 3).setUsage(THREE.DynamicDrawUsage),
      );
    }
    invalidate();
  }, [geometry, colors, invalidate]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.62} metalness={0} />
    </mesh>
  );
}

function OrbitRig({ controller }: { controller: OrbitController }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => controller.attach(invalidate), [controller, invalidate]);
  useFrame(() => {
    const { position, target } = controller.step();
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
}

/**
 * Interactive 3D body: one-finger drag orbits 360°, pinch zooms, double tap resets.
 * Zoom and tilt are clamped (see orbit.ts) so the camera can't enter the mesh or lose it.
 * Renders on demand — nothing is drawn while the body and camera are still.
 */
export function BodyViewer({
  positions,
  colors,
  indices,
  heightM,
  style,
  accessibilityLabel,
}: BodyViewerProps) {
  const [controller] = useState(() => new OrbitController(heightM));
  useEffect(() => controller.setHeight(heightM), [controller, heightM]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .onStart(() => controller.grab())
      .onChange((e) => controller.rotate(e.changeX, e.changeY))
      .onEnd((e) => controller.release(e.velocityX, e.velocityY));
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => controller.pinchStart())
      .onUpdate((e) => controller.pinch(e.scale));
    const reset = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .onEnd(() => controller.reset());
    return Gesture.Exclusive(reset, Gesture.Simultaneous(pan, pinch));
  }, [controller]);

  // The Body screen is a native modal: on iOS it's presented in its own view controller,
  // outside the app root's GestureHandlerRootView, so gestures need a root of their own here.
  return (
    <GestureHandlerRootView style={[styles.container, style]}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.container}
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        >
          <Canvas
            frameloop="demand"
            camera={{ fov: 35, near: 0.05, far: 50 }}
            onCreated={(state) => state.gl.setClearColor(theme.surface)}
          >
            <ambientLight intensity={0.55} />
            <hemisphereLight args={['#fff4e8', '#1b1f27', 0.6]} />
            <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
            <directionalLight position={[-3, 2.5, -2.5]} intensity={0.7} color="#9ec5ff" />
            <OrbitRig controller={controller} />
            <Body positions={positions} colors={colors} indices={indices} />
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
});
