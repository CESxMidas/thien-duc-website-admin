/**
 * Vòng đời tạo nội dung: **tạo không phải là đăng** — với MỌI vai trò.
 *
 * Trước batch chuẩn hoá, backend cho SUPER_ADMIN tạo Dự án / Trang / Dự án hợp
 * tác là nội dung ra công khai ngay. Nay cả ba module đều sinh ra bản nháp, và
 * việc đăng đi qua lệnh trạng thái riêng.
 *
 * Điều test này khoá ở phía Admin: form tạo chỉ chạy **đúng một lệnh tạo**,
 * không kèm bất kỳ lệnh xuất bản nào, và payload không mang field trạng thái
 * xuất bản. Nếu ai đó "tiện tay" thêm một lệnh đăng vào luồng tạo cho
 * SUPER_ADMIN, bộ test này đỏ.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { CooperationFormDialog } from "@/components/cooperation/CooperationFormDialog";
import { PageFormDialog } from "@/components/pages/PageFormDialog";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types";

const {
  createProject,
  createCooperation,
  createPage,
  updateProjectStatus,
  updateCooperationStatus,
  updatePageStatus,
  role,
} = vi.hoisted(() => ({
  // Khai báo tham số tường minh để `mock.calls[0][0]` có kiểu — bộ test này
  // soi chính PAYLOAD gửi đi, không chỉ đếm số lần gọi.
  createProject: vi.fn(async (_payload: unknown) => ({
    id: "p1",
    slug: "slug-tu-backend",
  })),
  createCooperation: vi.fn(async (_payload: unknown) => ({ id: "c1" })),
  createPage: vi.fn(async (_payload: unknown) => ({
    id: "g1",
    slug: "slug-tu-backend",
  })),
  updateProjectStatus: vi.fn(async () => ({})),
  updateCooperationStatus: vi.fn(async () => ({})),
  updatePageStatus: vi.fn(async () => ({})),
  role: { current: "SUPER_ADMIN" as Role },
}));

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  const empty = () => ({ data: [], isLoading: false });
  return {
    queryKeys: {},
    useCreateProject: mutation(createProject),
    useUpdateProject: mutation(async () => ({})),
    useUpdateProjectStatus: mutation(updateProjectStatus),
    useCreateCooperationProject: mutation(createCooperation),
    useUpdateCooperationProject: mutation(async () => ({})),
    useUpdateCooperationStatus: mutation(updateCooperationStatus),
    useCreatePage: mutation(createPage),
    useUpdatePage: mutation(async () => ({})),
    useUpdatePageStatus: mutation(updatePageStatus),
    useMedia: empty,
    useUploadMedia: mutation(async () => ({})),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "T", email: "a@b.c", role: role.current },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR"] as const;

function renderDialog(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openDialog(ui: ReactElement) {
  const user = userEvent.setup();
  renderDialog(ui);
  await user.click(screen.getByRole("button", { name: "Mở" }));
  await screen.findByRole("dialog");
  return user;
}

/** Mọi lệnh đổi trạng thái xuất bản — không lệnh nào được chạy khi TẠO. */
function expectNoPublishCommand() {
  expect(updateProjectStatus).not.toHaveBeenCalled();
  expect(updateCooperationStatus).not.toHaveBeenCalled();
  expect(updatePageStatus).not.toHaveBeenCalled();
}

/**
 * Field song ngữ có `aria-label="Tiếng Việt"` cho cả cụm, nên tìm theo NHÃN sẽ
 * nhập nhằng. Bám vào placeholder — thứ duy nhất phân biệt được từng ô.
 */
function fillByPlaceholder(
  user: ReturnType<typeof userEvent.setup>,
  entries: [string, string][],
) {
  return entries.reduce(
    (chain, [placeholder, value]) =>
      chain.then(() =>
        user.type(screen.getByPlaceholderText(placeholder), value),
      ),
    Promise.resolve(),
  );
}

async function submit(name: RegExp) {
  const user = userEvent.setup();
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  role.current = "SUPER_ADMIN";
});

describe("Tạo dự án — không kèm lệnh đăng", () => {
  async function fillProject(user: ReturnType<typeof userEvent.setup>) {
    await fillByPlaceholder(user, [
      ["Khu đô thị Hưng Phú", "Khu đô thị Hưng Phú"],
      ["khu-do-thi-hung-phu", "khu-do-thi-hung-phu"],
      [
        "Một hai câu giới thiệu dự án, hiện ở thẻ danh sách ngoài trang chủ.",
        "Mô tả ngắn đủ dài cho ràng buộc của form.",
      ],
    ]);
  }

  it.each(ROLES)(
    "%s: đúng một lệnh tạo, không lệnh xuất bản nào",
    async (currentRole) => {
      role.current = currentRole;
      const user = await openDialog(
        <ProjectFormDialog trigger={<Button>Mở</Button>} />,
      );

      await fillProject(user);
      await submit(/^Tạo dự án$/);

      expect(createProject).toHaveBeenCalledTimes(1);
      expectNoPublishCommand();
    },
  );

  it("payload tạo KHÔNG mang contentStatus", async () => {
    const user = await openDialog(
      <ProjectFormDialog trigger={<Button>Mở</Button>} />,
    );

    await fillProject(user);
    await submit(/^Tạo dự án$/);

    const payload = createProject.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("contentStatus");
    // Tình trạng thi công là dữ liệu nghiệp vụ bình thường, vẫn phải đi kèm.
    expect(payload).toHaveProperty("status");
  });

  it("hộp thoại nói rõ dự án mới là bản Nháp", async () => {
    await openDialog(<ProjectFormDialog trigger={<Button>Mở</Button>} />);

    expect(
      within(screen.getByRole("dialog")).getByText(/trạng thái Nháp/i),
    ).toBeInTheDocument();
  });
});

describe("Tạo trang nội dung — không kèm lệnh đăng", () => {
  async function fillPage(user: ReturnType<typeof userEvent.setup>) {
    await fillByPlaceholder(user, [
      ["gioi-thieu", "gioi-thieu-moi"],
      ["Tổng quan về Công ty Thiên Đức", "Giới thiệu"],
    ]);
    await user.type(
      screen.getByRole("dialog").querySelector("textarea")!,
      "Một đoạn nội dung của trang.",
    );
  }

  it.each(ROLES)(
    "%s: đúng một lệnh tạo, không lệnh xuất bản nào",
    async (currentRole) => {
      role.current = currentRole;
      const user = await openDialog(
        <PageFormDialog trigger={<Button>Mở</Button>} />,
      );

      await fillPage(user);
      await submit(/^Tạo trang$/);

      expect(createPage).toHaveBeenCalledTimes(1);
      expectNoPublishCommand();
    },
  );

  it("payload tạo KHÔNG mang status xuất bản", async () => {
    const user = await openDialog(
      <PageFormDialog trigger={<Button>Mở</Button>} />,
    );

    await fillPage(user);
    await submit(/^Tạo trang$/);

    const payload = createPage.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("status");
  });
});

describe("Tạo dự án hợp tác — không kèm lệnh đăng", () => {
  async function fillCooperation(user: ReturnType<typeof userEvent.setup>) {
    await fillByPlaceholder(user, [
      ["Vista Verde", "Dự án hợp tác"],
      ["Quận 2, TP.HCM", "Bến Tre"],
      ["CapitaLand (Singapore)", "Đối tác"],
      ["Đồng chủ đầu tư", "Đồng phát triển"],
      ["25.295 m² · 4 tòa tháp · 1.152 căn hộ", "10 ha"],
      ["Đã bàn giao", "Đang triển khai"],
    ]);
  }

  it.each(ROLES)(
    "%s: đúng một lệnh tạo, không lệnh xuất bản nào",
    async (currentRole) => {
      role.current = currentRole;
      const user = await openDialog(
        <CooperationFormDialog trigger={<Button>Mở</Button>} />,
      );

      await fillCooperation(user);
      await submit(/^Thêm dự án hợp tác$/);

      expect(createCooperation).toHaveBeenCalledTimes(1);
      expectNoPublishCommand();
    },
  );

  /**
   * `status` của dự án hợp tác là chữ mô tả ("Đang triển khai"), KHÔNG phải bậc
   * thang duyệt. Nó phải đi trong payload; `contentStatus` thì không — đúng
   * ranh giới mà bản vá bảo mật trước đã dựng.
   */
  it("payload mang `status` mô tả nhưng KHÔNG mang contentStatus", async () => {
    const user = await openDialog(
      <CooperationFormDialog trigger={<Button>Mở</Button>} />,
    );

    await fillCooperation(user);
    await submit(/^Thêm dự án hợp tác$/);

    const payload = createCooperation.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload).toHaveProperty("status");
    expect(payload).not.toHaveProperty("contentStatus");
  });

  it("hộp thoại nói rõ dự án mới là bản Nháp", async () => {
    await openDialog(<CooperationFormDialog trigger={<Button>Mở</Button>} />);

    expect(
      within(screen.getByRole("dialog")).getByText(/trạng thái Nháp/i),
    ).toBeInTheDocument();
  });
});
