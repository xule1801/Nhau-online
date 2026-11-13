# Thiết kế đề xuất: Đi nhậu online

## Mục tiêu và phạm vi
Game web 2D mô phỏng quán nhậu vỉa hè Việt Nam, phục vụ các phiên livestream. Mỗi phiên có một quán riêng, tối đa 20 bàn, bốn khách mỗi bàn (80 khách đồng thời). Chủ livestream điều khiển chủ quán; khách vào bằng đường dẫn, tự đặt tên, không đăng ký. Đây là mục tiêu tải cần kiểm thử, không phải cam kết hiệu năng đã được chứng minh.

## Các phương án
- Menu trực tiếp trong TikTok LIVE: trải nghiệm liền mạch nhưng khả năng tích hợp chưa được xác minh; không chọn cho phiên bản này.
- Ứng dụng di động: có thể tối ưu riêng cho điện thoại nhưng yêu cầu khách cài đặt.
- **Game web 2D** (đã chọn): mở qua đường dẫn, không cần cài; chủ quán phát màn hình game lên LIVE. Vị trí đường dẫn trên TikTok và khả năng vừa mở game vừa xem LIVE phụ thuộc thiết bị và tính năng TikTok, cần kiểm tra thực tế.

## Quy trình
1. Chủ tạo quán, tùy chỉnh thực đơn và nhận hai đường dẫn riêng: mời khách và quản lý. Đường dẫn quản lý là bí mật, không xuất hiện trên hình phát công khai; cho phép chủ khôi phục quyền điều khiển trong khi quán còn mở.
2. Khách mở đường dẫn mời, đặt tên và chọn bàn riêng hoặc ngồi ghép. Bàn giới hạn bốn khách; quán tối đa 80 khách. Khi đầy, báo hết chỗ.
3. Mỗi khách nhận ngẫu nhiên tiền ảo, từ mức đủ một ly bia và một món đến mức có thể bao hai hoặc ba bàn. Đề xuất tính mức tiền theo giá thực đơn từng quán; cần định nghĩa cụ thể thế nào là chi phí bao bàn để cân bằng.
4. Khách gọi mồi, đồ uống, sang mời bàn khác, khịa hoặc choảng. Người bị tác động có thể bỏ qua, nhịn hoặc đáp trả. Người xung quanh có thể can, đứng xem, mặc kệ hoặc giả lập quay video đăng mạng; không tạo hay đăng video thật.
5. Nếu xô xát không được can sau một khoảng thời gian, dân phòng xuất hiện, đưa người liên quan về phường và yêu cầu bồi thường chủ quán bằng tiền ảo.
6. Hết tiền, khách có thể ngồi không, xin chủ quán cho thiếu, nhờ người khác bao hoặc ăn quỵt. Đề xuất: cho thiếu và bao cần người liên quan đồng ý. Ăn quỵt có xác suất bị phát hiện; khi bị phát hiện, chủ quán chọn cho ăn đập hoặc báo dân phòng đưa về đồn.
7. Khi khách rời quán, cảnh sát giao thông thỉnh thoảng xuất hiện và kiểm tra ngẫu nhiên. Người đã uống có các lựa chọn năn nỉ, nộp phạt hoặc về đồn. Đề xuất thêm lựa chọn gọi xe hoặc nhờ người tỉnh táo chở; quy tắc cụ thể cần làm rõ.

## Giao diện và vận hành
- Quán hiển thị theo phong cách 2D, bàn ghế nhựa và món nhậu bình dân Việt Nam. Đề xuất hoạt cảnh ngắn, không có bạo lực chân thực; chủ quán có thể xem tổng quan và chọn bàn hoặc sự kiện để theo dõi.
- Chủ tùy chỉnh thực đơn; chi tiết tự thêm món, hình ảnh và giá là đề xuất, chưa được xác nhận rõ. Giá dùng tiền ảo, không có chức năng nạp tiền thật trong phạm vi này.
- Chủ nhận và xử lý yêu cầu cho thiếu và tình huống ăn quỵt. Đề xuất bố trí hàng đợi thông báo để không bị ngập khi quán đông; xử lý tự động là phương án tùy chọn chưa được chốt.
- Cần có biện pháp hạn chế tên phản cảm, giả mạo và quấy rối, cùng khả năng chủ quán loại người chơi; đề xuất dùng các câu khịa có sẵn để giảm rủi ro.

## Đề xuất hosting miễn phí và kiến trúc triển khai

**Khuyến nghị sơ bộ:** thử Cloudflare Workers kết hợp Durable Objects cho trạng thái và kết nối thời gian thực, cùng Cloudflare Workers Static Assets cho giao diện 2D. Mỗi quán được xử lý độc lập, máy chủ xác nhận hành động và phát cập nhật cho khách; dữ liệu phiên chỉ tồn tại trong thời gian cần thiết và được xóa khi quán đóng. Không đưa đường dẫn quản lý vào màn hình phát LIVE. Đây là phương án cần thử nghiệm, **chưa xác minh** hiện tại các thành phần có nằm trong gói miễn phí, hạn mức, điều kiện đăng ký hay có cần thẻ hay không; không hứa miễn phí lâu dài hoặc đáp ứng 80 người.

Các lựa chọn so sánh:
- **Cloudflare**: hướng có triển vọng cho nhiều quán tách biệt, nhưng phải kiểm tra giới hạn WebSocket, trạng thái và mức sử dụng miễn phí; cần làm theo mô hình của nền tảng.
- **Render miễn phí**: ứng viên cho máy chủ Node/WebSocket truyền thống; cần xác minh gói miễn phí, việc ngủ/khởi động lại và giới hạn trước khi dùng. Khi tiến trình dừng, trạng thái trong bộ nhớ có thể mất.
- **Chạy cục bộ trên máy chủ quán**: không trả phí hosting, phù hợp thử nhanh, nhưng máy và kết nối phải hoạt động xuyên suốt; truy cập từ Internet, bảo mật và độ ổn định là trách nhiệm của người vận hành.

Trước khi chọn chính thức, đối chiếu tài liệu [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [Render free](https://render.com/docs/free) và [Render WebSockets](https://render.com/docs/websockets). Các trang này chưa được truy cập xác minh trong phiên này. Kiểm tra cả băng thông, số kết nối, thời gian chạy, lưu trữ, giới hạn chi tiêu và điều khoản dữ liệu. Không bật thanh toán hoặc triển khai công khai khi chưa được chủ dự án đồng ý.

Thử tải tối thiểu một quán với 80 kết nối, sau đó nhiều quán theo mục tiêu thực tế; đo độ trễ, lỗi/mất kết nối và lượng tài nguyên trong suốt một phiên LIVE. Số quán đồng thời và thời lượng LIVE chưa xác định nên chưa thể ước tính chi phí hay khẳng định gói miễn phí đủ dùng. Nếu vượt hạn mức hoặc không ổn định, xem xét gói trả phí sau khi có số liệu và phê duyệt.

## Dữ liệu và an toàn
- Không yêu cầu đăng ký, không tạo hồ sơ người dùng lâu dài. Trạng thái như tên, ghế, tiền và nợ cần được giữ tạm để vận hành phiên và xóa khi phiên kết thúc; cấu hình nhật ký và hạ tầng nhằm hạn chế thông tin nhận dạng. Không khẳng định hệ thống hoàn toàn không xử lý dữ liệu kỹ thuật khi kết nối mạng.
- Đường dẫn quản lý là thông tin nhạy cảm: tạo khó đoán, không chia sẻ công khai; hết hiệu lực khi quán đóng. Việc khôi phục quyền khi mất đường dẫn chưa được xác định.
- Các hành vi bạo lực và lái xe sau khi uống là tình huống giả lập có hậu quả; không mô phỏng xử phạt như tư vấn pháp lý.

## Kiểm thử và những điểm cần chốt
- Kiểm thử nhiều quán độc lập, tối đa 80 khách/quán, số ghế, ngắt kết nối/quay lại, đồng thời gọi món và chuyển bàn, xử lý các tình huống, quyền chủ quán và xóa trạng thái sau phiên.
- Cần quyết định quy tắc vào lại khi mất kết nối, xử lý nợ/tiền phạt khi không đủ tiền, thời điểm quán tự đóng, cách cấp tiền theo giá thực đơn, và khả năng tùy chỉnh thực đơn chi tiết. Các quy tắc này chưa được coi là đã thống nhất.
- Quy định TikTok về nội dung rượu, bạo lực và việc trình chiếu game cần được kiểm tra trước khi phát hành; chưa xác minh trong phiên làm việc này.
