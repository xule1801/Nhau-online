// Luật chơi "Đi nhậu online" — thuần logic, không phụ thuộc mạng.
// Máy chủ (Node/ws hôm nay, Cloudflare Durable Object sau này) chỉ cần:
//   join / act / adminAct / tick và đọc publicState / privateState / adminState.
'use strict';

const MAC_DINH = {
  soBan: 20,
  ghePerBan: 4,
  khiaHan: 20_000, // thời gian người bị khịa/choảng được chọn phản ứng
  danPhongSau: 25_000, // xô xát không ai can sau chừng này thì dân phòng tới
  phuongThoiGian: 60_000, // ngồi ở phường bao lâu rồi được quay lại
  thieuHan: 45_000, // chủ không trả lời xin thiếu → coi như từ chối
  quytHan: 30_000, // chủ không xử lý ăn quỵt → mặc định báo dân phòng
  yeuCauHan: 30_000, // nhờ bao / nhờ chở
  csgtHan: 30_000, // không chọn khi bị CSGT dừng → mặc định nộp phạt
  matKetNoi: 120_000, // mất kết nối quá lâu → tự rời quán
  giuKetQua: 600_000, // giữ màn hình kết quả cho khách đã về
  tiLeCsgt: 0.4,
  tiLePhatHienQuyt: 0.9, // chỉ ~10% chuồn êm
  tiLeNanNi: 0.3,
  hoiChieu: 700, // khoảng cách tối thiểu giữa hai hành động của một khách
};

const LOAI_MON = ['bia', 'ruou', 'nuoc', 'moi'];
const CO_CON = new Set(['bia', 'ruou']);

const THUC_DON_MAC_DINH = [
  { emoji: '🍺', ten: 'Bia hơi', gia: 10, loai: 'bia' },
  { emoji: '🍻', ten: 'Bia chai', gia: 20, loai: 'bia' },
  { emoji: '🥃', ten: 'Rượu đế (ly)', gia: 10, loai: 'ruou' },
  { emoji: '🧋', ten: 'Trà đá', gia: 3, loai: 'nuoc' },
  { emoji: '🥤', ten: 'Nước ngọt', gia: 15, loai: 'nuoc' },
  { emoji: '🥜', ten: 'Lạc rang', gia: 15, loai: 'moi' },
  { emoji: '🥢', ten: 'Nem chua rán', gia: 40, loai: 'moi' },
  { emoji: '🐌', ten: 'Ốc luộc', gia: 60, loai: 'moi' },
  { emoji: '🍗', ten: 'Chân gà nướng', gia: 50, loai: 'moi' },
  { emoji: '🍢', ten: 'Lòng nướng', gia: 70, loai: 'moi' },
  { emoji: '🍲', ten: 'Lẩu dê', gia: 250, loai: 'moi' },
];

const CAU_KHIA = [
  'Uống như mèo liếm!',
  'Gọi mỗi đĩa lạc mà ngồi cả tối à?',
  'Nhìn bàn kia sang chưa kìa, học hỏi đi!',
  'Ai cho bàn này nói to thế?',
  'Tửu lượng thế này về nhà uống sữa đi!',
  'Bia hơi mà cũng say à?',
  'Mời được bàn nào chưa mà nói nhiều?',
  'Ví mỏng thì ngồi im cho người ta nhậu!',
  'Hát dở thế mà cũng hát!',
  'Trăm phần trăm đi, đừng có lấy lệ!',
];

const MAU = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ec407a', '#8d6e63', '#26c6da'];
const MAT = ['😀', '😎', '🤠', '😏', '🥸', '😺', '🐵', '🐶', '🐷', '🐸', '🦊', '🐻'];

// ---------- ngoại hình nhân vật 3D ----------
const DA = ['#f6d3b3', '#eec19a', '#e0a87e', '#c98b62', '#a86f4c'];
const TOC = ['#1b1612', '#2b1d14', '#3d2a1c', '#6b4a2e', '#9a9a9a', '#c2793a'];
const MAU_AO = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#ffffff', '#212121', '#00897b', '#6d4c41', '#90caf9', '#f48fb1'];
const MAU_QUAN = ['#263238', '#37474f', '#5d4037', '#1a237e', '#33691e', '#795548', '#9e9e9e'];
const KIEU_AO = ['trơn', 'kẻ', 'caro', 'hoa', 'ba lỗ', 'đội tuyển'];
const KIEU_TOC = ['đinh', 'mái', 'dài', 'hói', 'xoăn'];
const MU = [null, null, null, 'lưỡi trai', 'bảo hiểm'];
function taoHinh(r = Math.random) {
  const chon = (a) => a[Math.floor(r() * a.length)];
  return {
    da: chon(DA),
    toc: chon(TOC),
    kieuToc: chon(KIEU_TOC),
    ao: chon(MAU_AO),
    ao2: chon(MAU_AO),
    kieuAo: chon(KIEU_AO),
    quan: chon(MAU_QUAN),
    mu: chon(MU),
    muMau: chon(MAU_AO),
    kinh: r() < 0.2,
    rau: r() < 0.25,
    beo: 0.9 + r() * 0.3,
  };
}

// ---------- tiện ích ----------
const boDau = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const TU_CAM = new Set(['dit', 'djt', 'dm', 'dmm', 'dcm', 'dcmm', 'dkm', 'vcl', 'vkl', 'vl', 'cc', 'cl', 'clm', 'cmm', 'cak', 'buoi', 'deo', 'nung', 'fuck', 'shit', 'bitch']);
const TEN_GIA_MAO = ['chuquan', 'admin', 'danphong', 'csgt', 'congan', 'hethong', 'canhsat', 'quantri', 'moderator', 'tiktok'];

function kiemTraTen(ten) {
  ten = String(ten ?? '').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{N} ._\-]{2,20}$/u.test(ten)) return { loi: 'Tên 2–20 ký tự, chỉ gồm chữ, số, khoảng trắng.' };
  const kd = boDau(ten);
  const tu = kd.split(/[^a-z0-9]+/).filter(Boolean);
  if (tu.some((t) => TU_CAM.has(t))) return { loi: 'Tên này không phù hợp, chọn tên khác nhé.' };
  const lien = kd.replace(/[^a-z0-9]/g, '');
  if (TEN_GIA_MAO.some((x) => lien.includes(x))) return { loi: 'Không được đặt tên giả mạo chủ quán/cơ quan chức năng.' };
  return { ten, khoa: lien };
}

function kiemTraThucDon(menu) {
  if (!Array.isArray(menu) || menu.length < 2 || menu.length > 40) return { loi: 'Thực đơn cần 2–40 món.' };
  const ra = [];
  for (const m of menu) {
    const ten = String(m?.ten ?? '').trim().slice(0, 30);
    const gia = Number(m?.gia);
    const loai = m?.loai;
    const emoji = String(m?.emoji ?? '').trim().slice(0, 8) || '🍽️';
    if (!ten) return { loi: 'Có món chưa có tên.' };
    if (!Number.isInteger(gia) || gia < 1 || gia > 10_000) return { loi: `Giá món "${ten}" phải là số nguyên 1–10000 (nghìn).` };
    if (!LOAI_MON.includes(loai)) return { loi: `Loại món "${ten}" không hợp lệ.` };
    ra.push({ id: String(ra.length + 1), emoji, ten, gia, loai });
  }
  if (!ra.some((m) => m.loai !== 'moi')) return { loi: 'Cần ít nhất một đồ uống.' };
  if (!ra.some((m) => m.loai === 'moi')) return { loi: 'Cần ít nhất một món mồi.' };
  return { menu: ra };
}

// Mức tiền tính theo giá thực đơn của quán.
// "Bao một bàn" = 4 người × (2 đồ uống trung bình + 1 món mồi trung bình).
function tinhMucTien(menu) {
  const uong = menu.filter((m) => m.loai !== 'moi').map((m) => m.gia);
  const moi = menu.filter((m) => m.loai === 'moi').map((m) => m.gia);
  const tb = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const toiThieu = Math.min(...uong) + Math.min(...moi);
  const baoBan = Math.round(4 * (2 * tb(uong) + tb(moi)));
  const toiDa = Math.max(toiThieu + 5, Math.round(2.5 * baoBan));
  return {
    toiThieu,
    baoBan,
    toiDa,
    phatCsgt: Math.max(20, Math.round(baoBan / 2)),
    boiThuong: Math.max(10, Math.round(baoBan / 4)),
    goiXe: Math.max(10, Math.min(...uong) * 2),
  };
}

const lamTron5 = (x) => Math.max(5, Math.round(x / 5) * 5);

class Quan {
  constructor({ id, ten, menu, cauHinh = {}, rng = Math.random, rngHinh = Math.random, rngBan = Math.random, now = Date.now, taoMa }) {
    this.rngBan = rngBan; // chọn bàn ngẫu nhiên, tách khỏi luật chơi để test ổn định
    this.rngHinh = rngHinh; // ngoại hình dùng nguồn ngẫu nhiên riêng, không ảnh hưởng luật chơi
    const kt = kiemTraThucDon(menu ?? THUC_DON_MAC_DINH);
    if (kt.loi) throw new Error(kt.loi);
    this.id = id;
    this.ten = String(ten || 'Quán nhậu vỉa hè').trim().slice(0, 40);
    this.menu = kt.menu;
    this.cfg = { ...MAC_DINH, ...cauHinh };
    this.rng = rng;
    this.now = now;
    // Mã định danh không dùng this.rng để test điều khiển được chuỗi ngẫu nhiên của luật chơi.
    this.taoMa = taoMa ?? (() => (++this._dem).toString(36) + Math.random().toString(36).slice(2, 10));
    this._dem = 0;
    this.muc = tinhMucTien(this.menu);
    this.players = new Map(); // id -> khách
    this.tokens = new Map(); // token -> id
    this.ban = Array.from({ length: this.cfg.soBan }, (_, i) => ({ so: i + 1, mon: [] }));
    this.vuViec = new Map(); // khịa / xô xát
    this.hangDoiChu = []; // việc chờ chủ quán: xin thiếu, ăn quỵt
    this.yeuCau = new Map(); // nhờ bao, nhờ chở (giữa khách với nhau)
    this.nhatKy = [];
    this.bongBong = []; // câu nói hiện trên màn hình
    this.hoatCanh = []; // dân phòng, CSGT… cho màn hình phát
    this.doanhThu = 0;
    this.tenCam = new Set();
    this.dong = false;
    this.phienBan = 0;
  }

  // ---------- trợ giúp nội bộ ----------
  _ma() {
    return this.taoMa();
  }
  _doi() {
    this.phienBan++;
  }
  _log(text, loai = 'info', them = {}) {
    this.nhatKy.push({ id: this._ma(), t: this.now(), text, loai, ...them });
    if (this.nhatKy.length > 40) this.nhatKy.shift();
  }
  _canh(loai, them = {}) {
    this.hoatCanh.push({ id: this._ma(), loai, t: this.now(), ...them });
    if (this.hoatCanh.length > 20) this.hoatCanh.shift();
  }
  _noi(pid, text, ms = 6000) {
    this.bongBong = this.bongBong.filter((b) => b.pid !== pid);
    this.bongBong.push({ pid, text, den: this.now() + ms });
  }
  _taiBan(so) {
    return [...this.players.values()].filter((p) => p.trangThai === 'ngoi' && p.ban === so);
  }
  _soKhach() {
    let n = 0;
    for (const p of this.players.values()) if (p.trangThai !== 've') n++;
    return n;
  }
  _chonBan(chon) {
    const g = this.cfg.ghePerBan;
    const dem = this.ban.map((b) => this._taiBan(b.so).length);
    // bốc ngẫu nhiên để mỗi lần vào không ngồi mãi một bàn
    const boc = (ds) => (ds.length ? ds[Math.floor(this.rngBan() * ds.length)] + 1 : null);
    const loc = (dk) => dem.map((n, i) => (dk(n) ? i : -1)).filter((i) => i >= 0);
    if (chon === 'ghep') {
      const coNguoi = loc((n) => n > 0 && n < g);
      if (coNguoi.length) return boc(coNguoi);
      chon = 'rieng';
    }
    if (chon === 'rieng') return boc(loc((n) => n === 0));
    const so = Number(chon);
    if (!Number.isInteger(so) || so < 1 || so > this.cfg.soBan) return null;
    return dem[so - 1] < g ? so : null;
  }
  _gioiHan(p) {
    return p.tien + p.chiu - p.tab;
  }
  _monTheoId(id) {
    return this.menu.find((m) => m.id === String(id));
  }
  // Món trên bàn ghi rõ của ai (người đang ăn/uống) để khi người đó rời bàn thì dọn đúng phần của họ.
  _datMon(so, mon, cuaAi) {
    const b = this.ban[so - 1];
    b.mon.push({ emoji: mon.emoji, loai: mon.loai, to: mon.gia >= 150, cuaAi });
    if (b.mon.length > 20) b.mon.shift();
  }
  _donBan(p, so = p.ban) {
    if (!so) return;
    const b = this.ban[so - 1];
    const truoc = b.mon.length;
    b.mon = b.mon.filter((m) => m.cuaAi !== p.id);
    // bàn không còn ai thì dọn sạch
    if (!this._taiBan(so).some((k) => k.id !== p.id)) b.mon = [];
    if (b.mon.length !== truoc) this._log(`🧹 Dọn phần của ${p.ten} ở bàn ${so}`, 'don', { ban: so });
  }
  // Thanh toán hóa đơn + khoản thêm; thiếu thì dùng hạn mức cho thiếu, vẫn thiếu thì ghi nợ.
  _thanhToan(p, them = 0) {
    const can = p.tab + them;
    const tra = Math.min(p.tien, can);
    p.tien -= tra;
    this.doanhThu += tra;
    const conLai = can - tra;
    p.no += conLai;
    p.chiu = Math.max(0, p.chiu - conLai);
    p.tab = 0;
    return { tra, conLai };
  }
  _roiBan(p) {
    this._donBan(p);
    p.ban = null;
    // khách rời bàn thì hủy các vụ việc/yêu cầu đang chờ liên quan
    for (const [id, y] of this.yeuCau) if (y.tu === p.id || y.den === p.id) this.yeuCau.delete(id);
    for (const [id, v] of this.vuViec) {
      if (v.loai === 'khia' && (v.tu === p.id || v.den === p.id)) this.vuViec.delete(id);
      if (v.loai === 'xoxat') {
        v.nguoi = v.nguoi.filter((x) => x !== p.id);
        if (v.muc === p.id) v.muc = null;
        if (!v.nguoi.length) this.vuViec.delete(id);
      }
    }
  }
  _ketThuc(p, ketQua, loai = 'roi') {
    this._roiBan(p);
    p.trangThai = 've';
    p.roi = { buoc: 'xong', ketQua };
    p.veLuc = this.now();
    this._log(`${p.ten}: ${ketQua}`, loai);
  }
  _vuCuaToi(pid) {
    for (const v of this.vuViec.values()) if (v.loai === 'xoxat' && v.nguoi.includes(pid)) return v;
    return null;
  }

  // ---------- vào quán ----------
  join(tenVao, chonBan = 'ghep') {
    if (this.dong) return { loi: 'Quán đã đóng cửa.' };
    const kt = kiemTraTen(tenVao);
    if (kt.loi) return kt;
    if (this.tenCam.has(kt.khoa)) return { loi: 'Tên này đã bị chủ quán mời ra.' };
    for (const p of this.players.values()) {
      if (p.trangThai !== 've' && p.khoa === kt.khoa) return { loi: 'Đã có người dùng tên này trong quán.' };
    }
    if (this._soKhach() >= this.cfg.soBan * this.cfg.ghePerBan) return { loi: 'Quán hết chỗ rồi, quay lại sau nhé!' };
    const so = this._chonBan(chonBan);
    if (!so) return { loi: 'Bàn này hết chỗ (hoặc quán hết bàn trống).' };

    const { toiThieu, toiDa } = this.muc;
    const r = this.rng();
    const tien = lamTron5(toiThieu + (toiDa - toiThieu) * r * r); // đa số ở mức vừa, ít người "đại gia"
    const id = this._ma();
    const token = this._ma() + this._ma() + this._ma();
    const p = {
      id,
      token,
      ten: kt.ten,
      khoa: kt.khoa,
      mau: MAU[Math.floor(this.rng() * MAU.length)],
      mat: MAT[Math.floor(this.rng() * MAT.length)],
      hinh: taoHinh(this.rngHinh),
      tien,
      tienDau: tien,
      tab: 0,
      chiu: 0,
      no: 0,
      daUong: 0,
      ban: so,
      trangThai: 'ngoi', // ngoi | sanh (chờ chọn bàn) | phuong | roi (đang về) | ve (đã về)
      online: true,
      matLuc: 0,
      lastAct: 0,
      roi: null,
    };
    this.players.set(id, p);
    this.tokens.set(token, id);
    this._log(`${p.ten} vào quán, ngồi bàn ${so} (ví ${tien}k)`, 'vao', { ban: so });
    this._doi();
    return { id, token };
  }

  resume(token) {
    const id = this.tokens.get(token);
    const p = id && this.players.get(id);
    if (!p) return null;
    p.online = true;
    this._doi();
    return id;
  }

  disconnect(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    p.online = false;
    p.matLuc = this.now();
    this._doi();
  }

  // ---------- hành động của khách ----------
  act(pid, a = {}) {
    const p = this.players.get(pid);
    if (!p) return { loi: 'Không tìm thấy khách.' };
    if (this.dong) return { loi: 'Quán đã đóng cửa.' };
    const t = this.now();
    if (t - p.lastAct < this.cfg.hoiChieu) return { loi: 'Từ từ thôi, nhậu chậm lại!' };
    const fn = this['_a_' + a.type];
    if (typeof fn !== 'function') return { loi: 'Hành động không hợp lệ.' };
    const kq = fn.call(this, p, a) || {};
    if (!kq.loi) {
      p.lastAct = t;
      this._doi();
    }
    return kq;
  }

  _canNgoi(p) {
    return p.trangThai === 'ngoi' ? null : { loi: 'Bạn đang không ngồi trong quán.' };
  }

  _a_ngoi(p, a) {
    if (p.trangThai !== 'ngoi' && p.trangThai !== 'sanh') return { loi: 'Lúc này không chọn bàn được.' };
    if (this._vuCuaToi(p.id)) return { loi: 'Đang xô xát, chạy đi đâu!' };
    const cu = p.ban;
    if (cu) p.ban = null; // tạm nhấc ra để không tự chiếm chỗ của mình
    const so = this._chonBan(a.ban);
    if (!so) {
      p.ban = cu;
      return { loi: 'Bàn đó hết chỗ.' };
    }
    if (cu === so) {
      p.ban = cu;
      return {};
    }
    if (cu) {
      p.ban = cu;
      this._donBan(p, cu); // chuyển bàn: dọn phần của mình ở bàn cũ
    }
    p.ban = so;
    p.trangThai = 'ngoi';
    this._log(cu ? `${p.ten} chuyển từ bàn ${cu} sang bàn ${so}` : `${p.ten} quay lại, ngồi bàn ${so}`, 'vao', { ban: so });
    return {};
  }

  _a_goiMon(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const mon = this._monTheoId(a.mon);
    if (!mon) return { loi: 'Món không có trong thực đơn.' };
    if (this._gioiHan(p) < mon.gia) return { loi: 'Hết tiền rồi! Xin chủ cho thiếu, nhờ người bao, hoặc ngồi không.' };
    p.tab += mon.gia;
    if (CO_CON.has(mon.loai)) p.daUong++;
    this._datMon(p.ban, mon, p.id);
    this._log(`${p.ten} gọi ${mon.emoji} ${mon.ten}`, 'goi', { ban: p.ban });
    return {};
  }

  _a_moiBan(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const mon = this._monTheoId(a.mon);
    const so = Number(a.ban);
    if (!mon) return { loi: 'Món không có trong thực đơn.' };
    if (!Number.isInteger(so) || so < 1 || so > this.cfg.soBan || so === p.ban) return { loi: 'Chọn một bàn khác để mời.' };
    const khach = this._taiBan(so);
    if (!khach.length) return { loi: 'Bàn đó đang trống.' };
    const gia = mon.gia * khach.length;
    if (this._gioiHan(p) < gia) return { loi: `Mời cả bàn ${so} hết ${gia}k, không đủ tiền.` };
    p.tab += gia;
    if (CO_CON.has(mon.loai)) for (const k of khach) k.daUong++;
    for (const k of khach) this._datMon(so, mon, k.id); // mỗi phần thuộc về người nhận
    this._noi(p.id, `Mời bàn ${so} ${mon.emoji}!`);
    this._log(`${p.ten} (bàn ${p.ban}) mời cả bàn ${so} ${khach.length}× ${mon.emoji} ${mon.ten}`, 'moi', { ban: so, tuBan: p.ban });
    return {};
  }

  _a_khia(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const den = this.players.get(a.den);
    if (!den || den.trangThai !== 'ngoi' || den.id === p.id) return { loi: 'Người này không có trong quán.' };
    const cau = CAU_KHIA[Number(a.cau)];
    if (!cau) return { loi: 'Chỉ dùng câu khịa có sẵn.' };
    for (const v of this.vuViec.values()) {
      if (v.loai === 'khia' && v.den === den.id) return { loi: `${den.ten} đang bị người khác khịa rồi.` };
    }
    const v = { id: this._ma(), loai: 'khia', tu: p.id, den: den.id, cau, han: this.now() + this.cfg.khiaHan };
    this.vuViec.set(v.id, v);
    this._noi(p.id, `@${den.ten}: ${cau}`);
    this._log(`${p.ten} khịa ${den.ten}: “${cau}”`, 'khia', { ban: p.ban });
    return {};
  }

  _a_choang(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const den = this.players.get(a.den);
    if (!den || den.trangThai !== 'ngoi' || den.id === p.id) return { loi: 'Người này không có trong quán.' };
    if (this._vuCuaToi(p.id)) return { loi: 'Bạn đang trong một vụ xô xát rồi.' };
    this._batDauXoXat(p, den);
    return {};
  }

  _batDauXoXat(tu, den) {
    const v = {
      id: this._ma(),
      loai: 'xoxat',
      nguoi: [tu.id],
      muc: den.id,
      mucTraLoi: null,
      ban: tu.ban,
      banMuc: den.ban,
      batDau: this.now(),
      xem: new Set(),
      quay: new Set(),
    };
    this.vuViec.set(v.id, v);
    this._noi(tu.id, '💢 Choảng!!!', 4000);
    this._log(`💥 ${tu.ten} (bàn ${tu.ban}) lao vào choảng ${den.ten} (bàn ${den.ban})! Không ai can thì dân phòng tới.`, 'xoxat', { ban: den.ban });
    return v;
  }

  _a_traLoi(p, a) {
    const v = this.vuViec.get(a.vu);
    const chon = a.chon;
    if (!['bo_qua', 'nhin', 'dap_tra'].includes(chon)) return { loi: 'Lựa chọn không hợp lệ.' };
    if (!v) return { loi: 'Vụ này qua rồi.' };
    if (v.loai === 'khia') {
      if (v.den !== p.id) return { loi: 'Không phải chuyện của bạn.' };
      this.vuViec.delete(v.id);
      const tu = this.players.get(v.tu);
      if (chon === 'bo_qua') this._log(`${p.ten} bỏ qua câu khịa của ${tu?.ten}`, 'khia');
      else if (chon === 'nhin') {
        this._noi(p.id, '😤 …nhịn');
        this._log(`${p.ten} nghiến răng nhịn ${tu?.ten}`, 'khia');
      } else {
        if (!tu || tu.trangThai !== 'ngoi') return {};
        if (this._vuCuaToi(p.id)) return { loi: 'Bạn đang trong một vụ xô xát rồi.' };
        this._batDauXoXat(p, tu);
      }
      return {};
    }
    if (v.loai === 'xoxat') {
      if (v.muc !== p.id || v.mucTraLoi) return { loi: 'Không phải chuyện của bạn.' };
      v.mucTraLoi = chon;
      const tu = this.players.get(v.nguoi[0]);
      if (chon === 'dap_tra') {
        if (this._vuCuaToi(p.id)) return {};
        v.nguoi.push(p.id);
        this._noi(p.id, '💢 Ăn miếng trả miếng!', 4000);
        this._log(`${p.ten} đáp trả ${tu?.ten}! Hai bên lao vào nhau 💥`, 'xoxat', { ban: v.banMuc });
      } else if (chon === 'nhin') {
        this._noi(p.id, '😤 …nhịn');
        this._log(`${p.ten} ôm đầu nhịn, không đánh lại`, 'xoxat');
      } else this._log(`${p.ten} lờ đi như không có chuyện gì`, 'xoxat');
      return {};
    }
    return { loi: 'Vụ này không cần trả lời.' };
  }

  _a_canThiep(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const v = this.vuViec.get(a.vu);
    if (!v || v.loai !== 'xoxat') return { loi: 'Vụ này qua rồi.' };
    if (v.nguoi.includes(p.id) || v.muc === p.id) return { loi: 'Bạn đang là người trong cuộc.' };
    const ten = v.nguoi.map((id) => this.players.get(id)?.ten).filter(Boolean).join(' và ');
    if (a.chon === 'can') {
      this._dongXoXat(v);
      this._noi(p.id, '✋ Thôi thôi bỏ đi!');
      this._log(`🙌 ${p.ten} can ${ten}. Mọi chuyện êm xuôi.`, 'can', { ban: v.ban });
      return {};
    }
    if (a.chon === 'xem') {
      v.xem.add(p.id);
      return {};
    }
    if (a.chon === 'quay') {
      v.quay.add(p.id);
      this._noi(p.id, '📱 Quay lại, quay lại!');
      return {};
    }
    return { loi: 'Lựa chọn không hợp lệ.' };
  }

  _dongXoXat(v) {
    this.vuViec.delete(v.id);
    for (const id of v.quay) {
      const p = this.players.get(id);
      if (!p) continue;
      const view = Math.floor(500 + this.rng() * 200_000);
      this._log(`📱 Clip giả lập của ${p.ten} "lên xu hướng" với ${view.toLocaleString('vi-VN')} lượt xem (chỉ là trò chơi)`, 'clip');
    }
  }

  _a_xinThieu(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const so = Number(a.soTien);
    if (!Number.isInteger(so) || so < 5 || so > this.muc.baoBan) return { loi: `Xin từ 5k đến ${this.muc.baoBan}k thôi.` };
    if (this.hangDoiChu.some((x) => x.loai === 'thieu' && x.pid === p.id)) return { loi: 'Đang chờ chủ quán trả lời.' };
    this.hangDoiChu.push({ id: this._ma(), loai: 'thieu', pid: p.id, soTien: so, han: this.now() + this.cfg.thieuHan });
    this._noi(p.id, `🙏 Chủ ơi cho em thiếu ${so}k…`);
    this._log(`${p.ten} xin chủ quán cho thiếu ${so}k`, 'thieu', { ban: p.ban });
    return {};
  }

  _a_nhoBao(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    const den = this.players.get(a.den);
    const so = Number(a.soTien);
    if (!den || den.trangThai !== 'ngoi' || den.id === p.id) return { loi: 'Người này không có trong quán.' };
    if (!Number.isInteger(so) || so < 5 || so > 10_000) return { loi: 'Số tiền không hợp lệ.' };
    for (const y of this.yeuCau.values()) if (y.loai === 'bao' && y.tu === p.id) return { loi: 'Bạn đang chờ một người trả lời rồi.' };
    const y = { id: this._ma(), loai: 'bao', tu: p.id, den: den.id, soTien: so, han: this.now() + this.cfg.yeuCauHan };
    this.yeuCau.set(y.id, y);
    this._noi(p.id, `🥺 ${den.ten} ơi bao em ${so}k với!`);
    this._log(`${p.ten} nhờ ${den.ten} bao ${so}k`, 'bao');
    return {};
  }

  _a_traLoiYeuCau(p, a) {
    const y = this.yeuCau.get(a.yc);
    if (!y || y.den !== p.id) return { loi: 'Yêu cầu này không còn.' };
    this.yeuCau.delete(y.id);
    const tu = this.players.get(y.tu);
    if (!tu) return {};
    if (y.loai === 'bao') {
      if (!a.dongY) {
        this._log(`${p.ten} từ chối bao ${tu.ten}`, 'bao');
        return {};
      }
      if (p.tien < y.soTien) return { loi: 'Bạn không đủ tiền mặt để bao.' };
      p.tien -= y.soTien;
      tu.tien += y.soTien;
      this._noi(p.id, `😎 Để anh bao!`);
      this._log(`💸 ${p.ten} bao ${tu.ten} ${y.soTien}k`, 'bao');
      return {};
    }
    if (y.loai === 'cho') {
      if (!tu.roi || tu.roi.buoc !== 'cho_nguoi_cho') return {};
      if (!a.dongY) {
        tu.roi.buoc = 'chon_ve';
        tu.roi.thongBao = `${p.ten} không chở được, chọn cách khác nhé.`;
        this._log(`${p.ten} không chở ${tu.ten}`, 'roi');
        return {};
      }
      this._ketThuc(tu, `được ${p.ten} (tỉnh táo) chở về an toàn 🛵`, 'roi');
      this._canh('cho', { tu: tu.ten, nguoi: p.ten });
      return {};
    }
    return {};
  }

  // Ra về: "tra" = tính tiền, "quyt" = chuồn không trả.
  _a_roi(p, a) {
    const e = this._canNgoi(p);
    if (e) return e;
    if (this._vuCuaToi(p.id)) return { loi: 'Đang xô xát, chưa về được!' };
    if (a.cach === 'quyt') {
      if (p.tab <= 0) return { loi: 'Chưa gọi gì thì quỵt cái gì!' };
      const tab = p.tab;
      const so = p.ban;
      this._roiBan(p);
      p.trangThai = 'roi';
      if (this.rng() < this.cfg.tiLePhatHienQuyt) {
        p.roi = { buoc: 'cho_chu' };
        this.hangDoiChu.push({ id: this._ma(), loai: 'quyt', pid: p.id, soTien: tab, han: this.now() + this.cfg.quytHan });
        this._noi(p.id, '🏃💨');
        this._log(`🚨 ${p.ten} (bàn ${so}) định ăn quỵt ${tab}k thì bị phát hiện! Chờ chủ quán xử lý…`, 'quyt', { ban: so });
        this._canh('batQuyt', { ten: p.ten, ban: so });
      } else {
        p.tab = 0;
        this._log(`🏃💨 ${p.ten} chuồn êm, quán mất ${tab}k`, 'quyt', { ban: so });
        this._veNha(p);
      }
      return {};
    }
    if (this._gioiHan(p) < 0) return { loi: 'Không đủ tiền trả! Xin thiếu, nhờ bao hoặc… liều.' };
    const { tra, conLai } = this._thanhToan(p);
    this._log(`${p.ten} tính tiền ${tra}k${conLai ? `, ghi nợ ${conLai}k` : ''}, đứng dậy ra về`, 'roi', { ban: p.ban });
    this._roiBan(p);
    p.trangThai = 'roi';
    this._veNha(p);
    return {};
  }

  _veNha(p) {
    if (p.daUong > 0) {
      p.roi = { buoc: 'chon_ve' };
    } else {
      this._lenDuong(p, 'tự đi về');
    }
  }

  _a_chonVe(p, a) {
    if (p.trangThai !== 'roi' || p.roi?.buoc !== 'chon_ve') return { loi: 'Chưa đến lúc chọn cách về.' };
    if (a.cach === 'tu_lai') {
      this._lenDuong(p, 'tự lái xe về');
      return {};
    }
    if (a.cach === 'goi_xe') {
      if (p.tien < this.muc.goiXe) return { loi: `Gọi xe hết ${this.muc.goiXe}k, không đủ tiền.` };
      p.tien -= this.muc.goiXe;
      this._ketThuc(p, `gọi xe ôm về an toàn 🚕 (${this.muc.goiXe}k)`);
      this._canh('xeOm', { ten: p.ten });
      return {};
    }
    if (a.cach === 'nho_cho') {
      const den = this.players.get(a.den);
      if (!den || den.trangThai !== 'ngoi' || den.daUong > 0) return { loi: 'Chỉ nhờ được người đang ngồi trong quán và chưa uống cồn.' };
      const y = { id: this._ma(), loai: 'cho', tu: p.id, den: den.id, han: this.now() + this.cfg.yeuCauHan };
      this.yeuCau.set(y.id, y);
      p.roi = { buoc: 'cho_nguoi_cho', den: den.id };
      this._log(`${p.ten} nhờ ${den.ten} chở về`, 'roi');
      return {};
    }
    return { loi: 'Lựa chọn không hợp lệ.' };
  }

  _lenDuong(p, cach) {
    if (this.rng() < this.cfg.tiLeCsgt) {
      this._canh('csgt', { ten: p.ten });
      if (p.daUong > 0) {
        p.roi = { buoc: 'csgt', han: this.now() + this.cfg.csgtHan, phat: this.muc.phatCsgt };
        this._log(`🚓 CSGT dừng ${p.ten} kiểm tra nồng độ cồn… có mùi bia!`, 'csgt');
        return;
      }
      this._ketThuc(p, `${cach}, bị CSGT dừng kiểm tra: nồng độ cồn 0, đi tiếp 👍`, 'csgt');
      return;
    }
    this._ketThuc(p, `${cach}, đường vắng, về đến nhà 🏠`);
  }

  _a_csgt(p, a) {
    if (p.roi?.buoc !== 'csgt') return { loi: 'Không có CSGT nào ở đây.' };
    this._xuLyCsgt(p, a.chon);
    return {};
  }

  _xuLyCsgt(p, chon) {
    const phat = this.muc.phatCsgt;
    if (chon === 'nan_ni') {
      if (this.rng() < this.cfg.tiLeNanNi) {
        this._ketThuc(p, 'năn nỉ CSGT… được nhắc nhở cho qua lần này (chỉ là game!) 😅', 'csgt');
        return;
      }
      this._log(`${p.ten} năn nỉ không ăn thua!`, 'csgt');
      chon = 'nop_phat';
    }
    if (chon === 'nop_phat') {
      if (p.tien >= phat) {
        p.tien -= phat;
        this._ketThuc(p, `nộp phạt ${phat}k vì có cồn, xe bị giữ, đi bộ về 🚶`, 'csgt');
        return;
      }
      this._log(`${p.ten} không đủ ${phat}k nộp phạt`, 'csgt');
    }
    this._ketThuc(p, 'được mời về đồn làm việc 🚓', 'csgt');
  }

  // ---------- chủ quán ----------
  adminAct(a = {}) {
    if (this.dong) return { loi: 'Quán đã đóng.' };
    const fn = this['_c_' + a.type];
    if (typeof fn !== 'function') return { loi: 'Hành động không hợp lệ.' };
    const kq = fn.call(this, a) || {};
    if (!kq.loi) this._doi();
    return kq;
  }

  _layViec(id, loai) {
    const i = this.hangDoiChu.findIndex((x) => x.id === id && x.loai === loai);
    if (i < 0) return null;
    return this.hangDoiChu.splice(i, 1)[0];
  }

  _c_thieu(a) {
    const x = this._layViec(a.viec, 'thieu');
    if (!x) return { loi: 'Việc này đã xử lý rồi.' };
    const p = this.players.get(x.pid);
    if (!p || p.trangThai !== 'ngoi') return {};
    if (a.dongY) {
      p.chiu += x.soTien;
      this._log(`📒 Chủ quán cho ${p.ten} thiếu ${x.soTien}k`, 'thieu');
    } else this._log(`🙅 Chủ quán không cho ${p.ten} thiếu`, 'thieu');
    return {};
  }

  _c_quyt(a) {
    const x = this._layViec(a.viec, 'quyt');
    if (!x) return { loi: 'Việc này đã xử lý rồi.' };
    this._xuLyQuyt(x, a.chon === 'an_dap' ? 'an_dap' : 'dan_phong');
    return {};
  }

  _xuLyQuyt(x, chon) {
    const p = this.players.get(x.pid);
    if (!p || p.roi?.buoc !== 'cho_chu') return;
    if (chon === 'an_dap') {
      p.tab = 0;
      this._canh('anDap', { ten: p.ten });
      this._ketThuc(p, 'ăn quỵt bị bắt, ăn một trận “gậy hơi” hoạt hình rồi bị đuổi về 🤕', 'quyt');
    } else {
      const { tra } = this._thanhToan(p, this.muc.boiThuong);
      this._canh('danPhong', { ten: [p.ten] });
      this._ketThuc(p, `ăn quỵt bị bắt, dân phòng đưa về đồn, bồi thường ${tra}k 🚔`, 'quyt');
    }
  }

  _c_moiRa(a) {
    const p = this.players.get(a.pid);
    if (!p || p.trangThai === 've') return { loi: 'Không tìm thấy khách.' };
    this.tenCam.add(p.khoa);
    this.tokens.delete(p.token);
    this._roiBan(p);
    this.hangDoiChu = this.hangDoiChu.filter((x) => x.pid !== p.id);
    this.players.delete(p.id);
    this._log(`🚪 Chủ quán mời ${p.ten} ra khỏi quán`, 'moiRa');
    return { moiRa: p.id };
  }

  _c_dongQuan() {
    this.dong = true;
    this._log('Quán đóng cửa. Cảm ơn bà con!', 'dong');
    return {};
  }

  // ---------- đồng hồ ----------
  tick() {
    const t = this.now();
    const cfg = this.cfg;
    let doi = false;
    const truoc = this.bongBong.length;
    this.bongBong = this.bongBong.filter((b) => b.den > t);
    if (this.bongBong.length !== truoc) doi = true;

    for (const v of [...this.vuViec.values()]) {
      if (v.loai === 'khia' && t >= v.han) {
        this.vuViec.delete(v.id);
        doi = true;
      }
      if (v.loai === 'xoxat') {
        if (!v.mucTraLoi && t >= v.batDau + cfg.khiaHan) {
          v.mucTraLoi = 'bo_qua';
          doi = true;
        }
        if (t >= v.batDau + cfg.danPhongSau) {
          this._danPhong(v);
          doi = true;
        }
      }
    }

    for (const x of [...this.hangDoiChu]) {
      if (t < x.han) continue;
      this.hangDoiChu.splice(this.hangDoiChu.indexOf(x), 1);
      doi = true;
      if (x.loai === 'thieu') {
        const p = this.players.get(x.pid);
        if (p) this._log(`Chủ quán bận, chưa trả lời ${p.ten} (không cho thiếu)`, 'thieu');
      } else if (x.loai === 'quyt') this._xuLyQuyt(x, 'dan_phong');
    }

    for (const y of [...this.yeuCau.values()]) {
      if (t < y.han) continue;
      this.yeuCau.delete(y.id);
      doi = true;
      if (y.loai === 'cho') {
        const tu = this.players.get(y.tu);
        if (tu?.roi?.buoc === 'cho_nguoi_cho') {
          tu.roi = { buoc: 'chon_ve', thongBao: 'Không ai trả lời, chọn cách khác nhé.' };
        }
      }
    }

    for (const p of [...this.players.values()]) {
      if (p.trangThai === 'phuong' && t >= p.phuongDen) {
        p.trangThai = 'sanh';
        this._log(`${p.ten} được thả từ phường về, đang tìm bàn`, 'vao');
        doi = true;
      }
      if (p.roi?.buoc === 'csgt' && t >= p.roi.han) {
        this._xuLyCsgt(p, 'nop_phat');
        doi = true;
      }
      if (!p.online && p.trangThai !== 've' && t - p.matLuc >= cfg.matKetNoi) {
        if (p.trangThai === 'ngoi' || p.trangThai === 'sanh') this._thanhToan(p);
        if (p.roi?.buoc === 'cho_chu') continue; // chờ chủ/hết hạn xử lý
        if (p.roi?.buoc === 'csgt') this._xuLyCsgt(p, 'nop_phat');
        else this._ketThuc(p, 'mất sóng, tự động tính tiền và rời quán', 'roi');
        doi = true;
      }
      if (p.trangThai === 've' && (t - p.veLuc >= cfg.giuKetQua || (!p.online && t - p.matLuc >= cfg.matKetNoi))) {
        this.players.delete(p.id);
        this.tokens.delete(p.token);
        doi = true;
      }
    }
    if (doi) this._doi();
    return doi;
  }

  _danPhong(v) {
    this.vuViec.delete(v.id);
    const ds = v.nguoi.map((id) => this.players.get(id)).filter(Boolean);
    const ten = ds.map((p) => p.ten);
    for (const p of ds) {
      const { tra, conLai } = this._thanhToan(p, this.muc.boiThuong);
      this._roiBan(p);
      p.trangThai = 'phuong';
      p.phuongDen = this.now() + this.cfg.phuongThoiGian;
      this._log(`🚔 Dân phòng đưa ${p.ten} về phường. Thanh toán + bồi thường quán ${tra}k${conLai ? `, nợ ${conLai}k` : ''}`, 'danphong');
    }
    this._canh('danPhong', { ten, ban: v.ban });
    for (const id of v.quay) {
      const p = this.players.get(id);
      if (!p) continue;
      const view = Math.floor(5_000 + this.rng() * 900_000);
      this._log(`📱 Clip giả lập của ${p.ten} "nổ" ${view.toLocaleString('vi-VN')} lượt xem (chỉ là trò chơi)`, 'clip');
    }
  }

  // ---------- trạng thái gửi đi ----------
  publicState() {
    const t = this.now();
    const khach = [];
    for (const p of this.players.values()) {
      if (p.trangThai === 've') continue;
      khach.push({ id: p.id, ten: p.ten, mau: p.mau, mat: p.mat, hinh: p.hinh, ban: p.ban, trangThai: p.trangThai, online: p.online, tinhTao: p.daUong === 0, say: p.daUong >= 6 ? 2 : p.daUong >= 3 ? 1 : 0 });
    }
    const vu = [];
    for (const v of this.vuViec.values()) {
      if (v.loai === 'xoxat')
        vu.push({ id: v.id, loai: 'xoxat', nguoi: v.nguoi, muc: v.muc, ban: v.ban, banMuc: v.banMuc, conLai: Math.max(0, v.batDau + this.cfg.danPhongSau - t), xem: v.xem.size, quay: v.quay.size });
      else vu.push({ id: v.id, loai: 'khia', tu: v.tu, den: v.den });
    }
    return {
      quan: { id: this.id, ten: this.ten, dong: this.dong, soBan: this.cfg.soBan, ghe: this.cfg.ghePerBan, doanhThu: this.doanhThu, danPhongSau: this.cfg.danPhongSau },
      menu: this.menu,
      cauKhia: CAU_KHIA,
      muc: this.muc,
      khach,
      ban: this.ban.map((b) => ({ so: b.so, mon: b.mon.map((m) => ({ e: m.emoji, l: m.loai, to: m.to, ai: m.cuaAi })) })),
      vu,
      bongBong: this.bongBong.map((b) => ({ pid: b.pid, text: b.text })),
      nhatKy: this.nhatKy.slice(-15),
      hoatCanh: this.hoatCanh.filter((h) => t - h.t < 8000),
      choChu: this.hangDoiChu.length,
      t,
    };
  }

  privateState(pid) {
    const p = this.players.get(pid);
    if (!p) return null;
    const t = this.now();
    const viec = [];
    for (const v of this.vuViec.values()) {
      if (v.loai === 'khia' && v.den === pid)
        viec.push({ loai: 'biKhia', vu: v.id, tu: this.players.get(v.tu)?.ten, cau: v.cau, conLai: v.han - t });
      if (v.loai === 'xoxat' && v.muc === pid && !v.mucTraLoi)
        viec.push({ loai: 'biChoang', vu: v.id, tu: this.players.get(v.nguoi[0])?.ten, conLai: v.batDau + this.cfg.khiaHan - t });
    }
    for (const y of this.yeuCau.values()) {
      if (y.den === pid) viec.push({ loai: y.loai === 'bao' ? 'nhoBao' : 'nhoCho', yc: y.id, tu: this.players.get(y.tu)?.ten, soTien: y.soTien, conLai: y.han - t });
    }
    const choThieu = this.hangDoiChu.some((x) => x.loai === 'thieu' && x.pid === pid);
    return {
      id: p.id,
      ten: p.ten,
      mau: p.mau,
      mat: p.mat,
      tien: p.tien,
      tienDau: p.tienDau,
      tab: p.tab,
      chiu: p.chiu,
      no: p.no,
      conDung: this._gioiHan(p),
      daUong: p.daUong,
      ban: p.ban,
      trangThai: p.trangThai,
      phuongConLai: p.trangThai === 'phuong' ? Math.max(0, p.phuongDen - t) : 0,
      roi: p.roi ? { ...p.roi, conLai: p.roi.han ? p.roi.han - t : undefined } : null,
      choThieu,
      viec,
    };
  }

  adminState() {
    const t = this.now();
    return {
      hangDoi: this.hangDoiChu.map((x) => {
        const p = this.players.get(x.pid);
        return { id: x.id, loai: x.loai, ten: p?.ten, ban: p?.ban, soTien: x.soTien, conLai: x.han - t };
      }),
      khach: [...this.players.values()]
        .filter((p) => p.trangThai !== 've')
        .map((p) => ({ id: p.id, ten: p.ten, ban: p.ban, trangThai: p.trangThai, tien: p.tien, tab: p.tab, no: p.no, daUong: p.daUong, online: p.online })),
    };
  }
}

module.exports = { Quan, THUC_DON_MAC_DINH, CAU_KHIA, MAC_DINH, kiemTraTen, kiemTraThucDon, tinhMucTien, boDau };
