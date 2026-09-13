# Hướng dẫn thiết lập Time-to-Live (TTL) cho Firestore

Để tiết kiệm chi phí và tự động xóa dữ liệu cũ (Bài thi và Điểm số) sau 24 giờ, bạn cần bật tính năng TTL (Time-To-Live) trên Google Cloud Console.

### Các bước thực hiện:

1. Truy cập **Google Cloud Console**: https://console.cloud.google.com/
2. Chọn dự án Firebase tương ứng của bạn.
3. Điều hướng tới **Firestore** > **Cơ sở dữ liệu (Database)** > **Chính sách TTL (TTL Policies)**.
4. Nhấn **Tạo chính sách (Create Policy)**.
5. Tạo chính sách thứ nhất cho collection `quizzes`:
   - **Tên nhóm tập hợp (Collection group)**: `quizzes`
   - **Trường dấu thời gian (Timestamp field)**: `createdAt`
6. Tạo chính sách thứ hai cho collection `scores`:
   - **Tên nhóm tập hợp (Collection group)**: `scores`
   - **Trường dấu thời gian (Timestamp field)**: `createdAt`
7. Mặc định TTL hoạt động bằng cách xóa các document sau khoảng thời gian nhất định dựa trên trường Date/Timestamp.

**Lưu ý quan trọng**: Firestore TTL yêu cầu trường `createdAt` phải là kiểu `Date` (Timestamp). Trong mã nguồn ứng dụng, chúng ta đã cấu hình logic (fallback) ở mức client: nếu `createdAt` (lưu dưới dạng mili-giây) vượt quá 24h (86400000 ms), hệ thống sẽ tự động khóa bài thi. Nếu bạn muốn dùng TTL mặc định của Firebase, hãy đổi giá trị `Date.now()` thành `serverTimestamp()` của Firebase.
