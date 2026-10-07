// Third-person follow camera: orbit with the mouse / right-side touch drag, never inside walls.
//   const cam = tpcam(K3, { dist: 6, height: 1.6 });
//   cam.update(target {x,y,z}, dt)   -> call every rendered frame;  cam.yaw = where "forward" points for movement
import { V } from './kit3d.js';

export function tpcam(K3, { dist = 6, height = 1.5, pitch = 0.32, minPitch = -0.2, maxPitch = 1.2, fov = 70 } = {}) {
  const cam = new V.FreeCamera('tpcam', new V.Vector3(0, 5, -8), K3.scene);
  cam.minZ = 0.1; cam.maxZ = 500; cam.fov = (fov * Math.PI) / 180; cam.inertia = 0;
  K3.scene.activeCamera = cam;
  const C = { cam, yaw: 0, pitch, dist, height, smooth: { x: 0, y: 0, z: 0 }, ready: false, shake: 0 };
  C.update = (t, dt, look = true) => {
    if (look) { const l = K3.input.look(); C.yaw += l.x; C.pitch = Math.max(minPitch, Math.min(maxPitch, C.pitch + l.y)); }
    const k = C.ready ? Math.min(1, dt * 12) : 1; C.ready = true;
    C.smooth.x += (t.x - C.smooth.x) * k; C.smooth.y += (t.y + C.height - C.smooth.y) * Math.min(1, dt * 8); C.smooth.z += (t.z - C.smooth.z) * k;
    const f = { x: Math.sin(C.yaw) * Math.cos(C.pitch), y: -Math.sin(C.pitch), z: Math.cos(C.yaw) * Math.cos(C.pitch) };
    // pull the camera in if a wall is between it and the player
    let d = C.dist;
    const hit = K3.phys.ray(C.smooth, { x: -f.x, y: -f.y, z: -f.z }, d);
    if (hit) d = Math.max(0.6, hit.dist - 0.25);
    const sh = C.shake > 0 ? (Math.random() - 0.5) * C.shake : 0; C.shake = Math.max(0, C.shake - dt);
    cam.position.set(C.smooth.x - f.x * d + sh, C.smooth.y - f.y * d + sh, C.smooth.z - f.z * d);
    cam.setTarget(new V.Vector3(C.smooth.x, C.smooth.y, C.smooth.z));
    K3.listener = { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: C.yaw };
  };
  return C;
}
