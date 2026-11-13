'use strict';
// ===== Xác định quán và vai trò =====
const qid = (location.pathname.match(/^\/q\/([\w-]+)/) || [])[1] || new URLSearchParams(location.search).get('q');
const laLive = new URLSearchParams(location.search).has('live');
const KHOA_CHU = 'nhau:chu:' + qid;
const KHOA_KHACH = 'nhau:khach:' + qid;

const luu = {
  get(store, k) {
    try { return store.getItem(k); } catch { return null; }
  },
  set(store, k, v) {
    try { v == null ? store.removeItem(k) : store.setItem(k, v); } catch {}
  },
};

// Đường dẫn quản lý: lấy token từ #chu=… rồi xóa khỏi thanh địa chỉ để khỏi lộ.
let tokenChu = null;
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('chu')) {
  tokenChu = hash.get('chu');
  luu.set(sessionStorage, KHOA_CHU, tokenChu);
  history.replaceState(null, '', location.pathname + location.search);
} else tokenChu = luu.get(sessionStorage, KHOA_CHU);

const vaiTro = laLive ? 'live' : tokenChu ? 'chu' : 'khach';
document.body.classList.add('vai-' + vaiTro);

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const giay = (ms) => Math.max(0, Math.ceil(ms / 1000)) + 's';

const S = { pub: null, me: null, admin: null, myId: null, target: null, targetBan: null, tab: 'goi', boQua: new Set(), daThay: new Set(), daDong: false };

// ===== Kết nối =====
let ws;
let thuLai = 0;
function ketNoi() {
  if (!qid) return dongMan('Đường dẫn quán không hợp lệ.');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?q=${encodeURIComponent(qid)}`);
  ws.onopen = () => {
    thuLai = 0;
    const token = vaiTro === 'chu' ? tokenChu : vaiTro === 'khach' ? luu.get(localStorage, KHOA_KHACH) : null;
    gui({ type: 'hello', vaiTro, token });
  };
  ws.onmessage = (e) => nhan(JSON.parse(e.data));
  ws.onclose = () => {
    if (S.daDong) return;
    thongBao('Mất kết nối, đang nối lại…');
    setTimeout(ketNoi, Math.min(8000, 500 * 2 ** thuLai++));
  };
}
function gui(m) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(m));
}
const hanhDong = (a) => gui({ type: 'act', a });
const chuLam = (a) => gui({ type: 'admin', a });

function nhan(m) {
  if (m.type === 'pub') {
    S.pub = m.s;
    veSan();
    if (vaiTro === 'khach') veKhach();
    if (vaiTro === 'chu') veChu();
  } else if (m.type === 'me') {
    S.me = m.s;
    veKhach();
  } else if (m.type === 'admin') {
    S.admin = m.s;
    veChu();
  } else if (m.type === 'joined') {
    S.myId = m.id;
    luu.set(localStorage, KHOA_KHACH, m.token);
  } else if (m.type === 'loi') {
    if (m.fatal) {
      luu.set(sessionStorage, KHOA_CHU, null);
      return dongMan(m.msg);
    }
    if (vaiTro === 'khach' && !S.myId) $('#k-loi-vao').textContent = m.msg;
    else thongBao(m.msg);
  } else if (m.type === 'dong') {
    luu.set(localStorage, KHOA_KHACH, null);
    dongMan(m.msg);
  }
}

function dongMan(msg) {
  S.daDong = true;
  const el = $('#man-dong');
  el.innerHTML = `<div><h2>🍻</h2><p>${esc(msg)}</p></div>`;
  el.hidden = false;
}

let hetTB;
function thongBao(msg) {
  const el = $('#thong-bao');
  el.textContent = msg;
  el.classList.add('hien');
  clearTimeout(hetTB);
  hetTB = setTimeout(() => el.classList.remove('hien'), 2600);
}

// ===== Sân khấu 2D =====
const cacheBan = new Map();
function khachTheoId() {
  const m = new Map();
  for (const k of S.pub.khach) m.set(k.id, k);
  return m;
}

function veSan() {
  const p = S.pub;
  if (!p) return;
  document.title = `${p.quan.ten} — Đi nhậu online`;
  $('#s-ten').textContent = '🍻 ' + p.quan.ten;
  $('#s-moi').innerHTML = `Vào quán: <b>${esc(location.host)}/q/${esc(p.quan.id)}</b>`;
  const ngoi = p.khach.filter((k) => k.trangThai !== 've').length;
  $('#s-dem').innerHTML = `👥 ${ngoi}/${p.quan.soBan * p.quan.ghe}`;

  const luoi = $('#s-luoi');
  if (!luoi.children.length) {
    for (let i = 1; i <= p.quan.soBan; i++) {
      const d = document.createElement('div');
      d.className = 'ban';
      d.dataset.ban = i;
      luoi.appendChild(d);
    }
  }
  const theoBan = new Map();
  for (const k of p.khach) if (k.trangThai === 'ngoi' && k.ban) (theoBan.get(k.ban) || theoBan.set(k.ban, []).get(k.ban)).push(k);
  const bong = new Map(p.bongBong.map((b) => [b.pid, b.text]));
  const danh = new Set();
  const banDanh = new Map();
  for (const v of p.vu) {
    if (v.loai !== 'xoxat') continue;
    v.nguoi.forEach((id) => danh.add(id));
    banDanh.set(v.ban, v);
    banDanh.set(v.banMuc, v);
  }
  const bKhia = new Set(p.vu.filter((v) => v.loai === 'khia').map((v) => v.den));

  for (const b of p.ban) {
    const ds = theoBan.get(b.so) || [];
    const v = banDanh.get(b.so);
    const ghe = [0, 1, 2, 3]
      .map((i) => {
        const k = ds[i];
        if (!k) return `<div class="ghe g${i} trong"></div>`;
        const cls = ['nguoi', k.say ? 'say' + k.say : '', danh.has(k.id) ? 'danh' : '', !k.online ? 'off' : '', S.target === k.id ? 'chon' : '', k.id === S.myId ? 'toi' : '', bKhia.has(k.id) ? 'bi-khia' : ''].join(' ');
        const bb = bong.get(k.id);
        return `<div class="ghe g${i}"><div class="${cls}" data-pid="${k.id}" style="--mau:${k.mau}"><span>${esc(k.mat)}</span></div><div class="ten">${esc(k.ten)}</div>${bb ? `<div class="bong">${esc(bb)}</div>` : ''}</div>`;
      })
      .join('');
    const mon = b.mon.slice(-8).map((e) => `<span>${esc(e)}</span>`).join('');
    const html = `<div class="so-ban">Bàn ${b.so}</div><div class="mat-ban">${mon}</div>${ghe}${v ? `<div class="no">💥</div><div class="dem-nguoc">🚔 ${giay(v.conLai)}</div>` : ''}`;
    const el = luoi.children[b.so - 1];
    el.classList.toggle('co-xoxat', !!v);
    el.classList.toggle('chon', S.targetBan === b.so);
    el.classList.toggle('cua-toi', S.me?.ban === b.so && S.me?.trangThai === 'ngoi');
    el.classList.toggle('day', ds.length >= p.quan.ghe);
    if (cacheBan.get(b.so) !== html) {
      cacheBan.set(b.so, html);
      el.innerHTML = html;
    }
  }

  // chỉ vẽ lại nhật ký khi có dòng mới, để hiệu ứng không chạy lại liên tục
  const nkMoi = p.nhatKy.slice().reverse().slice(0, 12);
  const nkKhoa = nkMoi.map((e) => e.id).join();
  if (nkKhoa !== S.nkKhoa) {
    S.nkKhoa = nkKhoa;
    $('#s-nhatky').innerHTML = `<h4>Chuyện trong quán</h4>${nkMoi.map((e) => `<div class="dong-nk nk-${esc(e.loai)}">${esc(e.text)}</div>`).join('')}`;
  }

  // Hoạt cảnh trên đường: dân phòng, CSGT, xe ôm…
  const duong = $('#s-duong');
  for (const h of p.hoatCanh) {
    if (S.daThay.has(h.id)) continue;
    S.daThay.add(h.id);
    const ten = esc(Array.isArray(h.ten) ? h.ten.join(', ') : h.ten);
    const noiDung = {
      danPhong: `👮‍♂️👮 Dân phòng tới! Đưa <b>${ten}</b> về phường 🚔`,
      csgt: `🚓 CSGT kiểm tra nồng độ cồn: <b>${ten}</b> 👮‍♂️🛑`,
      xeOm: `🛵💨 <b>${ten}</b> gọi xe ôm về an toàn`,
      cho: `🛵 <b>${esc(h.nguoi)}</b> chở <b>${esc(h.tu)}</b> về nhà`,
      anDap: `🤕 <b>${ten}</b> ăn quỵt bị bắt, ăn đòn hoạt hình 🧹💫`,
      batQuyt: `🚨 Bắt quả tang <b>${ten}</b> định ăn quỵt!`,
    }[h.loai];
    if (!noiDung) continue;
    const d = document.createElement('div');
    d.className = 'canh canh-' + h.loai;
    d.innerHTML = noiDung;
    duong.appendChild(d);
    setTimeout(() => d.remove(), 7800);
  }
}

// Co giãn sân khấu 1280×720 cho vừa khung
function coGian() {
  const khung = $('#khung-san');
  const san = $('#san');
  const w = khung.clientWidth;
  const h = vaiTro === 'live' ? window.innerHeight : Infinity;
  const s = Math.min(w / 1280, h / 720);
  san.style.transform = `scale(${s})`;
  san.style.left = vaiTro === 'live' ? (w - 1280 * s) / 2 + 'px' : '0';
  khung.style.height = 720 * s + 'px';
}
window.addEventListener('resize', coGian);

// Chạm vào sơ đồ: chọn người / chọn bàn
$('#san').addEventListener('click', (e) => {
  if (vaiTro !== 'khach') return;
  const nguoi = e.target.closest('.nguoi');
  const ban = e.target.closest('.ban');
  if (!S.myId || S.me?.trangThai === 'sanh') {
    if (ban) {
      if (S.myId) hanhDong({ type: 'ngoi', ban: Number(ban.dataset.ban) });
      else vaoQuan(Number(ban.dataset.ban));
    }
    return;
  }
  if (nguoi && nguoi.dataset.pid !== S.myId) {
    S.target = nguoi.dataset.pid;
    if (!['giao', 'tien'].includes(S.tab)) S.tab = 'giao';
  } else if (ban) {
    S.targetBan = Number(ban.dataset.ban);
    if (S.tab !== 'moi' && S.targetBan !== S.me?.ban) S.tab = 'moi';
  }
  cacheBan.clear();
  veSan();
  veKhach(true);
});

// ===== Giao diện khách =====
function vaoQuan(ban) {
  const ten = $('#k-ten').value.trim();
  $('#k-loi-vao').textContent = '';
  if (!ten) return ($('#k-loi-vao').textContent = 'Nhập tên trước đã.');
  gui({ type: 'join', ten, ban });
}
document.querySelectorAll('[data-vao]').forEach((b) => (b.onclick = () => vaoQuan(b.dataset.vao)));
$('#k-tab').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (!t) return;
  S.tab = t.dataset.tab;
  veKhach(true);
});

function chonNguoi(loc = () => true) {
  const ds = S.pub.khach.filter((k) => k.trangThai === 'ngoi' && k.id !== S.myId && loc(k));
  if (S.target && !ds.some((k) => k.id === S.target)) S.target = null;
  return `<select class="chon-nguoi"><option value="">— chọn người (hoặc chạm vào sơ đồ) —</option>${ds
    .map((k) => `<option value="${k.id}" ${k.id === S.target ? 'selected' : ''}>${esc(k.ten)} · bàn ${k.ban}</option>`)
    .join('')}</select>`;
}

let chuKyTruoc = '';
function veKhach(epBuoc = false) {
  if (vaiTro !== 'khach' || !S.pub) return;
  const me = S.me;
  const coMe = S.myId && me;
  $('#k-vao').hidden = !!coMe;
  $('#k-choi').hidden = !coMe;
  if (!coMe) {
    $('#k-vao-ten').textContent = 'Vào ' + S.pub.quan.ten;
    return;
  }
  const t = S.pub.t;
  $('#k-vi').innerHTML = `<span class="mat-nho" style="--mau:${me.mau}">${esc(me.mat)}</span><b>${esc(me.ten)}</b>
    <span>👛 ${me.tien}k</span><span>🧾 ${me.tab}k</span>${me.chiu ? `<span>📒 được thiếu ${me.chiu}k</span>` : ''}${me.no ? `<span class="do">nợ ${me.no}k</span>` : ''}
    <span>🍺×${me.daUong}</span>${me.ban && me.trangThai === 'ngoi' ? `<span>🪑 bàn ${me.ban}</span>` : ''}`;

  // Việc cần trả lời ngay
  let viec = '';
  for (const v of me.viec) {
    if (v.loai === 'biKhia')
      viec += `<div class="the nong"><b>${esc(v.tu)}</b> khịa bạn: “${esc(v.cau)}” <small>${giay(v.conLai)}</small>
        <div class="hang-nut"><button class="nut" data-tl="${v.vu}" data-chon="bo_qua">Bỏ qua</button><button class="nut" data-tl="${v.vu}" data-chon="nhin">Nhịn 😤</button><button class="nut nguy" data-tl="${v.vu}" data-chon="dap_tra">Đáp trả 👊</button></div></div>`;
    if (v.loai === 'biChoang')
      viec += `<div class="the nong">💥 <b>${esc(v.tu)}</b> lao vào choảng bạn! <small>${giay(v.conLai)}</small>
        <div class="hang-nut"><button class="nut" data-tl="${v.vu}" data-chon="bo_qua">Bỏ qua</button><button class="nut" data-tl="${v.vu}" data-chon="nhin">Nhịn 😤</button><button class="nut nguy" data-tl="${v.vu}" data-chon="dap_tra">Đáp trả 👊</button></div></div>`;
    if (v.loai === 'nhoBao')
      viec += `<div class="the">🥺 <b>${esc(v.tu)}</b> nhờ bạn bao <b>${v.soTien}k</b> <small>${giay(v.conLai)}</small>
        <div class="hang-nut"><button class="nut chinh" data-yc="${v.yc}" data-dy="1">Bao luôn 😎</button><button class="nut" data-yc="${v.yc}" data-dy="0">Thôi</button></div></div>`;
    if (v.loai === 'nhoCho')
      viec += `<div class="the">🛵 <b>${esc(v.tu)}</b> đã uống, nhờ bạn chở về <small>${giay(v.conLai)}</small>
        <div class="hang-nut"><button class="nut chinh" data-yc="${v.yc}" data-dy="1">Chở</button><button class="nut" data-yc="${v.yc}" data-dy="0">Không</button></div></div>`;
  }
  if (me.trangThai === 'ngoi') {
    const kt = khachTheoId();
    for (const v of S.pub.vu) {
      if (v.loai !== 'xoxat' || v.nguoi.includes(S.myId) || v.muc === S.myId || S.boQua.has(v.id)) continue;
      const ten = v.nguoi.map((id) => kt.get(id)?.ten).filter(Boolean).join(' vs ');
      viec += `<div class="the canh-bao-xx">💥 Xô xát ở bàn ${v.banMuc}: <b>${esc(ten)}</b>. Dân phòng tới sau ${giay(v.conLai)}
        <div class="hang-nut"><button class="nut chinh" data-ct="${v.id}" data-chon="can">Can ✋</button><button class="nut" data-ct="${v.id}" data-chon="xem">Đứng xem 👀</button><button class="nut" data-ct="${v.id}" data-chon="quay">Quay clip 📱</button><button class="nut" data-mk="${v.id}">Mặc kệ</button></div></div>`;
    }
  }
  $('#k-viec').innerHTML = viec;

  // Màn hình đặc biệt (không ngồi bàn)
  const tab = $('#k-tab');
  const nd = $('#k-noi-dung');
  let rieng = '';
  if (me.trangThai === 've') {
    rieng = `<div class="the ket-qua"><h3>Bạn đã về</h3><p>${esc(me.roi?.ketQua || '')}</p><p>Tiêu ${me.tienDau - me.tien}k / ${me.tienDau}k${me.no ? `, còn nợ quán ${me.no}k` : ''}.</p>
      <button class="nut chinh" id="vao-lai">Vào quán lại</button></div>`;
  } else if (me.trangThai === 'phuong') {
    rieng = `<div class="the"><h3>🚔 Đang ở phường</h3><p>Viết bản kiểm điểm… được thả sau ${giay(me.phuongConLai)}.</p></div>`;
  } else if (me.trangThai === 'sanh') {
    rieng = `<div class="the"><h3>Được thả rồi! Ngồi đâu đây?</h3><div class="hang-nut"><button class="nut chinh" data-ngoi="ghep">Ngồi ghép</button><button class="nut" data-ngoi="rieng">Bàn riêng</button></div><p class="ghi-chu">Hoặc chạm vào bàn trên sơ đồ.</p></div>`;
  } else if (me.trangThai === 'roi') {
    const r = me.roi || {};
    if (r.buoc === 'chon_ve') {
      rieng = `<div class="the"><h3>Đã uống ${me.daUong} ly có cồn. Về bằng gì?</h3>${r.thongBao ? `<p class="do">${esc(r.thongBao)}</p>` : ''}
        <div class="hang-nut doc">
          <button class="nut chinh" data-ve="goi_xe">🚕 Gọi xe ôm (${S.pub.muc.goiXe}k)</button>
          <div class="hang-nut">${chonNguoi((k) => k.tinhTao)}<button class="nut" data-ve="nho_cho">🛵 Nhờ người tỉnh táo chở</button></div>
          <button class="nut nguy" data-ve="tu_lai">🏍️ Tự lái về (liều)</button>
        </div><p class="ghi-chu">Chỉ nhờ được người chưa uống ly có cồn nào.</p></div>`;
    } else if (r.buoc === 'cho_nguoi_cho') rieng = `<div class="the"><h3>Đang chờ người ta trả lời…</h3></div>`;
    else if (r.buoc === 'csgt')
      rieng = `<div class="the nong"><h3>🚓 CSGT yêu cầu dừng xe, thổi nồng độ cồn!</h3><p>Có cồn. Chọn trong ${giay(r.conLai)} (không chọn = nộp phạt).</p>
        <div class="hang-nut doc"><button class="nut" data-csgt="nan_ni">🙏 Năn nỉ</button><button class="nut chinh" data-csgt="nop_phat">💵 Nộp phạt ${r.phat}k</button><button class="nut" data-csgt="ve_don">🚓 Về đồn</button></div>
        <p class="ghi-chu nho">Tình huống giả lập trong game, không phải tư vấn pháp lý.</p></div>`;
    else if (r.buoc === 'cho_chu') rieng = `<div class="the nong"><h3>🚨 Bị bắt quả tang ăn quỵt!</h3><p>Chủ quán đang quyết định số phận của bạn…</p></div>`;
  }
  $('#k-man-rieng').innerHTML = rieng;
  tab.hidden = !!rieng;
  nd.hidden = !!rieng;
  if (rieng) return;

  tab.querySelectorAll('button').forEach((b) => b.classList.toggle('bat', b.dataset.tab === S.tab));
  // chỉ vẽ lại nội dung tab khi dữ liệu liên quan đổi, để không mất ô đang nhập
  const nguoiKey = S.pub.khach.filter((k) => k.trangThai === 'ngoi').map((k) => k.id + k.ban).join();
  const chuKy = [S.tab, me.conDung, me.tien, me.tab, me.chiu, me.choThieu, me.ban, S.target, S.targetBan, nguoiKey].join('|');
  if (!epBuoc && chuKy === chuKyTruoc) return;
  chuKyTruoc = chuKy;
  const giuLai = {};
  nd.querySelectorAll('input[id]').forEach((i) => (giuLai[i.id] = i.value));
  nd.innerHTML = noiDungTab(me);
  for (const [id, val] of Object.entries(giuLai)) {
    const i = nd.querySelector('#' + id);
    if (i) i.value = val;
  }
}

function nutMon(m, gia, data) {
  const het = S.me.conDung < gia;
  return `<button class="mon ${het ? 'het' : ''}" ${data} ${het ? 'disabled' : ''}><span class="e">${esc(m.emoji)}</span><span>${esc(m.ten)}</span><b>${gia}k</b></button>`;
}

function noiDungTab(me) {
  const p = S.pub;
  const het = me.conDung < Math.min(...p.menu.map((m) => m.gia));
  const canhBaoHet = het ? `<p class="do">Hết tiền rồi! Ngồi không, sang tab 💸 Tiền để xin thiếu / nhờ bao, hoặc… 🚪 Về.</p>` : '';
  if (S.tab === 'goi') {
    return `${canhBaoHet}<p class="ghi-chu">Còn dùng được: <b>${me.conDung}k</b> (trả khi ra về)</p><div class="luoi-mon">${p.menu.map((m) => nutMon(m, m.gia, `data-goi="${m.id}"`)).join('')}</div>`;
  }
  if (S.tab === 'moi') {
    const ds = p.ban.map((b) => ({ so: b.so, n: p.khach.filter((k) => k.trangThai === 'ngoi' && k.ban === b.so).length })).filter((b) => b.n && b.so !== me.ban);
    if (S.targetBan && !ds.some((b) => b.so === S.targetBan)) S.targetBan = null;
    const b = ds.find((x) => x.so === S.targetBan);
    return `<select class="chon-ban-moi"><option value="">— chọn bàn để mời (hoặc chạm sơ đồ) —</option>${ds.map((x) => `<option value="${x.so}" ${x.so === S.targetBan ? 'selected' : ''}>Bàn ${x.so} (${x.n} người)</option>`).join('')}</select>
      ${b ? `<p class="ghi-chu">Mời cả bàn ${b.so}: mỗi người một phần.</p><div class="luoi-mon">${p.menu.map((m) => nutMon(m, m.gia * b.n, `data-moi="${m.id}"`)).join('')}</div>` : '<p class="ghi-chu">Chọn một bàn đang có người.</p>'}`;
  }
  if (S.tab === 'giao') {
    return `${chonNguoi()}
      <h4>Khịa (câu có sẵn)</h4><div class="ds-khia">${p.cauKhia.map((c, i) => `<button class="nut nho" data-khia="${i}">${esc(c)}</button>`).join('')}</div>
      <h4>Hoặc…</h4><button class="nut nguy" data-choang="1">👊 Choảng!</button>
      <p class="ghi-chu nho">Choảng mà không ai can trong ${Math.round(p.quan.danPhongSau / 1000)}s thì dân phòng tới, đưa về phường và bồi thường quán ${p.muc.boiThuong}k.</p>`;
  }
  if (S.tab === 'tien') {
    return `<div class="the"><p>👛 Ví: <b>${me.tien}k</b> · 🧾 Hóa đơn: <b>${me.tab}k</b> · 📒 Được thiếu: <b>${me.chiu}k</b>${me.no ? ` · Nợ: <b class="do">${me.no}k</b>` : ''}</p></div>
      <h4>Xin chủ quán cho thiếu</h4>
      <div class="hang-nut"><input id="o-thieu" type="number" min="5" max="${p.muc.baoBan}" value="50" inputmode="numeric"><button class="nut" data-thieu="1" ${me.choThieu ? 'disabled' : ''}>${me.choThieu ? 'Đang chờ chủ…' : '🙏 Xin thiếu'}</button></div>
      <h4>Nhờ người khác bao</h4>
      ${chonNguoi()}
      <div class="hang-nut"><input id="o-bao" type="number" min="5" value="50" inputmode="numeric"><button class="nut" data-bao="1">🥺 Nhờ bao</button></div>`;
  }
  if (S.tab === 've') {
    return `<div class="the"><p>Hóa đơn của bạn: <b>${me.tab}k</b>. Ví: ${me.tien}k${me.chiu ? `, được thiếu ${me.chiu}k` : ''}.</p>
      <div class="hang-nut doc"><button class="nut chinh" data-roi="tra">💵 Tính tiền và về</button>
      <button class="nut nguy" data-roi="quyt" ${me.tab ? '' : 'disabled'}>🏃 Chuồn (ăn quỵt)</button></div>
      <p class="ghi-chu nho">Ăn quỵt có thể bị phát hiện; khi đó chủ quán quyết định xử lý thế nào.</p></div>`;
  }
  return '';
}

// Bấm nút trong giao diện khách
$('#bang-khach').addEventListener('change', (e) => {
  if (e.target.matches('.chon-nguoi')) {
    S.target = e.target.value || null;
    cacheBan.clear();
    veSan();
  }
  if (e.target.matches('.chon-ban-moi')) {
    S.targetBan = Number(e.target.value) || null;
    cacheBan.clear();
    veSan();
    veKhach(true);
  }
});
$('#bang-khach').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.goi) hanhDong({ type: 'goiMon', mon: d.goi });
  else if (d.moi) hanhDong({ type: 'moiBan', mon: d.moi, ban: S.targetBan });
  else if (d.khia) S.target ? hanhDong({ type: 'khia', den: S.target, cau: Number(d.khia) }) : thongBao('Chọn người để khịa trước.');
  else if (d.choang) {
    if (!S.target) return thongBao('Chọn người trước.');
    if (confirm('Choảng thật à? Không ai can là dân phòng tới đấy!')) hanhDong({ type: 'choang', den: S.target });
  } else if (d.tl) hanhDong({ type: 'traLoi', vu: d.tl, chon: d.chon });
  else if (d.ct) hanhDong({ type: 'canThiep', vu: d.ct, chon: d.chon });
  else if (d.mk) {
    S.boQua.add(d.mk);
    veKhach(true);
  } else if (d.yc) hanhDong({ type: 'traLoiYeuCau', yc: d.yc, dongY: d.dy === '1' });
  else if (d.thieu) hanhDong({ type: 'xinThieu', soTien: Number($('#o-thieu').value) });
  else if (d.bao) S.target ? hanhDong({ type: 'nhoBao', den: S.target, soTien: Number($('#o-bao').value) }) : thongBao('Chọn người để nhờ bao.');
  else if (d.roi) {
    if (d.roi === 'quyt' && !confirm('Chuồn thật à? Bị bắt là chủ quán xử đấy!')) return;
    hanhDong({ type: 'roi', cach: d.roi });
  } else if (d.ve) {
    if (d.ve === 'nho_cho' && !S.target) return thongBao('Chọn người tỉnh táo trước.');
    hanhDong({ type: 'chonVe', cach: d.ve, den: S.target });
  } else if (d.csgt) hanhDong({ type: 'csgt', chon: d.csgt });
  else if (d.ngoi) hanhDong({ type: 'ngoi', ban: d.ngoi });
  else if (b.id === 'vao-lai') {
    luu.set(localStorage, KHOA_KHACH, null);
    gui({ type: 'quen' });
    S.myId = null;
    S.me = null;
    veKhach();
  }
});

// ===== Giao diện chủ quán =====
function veChu() {
  if (vaiTro !== 'chu' || !S.pub || !S.admin) return;
  const a = S.admin;
  $('#c-so-viec').textContent = a.hangDoi.length;
  $('#c-hang-doi').innerHTML =
    a.hangDoi
      .map((x) =>
        x.loai === 'thieu'
          ? `<div class="the">🙏 <b>${esc(x.ten)}</b>${x.ban ? ` (bàn ${x.ban})` : ''} xin thiếu <b>${x.soTien}k</b> <small>${giay(x.conLai)}</small>
            <div class="hang-nut"><button class="nut chinh" data-thieu="${x.id}" data-dy="1">Cho thiếu</button><button class="nut" data-thieu="${x.id}" data-dy="0">Không</button></div></div>`
          : `<div class="the nong">🚨 <b>${esc(x.ten)}</b> định ăn quỵt <b>${x.soTien}k</b> <small>${giay(x.conLai)} → tự báo dân phòng</small>
            <div class="hang-nut"><button class="nut" data-quyt="${x.id}" data-chon="an_dap">🧹 Cho ăn đập (hoạt hình)</button><button class="nut chinh" data-quyt="${x.id}" data-chon="dan_phong">🚔 Báo dân phòng</button></div></div>`
      )
      .join('') || '<p class="ghi-chu">Chưa có việc gì.</p>';
  $('#c-so-khach').textContent = `(${a.khach.length})`;
  $('#c-khach').innerHTML = a.khach
    .map(
      (k) => `<div class="dong-khach ${k.online ? '' : 'off'}"><span><b>${esc(k.ten)}</b> ${k.ban ? `· bàn ${k.ban}` : `· ${esc(k.trangThai)}`}</span>
      <span class="so">👛${k.tien} 🧾${k.tab}${k.no ? ` nợ${k.no}` : ''} 🍺${k.daUong}</span><button class="nut nho nguy" data-moira="${k.id}" title="Mời ra khỏi quán">Mời ra</button></div>`
    )
    .join('');
}
$('#bang-chu').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.thieu) chuLam({ type: 'thieu', viec: d.thieu, dongY: d.dy === '1' });
  else if (d.quyt) chuLam({ type: 'quyt', viec: d.quyt, chon: d.chon });
  else if (d.moira) {
    if (confirm('Mời khách này ra khỏi quán? Họ sẽ không vào lại được bằng tên/mạng này.')) chuLam({ type: 'moiRa', pid: d.moira });
  } else if (b.id === 'c-dong') {
    if (confirm('Đóng quán? Toàn bộ dữ liệu phiên sẽ bị xóa, mọi người bị ngắt kết nối.')) chuLam({ type: 'dongQuan' });
  } else if (d.copy) {
    navigator.clipboard.writeText($('#' + d.copy).value).then(() => thongBao('Đã chép'));
  }
});

// ===== Khởi động =====
if (vaiTro === 'chu') {
  $('#bang-chu').hidden = false;
  $('#c-link-khach').value = `${location.origin}/q/${qid}`;
  $('#c-link-live').href = `/q/${qid}?live=1`;
}
if (vaiTro === 'khach') $('#bang-khach').hidden = false;
coGian();
new ResizeObserver(coGian).observe($('#khung-san'));
ketNoi();
