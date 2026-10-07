// NOVEX STRIKE HUD (DOM, drawn over the 3D view). No damage numbers by default (spec), hitmarker + headshot sound on.
const CSS = `
.sh{position:absolute;inset:0;font-family:'Rajdhani','Segoe UI',sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8)}
.sh-x{position:absolute;left:50%;top:50%;width:0;height:0}
.sh-x i{position:absolute;background:#fff;box-shadow:0 0 2px #000}
.sh-x .d{width:3px;height:3px;left:-1.5px;top:-1.5px;border-radius:50%}
.sh-hm{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:0;transition:opacity .15s}
.sh-hm b{position:absolute;left:50%;top:50%;width:9px;height:2px;background:#fff;box-shadow:0 0 3px #000}
.sh-hm.head b{background:#ff3355}
.sh-top{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;font-family:'Orbitron','Segoe UI',sans-serif;font-weight:700}
.sh-sc{font-size:26px;min-width:34px;text-align:center}
.sh-sc.a{color:#22e6ff}.sh-sc.b{color:#ff2bd6}
.sh-tm{font-size:15px;padding:4px 12px;border-radius:8px;background:rgba(8,6,20,.6);border:1px solid rgba(255,255,255,.15);min-width:62px;text-align:center}
.sh-tm.hot{color:#ff3355;border-color:#ff3355}
.sh-patch{position:absolute;top:52px;left:50%;transform:translateX(-50%);font-size:13px;letter-spacing:2px;color:#ffd93a;font-family:'Orbitron','Segoe UI',sans-serif}
.sh-hp{position:absolute;left:18px;bottom:16px;width:min(260px,40vw)}
.sh-hp .bar{height:12px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden}
.sh-hp .bar i{display:block;height:100%;background:linear-gradient(90deg,#3dffa0,#22e6ff);transition:width .12s}
.sh-hp .n{font-family:'Orbitron','Segoe UI',sans-serif;font-size:28px;font-weight:900}
.sh-ab{margin-top:6px;font-size:13px;letter-spacing:2px;color:#8e88b8;font-family:'Orbitron','Segoe UI',sans-serif}
.sh-ab.ready{color:#3dffa0}
.sh-ammo{position:absolute;right:18px;bottom:16px;text-align:right}
.sh-ammo .n{font-family:'Orbitron','Segoe UI',sans-serif;font-size:34px;font-weight:900}
.sh-ammo .n small{font-size:16px;color:#8e88b8}
.sh-ammo .w{font-size:14px;letter-spacing:3px;color:#22e6ff;font-family:'Orbitron','Segoe UI',sans-serif}
.sh-ammo .slots{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
.sh-ammo .slots span{font-size:11px;padding:2px 7px;border-radius:5px;border:1px solid rgba(255,255,255,.2);color:#8e88b8}
.sh-ammo .slots span.on{border-color:#22e6ff;color:#fff}
.sh-msg{position:absolute;left:0;right:0;top:30%;text-align:center;font-family:'Orbitron','Segoe UI',sans-serif;font-weight:900;font-size:clamp(28px,6vw,64px);letter-spacing:4px;opacity:0;transition:opacity .25s}
.sh-msg small{display:block;font-size:clamp(13px,2vw,18px);letter-spacing:2px;font-weight:700;color:#c8c0e8;margin-top:6px}
.sh-feed{position:absolute;right:14px;top:56px;display:flex;flex-direction:column;gap:4px;align-items:flex-end;font-size:14px}
.sh-feed div{background:rgba(8,6,20,.6);padding:3px 10px;border-radius:6px}
.sh-dmg{position:absolute;left:50%;top:50%;width:0;height:0}
.sh-dmg i{position:absolute;left:-60px;top:-150px;width:120px;height:26px;border-top:5px solid rgba(255,40,70,.9);border-radius:50%/100% 100% 0 0;transform-origin:60px 150px;transition:opacity .6s}
.sh-scope{position:absolute;inset:0;display:none;background:radial-gradient(circle at center,transparent 0,transparent 31vmin,rgba(0,0,0,.92) 31.5vmin)}
.sh-scope::before,.sh-scope::after{content:'';position:absolute;background:rgba(255,43,214,.85)}
.sh-scope::before{left:50%;top:18vh;bottom:18vh;width:1px}
.sh-scope::after{top:50%;left:calc(50% - 31vmin);right:calc(50% - 31vmin);height:1px}
.sh-zone{position:absolute;left:50%;top:76px;transform:translateX(-50%);color:#ff3355;font-family:'Orbitron','Segoe UI',sans-serif;font-size:13px;letter-spacing:2px;display:none}
.sh-vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 140px rgba(255,20,60,0);transition:box-shadow .2s}
.sh-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:min(520px,90vw);background:rgba(8,6,20,.88);border:1px solid rgba(34,230,255,.4);border-radius:12px;padding:14px 18px;display:none;font-size:15px}
.sh-board table{width:100%;border-collapse:collapse}.sh-board td{padding:4px 8px}
.sh-net{position:absolute;left:10px;top:10px;font-size:11px;color:#8e88b8;font-family:monospace}
.sh-spec{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);font-size:15px;letter-spacing:2px;color:#c8c0e8;font-family:'Orbitron','Segoe UI',sans-serif}
.sh-range{position:absolute;left:14px;top:60px;background:rgba(8,6,20,.7);border:1px solid rgba(34,230,255,.3);border-radius:10px;padding:10px 14px;font-size:14px;line-height:1.5;min-width:220px}
`;

export class Hud {
  constructor(K3) {
    const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
    const el = document.createElement('div'); el.className = 'sh'; K3.hud.appendChild(el);
    el.innerHTML = `
      <div class="sh-vig"></div><div class="sh-scope"></div>
      <div class="sh-x"><i class="d"></i><i class="l"></i><i class="r"></i><i class="u"></i><i class="b"></i></div>
      <div class="sh-hm"><b style="transform:translate(-50%,-50%) rotate(45deg) translateX(-9px)"></b><b style="transform:translate(-50%,-50%) rotate(45deg) translateX(9px)"></b><b style="transform:translate(-50%,-50%) rotate(-45deg) translateX(-9px)"></b><b style="transform:translate(-50%,-50%) rotate(-45deg) translateX(9px)"></b></div>
      <div class="sh-dmg"></div>
      <div class="sh-top"><div class="sh-sc a">0</div><div class="sh-tm">0:00</div><div class="sh-sc b">0</div></div>
      <div class="sh-patch"></div><div class="sh-zone">OVERCHARGE - GET INSIDE THE RING</div>
      <div class="sh-hp"><div class="n">100</div><div class="bar"><i style="width:100%"></i></div><div class="sh-ab"></div></div>
      <div class="sh-ammo"><div class="w"></div><div class="n"></div><div class="slots"></div></div>
      <div class="sh-feed"></div><div class="sh-msg"></div><div class="sh-spec"></div><div class="sh-board"></div><div class="sh-net"></div><div class="sh-range" style="display:none"></div>`;
    this.el = el; this.q = (c) => el.querySelector(c);
    this.x = this.q('.sh-x'); this.hm = this.q('.sh-hm'); this.msgEl = this.q('.sh-msg');
    this.hmT = 0; this.msgT = 0; this.dmg = [];
  }
  show(on) { this.el.style.display = on ? '' : 'none'; }
  crosshair(gapPx, visible = true, color = '#fff') {
    const g = Math.max(3, gapPx), L = 9, T = 2;
    this.x.style.display = visible ? '' : 'none';
    const [l, r, u, b] = ['.l', '.r', '.u', '.b'].map((c) => this.x.querySelector(c));
    Object.assign(l.style, { width: L + 'px', height: T + 'px', left: -g - L + 'px', top: -T / 2 + 'px', background: color });
    Object.assign(r.style, { width: L + 'px', height: T + 'px', left: g + 'px', top: -T / 2 + 'px', background: color });
    Object.assign(u.style, { width: T + 'px', height: L + 'px', top: -g - L + 'px', left: -T / 2 + 'px', background: color });
    Object.assign(b.style, { width: T + 'px', height: L + 'px', top: g + 'px', left: -T / 2 + 'px', background: color });
  }
  hit(head, kill) { this.hm.classList.toggle('head', !!head); this.hm.style.opacity = 1; this.hm.style.transform = kill ? 'scale(1.4)' : ''; this.hmT = kill ? 0.35 : 0.18; }
  damageFrom(angle) { const i = document.createElement('i'); i.style.transform = `rotate(${angle}rad)`; this.q('.sh-dmg').appendChild(i); setTimeout(() => (i.style.opacity = 0), 500); setTimeout(() => i.remove(), 1200); }
  msg(big, small = '', t = 1.6, color = '#fff') { this.msgEl.innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`; this.msgEl.style.color = color; this.msgEl.style.opacity = 1; this.msgT = t; }
  feed(html) { const f = this.q('.sh-feed'), d = document.createElement('div'); d.innerHTML = html; f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => d.remove(), 5000); }
  score(a, b, time, hot) { this.q('.sh-sc.a').textContent = a; this.q('.sh-sc.b').textContent = b; const t = this.q('.sh-tm'); t.textContent = time; t.classList.toggle('hot', !!hot); }
  patch(text) { this.q('.sh-patch').textContent = text || ''; }
  zone(on) { this.q('.sh-zone').style.display = on ? 'block' : 'none'; }
  hp(v, max, abilityText, ready) {
    this.q('.sh-hp .n').textContent = Math.max(0, Math.ceil(v)); this.q('.sh-hp .bar i').style.width = Math.max(0, (100 * v) / max) + '%';
    const ab = this.q('.sh-ab'); ab.textContent = abilityText; ab.classList.toggle('ready', !!ready);
    this.q('.sh-vig').style.boxShadow = `inset 0 0 140px rgba(255,20,60,${v < 35 ? 0.55 : 0})`;
  }
  ammo(name, n, mag, slots, cur, reloading) {
    this.q('.sh-ammo .w').textContent = reloading ? 'RELOADING…' : name;
    this.q('.sh-ammo .n').innerHTML = mag ? `${n}<small> / ${mag}</small>` : '∞';
    this.q('.sh-ammo .slots').innerHTML = slots.map((s, i) => `<span class="${i === cur ? 'on' : ''}">${i + 1} ${s}</span>`).join('');
  }
  scope(on) { this.q('.sh-scope').style.display = on ? 'block' : 'none'; }
  spec(text) { this.q('.sh-spec').textContent = text || ''; }
  board(rows) { const b = this.q('.sh-board'); if (!rows) { b.style.display = 'none'; return; } b.style.display = 'block'; b.innerHTML = `<table><tr style="color:#8e88b8"><td>PLAYER</td><td>K</td><td>D</td><td>DMG</td></tr>${rows.map((r) => `<tr style="color:${r.col}"><td>${r.name}</td><td>${r.k}</td><td>${r.d}</td><td>${Math.round(r.dmg)}</td></tr>`).join('')}</table>`; }
  range(html) { const r = this.q('.sh-range'); r.style.display = html ? 'block' : 'none'; if (html) r.innerHTML = html; }
  tick(dt) {
    if (this.hmT > 0) { this.hmT -= dt; if (this.hmT <= 0) this.hm.style.opacity = 0; }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msgEl.style.opacity = 0; }
  }
}
