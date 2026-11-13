'use strict';
const MAC_DINH = [
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
const LOAI = { bia: 'Bia (có cồn)', ruou: 'Rượu (có cồn)', nuoc: 'Nước (không cồn)', moi: 'Mồi' };
const $ = (s) => document.querySelector(s);
const body = $('#menu-body');

function themDong(m = { emoji: '🍽️', ten: '', gia: 20, loai: 'moi' }) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="o-emoji" maxlength="8"></td>
    <td><input class="o-ten" maxlength="30" placeholder="Tên món"></td>
    <td><input class="o-gia" type="number" min="1" max="10000" step="1"></td>
    <td><select class="o-loai">${Object.entries(LOAI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></td>
    <td><button type="button" class="nut xoa" title="Xóa">✕</button></td>`;
  tr.querySelector('.o-emoji').value = m.emoji;
  tr.querySelector('.o-ten').value = m.ten;
  tr.querySelector('.o-gia').value = m.gia;
  tr.querySelector('.o-loai').value = m.loai;
  tr.querySelector('.xoa').onclick = () => {
    tr.remove();
    capNhatMuc();
  };
  tr.addEventListener('input', capNhatMuc);
  body.appendChild(tr);
}

function docMenu() {
  return [...body.querySelectorAll('tr')].map((tr) => ({
    emoji: tr.querySelector('.o-emoji').value.trim(),
    ten: tr.querySelector('.o-ten').value.trim(),
    gia: Number(tr.querySelector('.o-gia').value),
    loai: tr.querySelector('.o-loai').value,
  }));
}

// Cùng công thức với máy chủ (src/game.js → tinhMucTien), chỉ để xem trước.
function capNhatMuc() {
  const menu = docMenu().filter((m) => m.ten && m.gia > 0);
  const uong = menu.filter((m) => m.loai !== 'moi').map((m) => m.gia);
  const moi = menu.filter((m) => m.loai === 'moi').map((m) => m.gia);
  if (!uong.length || !moi.length) {
    $('#muc-tien').textContent = 'Cần ít nhất một đồ uống và một món mồi.';
    return;
  }
  const tb = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const toiThieu = Math.min(...uong) + Math.min(...moi);
  const baoBan = Math.round(4 * (2 * tb(uong) + tb(moi)));
  const toiDa = Math.max(toiThieu + 5, Math.round(2.5 * baoBan));
  $('#muc-tien').textContent = `Mỗi khách được phát ngẫu nhiên ${toiThieu}k – ${toiDa}k. "Bao một bàn" (4 người × 2 đồ uống + 1 món) ≈ ${baoBan}k.`;
}

MAC_DINH.forEach((m) => themDong(m));
capNhatMuc();
$('#them-mon').onclick = () => themDong();

$('#mo-quan').onclick = async () => {
  $('#loi').textContent = '';
  $('#mo-quan').disabled = true;
  try {
    const r = await fetch('/api/quan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ten: $('#ten-quan').value, menu: docMenu() }),
    });
    const kq = await r.json();
    if (!r.ok) throw new Error(kq.loi || 'Lỗi không rõ');
    const info = await fetch('/api/info').then((x) => x.json()).catch(() => ({ lan: [] }));
    let goc = location.origin;
    if (/^(localhost|127\.)/.test(location.hostname) && info.lan?.length) {
      goc = `${location.protocol}//${info.lan[0]}:${location.port}`;
      $('#ghi-chu-lan').textContent = `Đang dùng địa chỉ mạng nội bộ (${info.lan[0]}): chỉ máy cùng Wi-Fi vào được. Muốn người xem TikTok vào được thì cần đưa lên Internet (bước sau).`;
    }
    $('#link-khach').value = `${goc}/q/${kq.id}`;
    $('#link-live').value = `${location.origin}/q/${kq.id}?live=1`;
    $('#mo-live').href = $('#link-live').value;
    $('#link-chu').value = `${location.origin}/q/${kq.id}#chu=${kq.adminToken}`;
    $('#mo-chu').href = $('#link-chu').value;
    $('#buoc-tao').hidden = true;
    $('#buoc-xong').hidden = false;
  } catch (e) {
    $('#loi').textContent = e.message;
  } finally {
    $('#mo-quan').disabled = false;
  }
};

document.addEventListener('click', (e) => {
  const id = e.target.dataset?.copy;
  if (!id) return;
  navigator.clipboard.writeText($('#' + id).value).then(() => {
    e.target.textContent = 'Đã chép ✓';
    setTimeout(() => (e.target.textContent = 'Chép'), 1500);
  });
});
