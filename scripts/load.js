// Thử tải: mở một quán, cho N khách ảo vào và bấm ngẫu nhiên.
// Dùng: npm start (cửa sổ khác) rồi  npm run load -- [số khách=80] [số giây=60] [url=http://localhost:3000]
'use strict';
const WebSocket = require('ws');

const N = Number(process.argv[2]) || 80;
const GIAY = Number(process.argv[3]) || 60;
const GOC = process.argv[4] || 'http://localhost:3000';

(async () => {
  const r = await fetch(GOC + '/api/quan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ten: 'Quán thử tải' }) });
  const { id, loi } = await r.json();
  if (loi) throw new Error(loi);
  console.log(`Quán ${id}: xem tại ${GOC}/q/${id}?live=1`);

  const tk = { vao: 0, loi: 0, tin: 0, dut: 0, treMax: 0, treTong: 0, treDem: 0 };
  const bots = [];
  for (let i = 0; i < N; i++) {
    const ws = new WebSocket(`${GOC.replace(/^http/, 'ws')}/ws?q=${id}`);
    const bot = { ws, me: null, pub: null, gui: 0 };
    bots.push(bot);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', vaiTro: 'khach' }));
      ws.send(JSON.stringify({ type: 'join', ten: 'Bot ' + i, ban: 'ghep' }));
    });
    ws.on('message', (raw) => {
      tk.tin++;
      const m = JSON.parse(raw);
      if (m.type === 'joined') tk.vao++;
      if (m.type === 'loi') tk.loi++;
      if (m.type === 'pub') {
        bot.pub = m.s;
        if (bot.gui) {
          const tre = Date.now() - bot.gui;
          tk.treMax = Math.max(tk.treMax, tre);
          tk.treTong += tre;
          tk.treDem++;
          bot.gui = 0;
        }
      }
      if (m.type === 'me') bot.me = m.s;
    });
    ws.on('close', () => tk.dut++);
    await new Promise((res) => setTimeout(res, 20));
  }

  const hanhDong = (bot) => {
    const { me, pub } = bot;
    if (!me || !pub || bot.ws.readyState !== 1) return;
    const send = (a) => {
      bot.gui = Date.now();
      bot.ws.send(JSON.stringify({ type: 'act', a }));
    };
    for (const v of me.viec) {
      if (v.vu) return send({ type: 'traLoi', vu: v.vu, chon: Math.random() < 0.3 ? 'dap_tra' : 'nhin' });
      if (v.yc) return send({ type: 'traLoiYeuCau', yc: v.yc, dongY: Math.random() < 0.5 });
    }
    if (me.trangThai === 'sanh') return send({ type: 'ngoi', ban: 'ghep' });
    if (me.trangThai !== 'ngoi') return;
    const xx = pub.vu.find((v) => v.loai === 'xoxat' && !v.nguoi.includes(me.id));
    const khac = pub.khach.filter((k) => k.trangThai === 'ngoi' && k.id !== me.id);
    const ai = khac[Math.floor(Math.random() * khac.length)];
    const x = Math.random();
    if (xx && x < 0.2) return send({ type: 'canThiep', vu: xx.id, chon: ['can', 'xem', 'quay'][Math.floor(Math.random() * 3)] });
    if (x < 0.6) return send({ type: 'goiMon', mon: pub.menu[Math.floor(Math.random() * pub.menu.length)].id });
    if (x < 0.75 && ai) return send({ type: 'moiBan', ban: ai.ban, mon: pub.menu[0].id });
    if (x < 0.88 && ai) return send({ type: 'khia', den: ai.id, cau: Math.floor(Math.random() * 10) });
    if (x < 0.9 && ai) return send({ type: 'choang', den: ai.id });
    if (x < 0.95) return send({ type: 'xinThieu', soTien: 20 });
  };

  const hen = setInterval(() => bots.forEach((b) => Math.random() < 0.5 && hanhDong(b)), 1000);
  const bao = setInterval(() => {
    const mem = process.memoryUsage().rss / 1e6;
    console.log(`vào ${tk.vao}/${N} · tin nhận ${tk.tin} · lỗi luật ${tk.loi} · đứt ${tk.dut} · trễ TB ${tk.treDem ? Math.round(tk.treTong / tk.treDem) : '-'}ms, max ${tk.treMax}ms · RAM bot ${mem.toFixed(0)}MB`);
  }, 5000);
  setTimeout(() => {
    clearInterval(hen);
    clearInterval(bao);
    console.log('Xong.');
    bots.forEach((b) => b.ws.close());
    setTimeout(() => process.exit(0), 300);
  }, GIAY * 1000);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
