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
