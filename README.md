# 🍻 Đi nhậu online

Game web 2D mô phỏng quán nhậu vỉa hè cho các buổi livestream (TikTok LIVE). Chủ livestream mở quán, phát "Màn hình LIVE" lên sóng; người xem vào bằng đường dẫn, tự đặt tên, không cần đăng ký. Tiền trong game là tiền ảo. Thiết kế gốc: [di-nhau-online-thiet-ke.md](di-nhau-online-thiet-ke.md).

> Phiên bản hiện tại chạy trên **localhost** để thử. Chưa đưa lên Cloudflare hay máy chủ công khai.

## Chạy thử

Cần Node.js 18 trở lên.

```bash
npm install
npm start          # mở http://localhost:3000
npm test           # kiểm thử luật chơi
npm run load -- 80 60   # (máy chủ đang chạy) thử tải 80 khách ảo trong 60 giây
```

1. Vào `http://localhost:3000`, đặt tên quán, sửa thực đơn rồi bấm **Mở quán**.
2. Bạn nhận 3 đường dẫn:
   - **Mời khách** (công khai): gửi cho người chơi. Trên localhost, đường dẫn dùng IP mạng nội bộ nên chỉ máy cùng Wi-Fi vào được.
   - **Màn hình LIVE** (an toàn để phát): mở trong một cửa sổ riêng, chia sẻ cửa sổ đó lên TikTok LIVE Studio / OBS.
   - **Quản lý** (BÍ MẬT): bảng điều khiển của chủ quán. Không phát cửa sổ này lên sóng. Token tự xóa khỏi thanh địa chỉ sau khi mở, chỉ còn lưu trong tab đó.
3. Thử nhiều khách: mở đường dẫn mời trong cửa sổ ẩn danh, trình duyệt khác hoặc điện thoại cùng Wi-Fi.

## Cách chơi (đã làm)

| Khách | Chủ quán |
|---|---|
| Đặt tên, ngồi ghép / bàn riêng / chọn bàn (4 người/bàn, 20 bàn, tối đa 80 khách) | Tùy chỉnh thực đơn khi mở quán |
| Nhận tiền ảo ngẫu nhiên theo giá thực đơn | Duyệt / từ chối xin thiếu |
| Gọi món, mời cả bàn khác | Xử lý ăn quỵt: cho ăn đập (hoạt hình) hoặc báo dân phòng |
| Khịa (câu có sẵn), choảng; người bị tác động chọn bỏ qua / nhịn / đáp trả | Mời khách ra (cấm tên + IP vào lại) |
| Người xung quanh: can, đứng xem, quay clip (giả lập), mặc kệ | Đóng quán: xóa toàn bộ dữ liệu phiên |
| Hết tiền: ngồi không, xin thiếu, nhờ người bao (cần người kia đồng ý), chuồn | |
| Ra về: tính tiền hoặc ăn quỵt; đã uống thì chọn gọi xe ôm, nhờ người tỉnh táo chở, hoặc tự lái (có thể gặp CSGT: năn nỉ / nộp phạt / về đồn) | |

## Các quy tắc mình tự chốt (cần bạn xem lại)

Bản thiết kế để ngỏ những điểm dưới đây. Mình đã chọn một phương án để game chạy được. Mọi con số nằm trong `MAC_DINH` ở [src/game.js](src/game.js).

- **Cấp tiền:** "bao một bàn" = 4 người × (2 đồ uống trung bình + 1 món mồi trung bình). Mỗi khách nhận ngẫu nhiên từ *đồ uống rẻ nhất + mồi rẻ nhất* đến *2,5 × bao một bàn*. Phân bố lệch về mức thấp, nên ít người là "đại gia".
- **Dọn bàn:** mỗi món trên bàn ghi là của ai. Khách rời bàn (ra về, bị dân phòng đưa đi, bị mời ra, chuyển sang bàn khác) thì chỉ dọn phần của khách đó; bàn không còn ai thì dọn sạch. Món "mời cả bàn" tính là của người nhận, nên ai được mời mà về thì phần đó được dọn.
- **Ngoại hình:** mỗi khách được bốc ngẫu nhiên màu da, kiểu tóc, mũ, kính, ria, kiểu áo (trơn, kẻ, caro, hoa, ba lỗ, đội tuyển), màu quần, dáng người. Chưa cho khách tự chọn.
- **Hóa đơn:** món gọi được ghi vào hóa đơn, trả khi ra về. Chỉ gọi được khi hóa đơn ≤ tiền trong ví + hạn mức được thiếu. Phần dùng hạn mức thiếu sẽ thành **nợ** (chỉ hiển thị, không bị truy thu).
- **Mời bàn:** mời một món cho cả bàn, mỗi người một phần, người mời trả hết.
- **Xô xát:** không ai can trong **25 giây** thì dân phòng tới. Người trong cuộc phải tính tiền, bồi thường quán (= ¼ bao một bàn), ở phường **60 giây** rồi được quay lại chọn bàn. Người bị choảng mà nhịn hoặc bỏ qua thì không bị đưa đi.
- **Ăn quỵt:** 90% bị phát hiện (chỉ ~10% chuồn êm). Chủ quán có 30 giây để quyết định, quá hạn thì tự động báo dân phòng. Xin thiếu quá 45 giây không ai trả lời thì coi như bị từ chối.
- **CSGT:** 40% bị dừng khi tự đi về. Chưa uống thì được đi tiếp. Đã uống thì năn nỉ (30% được tha), nộp phạt (= ½ bao một bàn) hoặc về đồn. Không chọn trong 30 giây thì mặc định nộp phạt.
- **Nhờ chở:** chỉ nhờ được người đang ngồi trong quán và chưa uống ly có cồn nào.
- **Mất kết nối:** quay lại trong 2 phút thì giữ nguyên chỗ (nhận diện qua token lưu trên trình duyệt). Quá 2 phút thì tự tính tiền và rời quán.
- **Đóng quán:** chủ bấm đóng, hoặc 30 phút không còn ai kết nối. Dữ liệu chỉ nằm trong bộ nhớ và bị xóa khi quán đóng hoặc khi máy chủ khởi động lại.
- **Tên:** 2–20 ký tự. Chặn một danh sách từ tục (so khớp sau khi bỏ dấu), chặn tên giả mạo chủ quán, dân phòng, CSGT, công an, admin; không cho trùng tên trong quán.

## Cấu trúc

```
src/game.js      Luật chơi thuần (không phụ thuộc mạng), có đồng hồ & số ngẫu nhiên tiêm vào để test
src/server.js    Máy chủ HTTP + WebSocket (ws) cho localhost; mỗi quán một đối tượng Quan trong bộ nhớ
public/          Giao diện: index (mở quán), quan.html/quan.js (khách, chủ, màn hình LIVE), style.css
public/san3d.js  Cảnh 3D (three.js, phục vụ từ node_modules tại /vendor/three): phố, quán, bàn ghế, món, nhân vật chibi, hoạt cảnh
test/            Kiểm thử luật chơi (node --test)
scripts/load.js  Thử tải bằng khách ảo
```

`Quan` chỉ có các hàm `join / act / adminAct / tick` và `publicState / privateState / adminState`. Nhờ vậy, sau này chuyển sang Cloudflare Durable Objects (mỗi quán một Durable Object) chỉ cần viết lại `server.js`, luật chơi giữ nguyên.

## Đã kiểm tra trên máy này

- 25 bài test luật chơi đều qua (gồm 4 bài cho việc dọn bàn).
- Thử tải 80 khách ảo trong 30 giây trên localhost: 80/80 vào được, không rớt kết nối, độ trễ phản hồi trung bình ~70ms (tối đa ~160ms). Con số này đo trên localhost, **không** phản ánh độ trễ thật qua Internet.

## Chưa làm / bước tiếp theo

- Đưa lên Internet cho người xem TikTok (Cloudflare Workers + Durable Objects, hoặc dùng tạm một đường hầm như Cloudflare Tunnel). Cần kiểm tra hạn mức miễn phí trước.
- Mã QR cho đường dẫn mời trên màn hình LIVE.
- Âm thanh; mô hình 3D chi tiết hơn (hiện dựng từ khối cơ bản); cho khách tự chọn phục trang.
- Đo tốc độ khung hình trên máy phát LIVE thật và điện thoại tầm trung khi quán đủ 80 người.
- Kiểm tra quy định của TikTok về nội dung rượu bia, bạo lực (dù là hoạt hình) và việc trình chiếu game.
