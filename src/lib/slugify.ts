/**
 * Sinh slug từ tiếng Việt — không phụ thuộc thư viện ngoài.
 *
 * Biên tập viên gõ tên chuyên mục có dấu ("Kiến trúc & Xây dựng"); slug lại là
 * URL công khai nên phải là ASCII thường, gạch ngang đơn. Bắt người dùng tự
 * chuyển là nguồn lỗi chính: sai một ký tự là một URL sai vĩnh viễn (slug bị
 * khoá sau khi tạo).
 *
 * `normalize("NFD")` tách nguyên âm khỏi dấu thanh/dấu mũ, rồi bỏ toàn bộ dấu
 * tổ hợp (`̀-ͯ`). Riêng **đ/Đ** không phải nguyên âm + dấu mà là một
 * chữ cái riêng trong bảng chữ cái tiếng Việt — NFD không tách được, phải thay
 * tay TRƯỚC khi chuẩn hoá.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu thanh + dấu mũ (ắ → a, ế → e)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    // Mọi cụm ký tự không phải chữ/số → MỘT gạch ngang. Gộp luôn ở bước này nên
    // không bao giờ sinh ra hai gạch liền ("A & B" → "a-b", không phải "a--b").
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, ""); // bỏ gạch thừa ở hai đầu
}
