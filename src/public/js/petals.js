(function () {
  const canvas = document.getElementById("petals-canvas");
  const ctx = canvas.getContext("2d");
  let W = (canvas.width = window.innerWidth);
  let H = (canvas.height = window.innerHeight);
  window.addEventListener("resize", () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
  const COLORS = [
    "rgba(242,217,213,",
    "rgba(212,165,160,",
    "rgba(232,216,192,",
    "rgba(168,181,162,",
    "rgba(138,158,104,",
    "rgba(244,184,176,",
  ];
  function mk(fromTop) {
    return {
      x: Math.random() * W,
      y: fromTop ? -20 : Math.random() * H,
      sz: Math.random() * 10 + 5,
      op: Math.random() * 0.45 + 0.15,
      vy: Math.random() * 1.1 + 0.35,
      vx: (Math.random() - 0.5) * 0.5,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.035,
      wb: Math.random() * Math.PI * 2,
      ws: Math.random() * 0.025 + 0.008,
      col: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }
  const P = Array.from({ length: 60 }, () => mk(false));
  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.op;
    ctx.fillStyle = p.col + "0.85)";
    ctx.beginPath();
    ctx.ellipse(0, 0, p.sz * 0.45, p.sz, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = p.op * 0.35;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(
      -p.sz * 0.1,
      -p.sz * 0.2,
      p.sz * 0.14,
      p.sz * 0.28,
      -0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
  function loop() {
    ctx.clearRect(0, 0, W, H);
    P.forEach((p) => {
      p.wb += p.ws;
      p.x += p.vx + Math.sin(p.wb) * 0.44;
      p.y += p.vy;
      p.rot += p.rv;
      if (p.y > H + 30) {
        Object.assign(p, mk(true));
        p.y = -20;
      }
      draw(p);
    });
    requestAnimationFrame(loop);
  }
  loop();
})();
