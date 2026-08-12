// Nạp matcher của jest-dom (toBeInTheDocument, toHaveAttribute…) cho Vitest và
// tự dọn DOM sau mỗi test để các render không rò rỉ sang nhau.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Radix (Select, Dropdown…) dùng Pointer Capture API và `scrollIntoView` để
 * quản lý con trỏ trong danh sách bật lên. jsdom **không cài đặt** những API
 * này, nên bấm vào một mục trong `<Select>` im lặng không có tác dụng: danh
 * sách mở ra nhưng giá trị không đổi, và test thất bại theo kiểu khó truy —
 * không có lỗi nào được ném, chỉ là giá trị vẫn nguyên như cũ.
 *
 * Đây là polyfill cho MÔI TRƯỜNG TEST, không phải cách lách qua lỗi sản phẩm:
 * trên trình duyệt thật cả ba API đều có sẵn.
 */
Object.assign(Element.prototype, {
  hasPointerCapture: vi.fn(() => false),
  setPointerCapture: vi.fn(),
  releasePointerCapture: vi.fn(),
  scrollIntoView: vi.fn(),
});

afterEach(() => {
  cleanup();
});
