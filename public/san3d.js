// Cảnh 3D quán nhậu vỉa hè (three.js). Nhận trạng thái từ quan.js qua window.San3D.capNhat(pub, ctx).
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Gộp các khối tĩnh cùng vật liệu trong một nhóm thành một mesh để giảm lệnh vẽ.
// `giu(o)` = true thì giữ nguyên o (và cả cây con của nó) để còn chuyển động/ẩn hiện.
function gopLai(nhom, giu = () => false) {
  nhom.updateMatrixWorld(true);
  const inv = nhom.matrixWorld.clone().invert();
  const theoVl = new Map();
  nhom.traverse((c) => {
    if (!c.isMesh || c.isInstancedMesh || c === nhom) return;
    for (let p = c; p && p !== nhom; p = p.parent) if (giu(p)) return;
    const geo = c.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
    if (!theoVl.has(c.material)) theoVl.set(c.material, { geos: [], goc: [], ud: c.userData, bong: false });
    const e = theoVl.get(c.material);
    e.geos.push(geo);
    e.goc.push(c);
    e.bong ||= c.castShadow;
  });
  for (const [vl, { geos, goc, ud, bong }] of theoVl) {
    if (goc.length < 2) continue; // một khối thì để nguyên
    const gop = mergeGeometries(geos);
    if (!gop) continue; // không gộp được thì giữ bản gốc
    const m = new THREE.Mesh(gop, vl);
    m.castShadow = bong;
    m.receiveShadow = true;
    m.userData = { ...ud };
    nhom.add(m);
    for (const c of goc) c.parent?.remove(c);
  }
}

const W = 1280;
const H = 720;
const DIEN_THOAI = matchMedia('(pointer: coarse)').matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ---------- renderer ----------
const host = document.getElementById('s-3d');
const renderer = new THREE.WebGLRenderer({ antialias: !DIEN_THOAI, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = !DIEN_THOAI;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
host.appendChild(renderer.domElement);
const lopNhan = new CSS2DRenderer();
lopNhan.setSize(W, H);
lopNhan.domElement.className = 'lop-nhan';
host.appendChild(lopNhan.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#121833');
scene.fog = new THREE.Fog('#121833', 40, 75);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
const CAM_TOAN = { pos: V(2, 11, 19.5), look: V(2, 0, -0.8) };
const CO_NV = 1.25; // phóng to nhân vật kiểu chibi
const camHt = { pos: CAM_TOAN.pos.clone(), look: CAM_TOAN.look.clone() };
camera.position.copy(camHt.pos);
camera.lookAt(camHt.look);

// ---------- ánh sáng ----------
scene.add(new THREE.HemisphereLight('#a9b8ff', '#5a4330', 1.5));
const trang = new THREE.DirectionalLight('#ffe6c4', 1.5);
trang.position.set(-10, 20, 12);
trang.castShadow = !DIEN_THOAI;
trang.shadow.mapSize.set(2048, 2048);
Object.assign(trang.shadow.camera, { left: -26, right: 26, top: 22, bottom: -14, near: 1, far: 60 });
scene.add(trang);
for (const x of [-9, 2, 13]) {
  const d = new THREE.PointLight('#ffb35c', 40, 16, 1.6);
  d.position.set(x, 4.2, -8.5);
  scene.add(d);
}

// ---------- vật liệu & hình khối dùng chung ----------
const _vl = new Map();
function VL(mau, them = {}) {
  const k = mau + JSON.stringify(them);
  if (!_vl.has(k)) _vl.set(k, new THREE.MeshLambertMaterial({ color: mau, ...them }));
  return _vl.get(k);
}
const PHAT = (mau, cuong = 1) => VL(mau, { emissive: mau, emissiveIntensity: cuong });
function khoi(geo, vl, x = 0, y = 0, z = 0, bong = true) {
  const m = new THREE.Mesh(geo, vl);
  m.position.set(x, y, z);
  m.castShadow = bong;
  m.receiveShadow = true;
  return m;
}
const G = {
  hop: new THREE.BoxGeometry(1, 1, 1),
  cau: new THREE.SphereGeometry(1, 20, 14),
  cauThap: new THREE.SphereGeometry(1, 10, 8),
  tru: new THREE.CylinderGeometry(1, 1, 1, 18),
  truThap: new THREE.CylinderGeometry(1, 1, 1, 10),
  dau: new THREE.SphereGeometry(0.42, 24, 18),
  toc: new THREE.SphereGeometry(0.44, 24, 12, 0, 2 * PI, 0, PI * 0.45),
  mu: new THREE.SphereGeometry(0.47, 24, 12, 0, 2 * PI, 0, PI * 0.5),
  muBH: new THREE.SphereGeometry(0.53, 24, 12, 0, 2 * PI, 0, PI * 0.55),
  than: new THREE.CylinderGeometry(0.3, 0.37, 0.62, 20),
  tay: new THREE.CapsuleGeometry(0.085, 0.2, 4, 10),
  chan: new THREE.CapsuleGeometry(0.11, 0.26, 4, 10),
  hoi: new THREE.TorusGeometry(0.38, 0.07, 8, 24),
  banhXe: new THREE.TorusGeometry(0.26, 0.08, 8, 20),
};
function texCanvas(w, h, ve, lap) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  ve(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (lap) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...lap);
  }
  return t;
}

// ---------- hoa văn áo ----------
const _ao = new Map();
function vlAo(kieu, a, b) {
  const k = kieu + a + b;
  if (_ao.has(k)) return _ao.get(k);
  const t = texCanvas(256, 128, (g, w, h) => {
    g.fillStyle = kieu === 'đội tuyển' ? '#d8221a' : a;
    g.fillRect(0, 0, w, h);
    if (kieu === 'kẻ') {
      g.fillStyle = b;
      for (let y = 0; y < h; y += 22) g.fillRect(0, y, w, 9);
    } else if (kieu === 'caro') {
      g.globalAlpha = 0.55;
      g.fillStyle = b;
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
      for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 14);
      g.globalAlpha = 0.35;
      g.fillStyle = '#000';
      for (let x = 6; x < w; x += 32) g.fillRect(x, 0, 2, h);
    } else if (kieu === 'hoa') {
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        g.fillStyle = i % 3 ? b : '#ffffff';
        for (let c = 0; c < 5; c++) {
          g.beginPath();
          g.arc(x + Math.cos((c * 2 * PI) / 5) * 6, y + Math.sin((c * 2 * PI) / 5) * 6, 5, 0, 2 * PI);
          g.fill();
        }
        g.fillStyle = '#ffd54f';
        g.beginPath();
        g.arc(x, y, 3, 0, 2 * PI);
        g.fill();
      }
    } else if (kieu === 'đội tuyển') {
      // ngôi sao vàng ở giữa (u = 0.5 là mặt trước sau khi xoay thân)
      g.fillStyle = '#ffde00';
      g.beginPath();
      const cx = w / 2;
      const cy = h * 0.42;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 9 : 22;
        const goc = -PI / 2 + (i * PI) / 5;
        g.lineTo(cx + Math.cos(goc) * r, cy + Math.sin(goc) * r);
      }
      g.fill();
    }
  });
  const m = new THREE.MeshLambertMaterial({ map: t });
  _ao.set(k, m);
  return m;
}

// ---------- nhân vật ----------
const DONG_PHUC = {
  danPhong: { da: '#e0a87e', toc: '#1b1612', kieuToc: 'đinh', ao: '#5f6e33', ao2: '#5f6e33', kieuAo: 'trơn', quan: '#4b5729', mu: 'kêpi', muMau: '#4b5729', beo: 1, bang: '#d32f2f' },
  csgt: { da: '#eec19a', toc: '#1b1612', kieuToc: 'đinh', ao: '#e8d27c', ao2: '#e8d27c', kieuAo: 'trơn', quan: '#2e4a2e', mu: 'kêpi', muMau: '#f5f5f5', beo: 1, gay: true },
  chuQuan: { da: '#e0a87e', toc: '#2b1d14', kieuToc: 'dài', ao: '#7e57c2', ao2: '#ffffff', kieuAo: 'hoa', quan: '#37474f', mu: null, beo: 1.15 },
  xeOm: { da: '#c98b62', toc: '#1b1612', kieuToc: 'đinh', ao: '#2e7d32', ao2: '#2e7d32', kieuAo: 'trơn', quan: '#263238', mu: 'bảo hiểm', muMau: '#2e7d32', beo: 1 },
  nhanVien: { da: '#eec19a', toc: '#1b1612', kieuToc: 'đinh', ao: '#1565c0', ao2: '#ffffff', kieuAo: 'kẻ', quan: '#263238', mu: 'lưỡi trai', muMau: '#c62828', beo: 1.05 },
  nhanVien2: { da: '#c98b62', toc: '#3d2a1c', kieuToc: 'xoăn', ao: '#f5f5f5', ao2: '#f5f5f5', kieuAo: 'ba lỗ', quan: '#5d4037', mu: null, beo: 1.2, rau: true },
};

function taoNguoi(h, { dung = false } = {}) {
  const g = new THREE.Group();
  const da = VL(h.da);
  const ao = h.kieuAo === 'ba lỗ' ? VL(h.ao === '#212121' ? '#f5f5f5' : h.ao) : vlAo(h.kieuAo, h.ao, h.ao2);
  const tayAo = h.kieuAo === 'ba lỗ' ? da : h.kieuAo === 'đội tuyển' ? VL('#d8221a') : VL(h.ao);
  const quan = VL(h.quan);
  const beo = h.beo || 1;
  const goc = new THREE.Group(); // gốc để lắc lư cả người
  g.add(goc);
  const yThan = dung ? 0.98 : 0.38;

  // chân
  const chan = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    if (dung) {
      c.position.set(0.14 * s, 0.68, 0);
      c.add(khoi(G.chan, quan, 0, -0.18, 0));
      const ong = khoi(G.chan, da, 0, -0.45, 0);
      ong.scale.set(0.8, 0.7, 0.8);
      c.add(ong);
      const dep = khoi(G.hop, VL('#3e2723'), 0, -0.64, 0.05);
      dep.scale.set(0.16, 0.06, 0.3);
      c.add(dep);
    } else {
      c.position.set(0.14 * s, 0.08, 0.05);
      const dui = khoi(G.chan, quan, 0, 0, 0.2);
      dui.rotation.x = PI / 2;
      c.add(dui);
      const ong = khoi(G.chan, da, 0, -0.2, 0.42);
      ong.scale.set(0.8, 0.75, 0.8);
      c.add(ong);
      const dep = khoi(G.hop, VL('#3e2723'), 0, -0.38, 0.5);
      dep.scale.set(0.16, 0.06, 0.3);
      c.add(dep);
    }
    goc.add(c);
    chan.push(c);
  }

  // thân (xoay 180° để mặt trước của hoa văn quay ra trước)
  const than = khoi(G.than, ao, 0, yThan, 0);
  than.rotation.y = PI;
  than.scale.set(beo, 1, beo);
  goc.add(than);
  if (beo > 1.05) {
    const bung = khoi(G.cau, ao, 0, yThan - 0.08, 0.1 * beo);
    bung.scale.set(0.3 * beo, 0.28, 0.26 * beo);
    goc.add(bung);
  }
  if (h.bang) {
    // băng đỏ dân phòng trên tay áo
    const b = khoi(G.tru, VL(h.bang), 0.4, yThan + 0.12, 0);
    b.scale.set(0.1, 0.08, 0.1);
    goc.add(b);
  }

  // tay: nhóm xoay ở vai
  const tay = [];
  for (const s of [-1, 1]) {
    const vai = new THREE.Group();
    vai.position.set(0.37 * beo * s, yThan + 0.22, 0);
    const tren = khoi(G.tay, tayAo, 0, -0.14, 0);
    vai.add(tren);
    const duoi = khoi(G.tay, da, 0, -0.36, 0);
    duoi.scale.set(0.9, 0.9, 0.9);
    vai.add(duoi);
    const ban = khoi(G.cau, da, 0, -0.52, 0);
    ban.scale.setScalar(0.085);
    vai.add(ban);
    vai.rotation.x = dung ? 0 : -0.9;
    vai.rotation.z = 0.12 * s;
    goc.add(vai);
    tay.push(vai);
  }
  if (h.gay) {
    // gậy chỉ huy giao thông
    const gay = khoi(G.tru, VL('#ffffff'), 0, -0.7, 0.05);
    gay.scale.set(0.035, 0.45, 0.035);
    tay[1].add(gay);
    const soc = khoi(G.tru, VL('#e53935'), 0, -0.82, 0.05);
    soc.scale.set(0.037, 0.1, 0.037);
    tay[1].add(soc);
  }
  // cốc cầm tay (hiện khi nâng cốc)
  const coc = khoi(G.tru, VL('#f2b632', { transparent: true, opacity: 0.92 }), 0, -0.6, 0.08, false);
  coc.scale.set(0.07, 0.16, 0.07);
  coc.visible = false;
  tay[1].add(coc);

  // đầu
  const dau = new THREE.Group();
  dau.position.set(0, yThan + 0.72, 0);
  goc.add(dau);
  dau.add(khoi(G.dau, da));
  const den = VL('#1a1a1a');
  for (const s of [-1, 1]) {
    const mat = khoi(G.cau, den, 0.14 * s, 0.03, 0.38, false);
    mat.scale.set(0.05, 0.065, 0.04);
    dau.add(mat);
    const sang = khoi(G.cauThap, VL('#ffffff'), 0.14 * s + 0.015, 0.05, 0.415, false);
    sang.scale.setScalar(0.015);
    dau.add(sang);
  }
  const mui = khoi(G.cau, da, 0, -0.05, 0.41, false);
  mui.scale.set(0.05, 0.04, 0.04);
  dau.add(mui);
  const mieng = khoi(G.hop, VL('#6d2b22'), 0, -0.16, 0.385, false);
  mieng.scale.set(0.12, 0.025, 0.02);
  dau.add(mieng);
  const ma = [];
  for (const s of [-1, 1]) {
    const m = khoi(G.cau, VL('#ff6b6b', { transparent: true, opacity: 0.75 }), 0.22 * s, -0.08, 0.32, false);
    m.scale.set(0.08, 0.05, 0.03);
    m.visible = false;
    dau.add(m);
    ma.push(m);
  }
  if (h.rau) {
    const r = khoi(G.hop, VL(h.toc), 0, -0.1, 0.405, false);
    r.scale.set(0.2, 0.04, 0.03);
    dau.add(r);
  }
  if (h.kinh) {
    for (const s of [-1, 1]) {
      const k = khoi(G.hop, VL('#111111'), 0.14 * s, 0.04, 0.42, false);
      k.scale.set(0.16, 0.1, 0.02);
      dau.add(k);
    }
    const cau = khoi(G.hop, VL('#111111'), 0, 0.06, 0.42, false);
    cau.scale.set(0.1, 0.02, 0.02);
    dau.add(cau);
  }
  // tóc
  const toc = VL(h.toc);
  if (h.kieuToc === 'hói') {
    const v = khoi(G.hoi, toc, 0, -0.02, -0.04);
    v.rotation.x = PI / 2;
    dau.add(v);
  } else if (h.kieuToc === 'xoăn') {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 2 * PI;
      const c = khoi(G.cauThap, toc, Math.cos(a) * 0.3, 0.26 + (i % 2) * 0.06, Math.sin(a) * 0.3 - 0.04);
      c.scale.setScalar(0.15);
      dau.add(c);
    }
    const dinh = khoi(G.cauThap, toc, 0, 0.36, -0.04);
    dinh.scale.setScalar(0.2);
    dau.add(dinh);
  } else {
    const t = khoi(G.toc, toc, 0, 0, -0.02);
    t.rotation.x = -0.35;
    dau.add(t);
    if (h.kieuToc === 'mái') {
      const m = khoi(G.hop, toc, 0, 0.24, 0.3);
      m.scale.set(0.5, 0.1, 0.14);
      m.rotation.x = 0.4;
      dau.add(m);
    }
    if (h.kieuToc === 'dài') {
      const d = khoi(G.cau, toc, 0, -0.18, -0.18);
      d.scale.set(0.42, 0.42, 0.3);
      dau.add(d);
    }
  }
  // mũ
  if (h.mu === 'lưỡi trai') {
    const m = khoi(G.mu, VL(h.muMau), 0, 0.03, 0);
    m.rotation.x = -0.15;
    dau.add(m);
    const vanh = khoi(G.hop, VL(h.muMau), 0, 0.1, 0.45);
    vanh.scale.set(0.42, 0.03, 0.3);
    dau.add(vanh);
  } else if (h.mu === 'bảo hiểm') {
    const m = khoi(G.muBH, VL(h.muMau), 0, -0.02, -0.02);
    dau.add(m);
    const kinh = khoi(G.hop, VL('#90a4ae', { transparent: true, opacity: 0.6 }), 0, 0.2, 0.47, false);
    kinh.scale.set(0.5, 0.08, 0.05);
    dau.add(kinh);
  } else if (h.mu === 'kêpi') {
    const m = khoi(G.tru, VL(h.muMau), 0, 0.33, 0);
    m.scale.set(0.46, 0.18, 0.5);
    dau.add(m);
    const vanh = khoi(G.hop, VL('#212121'), 0, 0.25, 0.42);
    vanh.scale.set(0.4, 0.03, 0.22);
    dau.add(vanh);
    const huy = khoi(G.cauThap, PHAT('#ffd54f', 0.6), 0, 0.36, 0.47, false);
    huy.scale.setScalar(0.06);
    dau.add(huy);
  }
  // gộp khối tĩnh: chỉ giữ riêng tay (vung/nâng cốc), đầu (lắc), má (ẩn hiện), chân khi đi bộ
  const dong = new Set([...tay, dau, coc, ...ma, ...(dung ? chan : [])]);
  gopLai(goc, (o) => dong.has(o));
  tay.forEach((v) => gopLai(v, (o) => o === coc));
  gopLai(dau, (o) => ma.includes(o));
  if (dung) chan.forEach((c) => gopLai(c));
  return { g, goc, dau, tay, chan, coc, ma, dung };
}

// ---------- xe máy ----------
function taoXe(mau) {
  const g = new THREE.Group();
  const vl = VL(mau);
  const th = khoi(G.hop, vl, 0, 0.55, 0);
  th.scale.set(1.2, 0.32, 0.36);
  g.add(th);
  const yen = khoi(G.hop, VL('#212121'), -0.15, 0.76, 0);
  yen.scale.set(0.7, 0.12, 0.34);
  g.add(yen);
  const dau = khoi(G.hop, vl, 0.62, 0.85, 0);
  dau.scale.set(0.2, 0.5, 0.42);
  g.add(dau);
  const den = khoi(G.cau, PHAT('#fff6c0', 1.5), 0.74, 0.95, 0, false);
  den.scale.set(0.05, 0.08, 0.1);
  g.add(den);
  const ghiDong = khoi(G.tru, VL('#9e9e9e'), 0.6, 1.12, 0);
  ghiDong.scale.set(0.03, 0.7, 0.03);
  ghiDong.rotation.x = PI / 2;
  g.add(ghiDong);
  for (const x of [-0.55, 0.62]) g.add(khoi(G.banhXe, VL('#1b1b1b'), x, 0.3, 0));
  return g;
}

// ---------- môi trường ----------
let bienQuan;
function veBien(ten) {
  return texCanvas(1024, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#d32f2f');
    gr.addColorStop(1, '#8e1c16');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd54f';
    g.lineWidth = 10;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffe27a';
    g.textAlign = 'center';
    g.font = 'bold 74px "Segoe UI", system-ui, sans-serif';
    g.fillText('BIA HƠI', w / 2, 88);
    g.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(String(ten || '').toUpperCase().slice(0, 28), w / 2, 156);
  });
}

function moiTruong() {
  const gach = texCanvas(256, 256, (g, w) => {
    g.fillStyle = '#8d857a';
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * w, 3, 3);
    }
    g.strokeStyle = '#6f685e';
    g.lineWidth = 5;
    for (let i = 0; i <= w; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
  }, [35, 10]);
  const via = khoi(new THREE.PlaneGeometry(80, 20), new THREE.MeshLambertMaterial({ map: gach }), 2, 0, -3, false);
  via.rotation.x = -PI / 2;
  scene.add(via);
  const bo = khoi(G.hop, VL('#c9c2b6'), 2, 0.12, 7.1);
  bo.scale.set(80, 0.25, 0.4);
  scene.add(bo);
  const duong = khoi(new THREE.PlaneGeometry(80, 16), VL('#4a4c55'), 2, -0.02, 15.2, false);
  duong.rotation.x = -PI / 2;
  scene.add(duong);
  for (let x = -38; x < 42; x += 4) {
    const v = khoi(G.hop, VL('#e8e8e8'), x, 0.0, 10.6, false);
    v.scale.set(2.2, 0.02, 0.18);
    scene.add(v);
  }

  // dãy nhà ống
  const MAU_NHA = ['#e8c07a', '#c5e1a5', '#90caf9', '#f8bbd0', '#ffe082', '#bcaaa4', '#b2dfdb', '#ffccbc'];
  // quán ở giữa (x 2), nhà ống hai bên
  const dsNha = [{ cx: 2, rong: 10, laQuan: true }];
  for (let x = -3, k = 0; x > -40; k++) {
    const r = 4 + ((k * 7) % 3) * 0.6;
    dsNha.push({ cx: x - r / 2, rong: r });
    x -= r;
  }
  for (let x = 7, k = 1; x < 44; k++) {
    const r = 4 + ((k * 5) % 3) * 0.6;
    dsNha.push({ cx: x + r / 2, rong: r });
    x += r;
  }
  dsNha.forEach(({ cx, rong, laQuan }, i) => {
    const cao = laQuan ? 9 : 8 + ((i * 5) % 4) * 1.4;
    const nha = khoi(G.hop, VL(laQuan ? '#f3e2c0' : MAU_NHA[i % MAU_NHA.length]), cx, cao / 2, -15.2);
    nha.scale.set(rong - 0.08, cao, 4);
    scene.add(nha);
    // tầng trệt: cửa hàng tối hoặc cửa cuốn
    const tret = khoi(G.hop, laQuan ? PHAT('#fff1c9', 0.55) : VL(i % 2 ? '#3a3a3a' : '#9e9e9e'), cx, 1.6, -13.17, false);
    tret.scale.set(rong - 0.8, 3.1, 0.05);
    scene.add(tret);
    // cửa sổ các tầng
    for (let y = 4.6; y < cao - 1; y += 2.6) {
      for (const dx of rong > 5 ? [-2.5, 0, 2.5] : [-0.9, 0.9]) {
        const sang = Math.random() < 0.55;
        const cs = khoi(G.hop, sang ? PHAT('#ffcf6e', 0.8) : VL('#2b3550'), cx + dx, y, -13.17, false);
        cs.scale.set(1.1, 1.3, 0.05);
        scene.add(cs);
      }
      const banCong = khoi(G.hop, VL('#5d4037'), cx, y - 0.85, -12.9);
      banCong.scale.set(rong - 0.6, 0.12, 0.6);
      scene.add(banCong);
    }
    // mái bạt
    const bat = khoi(G.hop, laQuan ? VL('#1565c0') : VL(['#c62828', '#2e7d32', '#ef6c00', '#6a1b9a'][i % 4]), cx, 3.35, laQuan ? -11.4 : -12.4);
    bat.scale.set(rong - 0.3, 0.08, laQuan ? 3.6 : 1.6);
    bat.rotation.x = 0.18;
    scene.add(bat);
    if (laQuan) {
      bienQuan = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 1.76), new THREE.MeshBasicMaterial({ map: veBien('') }));
      bienQuan.position.set(cx, 4.5, -13.1);
      scene.add(bienQuan);
      // tủ lạnh, két bia, thùng đá, bếp than
      const tu = khoi(G.hop, VL('#eceff1'), cx + 3.6, 1.1, -12.6);
      tu.scale.set(1.2, 2.2, 0.8);
      scene.add(tu);
      const kinh = khoi(G.hop, PHAT('#b3e5fc', 0.6), cx + 3.6, 1.2, -12.19, false);
      kinh.scale.set(0.9, 1.6, 0.02);
      scene.add(kinh);
      for (let k = 0; k < 6; k++) {
        const ket = khoi(G.hop, VL(k % 2 ? '#fbc02d' : '#2e7d32'), cx - 4 + (k % 2) * 0.75, 0.3 + Math.floor(k / 2) * 0.55, -11.8);
        ket.scale.set(0.7, 0.5, 0.5);
        scene.add(ket);
      }
      const da = khoi(G.hop, VL('#1e88e5'), cx + 1.6, 0.4, -11.9);
      da.scale.set(1.1, 0.8, 0.7);
      scene.add(da);
      const nap = khoi(G.hop, VL('#ffffff'), cx + 1.6, 0.83, -11.9);
      nap.scale.set(1.15, 0.08, 0.75);
      scene.add(nap);
      const bep = khoi(G.tru, VL('#424242'), cx - 2, 0.45, -10.8);
      bep.scale.set(0.45, 0.9, 0.45);
      scene.add(bep);
      const than = khoi(G.tru, PHAT('#ff6d00', 1.6), cx - 2, 0.92, -10.8, false);
      than.scale.set(0.4, 0.05, 0.4);
      scene.add(than);
      khoiBep.push(V(cx - 2, 1, -10.8));
    }
  });

  // cột đèn ở mép vỉa hè (hai bên, không che giữa khung hình)
  for (const cx of [-15, 19]) {
    const cot = khoi(G.tru, VL('#455a64'), cx, 3, 6.7);
    cot.scale.set(0.09, 6, 0.09);
    scene.add(cot);
    const canh = khoi(G.hop, VL('#455a64'), cx, 5.9, 6.1);
    canh.scale.set(0.1, 0.1, 1.2);
    scene.add(canh);
    const bong = khoi(G.cau, PHAT('#fff2c4', 2), cx, 5.75, 5.5, false);
    bong.scale.set(0.3, 0.12, 0.3);
    scene.add(bong);
    const d = new THREE.PointLight('#ffe0a3', 30, 14, 1.6);
    d.position.set(cx, 5.4, 5.4);
    scene.add(d);
  }

  // dây bóng đèn từ mái bạt ra cột
  const bongDen = [];
  for (const cx of [-15, 19]) {
    const a = V(cx, 3.2, -9.6);
    const b = V(cx, 5.6, 6.6);
    for (let t = 0; t <= 1.0001; t += 1 / 20) {
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * PI) * 1.0;
      bongDen.push(p);
    }
    // dây ngang song song mặt nhà
  }
  for (let xx = -24; xx <= 28; xx += 1.1) {
    const t = ((xx + 24) % 8.8) / 8.8;
    bongDen.push(V(xx, 3.3 - Math.sin(t * PI) * 0.4, -9.4));
  }
  const MAU_BONG = ['#ffd54f', '#ff8a65', '#81c784', '#64b5f6', '#fff59d', '#f06292'];
  const im = new THREE.InstancedMesh(G.cauThap, new THREE.MeshBasicMaterial({ color: '#ffffff' }), bongDen.length);
  const m4 = new THREE.Matrix4();
  bongDen.forEach((p, k) => {
    m4.makeScale(0.09, 0.11, 0.09).setPosition(p);
    im.setMatrixAt(k, m4);
    im.setColorAt(k, new THREE.Color(MAU_BONG[k % MAU_BONG.length]));
  });
  scene.add(im);

  // xe máy đỗ dọc vỉa hè, cây
  const MAU_XE = ['#c62828', '#1565c0', '#424242', '#f5f5f5', '#6a1b9a', '#2e7d32'];
  [-22, -19.8, -17.6, 13.5, 15.7, 23, 25.2].forEach((cx, k) => {
    const xe = taoXe(MAU_XE[k % MAU_XE.length]);
    xe.position.set(cx, 0, 5.4);
    xe.rotation.y = PI / 2 - 0.25;
    scene.add(xe);
  });
  for (const cx of [-27, 30]) {
    const goc = khoi(G.tru, VL('#5d4037'), cx, 1.6, 5.8);
    goc.scale.set(0.25, 3.2, 0.25);
    scene.add(goc);
    for (const [dx, dy, r] of [[0, 3.8, 1.6], [0.9, 3.3, 1.1], [-0.9, 3.4, 1.2]]) {
      const la = khoi(G.cauThap, VL('#2e7d32'), cx + dx, dy, 5.8);
      la.scale.setScalar(r);
      scene.add(la);
    }
  }
}
const khoiBep = [];
moiTruong();
{
  // gộp toàn bộ bối cảnh tĩnh (trừ biển quán vì đổi chữ theo tên quán)
  const mt = new THREE.Group();
  for (const c of [...scene.children]) if ((c.isMesh && !c.isInstancedMesh && c !== bienQuan) || (c.isGroup && !c.isLight)) mt.add(c);
  scene.add(mt);
  gopLai(mt);
}

// khói bếp than
const khoi3d = [];
for (const p of khoiBep) {
  for (let k = 0; k < 8; k++) {
    const m = new THREE.Mesh(G.cauThap, new THREE.MeshBasicMaterial({ color: '#cfd8dc', transparent: true, opacity: 0.35, depthWrite: false }));
    m.userData = { goc: p, pha: k / 8 };
    scene.add(m);
    khoi3d.push(m);
  }
}

// ---------- bàn ----------
const VI_TRI_GHE = [V(-1.2, 0, 0), V(1.2, 0, 0), V(0, 0, -1.2), V(0, 0, 1.2)];
function viTriBan(so) {
  const i = so - 1;
  // bàn 1–5 là hàng gần camera nhất, bàn 16–20 sát mặt quán
  return V(((i % 5) - 2) * 4.6 + 2, 0, 3.9 - Math.floor(i / 5) * 3.7);
}
const bans = [];
function taoBan(so) {
  const g = new THREE.Group();
  g.position.copy(viTriBan(so));
  const vlMat = new THREE.MeshLambertMaterial({ color: '#2f6fd6', emissive: '#000000' });
  const mat = khoi(G.hop, vlMat, 0, 0.62, 0);
  mat.scale.set(1.55, 0.08, 1.55);
  mat.userData.ban = so;
  g.add(mat);
  for (const [dx, dz] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) {
    const c = khoi(G.tru, VL('#2a5fb8'), dx, 0.3, dz);
    c.scale.set(0.05, 0.6, 0.05);
    c.userData.ban = so;
    g.add(c);
  }
  for (const p of VI_TRI_GHE) {
    const ghe = khoi(G.tru, VL('#e53935'), p.x, 0.2, p.z);
    ghe.scale.set(0.3, 0.4, 0.3);
    ghe.userData.ban = so;
    g.add(ghe);
  }
  gopLai(g); // chân bàn + ghế gộp lại (mặt bàn có vật liệu riêng nên giữ nguyên)
  const mon = new THREE.Group();
  mon.position.y = 0.66;
  g.add(mon);
  const nhan = document.createElement('div');
  nhan.className = 'nhan-ban';
  nhan.textContent = 'Bàn ' + so;
  const o = new CSS2DObject(nhan);
  o.position.set(0, 0.05, 1.85);
  g.add(o);
  const no = document.createElement('div');
  no.className = 'no-3d';
  no.innerHTML = '<div class="no-icon">💥</div><div class="no-dem"></div>';
  const oNo = new CSS2DObject(no);
  oNo.position.set(0, 2.6, 0);
  oNo.visible = false;
  g.add(oNo);
  scene.add(g);
  return { g, vlMat, mon, monKey: '', oNo, no, nhan };
}
for (let so = 1; so <= 20; so++) bans.push(taoBan(so));

// ---------- món trên bàn ----------
const VL_BIA = VL('#f2b632', { transparent: true, opacity: 0.9 });
const VL_BOT = VL('#fffdf3');
const VL_DIA = VL('#fafafa');
function taoMon(m) {
  const g = new THREE.Group();
  const e = m.e || '';
  if (m.l === 'bia') {
    if (e.includes('🍻') || e.includes('🍾')) {
      const chai = khoi(G.tru, VL('#2e7d32', { transparent: true, opacity: 0.9 }), 0, 0.13, 0);
      chai.scale.set(0.06, 0.26, 0.06);
      const co = khoi(G.tru, VL('#2e7d32'), 0, 0.31, 0);
      co.scale.set(0.025, 0.1, 0.025);
      g.add(chai, co);
    } else {
      const coc = khoi(G.tru, VL_BIA, 0, 0.09, 0);
      coc.scale.set(0.075, 0.18, 0.075);
      const bot = khoi(G.tru, VL_BOT, 0, 0.19, 0, false);
      bot.scale.set(0.078, 0.04, 0.078);
      g.add(coc, bot);
    }
  } else if (m.l === 'ruou') {
    const chen = khoi(G.tru, VL('#e0f7fa', { transparent: true, opacity: 0.7 }), 0, 0.04, 0);
    chen.scale.set(0.045, 0.08, 0.045);
    g.add(chen);
  } else if (m.l === 'nuoc') {
    if (e.includes('🥤')) {
      const lon = khoi(G.tru, VL('#d32f2f'), 0, 0.08, 0);
      lon.scale.set(0.05, 0.16, 0.05);
      g.add(lon);
    } else {
      const coc = khoi(G.tru, VL('#b5803a', { transparent: true, opacity: 0.85 }), 0, 0.07, 0);
      coc.scale.set(0.06, 0.14, 0.06);
      g.add(coc);
    }
  } else if (m.to) {
    // nồi lẩu + bếp ga mini + khói
    const bep = khoi(G.tru, VL('#37474f'), 0, 0.04, 0);
    bep.scale.set(0.3, 0.08, 0.3);
    const noi = khoi(G.tru, VL('#b0bec5'), 0, 0.17, 0);
    noi.scale.set(0.3, 0.18, 0.3);
    const nuoc = khoi(G.tru, PHAT('#e65100', 0.35), 0, 0.26, 0, false);
    nuoc.scale.set(0.27, 0.01, 0.27);
    g.add(bep, noi, nuoc);
    g.userData.lau = true;
  } else {
    const dia = khoi(G.tru, VL_DIA, 0, 0.015, 0);
    dia.scale.set(0.18, 0.03, 0.18);
    g.add(dia);
    const mau = e.includes('🥜') ? '#a1662f' : e.includes('🐌') ? '#4e342e' : e.includes('🍗') ? '#bf6a2a' : e.includes('🍢') ? '#8d4a2b' : e.includes('🥢') ? '#ef8a3c' : '#c0843f';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 2 * PI;
      const c = khoi(G.cauThap, VL(mau), Math.cos(a) * 0.08, 0.05, Math.sin(a) * 0.08, false);
      c.scale.set(0.05, 0.035, e.includes('🍢') || e.includes('🥢') ? 0.09 : 0.05);
      c.rotation.y = a;
      g.add(c);
    }
  }
  return g;
}
const O_MON = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) O_MON.push([-0.54 + c * 0.36, -0.54 + r * 0.36]);
function veMon(b, ds) {
  const key = ds.map((m) => m.e + m.l + (m.to ? 1 : 0)).join('|');
  if (key === b.monKey) return;
  b.monKey = key;
  b.mon.clear();
  const lau = ds.filter((m) => m.to).slice(0, 1);
  const khac = ds.filter((m) => !m.to);
  let cho = O_MON.map((o, k) => ({ o, k }));
  if (lau.length) {
    const g = taoMon(lau[0]);
    b.mon.add(g);
    cho = cho.filter(({ o }) => Math.abs(o[0]) > 0.3 || Math.abs(o[1]) > 0.3);
  }
  khac.slice(-cho.length).forEach((m, k) => {
    const g = taoMon(m);
    const [x, z] = cho[k].o;
    g.position.set(x + (Math.random() - 0.5) * 0.05, 0, z + (Math.random() - 0.5) * 0.05);
    b.mon.add(g);
  });
  gopLai(b.mon);
}

// Gỡ một vật khỏi cảnh. Biển tên/bong bóng (CSS2DObject) là phần tử HTML riêng,
// three.js không tự xóa khi gỡ nhóm cha, nên phải xóa tay để khỏi để lại biển tên "ma".
function goKhoiCanh(obj) {
  obj.traverse((o) => o.element?.remove());
  obj.parent?.remove(obj);
}

// ---------- khách ----------
const khach = new Map(); // pid -> { nv, o, nhan, bong, ban, ghe, muc: Vector3, pha, sinh, xoa }
const gheCua = new Map(); // `${ban}` -> [pid|null ×4] giữ chỗ ổn định
function xepGhe(so, ids) {
  let ghe = gheCua.get(so) || [null, null, null, null];
  ghe = ghe.map((id) => (id && ids.includes(id) ? id : null));
  for (const id of ids) {
    if (ghe.includes(id)) continue;
    const k = ghe.indexOf(null);
    if (k >= 0) ghe[k] = id;
  }
  gheCua.set(so, ghe);
  return ghe;
}
function taoKhach(k) {
  const nv = taoNguoi(k.hinh || DONG_PHUC.chuQuan);
  nv.g.traverse((o) => (o.userData.pid = k.id));
  const div = document.createElement('div');
  div.className = 'nhan-nguoi';
  div.innerHTML = '<div class="bong-3d"></div><div class="ten-3d"></div>';
  div.querySelector('.ten-3d').textContent = k.ten;
  const o = new CSS2DObject(div);
  o.position.set(0, 1.85, 0);
  nv.g.add(o);
  scene.add(nv.g);
  return { nv, o, div, bong: div.querySelector('.bong-3d'), ten: div.querySelector('.ten-3d'), pha: Math.random() * 10, sinh: performance.now(), muc: V(0, 0, 0), huong: 0, xoa: 0, uongLuc: 3 + Math.random() * 8 };
}
function xoaKhach(id, x) {
  x.xoa = performance.now();
}

// ---------- người đi đường (hoạt cảnh) ----------
const diDuong = []; // { g, nv, tu, den, t0, dur, kieu }
const daThay = new Set();
function themNguoiDi(h, tu, den, dur, { ten, xe, nhan, toc = 3 } = {}) {
  let g;
  let nv = null;
  if (xe) {
    g = new THREE.Group();
    const x = taoXe(xe);
    g.add(x);
    const tai = taoNguoi(DONG_PHUC.xeOm);
    tai.g.position.set(0.1, 0.8, 0);
    tai.g.rotation.y = PI / 2;
    g.add(tai.g);
    if (h) {
      const khachNv = taoNguoi(h);
      khachNv.g.position.set(-0.45, 0.84, 0);
      khachNv.g.rotation.y = PI / 2;
      g.add(khachNv.g);
    }
  } else {
    nv = taoNguoi(h, { dung: true });
    g = nv.g;
  }
  if (ten || nhan) {
    const d = document.createElement('div');
    d.className = 'nhan-nguoi di-duong';
    d.innerHTML = `${nhan ? `<div class="bong-3d hien">${nhan}</div>` : ''}<div class="ten-3d"></div>`;
    d.querySelector('.ten-3d').textContent = ten || '';
    const o = new CSS2DObject(d);
    o.position.set(0, 2.3, 0);
    g.add(o);
  }
  g.position.copy(tu);
  g.scale.setScalar(CO_NV);
  // người: mặt hướng +z; xe: đầu xe hướng +x
  g.rotation.y = Math.atan2(den.x - tu.x, den.z - tu.z) - (xe ? PI / 2 : 0);
  scene.add(g);
  diDuong.push({ g, nv, tu, den, t0: performance.now(), dur, toc });
}
function hoatCanh(h, pub) {
  const timHinh = (ten) => pub.khach.find((k) => k.ten === ten)?.hinh || DONG_PHUC.chuQuan;
  const z = 8.6;
  // tốc độ vừa mắt người xem (đơn vị cảnh/giây): đi bộ, chạy, xe máy
  const DI = 2.2;
  const CHAY = 3.4;
  const XE = 4.5;
  const di = (hinh, tu, den, toc, opt = {}) => themNguoiDi(hinh, tu, den, (tu.distanceTo(den) / toc) * 1000, { toc, ...opt });
  if (h.loai === 'danPhong') {
    // dân phòng đi trước, người bị đưa về đi giữa, dân phòng đi sau; vào từ mép trái, ra mép phải
    const ds = Array.isArray(h.ten) ? h.ten : [h.ten];
    di(DONG_PHUC.danPhong, V(-13, 0, z), V(19, 0, z), DI, { ten: 'Dân phòng', nhan: '🚔 Về phường!' });
    ds.forEach((t, k) => di(timHinh(t), V(-14.4 - k * 1.4, 0, z + 0.3), V(17.6 - k * 1.4, 0, z + 0.3), DI, { ten: t, nhan: '😔' }));
    di(DONG_PHUC.danPhong, V(-15.8 - ds.length * 1.4, 0, z), V(16.2 - ds.length * 1.4, 0, z), DI, { ten: 'Dân phòng' });
  } else if (h.loai === 'csgt') {
    themNguoiDi(DONG_PHUC.csgt, V(9, 0, 8.2), V(8.99, 0, 8.2), 11000, { ten: 'CSGT', nhan: '🛑 Dừng xe!' });
    di(timHinh(h.ten), V(-14, 0, 9.4), V(7.2, 0, 9.4), XE * 0.8, { ten: h.ten, xe: '#c62828' });
  } else if (h.loai === 'xeOm' || h.loai === 'cho') {
    const ten = h.loai === 'cho' ? h.tu : h.ten;
    di(timHinh(ten), V(-15, 0, 9.6), V(20, 0, 9.6), XE, { ten, xe: h.loai === 'cho' ? '#1565c0' : '#2e7d32' });
  } else if (h.loai === 'batQuyt') {
    // chạy dọc lối đi giữa hai dãy bàn (x = 4.3) về phía camera, không xuyên qua bàn ghế
    di(timHinh(h.ten), V(4.3, 0, -9.5), V(4.3, 0, 13), CHAY, { ten: h.ten, nhan: '🏃💨' });
    di(DONG_PHUC.chuQuan, V(4.3, 0, -11.2), V(4.3, 0, 11.3), CHAY, { ten: 'Chủ quán', nhan: '🚨 Bắt quỵt!' });
  } else if (h.loai === 'anDap') {
    hangDap.push({ hinh: timHinh(h.ten), ten: h.ten });
    if (!canhDap) batDauDap();
  }
}

// ---------- cảnh "cho ăn đập" (hoạt hình, không máu me) ----------
// Lôi khách quỵt ra giữa đường, camera cắt cận: đấm, đá, quật ngã, đạp; rồi khách lết đi.
const TAM_DAP = V(2, 0, 9.0);
const CAM_DAP = { pos: V(2, 5.0, 16.2), look: V(2, 0.9, 8.8) };
const HET_CAM_DAP = 14.8; // giây thực: giữ camera cận tới khi nạn nhân lết ra khỏi khung
const DAP_A = V(4.3, 0, -10.5); // trong quán
const DAP_B = V(4.3, 0, 6.6); // lối đi giữa các dãy bàn ra mép đường
const hangDap = [];
let canhDap = null;
const CHU_DAP = ['💥', 'BỐP!', 'BỊCH!', 'HỰ!', 'CỐP!', '⭐', 'BỐP!!'];

function nhanNoi(g, ten) {
  const d = document.createElement('div');
  d.className = 'nhan-nguoi di-duong';
  d.innerHTML = '<div class="bong-3d"></div><div class="ten-3d"></div>';
  d.querySelector('.ten-3d').textContent = ten;
  const o = new CSS2DObject(d);
  o.position.set(0, 2.25, 0);
  g.add(o);
  const bong = d.querySelector('.bong-3d');
  return (txt) => {
    if (bong.textContent === (txt || '')) return;
    bong.textContent = txt || '';
    bong.classList.toggle('hien', !!txt);
  };
}
function batDauDap() {
  const ds = hangDap.shift();
  if (!ds) return;
  const tao = (hinh, ten) => {
    const nv = taoNguoi(hinh, { dung: true });
    nv.g.scale.setScalar(CO_NV);
    nv.g.position.copy(DAP_A);
    scene.add(nv.g);
    return { nv, noi: nhanNoi(nv.g, ten), truoc: 0 };
  };
  canhDap = { t0: performance.now(), nan: tao(ds.hinh, ds.ten), chu: tao(DONG_PHUC.chuQuan, 'Chủ quán'), a: tao(DONG_PHUC.nhanVien, 'Nhân viên'), b: tao(DONG_PHUC.nhanVien2, 'Nhân viên'), pop: [] };
}
function ketThucDap() {
  const c = canhDap;
  for (const x of [c.nan, c.chu, c.a, c.b]) goKhoiCanh(x.nv.g);
  for (const p of c.pop) goKhoiCanh(p.o);
  canhDap = null;
  batDauDap();
}
const nhip = (t, w, pha = 0) => Math.max(0, Math.sin(t * w + pha)) ** 2;
const huongVe = (g, p) => (g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z));
function dungThang(nv) {
  for (const c of nv.chan) c.rotation.set(0, 0, 0);
  nv.tay[0].rotation.set(0, 0, -0.12);
  nv.tay[1].rotation.set(0, 0, 0.12);
  nv.goc.position.set(0, 0, 0);
  nv.goc.rotation.set(0, 0, 0);
  nv.dau.rotation.set(0, 0, 0);
}
function buocDi(nv, t, nhanh = 1) {
  const s = Math.sin(t * 11 * nhanh);
  nv.chan[0].rotation.x = s * 0.7;
  nv.chan[1].rotation.x = -s * 0.7;
  nv.tay[0].rotation.x = -s * 0.5;
  nv.tay[1].rotation.x = s * 0.5;
  nv.goc.position.y = Math.abs(s) * 0.06;
}
function dam(nv, p) {
  // tay phải thụi thẳng về trước, người đổ theo
  nv.tay[1].rotation.x = -0.3 - 1.35 * p;
  nv.tay[0].rotation.x = -0.9 + 0.5 * p;
  nv.goc.position.z = 0.16 * p;
  nv.goc.rotation.x = 0.18 * p;
}
function da(nv, p) {
  // đá: chân phải vung lên trước, người ngả ra sau, tay dang giữ thăng bằng
  nv.chan[1].rotation.x = -1.6 * p;
  nv.goc.rotation.x = -0.25 * p;
  nv.tay[0].rotation.z = -0.12 - 0.8 * p;
  nv.tay[1].rotation.z = 0.12 + 0.8 * p;
}
function dapXuong(nv, p) {
  // đạp: co chân lên rồi dậm mạnh xuống
  nv.chan[1].rotation.x = -1.25 * p;
  nv.goc.position.y = 0.12 * p;
  nv.tay[0].rotation.x = -0.8 * p;
  nv.tay[1].rotation.x = -0.5 * p;
}
function bungChu(c, vt) {
  // CSS2DRenderer tự đặt transform lên phần tử ngoài, nên hiệu ứng phải nằm ở thẻ con
  const d = document.createElement('div');
  const chu = document.createElement('span');
  chu.className = 'pop-dap';
  chu.textContent = CHU_DAP[Math.floor(Math.random() * CHU_DAP.length)];
  d.appendChild(chu);
  const o = new CSS2DObject(d);
  o.position.set(vt.x + (Math.random() - 0.5) * 1.2, vt.y + 0.8 + Math.random() * 1.2, vt.z + 0.3);
  scene.add(o);
  c.pop.push({ o, t: performance.now() });
}
// gọi khi một nhịp đòn vừa chạm (vượt ngưỡng) → nạn nhân giật người + bật chữ
function trung(c, x, p, tam) {
  const vaCham = p > 0.85 && x.truoc <= 0.85;
  x.truoc = p;
  if (vaCham) {
    c.giat = 1;
    bungChu(c, tam);
  }
}
function chayCanhDap(now) {
  const c = canhDap;
  // s0: giây thực; s: "giây kịch bản" — 4s đầu (lôi ra) giãn chậm 0.6 lần, sau đó lùi 1.6s
  const s0 = (now - c.t0) / 1000;
  const s = s0 < 4 ? s0 * 0.6 : s0 - 1.6;
  const t = now / 1000;
  const { nan, chu, a, b } = c;
  for (const x of [nan, chu, a, b]) dungThang(x.nv);
  const N = nan.nv.g;
  c.giat = Math.max(0, (c.giat || 0) - dt * 6);

  if (s < 2.4) {
    // lôi ra giữa đường: trong quán → lối đi → giữa đường
    const p = s < 1.8 ? s / 1.8 : 1;
    const q = s < 1.8 ? 0 : (s - 1.8) / 0.6;
    const vt = s < 1.8 ? DAP_A.clone().lerp(DAP_B, p) : DAP_B.clone().lerp(TAM_DAP, q);
    N.position.copy(vt);
    chu.nv.g.position.copy(vt).add(V(-0.75, 0, -0.2));
    a.nv.g.position.copy(vt).add(V(0.7, 0, -0.9));
    b.nv.g.position.copy(vt).add(V(-0.4, 0, -1.4));
    const toi = s < 1.8 ? DAP_B : TAM_DAP;
    for (const x of [nan, chu, a, b]) {
      if (x.nv.g.position.distanceTo(toi) > 0.05) huongVe(x.nv.g, toi.clone().add(x.nv.g.position.clone().sub(N.position)));
      buocDi(x.nv, t, 0.75);
    }
    chu.nv.tay[1].rotation.x = -1.4; // túm cổ áo lôi đi
    nan.nv.tay[0].rotation.x = -2.4;
    nan.nv.tay[1].rotation.x = -2.4; // giơ hai tay xin
    chu.noi('Ăn quỵt hả?! Ra đây!');
    nan.noi('Em xin lỗi!!!');
    a.noi('');
    b.noi('');
  } else if (s < 9.0) {
    const k = Math.min(1, (s - 2.4) / 0.4); // vào vị trí
    const nga = s < 5.4 ? 0 : Math.min(1, (s - 5.4) / 0.35);
    // người đánh đứng hai bên và phía sau, để nạn nhân luôn ở trước mặt khán giả
    const viTri = nga
      ? { chu: V(-2.0, 0, -0.35), a: V(0.85, 0, -0.75), b: V(-0.55, 0, -0.95) }
      : { chu: V(-1.1, 0, -0.35), a: V(1.1, 0, -0.3), b: V(0.05, 0, -1.05) };
    const tam = TAM_DAP.clone().add(V(-1.2 * nga, 0, 0));
    for (const ten of ['chu', 'a', 'b']) {
      const g = c[ten].nv.g;
      g.position.lerp(TAM_DAP.clone().add(viTri[ten]), Math.max(k * 0.25, muot(8)));
      huongVe(g, tam);
    }
    // ngã nghiêng, đầu về phía chủ quán; dời gốc (ở chân) để thân nằm giữa vòng vây
    N.position.set(TAM_DAP.x + 1.05 * nga, 0.45 * nga, TAM_DAP.z);
    N.rotation.y = 0;
    N.rotation.z = (PI / 2) * nga;

    if (s < 8.2) {
      if (!nga) {
        const pc = nhip(s, 13);
        const pa = nhip(s, 8, 1.2);
        const pb = nhip(s, 11, 2.1);
        dam(chu.nv, pc);
        da(a.nv, pa);
        dam(b.nv, pb);
        trung(c, chu, pc, TAM_DAP);
        trung(c, a, pa, TAM_DAP);
        trung(c, b, pb, TAM_DAP);
        // nạn nhân co rúm, bị đẩy giật lùi
        nan.nv.tay[0].rotation.x = -2.2;
        nan.nv.tay[1].rotation.x = -2.2;
        nan.nv.goc.rotation.x = -0.35 * c.giat;
        nan.nv.goc.position.z = -0.15 * c.giat;
        nan.nv.dau.rotation.z = Math.sin(t * 40) * 0.25 * c.giat;
        chu.noi('Này thì quỵt!');
        a.noi('Bốp cho chừa!');
        b.noi('');
        nan.noi('Á á á!!');
      } else {
        const pa = nhip(s, 9);
        const pb = nhip(s, 10, 1.7);
        const pc = nhip(s, 7, 0.6);
        dapXuong(a.nv, pa);
        dapXuong(b.nv, pb);
        da(chu.nv, pc);
        const tamNam = TAM_DAP.clone().add(V(-0.1, 0, 0));
        trung(c, a, pa, tamNam);
        trung(c, b, pb, tamNam);
        trung(c, chu, pc, tamNam);
        // nằm giãy
        nan.nv.chan[0].rotation.x = Math.sin(t * 20) * 0.5 * (0.4 + c.giat);
        nan.nv.chan[1].rotation.x = -Math.sin(t * 20) * 0.5 * (0.4 + c.giat);
        nan.nv.tay[0].rotation.x = -2.4;
        nan.nv.tay[1].rotation.x = -2.6;
        nan.nv.goc.position.x = -0.06 * c.giat;
        chu.noi('Còn quỵt nữa không?!');
        a.noi('');
        b.noi('Đạp cho bõ!');
        nan.noi('Em trả! Em trả mà!');
      }
    } else {
      // dừng tay, chủ quán chỉ mặt
      chu.nv.tay[1].rotation.x = -2.5;
      chu.noi('Lần sau chừa nhé!');
      a.noi('');
      b.noi('');
      nan.noi('😵‍💫');
      nan.nv.chan[0].rotation.x = Math.sin(t * 6) * 0.15;
    }
  } else if (s < 9.7) {
    // lồm cồm bò dậy
    const p = (s - 9.0) / 0.7;
    N.rotation.z = (PI / 2) * (1 - p);
    N.position.set(TAM_DAP.x + 1.05 * (1 - p), 0.45 * (1 - p), TAM_DAP.z);
    nan.nv.tay[0].rotation.x = -1.2;
    nan.nv.tay[1].rotation.x = -1.2;
    nan.noi('💫');
  } else if (s < 13.5) {
    // lết đi, xiêu vẹo; quán quay vào
    const p = (s - 9.7) / 3.8;
    const den = V(10.5, 0, 9.4); // lết ra mép phải khung hình
    N.position.lerpVectors(TAM_DAP, den, p);
    N.rotation.z = Math.sin(t * 5) * 0.18;
    huongVe(N, den);
    buocDi(nan.nv, t, 0.45);
    nan.noi('💫 Chừa rồi… chừa rồi…');
    for (const x of [chu, a, b]) {
      const g = x.nv.g;
      g.position.lerp(DAP_A, muot(0.6));
      huongVe(g, DAP_A);
      buocDi(x.nv, t);
    }
    chu.noi('Đi! Đừng vác mặt lại!');
  } else return ketThucDap();

  // chữ BỐP! bay lên rồi tắt
  for (let k = c.pop.length - 1; k >= 0; k--) {
    const p = c.pop[k];
    if (now - p.t > 600) {
      goKhoiCanh(p.o);
      c.pop.splice(k, 1);
    } else p.o.position.y += dt * 0.8;
  }
}

// ---------- cập nhật từ trạng thái ----------
let ctxHt = {};
let pubHt = null;
let tenBien = null;
function capNhat(pub, ctx) {
  pubHt = pub;
  ctxHt = ctx;
  if (pub.quan.ten !== tenBien) {
    tenBien = pub.quan.ten;
    bienQuan.material.map?.dispose();
    bienQuan.material.map = veBien(tenBien);
    bienQuan.material.needsUpdate = true;
  }
  const ngoi = pub.khach.filter((k) => k.trangThai === 'ngoi' && k.ban);
  const theoBan = new Map();
  for (const k of ngoi) (theoBan.get(k.ban) || theoBan.set(k.ban, []).get(k.ban)).push(k.id);
  const bong = new Map(pub.bongBong.map((b) => [b.pid, b.text]));
  const danh = new Set();
  const banDanh = new Map();
  for (const v of pub.vu) {
    if (v.loai !== 'xoxat') continue;
    v.nguoi.forEach((id) => danh.add(id));
    banDanh.set(v.ban, v);
    banDanh.set(v.banMuc, v);
  }
  const biKhia = new Set(pub.vu.filter((v) => v.loai === 'khia').map((v) => v.den));

  // bàn
  for (const b of pub.ban) {
    const ob = bans[b.so - 1];
    veMon(ob, b.mon);
    const v = banDanh.get(b.so);
    ob.oNo.visible = !!v;
    if (v) ob.no.querySelector('.no-dem').textContent = '🚔 ' + Math.ceil(v.conLai / 1000) + 's';
    const laCuaToi = ctx.me?.trangThai === 'ngoi' && ctx.me.ban === b.so;
    ob.vlMat.emissive.set(ctx.targetBan === b.so ? '#7a5a00' : laCuaToi ? '#0d4d22' : '#000000');
    ob.nhan.classList.toggle('chon', ctx.targetBan === b.so);
  }

  // khách đang ngồi
  const conLai = new Set();
  for (const [so, ids] of theoBan) {
    const ghe = xepGhe(so, ids);
    const goc = viTriBan(so);
    ghe.forEach((id, gi) => {
      if (!id) return;
      const k = ngoi.find((x) => x.id === id);
      conLai.add(id);
      let x = khach.get(id);
      if (!x || x.xoa) {
        if (x) goKhoiCanh(x.nv.g);
        x = taoKhach(k);
        khach.set(id, x);
        const p = goc.clone().add(VI_TRI_GHE[gi]);
        x.nv.g.position.set(p.x, 0.42, p.z);
      }
      const p = goc.clone().add(VI_TRI_GHE[gi]);
      x.muc.set(p.x, 0.42, p.z);
      x.huong = Math.atan2(-VI_TRI_GHE[gi].x, -VI_TRI_GHE[gi].z);
      x.say = k.say;
      x.danh = danh.has(id);
      x.off = !k.online;
      x.div.classList.toggle('toi', id === ctx.myId);
      x.div.classList.toggle('chon', id === ctx.target);
      x.div.classList.toggle('off', !k.online);
      x.div.classList.toggle('bi-khia', biKhia.has(id));
      const bb = bong.get(id);
      x.bong.textContent = bb || '';
      x.bong.classList.toggle('hien', !!bb);
      x.nv.ma.forEach((m) => (m.visible = k.say > 0));
    });
  }
  for (const [id, x] of khach) if (!conLai.has(id) && !x.xoa) xoaKhach(id, x);
  for (const so of [...gheCua.keys()]) if (!theoBan.has(so)) gheCua.delete(so);

  // hoạt cảnh mới
  for (const h of pub.hoatCanh) {
    if (daThay.has(h.id)) continue;
    daThay.add(h.id);
    hoatCanh(h, pub);
  }

  // góc nhìn
  if (ctx.gocNhin === 'ban' && ctx.me?.trangThai === 'ngoi' && ctx.me.ban) {
    const p = viTriBan(ctx.me.ban);
    // nhìn chếch từ trên xuống để đầu người bàn trước không che
    camMuc = { pos: V(p.x + 0.5, 7.8, p.z + 5.6), look: V(p.x, 0.6, p.z - 0.2) };
  } else camMuc = CAM_TOAN;
}
let camMuc = CAM_TOAN;

// ---------- chọn bằng chạm ----------
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('click', (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const ds = ray.intersectObjects(scene.children, true);
  for (const d of ds) {
    const u = d.object.userData;
    if (u.pid) return window.chon3D?.({ pid: u.pid });
    if (u.ban) return window.chon3D?.({ ban: u.ban });
  }
});

// ---------- vòng lặp ----------
let truoc = 0;
let dt = 0.016;
// hệ số làm mượt theo thời gian thực (không phụ thuộc số khung hình/giây)
const muot = (toc) => 1 - Math.exp(-toc * dt);
function khung(now) {
  requestAnimationFrame(khung);
  if (DIEN_THOAI && now - truoc < 32) return; // điện thoại: ~30 khung/giây
  dt = Math.min(0.25, (now - truoc) / 1000 || 0.016);
  truoc = now;
  const t = now / 1000;

  // đang có cảnh ăn đập thì camera cắt cận vào giữa đường (cho tới lúc nạn nhân lết đi)
  const dangDap = !!canhDap && now - canhDap.t0 < HET_CAM_DAP * 1000;
  const muc = dangDap ? CAM_DAP : camMuc;
  lopNhan.domElement.classList.toggle('dang-dap', dangDap); // ẩn nhãn bàn/khách khác cho gọn cảnh
  camHt.pos.lerp(muc.pos, muot(canhDap ? 4 : 3));
  camHt.look.lerp(muc.look, muot(canhDap ? 4 : 3));
  if (canhDap) chayCanhDap(now);
  camera.position.set(camHt.pos.x + Math.sin(t * 0.15) * 0.25, camHt.pos.y, camHt.pos.z);
  camera.lookAt(camHt.look);

  for (const [id, x] of khach) {
    const { nv } = x;
    const g = nv.g;
    if (x.xoa) {
      const k = 1 - (now - x.xoa) / 400;
      if (k <= 0) {
        goKhoiCanh(g);
        khach.delete(id);
        continue;
      }
      g.scale.setScalar(k * CO_NV);
      continue;
    }
    const s = Math.min(1, (now - x.sinh) / 350);
    g.scale.setScalar(CO_NV * (s < 1 ? s * (1.15 - 0.15 * s) : 1));
    g.position.lerp(x.muc, muot(10));
    g.rotation.y += (x.huong - g.rotation.y) * muot(10);
    const tt = t + x.pha;
    nv.dau.rotation.x = Math.sin(tt * 1.3) * 0.04;
    if (x.danh) {
      // đứng bật dậy, rung, vung tay
      nv.goc.position.set(Math.sin(t * 40) * 0.05, 0.25 + Math.abs(Math.sin(t * 12)) * 0.12, 0);
      nv.goc.rotation.z = Math.sin(t * 25) * 0.15;
      nv.tay[0].rotation.x = -1.6 + Math.sin(t * 18) * 1.1;
      nv.tay[1].rotation.x = -1.6 - Math.sin(t * 18) * 1.1;
      nv.coc.visible = false;
      continue;
    }
    const lac = x.say === 2 ? 0.16 : x.say === 1 ? 0.07 : 0.015;
    nv.goc.position.set(0, 0, 0);
    nv.goc.rotation.z = Math.sin(tt * (x.say ? 1.6 : 0.9)) * lac;
    nv.dau.rotation.z = Math.sin(tt * 1.1) * (x.say === 2 ? 0.25 : 0.05);
    // nâng cốc uống theo chu kỳ
    const chuKy = (tt % 9) / 9;
    const uong = chuKy > 0.82;
    nv.coc.visible = uong;
    nv.tay[1].rotation.x += ((uong ? -2.5 : -0.9) - nv.tay[1].rotation.x) * muot(9);
    nv.tay[0].rotation.x += (-0.9 - nv.tay[0].rotation.x) * muot(9);
    nv.dau.rotation.x += uong ? -0.25 : 0;
  }

  for (let k = diDuong.length - 1; k >= 0; k--) {
    const d = diDuong[k];
    const p = (now - d.t0) / d.dur;
    if (p >= 1) {
      goKhoiCanh(d.g);
      diDuong.splice(k, 1);
      continue;
    }
    d.g.position.lerpVectors(d.tu, d.den, p);
    if (d.nv) {
      // nhịp bước tỉ lệ với tốc độ: đi chậm thì bước chậm, chạy thì vung tay mạnh hơn
      const b = Math.sin((now / 1000) * d.toc * 2.6);
      const bien = d.toc > 3 ? 0.75 : 0.5;
      d.nv.chan[0].rotation.x = b * bien;
      d.nv.chan[1].rotation.x = -b * bien;
      d.nv.tay[0].rotation.x = -b * bien * 0.8;
      d.nv.tay[1].rotation.x = b * bien * 0.8;
      d.nv.goc.position.y = Math.abs(b) * 0.05;
    }
  }

  for (const m of khoi3d) {
    const p = (t * 0.35 + m.userData.pha) % 1;
    m.position.set(m.userData.goc.x + Math.sin(p * 6 + m.userData.pha * 9) * 0.25, m.userData.goc.y + p * 3, m.userData.goc.z);
    m.scale.setScalar(0.15 + p * 0.45);
    m.material.opacity = 0.35 * (1 - p);
  }

  // bóng đổ chỉ cập nhật ~5 lần/giây (nhân vật ngồi gần như yên một chỗ)
  if (renderer.shadowMap.enabled && now - (khung.bong || 0) > 200) {
    renderer.shadowMap.needsUpdate = true;
    khung.bong = now;
  }
  renderer.render(scene, camera);
  lopNhan.render(scene, camera);
}
requestAnimationFrame(khung);

window.San3D = { capNhat, info: () => ({ ...renderer.info.render }), thuDap: (ten = 'Khách quỵt') => hoatCanh({ id: 'thu' + Math.random(), loai: 'anDap', ten }, pubHt || { khach: [] }) };
window.ve3D?.();
