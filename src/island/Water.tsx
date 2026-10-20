import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Calm sea: a flat plane whose shader fakes the look of water. Turquoise in
// the shallows around the island, deeper blue further out, sky reflected at
// grazing angles (Fresnel), and sun glints from soft drifting ripple texture.
// The surface itself doesn't move, so there are no visible waves.

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform float uIslandRadius;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  // Rotating each octave stops the noise lining up into a visible grid.
  const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

  // Irregular drifting ripple height (never moves the surface; it only
  // tilts the lighting normal and shades the colour slightly). The input is
  // domain-warped so ripples swirl instead of repeating evenly.
  float ripples(vec2 p, float t) {
    vec2 warp = vec2(noise(p * 0.18 + vec2(t * 0.03, 0.0)), noise(p * 0.18 + vec2(5.2, -t * 0.03)));
    p += (warp - 0.5) * 3.0;
    float h = 0.0;
    float amp = 0.5;
    vec2 drift = vec2(t * 0.22, t * 0.15);
    for (int i = 0; i < 4; i++) {
      h += noise(p + drift) * amp;
      p = ROT * p * 2.03;
      drift = ROT * drift * 1.4;
      amp *= 0.5;
    }
    return h;
  }

  void main() {
    vec2 p = vWorld.xz;
    float r = length(p);
    float t = uTime;
    float viewDist = length(cameraPosition - vWorld);

    // Big slow patches: calm, glassy stretches next to choppier ones.
    float patches = noise(p * 0.07 + vec2(t * 0.012, -t * 0.009));
    patches = smoothstep(0.25, 0.85, patches);
    // Ripple detail fades with distance so far water doesn't shimmer evenly.
    float strength = mix(0.35, 1.25, patches) * (1.0 - 0.7 * smoothstep(12.0, 40.0, viewDist));

    float h0 = ripples(p, t);
    float e = 0.05;
    vec2 slope = vec2(ripples(p + vec2(e, 0.0), t) - h0, ripples(p + vec2(0.0, e), t) - h0) / e;
    vec3 n = normalize(vec3(-slope.x * 0.10 * strength, 1.0, -slope.y * 0.10 * strength));
    vec3 v = normalize(cameraPosition - vWorld);

    // Turquoise shallows with an uneven edge, deep blue further out.
    float edge = (noise(p * 0.35) - 0.5) * 2.5;
    float shallow = 1.0 - smoothstep(uIslandRadius + 0.4, uIslandRadius + 5.5, r + edge);
    vec3 color = mix(uDeep, uShallow, shallow);
    // Choppy patches read a touch darker, calm ones a touch lighter.
    color *= 1.04 - 0.10 * patches;
    color *= 0.95 + 0.10 * h0 * strength;

    // A little sky reflection when looking across the water.
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
    color = mix(color, uSky, clamp(fresnel * 0.6, 0.0, 0.3));

    // Sun glints, mostly where the water is choppy.
    vec3 hv = normalize(uSunDir + v);
    float glint = pow(max(dot(n, hv), 0.0), 700.0) * patches;
    color += vec3(1.0, 0.98, 0.92) * glint * 0.9;

    // Fade into the sky far away so the edge of the sea isn't visible.
    float alpha = 1.0 - smoothstep(32.0, 58.0, r);

    // Colours are passed in already display-ready (see uniforms), so no
    // colour-space conversion here.
    gl_FragColor = vec4(color, alpha);
  }
`;

/** A hex colour as the raw sRGB numbers the screen shows, skipping three's linear conversion. */
function displayColor(hex: string): THREE.Color {
  return new THREE.Color(hex).convertLinearToSRGB();
}

export function Water({ islandRadius, sunPosition }: { islandRadius: number; sunPosition: [number, number, number] }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        // Skip tone mapping so the blues stay rich instead of washing out.
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uSunDir: { value: new THREE.Vector3(...sunPosition).normalize() },
          // Display (sRGB) values, written straight to the screen.
          uShallow: { value: displayColor('#38b6b0') },
          uDeep: { value: displayColor('#1e6c9e') },
          uSky: { value: displayColor('#bfe6ff') },
          uIslandRadius: { value: islandRadius },
        },
      }),
    [islandRadius, sunPosition],
  );

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} material={material} renderOrder={-1}>
      <planeGeometry args={[120, 120]} />
    </mesh>
  );
}
