/* Vector chess pieces (look the same on every device, no font needed).
 * CP.draw(ctx, type 'K'|'Q'|'R'|'B'|'N'|'P', color 'w'|'b', cx, cy, size)
 */
(function () {
  const CP = {};
  function base(c, s) { c.beginPath(); c.roundRect(-0.36 * s, 0.30 * s, 0.72 * s, 0.14 * s, 0.04 * s); c.fill(); c.stroke(); }
  const shapes = {
    P(c, s) { base(c, s); c.beginPath(); c.moveTo(-0.22 * s, 0.30 * s); c.quadraticCurveTo(-0.16 * s, 0.02 * s, -0.08 * s, -0.04 * s); c.lineTo(0.08 * s, -0.04 * s); c.quadraticCurveTo(0.16 * s, 0.02 * s, 0.22 * s, 0.30 * s); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -0.16 * s, 0.13 * s, 0, Math.PI * 2); c.fill(); c.stroke(); },
    R(c, s) { base(c, s); c.beginPath(); c.rect(-0.22 * s, -0.12 * s, 0.44 * s, 0.42 * s); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-0.3 * s, -0.12 * s); c.lineTo(-0.3 * s, -0.36 * s); c.lineTo(-0.18 * s, -0.36 * s); c.lineTo(-0.18 * s, -0.26 * s); c.lineTo(-0.06 * s, -0.26 * s); c.lineTo(-0.06 * s, -0.36 * s); c.lineTo(0.06 * s, -0.36 * s); c.lineTo(0.06 * s, -0.26 * s); c.lineTo(0.18 * s, -0.26 * s); c.lineTo(0.18 * s, -0.36 * s); c.lineTo(0.3 * s, -0.36 * s); c.lineTo(0.3 * s, -0.12 * s); c.closePath(); c.fill(); c.stroke(); },
    B(c, s) { base(c, s); c.beginPath(); c.moveTo(-0.2 * s, 0.30 * s); c.quadraticCurveTo(-0.26 * s, -0.1 * s, 0, -0.38 * s); c.quadraticCurveTo(0.26 * s, -0.1 * s, 0.2 * s, 0.30 * s); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -0.42 * s, 0.06 * s, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0.04 * s, -0.22 * s); c.lineTo(0.12 * s, -0.04 * s); c.stroke(); },
    N(c, s) { base(c, s); c.beginPath(); c.moveTo(-0.24 * s, 0.30 * s); c.lineTo(-0.2 * s, 0.0); c.quadraticCurveTo(-0.24 * s, -0.3 * s, 0.02 * s, -0.4 * s); c.lineTo(0.06 * s, -0.32 * s); c.quadraticCurveTo(0.3 * s, -0.22 * s, 0.32 * s, -0.02 * s); c.lineTo(0.22 * s, 0.06 * s); c.lineTo(0.06 * s, -0.04 * s); c.quadraticCurveTo(0.12 * s, 0.14 * s, 0.24 * s, 0.30 * s); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0.06 * s, -0.2 * s, 0.03 * s, 0, Math.PI * 2); c.stroke(); },
    Q(c, s) { base(c, s); c.beginPath(); c.moveTo(-0.26 * s, 0.30 * s); c.lineTo(-0.34 * s, -0.24 * s); c.lineTo(-0.16 * s, -0.04 * s); c.lineTo(-0.08 * s, -0.34 * s); c.lineTo(0, -0.06 * s); c.lineTo(0.08 * s, -0.34 * s); c.lineTo(0.16 * s, -0.04 * s); c.lineTo(0.34 * s, -0.24 * s); c.lineTo(0.26 * s, 0.30 * s); c.closePath(); c.fill(); c.stroke(); [-0.34, -0.08, 0.08, 0.34].forEach((x) => { c.beginPath(); c.arc(x * s, (x === -0.34 || x === 0.34 ? -0.27 : -0.37) * s, 0.05 * s, 0, Math.PI * 2); c.fill(); c.stroke(); }); },
    K(c, s) { base(c, s); c.beginPath(); c.moveTo(-0.26 * s, 0.30 * s); c.quadraticCurveTo(-0.34 * s, -0.16 * s, -0.12 * s, -0.16 * s); c.quadraticCurveTo(0, -0.18 * s, 0, -0.06 * s); c.quadraticCurveTo(0, -0.18 * s, 0.12 * s, -0.16 * s); c.quadraticCurveTo(0.34 * s, -0.16 * s, 0.26 * s, 0.30 * s); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.rect(-0.03 * s, -0.42 * s, 0.06 * s, 0.24 * s); c.rect(-0.1 * s, -0.35 * s, 0.2 * s, 0.06 * s); c.fill(); c.stroke(); },
  };
  CP.draw = (c, type, color, x, y, size) => {
    c.save(); c.translate(x, y);
    c.fillStyle = color === 'w' ? '#fbf8ff' : '#1a1230';
    c.strokeStyle = color === 'w' ? '#1a1230' : '#cfc6ff';
    c.lineWidth = Math.max(1.5, size * 0.035); c.lineJoin = 'round';
    shapes[type](c, size);
    c.restore();
  };
  window.CP = CP;
})();
