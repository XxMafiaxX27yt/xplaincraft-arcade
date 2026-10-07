// Animated characters for the third-person games.
//   const make = await avatars(K3, 'assets/common/buddy.glb', { height: 1.6 });
//   const a = make('#ff2bd6');      a.root (TransformNode, feet at its origin, facing +z)
//   a.play('Run', { loop: true, speed: 1.2 })    smooth blend between clips
//   a.has('Wave') · a.dispose()
import { V } from './kit3d.js';

export async function avatars(K3, url, { height = 1.6, main = 'Main', second = 'Main2' } = {}) {
  const cont = await K3.loadGLB(url);
  let scale = null;
  return (color = null, color2 = null) => {
    const inst = cont.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
    const root = new V.TransformNode('avatar', K3.scene);
    const inner = new V.TransformNode('avatar-in', K3.scene); inner.parent = root;
    inst.rootNodes.forEach((n) => (n.parent = inner));
    if (scale == null) { const b = inner.getHierarchyBoundingVectors(true); scale = height / Math.max(0.01, b.max.y - b.min.y); }
    inner.scaling.setAll(scale);
    const meshes = root.getChildMeshes();
    meshes.forEach((m) => { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; if (K3.shadow) K3.shadow.addShadowCaster(m); });
    // per-player colours: clone the body materials once per avatar
    const tint = (name, hex) => {
      if (!hex) return;
      const seen = new Map();
      meshes.forEach((m) => {
        const mat = m.material; if (!mat) return;
        const subs = mat.subMaterials || [mat];
        subs.forEach((sm, i) => {
          if (!sm || sm.name !== name) return;
          let c = seen.get(sm); if (!c) { c = sm.clone(sm.name + '-' + hex); (c.albedoColor || c.diffuseColor).copyFrom(V.Color3.FromHexString(hex).toLinearSpace()); seen.set(sm, c); }
          if (mat.subMaterials) mat.subMaterials[i] = c; else m.material = c;
        });
      });
    };
    tint(main, color); tint(second, color2);
    const groups = {};
    inst.animationGroups.forEach((g) => { g.stop(); groups[g.name.replace(/^.*\|/, '')] = g; g.targetedAnimations.forEach((t) => { t.animation.enableBlending = true; t.animation.blendingSpeed = 0.12; }); });
    let cur = null;
    return {
      root, groups,
      has: (n) => !!groups[n],
      play(name, { loop = true, speed = 1 } = {}) {
        const g = groups[name]; if (!g) return;
        if (cur === g) { g.speedRatio = speed; return; }
        cur?.stop(); cur = g;
        g.start(loop, speed, g.from, g.to, false);
      },
      get current() { return cur ? cur.name : null; },
      dispose() { inst.animationGroups.forEach((g) => g.dispose()); root.dispose(false, true); },
    };
  };
}
