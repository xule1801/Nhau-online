// Máy chủ chạy localhost: phục vụ giao diện + WebSocket thời gian thực.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Quan } = require('./game');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const TOI_DA_QUAN = Number(process.env.MAX_QUAN) || 30;
const QUAN_TRONG_DONG_SAU = 30 * 60_000; // không ai kết nối 30 phút → xóa quán
const PUBLIC = path.join(__dirname, '..', 'public');
const THREE_BUILD = path.join(__dirname, '..', 'node_modules', 'three', 'build');
const THREE_ADDONS = path.join(__dirname, '..', 'node_modules', 'three', 'examples', 'jsm');

const quanMap = new Map(); // id -> { quan, adminHash, conns:Set, trongTu, ipCam:Set }

const ma = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const bam = (s) => crypto.createHash('sha256').update(s).digest('hex');
const anToan = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function diaChiLan() {
  const ds = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) ds.push(n.address);
  }
  return ds;
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function guiJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function docBody(req, max = 20_000) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > max) {
        reject(new Error('quá lớn'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && url.pathname === '/api/quan') {
      if (quanMap.size >= TOI_DA_QUAN) return guiJson(res, 503, { loi: 'Máy chủ đang đủ quán, thử lại sau.' });
      const body = JSON.parse((await docBody(req)) || '{}');
      const id = ma(6);
      const adminToken = ma(24);
      let quan;
      try {
        quan = new Quan({ id, ten: body.ten, menu: body.menu, taoMa: () => ma(9) });
      } catch (e) {
        return guiJson(res, 400, { loi: e.message });
      }
      quanMap.set(id, { quan, adminHash: bam(adminToken), conns: new Set(), trongTu: Date.now(), ipCam: new Set(), banDaGui: -1 });
      console.log(`[+] Mở quán ${id} "${quan.ten}"`);
      return guiJson(res, 200, { id, adminToken, muc: quan.muc });
    }
    if (req.method === 'GET' && url.pathname === '/api/info') {
      return guiJson(res, 200, { lan: diaChiLan(), port: PORT });
    }
    if (req.method !== 'GET') return guiJson(res, 405, { loi: 'Không hỗ trợ' });

    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (/^\/q\/[\w-]+$/.test(p)) p = '/quan.html'; // đường dẫn mời đẹp: /q/<id>
    // Thư viện three.js phục vụ thẳng từ node_modules (không phụ thuộc CDN)
    let goc = PUBLIC;
    if (p.startsWith('/vendor/three/addons/')) (goc = THREE_ADDONS), (p = p.slice('/vendor/three/addons'.length));
    else if (p.startsWith('/vendor/three/')) (goc = THREE_BUILD), (p = p.slice('/vendor/three'.length));
    const file = path.normalize(path.join(goc, p));
    if (!file.startsWith(goc + path.sep)) return guiJson(res, 403, { loi: 'Cấm' });
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Không tìm thấy');
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': goc === PUBLIC ? 'no-cache' : 'public, max-age=86400',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  } catch (e) {
    guiJson(res, 400, { loi: 'Yêu cầu không hợp lệ' });
  }
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

function gui(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function phatTrangThai(q) {
  const { quan } = q;
  if (q.banDaGui === quan.phienBan) return;
  q.banDaGui = quan.phienBan;
  const pub = JSON.stringify({ type: 'pub', s: quan.publicState() });
  let adminMsg = null;
  for (const ws of q.conns) {
    if (ws.readyState !== 1) continue;
    ws.send(pub);
    if (ws.vaiTro === 'chu') {
      adminMsg ??= JSON.stringify({ type: 'admin', s: quan.adminState() });
      ws.send(adminMsg);
    } else if (ws.pid) {
      const me = quan.privateState(ws.pid);
      if (me) gui(ws, { type: 'me', s: me });
    }
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const q = quanMap.get(url.searchParams.get('q') || '');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (!q || q.quan.dong) {
    gui(ws, { type: 'dong', msg: 'Quán không tồn tại hoặc đã đóng cửa.' });
    return ws.close();
  }
  ws.vaiTro = null;
  ws.pid = null;
  ws.dem = { t: Date.now(), n: 0 };
  ws.ip = ip;
  q.conns.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    // chống spam thô: tối đa 20 tin/giây mỗi kết nối
    const t = Date.now();
    if (t - ws.dem.t > 1000) ws.dem = { t, n: 0 };
    if (++ws.dem.n > 20) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const { quan } = q;
    if (quan.dong) return;

    if (m.type === 'hello') {
      if (m.vaiTro === 'chu') {
        if (typeof m.token !== 'string' || !anToan(bam(m.token), q.adminHash)) return gui(ws, { type: 'loi', msg: 'Đường dẫn quản lý không đúng.', fatal: true });
        ws.vaiTro = 'chu';
      } else if (m.vaiTro === 'live') {
        ws.vaiTro = 'live';
      } else {
        ws.vaiTro = 'khach';
        if (typeof m.token === 'string') {
          const pid = quan.resume(m.token);
          if (pid) {
            ws.pid = pid;
            gui(ws, { type: 'joined', id: pid, token: m.token });
          }
        }
      }
      q.banDaGui = -1;
      gui(ws, { type: 'pub', s: quan.publicState() });
      if (ws.vaiTro === 'chu') gui(ws, { type: 'admin', s: quan.adminState() });
      if (ws.pid) gui(ws, { type: 'me', s: quan.privateState(ws.pid) });
      return;
    }

    if (m.type === 'join' && ws.vaiTro === 'khach' && !ws.pid) {
      if (q.ipCam.has(ip)) return gui(ws, { type: 'loi', msg: 'Bạn đã bị chủ quán mời ra.' });
      const kq = quan.join(m.ten, m.ban);
      if (kq.loi) return gui(ws, { type: 'loi', msg: kq.loi });
      ws.pid = kq.id;
      gui(ws, { type: 'joined', id: kq.id, token: kq.token });
      return;
    }

    if (m.type === 'quen' && ws.pid) {
      const p = quan.players.get(ws.pid);
      if (!p || p.trangThai === 've') ws.pid = null; // chỉ "vào lại" sau khi đã về
      return;
    }

    if (m.type === 'act' && ws.pid && m.a && typeof m.a === 'object') {
      const kq = quan.act(ws.pid, m.a);
      if (kq.loi) gui(ws, { type: 'loi', msg: kq.loi });
      return;
    }

    if (m.type === 'admin' && ws.vaiTro === 'chu' && m.a && typeof m.a === 'object') {
      const kq = quan.adminAct(m.a);
      if (kq.loi) return gui(ws, { type: 'loi', msg: kq.loi });
      if (kq.moiRa) {
        for (const c of q.conns) {
          if (c.pid === kq.moiRa) {
            q.ipCam.add(c.ip);
            gui(c, { type: 'dong', msg: 'Chủ quán đã mời bạn ra khỏi quán.' });
            c.pid = null;
            c.close();
          }
        }
      }
      if (quan.dong) dongQuan(q.quan.id, 'Quán đã đóng cửa. Cảm ơn bà con!');
    }
  });

  ws.on('close', () => {
    q.conns.delete(ws);
    if (ws.pid) q.quan.disconnect(ws.pid);
  });
});

function dongQuan(id, msg) {
  const q = quanMap.get(id);
  if (!q) return;
  for (const ws of q.conns) {
    gui(ws, { type: 'dong', msg });
    ws.close();
  }
  quanMap.delete(id); // xóa toàn bộ trạng thái phiên
  console.log(`[-] Đóng quán ${id}`);
}

// Gửi trạng thái 8 lần/giây khi có thay đổi; đồng hồ luật chơi chạy mỗi 250ms.
setInterval(() => {
  for (const q of quanMap.values()) phatTrangThai(q);
}, 125);
setInterval(() => {
  const t = Date.now();
  for (const [id, q] of quanMap) {
    q.quan.tick();
    if (q.conns.size) q.trongTu = t;
    else if (t - q.trongTu > QUAN_TRONG_DONG_SAU) dongQuan(id, 'Quán vắng quá lâu, đã đóng.');
  }
}, 250);
// Đếm ngược trên màn hình cần cập nhật đều đặn dù không có hành động nào.
setInterval(() => {
  for (const q of quanMap.values()) if (q.conns.size) q.quan._doi();
}, 1000);
// Phát hiện kết nối chết
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 20_000);

server.listen(PORT, HOST, () => {
  console.log(`\n🍻 Đi nhậu online đang chạy:`);
  console.log(`   http://localhost:${PORT}`);
  for (const ip of diaChiLan()) console.log(`   http://${ip}:${PORT}   (máy khác cùng mạng Wi-Fi)`);
  console.log('');
});

module.exports = { server, quanMap };
