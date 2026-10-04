/* Procedural faces for people-based games (neighbours, guests, suspects...).
 * F.make()          random person
 * F.variant(p)      same person with ONE subtle difference (returns { p, diff })
 * F.draw(p, x, y, size, opts)   opts: { wrong: true } adds creepy touches
 */
(function () {
  const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#8d5a3b', '#5c3a26', '#ffd9c2'];
  const HAIR = ['#1b1209', '#4a2c14', '#a0652a', '#d9b25f', '#e8e3d3', '#7a1f1f', '#2b2b45'];
  const EYE = ['#3b2414', '#2f5d8a', '#3e7a3a', '#6b6b6b', '#1a1a1a'];
  const SHIRT = ['#3a6fd8', '#d83a5a', '#3ab07a', '#d8a03a', '#7a4ad8', '#555a66', '#e6e6e6'];
  const FIRST = ['Maya', 'Arjun', 'Lena', 'Omar', 'Priya', 'Tom', 'Sara', 'Ravi', 'Nina', 'Leo', 'Zoe', 'Kabir', 'Ella', 'Dev', 'Ivy', 'Sam', 'Aisha', 'Ben', 'Meera', 'Jack'];
  const LAST = ['Shah', 'Cole', 'Iyer', 'Grant', 'Das', 'Hart', 'Rao', 'Lane', 'Khan', 'Ford', 'Nair', 'Moss'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const F = {};
  F.make = () => ({
    skin: pick(SKIN), hair: pick(HAIR), hairStyle: Math.floor(Math.random() * 5), eye: pick(EYE), shirt: pick(SHIRT),
    glasses: Math.random() < 0.3, mole: Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) : 0, beard: Math.random() < 0.25,
    brows: Math.floor(Math.random() * 3), mouth: Math.floor(Math.random() * 3), ears: Math.random() < 0.15,
    name: pick(FIRST) + ' ' + pick(LAST), apt: 100 + Math.floor(Math.random() * 6) * 100 + 1 + Math.floor(Math.random() * 8),
  });
  const DIFFS = [
    ['eye', (p) => { p.eye = pick(EYE.filter((e) => e !== p.eye)); }, 'eye colour'],
    ['hair', (p) => { p.hair = pick(HAIR.filter((e) => e !== p.hair)); }, 'hair colour'],
    ['hairStyle', (p) => { p.hairStyle = (p.hairStyle + 1 + Math.floor(Math.random() * 3)) % 5; }, 'haircut'],
    ['glasses', (p) => { p.glasses = !p.glasses; }, 'glasses'],
    ['mole', (p) => { p.mole = p.mole ? 0 : 1; }, 'mole'],
    ['beard', (p) => { p.beard = !p.beard; }, 'beard'],
    ['shirt', (p) => { p.shirt = pick(SHIRT.filter((e) => e !== p.shirt)); }, 'shirt'],
    ['apt', (p) => { p.apt += 100; }, 'apartment number'],
    ['name', (p) => { p.name = pick(FIRST) + ' ' + p.name.split(' ')[1]; }, 'name'],
  ];
  F.variant = (p) => { const q = { ...p }; const d = pick(DIFFS); d[1](q); return { p: q, diff: d[2] }; };

  F.draw = (p, x, y, size = 1, opts = {}) => {
    const c = K.ctx(); c.save(); c.translate(x, y); c.scale(size, size);
    K.rect(-70, 70, 140, 80, p.shirt, 30); // shoulders
    K.rect(-14, 45, 28, 30, p.skin); // neck
    // hair back
    if (p.hairStyle === 2) K.rect(-56, -40, 112, 110, p.hair, 40);
    if (p.ears) { K.circle(-52, 0, 12, p.skin); K.circle(52, 0, 12, p.skin); }
    // head
    c.fillStyle = p.skin; c.beginPath(); c.ellipse(0, 0, 50, 62, 0, 0, Math.PI * 2); c.fill();
    // hair
    c.fillStyle = p.hair;
    if (p.hairStyle === 0) { c.beginPath(); c.ellipse(0, -36, 52, 32, 0, Math.PI, 0); c.fill(); }
    else if (p.hairStyle === 1) { c.beginPath(); c.ellipse(0, -40, 54, 30, 0, Math.PI * 0.95, Math.PI * 2.05); c.fill(); K.rect(-54, -40, 14, 40, p.hair); }
    else if (p.hairStyle === 2) { c.beginPath(); c.ellipse(0, -38, 54, 30, 0, Math.PI, 0); c.fill(); }
    else if (p.hairStyle === 3) { for (let i = -3; i <= 3; i++) K.circle(i * 14, -50 + Math.abs(i) * 3, 14, p.hair); }
    else { K.rect(-40, -66, 80, 18, p.hair, 6); }
    // brows
    const by = -14, bt = [0, -4, 4][p.brows];
    K.line(-30, by + bt, -12, by, '#2a1a10', 4); K.line(12, by, 30, by + bt, '#2a1a10', 4);
    // eyes
    const ey = 0;
    if (opts.wrong === 'black') { K.circle(-20, ey, 9, '#000'); K.circle(20, ey, 9, '#000'); }
    else {
      K.circle(-20, ey, 9, '#fff'); K.circle(20, ey, 9, '#fff');
      const lx = opts.look || 0;
      K.circle(-20 + lx, ey, 5, p.eye); K.circle(20 + lx, ey, 5, p.eye);
      K.circle(-20 + lx, ey, 2, '#000'); K.circle(20 + lx, ey, 2, '#000');
    }
    if (p.glasses) { K.ring(-20, ey, 14, '#222', 3); K.ring(20, ey, 14, '#222', 3); K.line(-6, ey, 6, ey, '#222', 3); }
    // nose + mouth
    K.line(0, 6, -4, 22, 'rgba(0,0,0,0.25)', 3);
    if (opts.wrong === 'smile') { c.strokeStyle = '#5a0f0f'; c.lineWidth = 4; c.beginPath(); c.arc(0, 26, 34, 0.15, Math.PI - 0.15); c.stroke(); }
    else if (p.mouth === 0) K.line(-16, 36, 16, 36, '#7a2f2f', 4);
    else if (p.mouth === 1) { c.strokeStyle = '#7a2f2f'; c.lineWidth = 4; c.beginPath(); c.arc(0, 26, 16, 0.3, Math.PI - 0.3); c.stroke(); }
    else { c.fillStyle = '#7a2f2f'; c.beginPath(); c.ellipse(0, 36, 10, 6, 0, 0, Math.PI * 2); c.fill(); }
    if (p.beard) { c.fillStyle = p.hair; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(0, 40, 40, 26, 0, 0, Math.PI); c.fill(); c.globalAlpha = 1; }
    if (p.mole) K.circle(28 * p.mole, 22, 3, '#3a2214');
    c.restore();
  };
  window.F = F;
})();
