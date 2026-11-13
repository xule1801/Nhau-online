'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Quan, THUC_DON_MAC_DINH, kiemTraTen, kiemTraThucDon, tinhMucTien } = require('../src/game');

// Quán với đồng hồ và số ngẫu nhiên điều khiển được
function taoQuan(cauHinh = {}, rngVals = []) {
  let t = 1_000_000;
  const vals = [...rngVals];
  const q = new Quan({ id: 'test', ten: 'Quán Test', cauHinh: { hoiChieu: 0, ...cauHinh }, rng: () => (vals.length ? vals.shift() : 0.5), now: () => t });
  q.troi = (ms) => {
    t += ms;
    q.tick();
  };
  q.datRng = (...v) => vals.push(...v);
  return q;
}
const vao = (q, ten, ban = 'ghep') => {
  const r = q.join(ten, ban);
  assert.ok(!r.loi, r.loi);
  return q.players.get(r.id);
};
const ok = (r) => assert.ok(!r.loi, r.loi);

test('kiểm tra tên: chặn tên tục, giả mạo; nhận tên tiếng Việt', () => {
  assert.ok(kiemTraTen('Tuấn Bia').ten);
  assert.ok(kiemTraTen('Đức 99').ten);
  assert.ok(kiemTraTen('dm ông').loi);
  assert.ok(kiemTraTen('Chủ Quán').loi);
  assert.ok(kiemTraTen('CSGT 113').loi);
  assert.ok(kiemTraTen('a').loi);
  assert.ok(kiemTraTen('<script>').loi);
});

test('thực đơn: cần cả đồ uống và mồi, giá hợp lệ', () => {
  assert.ok(kiemTraThucDon(THUC_DON_MAC_DINH).menu);
  assert.ok(kiemTraThucDon([{ ten: 'Bia', gia: 10, loai: 'bia' }, { ten: 'Bia 2', gia: 10, loai: 'bia' }]).loi);
  assert.ok(kiemTraThucDon([{ ten: 'Bia', gia: 0, loai: 'bia' }, { ten: 'Lạc', gia: 10, loai: 'moi' }]).loi);
});

test('mức tiền tính theo giá thực đơn', () => {
  const m = tinhMucTien(kiemTraThucDon(THUC_DON_MAC_DINH).menu);
  assert.equal(m.toiThieu, 3 + 15); // trà đá rẻ nhất + lạc rang rẻ nhất
  assert.ok(m.toiDa >= 2 * m.baoBan);
  const q = taoQuan({}, [0, 0, 0, 0.9999]);
  const nghèo = vao(q, 'Nghèo');
  assert.ok(nghèo.tien >= m.toiThieu - 5 && nghèo.tien <= m.toiThieu + 5);
});

test('xếp bàn: ghép vào bàn đông nhất chưa đầy, bàn tối đa 4 người, quán tối đa 80', () => {
  const q = taoQuan();
  const a = vao(q, 'An', 'rieng');
  const b = vao(q, 'Bình', 'ghep');
  assert.equal(b.ban, a.ban);
  const so = a.ban === 3 ? 4 : 3; // bàn riêng giờ bốc ngẫu nhiên, nên chọn bàn khác bàn của An
  vao(q, 'Cường', so);
  vao(q, 'Dũng', so);
  vao(q, 'Em', so);
  vao(q, 'Phúc', so);
  assert.ok(q.join('Giang', so).loi);
  const q2 = taoQuan();
  for (let i = 0; i < 80; i++) vao(q2, 'Khach ' + i, 'ghep');
  assert.match(q2.join('Muon', 'ghep').loi, /hết chỗ/);
});

test('không trùng tên trong quán', () => {
  const q = taoQuan();
  vao(q, 'Tuấn');
  assert.ok(q.join('tuấn').loi);
  assert.ok(q.join('Tuan').loi);
});

test('gọi món cộng hóa đơn, không vượt quá tiền + hạn mức thiếu', () => {
  const q = taoQuan({}, [0]); // tiền thấp nhất
  const p = vao(q, 'An');
  const lau = q.menu.find((m) => m.ten === 'Lẩu dê');
  assert.match(q.act(p.id, { type: 'goiMon', mon: lau.id }).loi, /Hết tiền/);
  const bia = q.menu.find((m) => m.ten === 'Bia hơi');
  ok(q.act(p.id, { type: 'goiMon', mon: bia.id }));
  assert.equal(p.tab, 10);
  assert.equal(p.daUong, 1);
});

test('mời cả bàn khác: trả tiền theo số người, người nhận được tính đã uống', () => {
  const q = taoQuan({}, [0.99, 0, 0, 0, 0, 0, 0, 0]);
  const dai = vao(q, 'Đại Gia', 1);
  const x = vao(q, 'Xuân', 2);
  const y = vao(q, 'Yến', 2);
  const bia = q.menu.find((m) => m.ten === 'Bia chai');
  ok(q.act(dai.id, { type: 'moiBan', ban: 2, mon: bia.id }));
  assert.equal(dai.tab, 40);
  assert.equal(x.daUong, 1);
  assert.equal(y.daUong, 1);
  assert.ok(q.act(dai.id, { type: 'moiBan', ban: 1, mon: bia.id }).loi); // không tự mời bàn mình
});

test('khịa → đáp trả thành xô xát; có người can thì êm', () => {
  const q = taoQuan();
  const a = vao(q, 'An', 1);
  const b = vao(q, 'Bình', 2);
  const c = vao(q, 'Cường', 3);
  ok(q.act(a.id, { type: 'khia', den: b.id, cau: 0 }));
  const vu = [...q.vuViec.values()][0];
  assert.equal(q.privateState(b.id).viec[0].loai, 'biKhia');
  ok(q.act(b.id, { type: 'traLoi', vu: vu.id, chon: 'dap_tra' }));
  const xx = [...q.vuViec.values()].find((v) => v.loai === 'xoxat');
  assert.deepEqual(xx.nguoi, [b.id]);
  assert.equal(xx.muc, a.id);
  ok(q.act(c.id, { type: 'canThiep', vu: xx.id, chon: 'can' }));
  assert.equal(q.vuViec.size, 0);
});

test('choảng không ai can → dân phòng đưa về phường, bồi thường, rồi được thả', () => {
  const q = taoQuan({ danPhongSau: 10_000, phuongThoiGian: 5_000 });
  const a = vao(q, 'An', 1);
  const b = vao(q, 'Bình', 2);
  const tienTruoc = a.tien;
  ok(q.act(a.id, { type: 'choang', den: b.id }));
  const xx = [...q.vuViec.values()][0];
  ok(q.act(b.id, { type: 'traLoi', vu: xx.id, chon: 'dap_tra' }));
  q.troi(10_001);
  assert.equal(a.trangThai, 'phuong');
  assert.equal(b.trangThai, 'phuong');
  assert.equal(a.tien, tienTruoc - q.muc.boiThuong);
  assert.equal(q.doanhThu, 2 * q.muc.boiThuong);
  q.troi(5_001);
  assert.equal(a.trangThai, 'sanh');
  ok(q.act(a.id, { type: 'ngoi', ban: 'rieng' }));
  assert.equal(a.trangThai, 'ngoi');
});

test('người bị choảng chọn nhịn thì chỉ kẻ gây sự bị đưa đi', () => {
  const q = taoQuan({ danPhongSau: 10_000 });
  const a = vao(q, 'An', 1);
  const b = vao(q, 'Bình', 2);
  ok(q.act(a.id, { type: 'choang', den: b.id }));
  const xx = [...q.vuViec.values()][0];
  ok(q.act(b.id, { type: 'traLoi', vu: xx.id, chon: 'nhin' }));
  q.troi(10_001);
  assert.equal(a.trangThai, 'phuong');
  assert.equal(b.trangThai, 'ngoi');
});

test('xin thiếu: chủ đồng ý thì tăng hạn mức, phần thiếu thành nợ khi về', () => {
  const q = taoQuan({ tiLeCsgt: 0 }, [0]);
  const p = vao(q, 'An');
  ok(q.act(p.id, { type: 'xinThieu', soTien: 50 }));
  const viec = q.adminState().hangDoi[0];
  ok(q.adminAct({ type: 'thieu', viec: viec.id, dongY: true }));
  assert.equal(p.chiu, 50);
  const lau = q.menu.find((m) => m.gia === 60);
  const tien = p.tien;
  ok(q.act(p.id, { type: 'goiMon', mon: lau.id }));
  ok(q.act(p.id, { type: 'roi', cach: 'tra' }));
  assert.equal(p.tien, 0);
  assert.equal(p.no, 60 - tien);
  assert.equal(p.trangThai, 've');
});

test('xin thiếu: chủ không trả lời thì hết hạn, coi như không cho', () => {
  const q = taoQuan({ thieuHan: 1000 });
  const p = vao(q, 'An');
  ok(q.act(p.id, { type: 'xinThieu', soTien: 20 }));
  q.troi(1001);
  assert.equal(q.hangDoiChu.length, 0);
  assert.equal(p.chiu, 0);
});

test('nhờ bao cần người kia đồng ý', () => {
  const q = taoQuan();
  const a = vao(q, 'An');
  const b = vao(q, 'Bình');
  const ta = a.tien;
  const tb = b.tien;
  ok(q.act(a.id, { type: 'nhoBao', den: b.id, soTien: 20 }));
  const yc = q.privateState(b.id).viec.find((v) => v.loai === 'nhoBao');
  assert.ok(q.act(a.id, { type: 'traLoiYeuCau', yc: yc.yc, dongY: true }).loi); // người nhờ không tự đồng ý được
  ok(q.act(b.id, { type: 'traLoiYeuCau', yc: yc.yc, dongY: true }));
  assert.equal(a.tien, ta + 20);
  assert.equal(b.tien, tb - 20);
});

test('ăn quỵt bị phát hiện → chủ chọn báo dân phòng → bồi thường', () => {
  const q = taoQuan({}, [0.5, 0, 0]);
  const p = vao(q, 'An');
  const bia = q.menu.find((m) => m.ten === 'Bia hơi');
  ok(q.act(p.id, { type: 'goiMon', mon: bia.id }));
  q.datRng(0.1); // < 0.5 → bị phát hiện
  ok(q.act(p.id, { type: 'roi', cach: 'quyt' }));
  assert.equal(p.roi.buoc, 'cho_chu');
  const viec = q.adminState().hangDoi.find((x) => x.loai === 'quyt');
  ok(q.adminAct({ type: 'quyt', viec: viec.id, chon: 'dan_phong' }));
  assert.equal(p.trangThai, 've');
  assert.equal(q.doanhThu, Math.min(p.tienDau, 10 + q.muc.boiThuong));
});

test('ăn quỵt trót lọt: quán mất tiền, khách vẫn phải chọn cách về vì đã uống', () => {
  const q = taoQuan({ tiLeCsgt: 0 });
  const p = vao(q, 'An');
  const bia = q.menu.find((m) => m.ten === 'Bia hơi');
  ok(q.act(p.id, { type: 'goiMon', mon: bia.id }));
  q.datRng(0.9);
  ok(q.act(p.id, { type: 'roi', cach: 'quyt' }));
  assert.equal(q.doanhThu, 0);
  assert.equal(p.roi.buoc, 'chon_ve');
  ok(q.act(p.id, { type: 'chonVe', cach: 'goi_xe' }));
  assert.equal(p.trangThai, 've');
});

test('đã uống tự lái gặp CSGT: năn nỉ thất bại thì nộp phạt', () => {
  const q = taoQuan({}, [0.99]);
  const p = vao(q, 'An');
  const bia = q.menu.find((m) => m.ten === 'Bia hơi');
  ok(q.act(p.id, { type: 'goiMon', mon: bia.id }));
  ok(q.act(p.id, { type: 'roi', cach: 'tra' }));
  q.datRng(0.1); // gặp CSGT
  ok(q.act(p.id, { type: 'chonVe', cach: 'tu_lai' }));
  assert.equal(p.roi.buoc, 'csgt');
  const tien = p.tien;
  q.datRng(0.9); // năn nỉ không được
  ok(q.act(p.id, { type: 'csgt', chon: 'nan_ni' }));
  assert.equal(p.tien, tien - q.muc.phatCsgt);
  assert.equal(p.trangThai, 've');
});

test('nhờ người tỉnh táo chở: chỉ nhờ được người chưa uống, cần đồng ý', () => {
  const q = taoQuan();
  const say = vao(q, 'Say');
  const tinh = vao(q, 'Tỉnh');
  const say2 = vao(q, 'Say Hai');
  const bia = q.menu.find((m) => m.ten === 'Bia hơi');
  ok(q.act(say.id, { type: 'goiMon', mon: bia.id }));
  ok(q.act(say2.id, { type: 'goiMon', mon: bia.id }));
  ok(q.act(say.id, { type: 'roi', cach: 'tra' }));
  assert.ok(q.act(say.id, { type: 'chonVe', cach: 'nho_cho', den: say2.id }).loi);
  ok(q.act(say.id, { type: 'chonVe', cach: 'nho_cho', den: tinh.id }));
  const yc = q.privateState(tinh.id).viec.find((v) => v.loai === 'nhoCho');
  ok(q.act(tinh.id, { type: 'traLoiYeuCau', yc: yc.yc, dongY: true }));
  assert.equal(say.trangThai, 've');
  assert.match(say.roi.ketQua, /chở về/);
});

test('mất kết nối quá lâu thì tự tính tiền và rời quán; quay lại kịp thì giữ chỗ', () => {
  const q = taoQuan({ matKetNoi: 5000 });
  const a = vao(q, 'An');
  const b = vao(q, 'Bình');
  q.disconnect(a.id);
  q.disconnect(b.id);
  q.troi(3000);
  assert.equal(q.resume(b.token), b.id);
  q.troi(3000);
  assert.equal(a.trangThai, 've');
  assert.equal(b.trangThai, 'ngoi');
});

test('chủ mời ra: xóa khách, cấm tên đó vào lại', () => {
  const q = taoQuan();
  const p = vao(q, 'Phá Đám');
  ok(q.adminAct({ type: 'moiRa', pid: p.id }));
  assert.equal(q.players.size, 0);
  assert.ok(q.join('Phá Đám').loi);
});

test('trạng thái công khai không lộ token, tiền của khách', () => {
  const q = taoQuan();
  vao(q, 'An');
  const s = JSON.stringify(q.publicState());
  const p = [...q.players.values()][0];
  assert.ok(!s.includes(p.token));
  assert.ok(!('tien' in q.publicState().khach[0]));
});

test('chống bấm liên tục', () => {
  const q = taoQuan({ hoiChieu: 700 });
  const p = vao(q, 'An');
  const tra = q.menu.find((m) => m.ten === 'Trà đá');
  ok(q.act(p.id, { type: 'goiMon', mon: tra.id }));
  assert.match(q.act(p.id, { type: 'goiMon', mon: tra.id }).loi, /chậm/);
});

test('khách ra về: chỉ dọn món của khách đó, món người khác vẫn còn', () => {
  const q = taoQuan({ tiLeCsgt: 0 });
  const a = vao(q, 'An', 1);
  const b = vao(q, 'Bình', 1);
  const tra = q.menu.find((m) => m.ten === 'Trà đá');
  const lac = q.menu.find((m) => m.ten === 'Lạc rang');
  ok(q.act(a.id, { type: 'goiMon', mon: tra.id }));
  ok(q.act(a.id, { type: 'goiMon', mon: lac.id }));
  ok(q.act(b.id, { type: 'goiMon', mon: lac.id }));
  assert.equal(q.ban[0].mon.length, 3);
  ok(q.act(a.id, { type: 'roi', cach: 'tra' }));
  assert.deepEqual(q.ban[0].mon.map((m) => m.cuaAi), [b.id]);
});

test('bàn không còn ai thì dọn sạch; chuyển bàn thì dọn phần ở bàn cũ', () => {
  const q = taoQuan({ tiLeCsgt: 0 });
  const a = vao(q, 'An', 1);
  const tra = q.menu.find((m) => m.ten === 'Trà đá');
  ok(q.act(a.id, { type: 'goiMon', mon: tra.id }));
  ok(q.act(a.id, { type: 'ngoi', ban: 2 }));
  assert.equal(q.ban[0].mon.length, 0);
  ok(q.act(a.id, { type: 'goiMon', mon: tra.id }));
  ok(q.act(a.id, { type: 'roi', cach: 'tra' }));
  assert.equal(q.ban[1].mon.length, 0);
});

test('món được mời thuộc về người nhận: người nhận về thì dọn phần đó', () => {
  const q = taoQuan({ tiLeCsgt: 0 }, [0.99]);
  const dai = vao(q, 'Đại Gia', 1);
  const x = vao(q, 'Xuân', 2);
  const y = vao(q, 'Yến', 2);
  const tra = q.menu.find((m) => m.ten === 'Trà đá');
  ok(q.act(dai.id, { type: 'moiBan', ban: 2, mon: tra.id }));
  assert.equal(q.ban[1].mon.length, 2);
  ok(q.act(x.id, { type: 'roi', cach: 'tra' }));
  assert.deepEqual(q.ban[1].mon.map((m) => m.cuaAi), [y.id]);
});

test('bị dân phòng đưa đi hoặc bị mời ra cũng dọn phần của mình', () => {
  const q = taoQuan({ danPhongSau: 1000 });
  const a = vao(q, 'An', 1);
  const b = vao(q, 'Bình', 1);
  const c = vao(q, 'Cường', 1);
  const tra = q.menu.find((m) => m.ten === 'Trà đá');
  for (const p of [a, b, c]) ok(q.act(p.id, { type: 'goiMon', mon: tra.id }));
  ok(q.act(a.id, { type: 'choang', den: b.id }));
  q.troi(1001);
  assert.equal(a.trangThai, 'phuong');
  ok(q.adminAct({ type: 'moiRa', pid: c.id }));
  assert.deepEqual(q.ban[0].mon.map((m) => m.cuaAi), [b.id]);
});

test('chọn bàn ngẫu nhiên: bàn riêng bốc trong số bàn trống, ghép chỉ vào bàn có người còn ghế', () => {
  const vals = [0.99, 0.5, 0.0];
  const q = new Quan({ id: 't', cauHinh: { hoiChieu: 0 }, rngBan: () => vals.shift() ?? 0.5 });
  const a = q.players.get(q.join('An', 'rieng').id);
  assert.equal(a.ban, 20); // 0.99 → bàn trống cuối
  const b = q.players.get(q.join('Bình', 'rieng').id);
  assert.equal(b.ban, 10); // 0.5 → bàn trống thứ 10 trong 19 bàn còn lại (1..19)
  const c = q.players.get(q.join('Cường', 'ghep').id);
  assert.ok([a.ban, b.ban].includes(c.ban)); // ghép thì không ngồi bàn trống
});

test('vào lại nhiều lần thì rải ra nhiều bàn khác nhau', () => {
  const q = new Quan({ id: 't', cauHinh: { hoiChieu: 0 } });
  const ban = new Set();
  for (let i = 0; i < 30; i++) {
    const p = q.players.get(q.join('Khach ' + i, 'rieng').id);
    ban.add(p.ban);
    q.adminAct({ type: 'moiRa', pid: p.id });
    q.tenCam.clear();
  }
  assert.ok(ban.size >= 8, `chỉ rơi vào ${ban.size} bàn`);
});