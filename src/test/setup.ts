// Nạp matcher của jest-dom (toBeInTheDocument, toHaveAttribute…) cho Vitest và
// tự dọn DOM sau mỗi test để các render không rò rỉ sang nhau.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
