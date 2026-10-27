import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { NewsFormDialog } from "@/components/news/NewsFormDialog";
import { PageFormDialog } from "@/components/pages/PageFormDialog";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "SUPER_ADMIN" } }),
}));
vi.mock("@/components/ui/ImagePickerField", () => ({
  ImagePickerField: () => null,
}));
vi.mock("@/lib/api/queries", () => {
  const idle = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useCreateProject: idle,
    useUpdateProject: idle,
    useUpdateProjectStatus: idle,
    useScheduleProjectPublication: idle,
    useCreateNews: idle,
    useUpdateNews: idle,
    useUpdateNewsStatus: idle,
    useScheduleNewsPublication: idle,
    useCreatePage: idle,
    useUpdatePage: idle,
    useUpdatePageStatus: idle,
    useSchedulePagePublication: idle,
    useNewsCategories: () => ({ data: [] }),
  };
});

describe.each([
  {
    name: "dự án",
    Form: ProjectFormDialog,
    title: "Tên dự án",
    slug: "Slug dự án",
  },
  {
    name: "tin tức",
    Form: NewsFormDialog,
    title: "Tiêu đề bài viết",
    slug: "Đường dẫn bài viết",
  },
  {
    name: "trang nội dung",
    Form: PageFormDialog,
    title: "Tiêu đề trang",
    slug: "Slug trang nội dung",
  },
])("Tự tạo đường dẫn $name", ({ Form, title, slug }) => {
  it("không ngừng tự tạo khi bộ gõ thay chữ d bằng đ qua giá trị rỗng", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Form trigger={<button>Tạo mới</button>} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Tạo mới" }));
    const nameInput = screen.getByRole("textbox", { name: title });
    fireEvent.change(nameInput, { target: { value: "d" } });
    fireEvent.compositionStart(nameInput);
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.change(nameInput, { target: { value: "đ" } });
    fireEvent.compositionEnd(nameInput, { data: "đ" });
    fireEvent.change(nameInput, { target: { value: "đô thị Hưng Phú" } });
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "do-thi-hung-phu",
    );
    await user.clear(nameInput);
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue("");
    await user.type(nameInput, "Dự án Bến Tre");
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue("du-an-ben-tre");
  });

  it("tiếp tục tạo đường dẫn khi gõ từng chữ tiếng Việt có dấu", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Form trigger={<button>Tạo mới</button>} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Tạo mới" }));
    const nameInput = screen.getByRole("textbox", { name: title });
    await user.type(nameInput, "Dự án Khu đô thị Hưng Phú");
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "du-an-khu-do-thi-hung-phu",
    );
    await user.tab();
    await user.click(nameInput);
    await user.type(nameInput, " Bến Tre");
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "du-an-khu-do-thi-hung-phu-ben-tre",
    );
  });

  it("bật lại tự tạo khi đóng form và mở lần tạo mới tiếp theo", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Form trigger={<button>Tạo mới</button>} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Tạo mới" }));
    await user.type(screen.getByRole("textbox", { name: slug }), "duong-dan-rieng");
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await user.click(screen.getByRole("button", { name: "Tạo mới" }));
    await user.type(screen.getByRole("textbox", { name: title }), "Khu đô thị Hưng Phú");
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "khu-do-thi-hung-phu",
    );
  });

  it("chuyển tên có dấu thành đường dẫn và theo sát tên tới khi người dùng chỉnh riêng", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Form trigger={<button>Tạo mới</button>} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Tạo mới" }));
    const nameInput = screen.getByRole("textbox", { name: title });
    fireEvent.change(nameInput, { target: { value: "Thiên Đức – Dự án mới" } });
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "thien-duc-du-an-moi",
    );
    fireEvent.change(nameInput, { target: { value: "Thiên Đức Hà Nội" } });
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "thien-duc-ha-noi",
    );
    fireEvent.change(screen.getByRole("textbox", { name: slug }), {
      target: { value: "duong-dan-rieng" },
    });
    fireEvent.change(nameInput, { target: { value: "Tên mới" } });
    expect(screen.getByRole("textbox", { name: slug })).toHaveValue(
      "duong-dan-rieng",
    );
  });
});
