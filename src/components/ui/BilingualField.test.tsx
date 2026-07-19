import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BilingualField } from "@/components/ui/BilingualField";

describe("BilingualField", () => {
  it("shows the Vietnamese value first", () => {
    render(
      <BilingualField value={{ vi: "Xin chào", en: "Hello" }} onChange={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Xin chào")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Hello")).not.toBeInTheDocument();
  });

  it("switches to the English value when the EN toggle is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BilingualField value={{ vi: "Xin chào", en: "Hello" }} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /^en/i }));
    expect(screen.getByDisplayValue("Hello")).toBeInTheDocument();
  });

  it("flags a missing English translation when VI is filled but EN is empty", () => {
    render(<BilingualField value={{ vi: "Xin chào", en: "" }} onChange={vi.fn()} />);
    expect(
      screen.getByLabelText("Chưa có bản dịch tiếng Anh"),
    ).toBeInTheDocument();
  });

  it("does not flag when both languages are present", () => {
    render(
      <BilingualField value={{ vi: "Xin chào", en: "Hello" }} onChange={vi.fn()} />,
    );
    expect(
      screen.queryByLabelText("Chưa có bản dịch tiếng Anh"),
    ).not.toBeInTheDocument();
  });

  it("calls onChange as the user types in the active field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BilingualField value={{ vi: "", en: "" }} onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "A");
    expect(onChange).toHaveBeenCalledWith({ vi: "A", en: "" });
  });
});
