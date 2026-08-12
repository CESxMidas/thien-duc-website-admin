/**
 * THIEN-DUC-OPTIONAL-BACKLOG-REPO-WORK-M1 — test TRỰC TIẾP 6 schema Zod của
 * các FormDialog ở Admin (backlog §6 "Test Zod schema 6 FormDialog").
 *
 * Trước đây các schema là module-local nên chỉ được phủ **gián tiếp** qua test
 * component (`BilingualField`/`bilingual.ts`): không có gì khẳng định biên độ
 * dài, hình dạng slug, URL nguy hiểm hay trần số đoạn. Nay mỗi schema được
 * export (CHỈ schema, không lộ nội bộ component) và kiểm thẳng ở đây.
 *
 * Nguyên tắc đối chiếu: Admin phải kiểm **đúng bằng** backend DTO — không lỏng
 * hơn (biên tập viên chỉ biết sai sau khi nhận 400) và không chặt hơn (tự chặn
 * dữ liệu API vẫn nhận). Bảng đối chiếu đầy đủ nằm trong báo cáo phiên.
 */
import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { bannerSchema } from "@/components/banners/banner-schema";
import { cooperationSchema } from "@/components/cooperation/cooperation-schema";
import { newsSchema } from "@/components/news/news-schema";
import { pageSchema } from "@/components/pages/page-schema";
import { projectSchema } from "@/components/projects/project-schema";
import { userSchema } from "@/components/users/user-schema";
import {
  MAX_AUTHOR_LENGTH,
  MAX_CATEGORY_ID_LENGTH,
  MAX_OBJECT_POSITION_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_URL_LENGTH,
} from "@/lib/form-validation";
import { MAX_CONTENT_BLOCKS, MAX_LONG_TEXT_LENGTH } from "@/lib/long-form-content";

/** Đường dẫn field bị lỗi, ví dụ `title.vi`. */
function errorPaths(result: z.ZodSafeParseResult<unknown>): string[] {
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

const ok = (result: z.ZodSafeParseResult<unknown>) => result.success;

/** Chuỗi dài `n` ký tự. */
const long = (n: number) => "a".repeat(n);

/** Khoảng trắng "vô hình" hay bị dán nhầm từ Word/Excel. */
const ZERO_WIDTH = "​​​";
const NBSP = "   ";

/* =========================================================================
   Dữ liệu hợp lệ tối thiểu cho từng schema
   ========================================================================= */

const bilingual = (vi: string, en = "") => ({ vi, en });

const validBanner = {
  image: "/images/banners/hero.jpg",
  href: "/du-an",
  title: bilingual("Tiêu đề banner"),
  eyebrow: bilingual(""),
  subtitle: bilingual(""),
  ctaLabel: bilingual(""),
  objectPosition: "",
};

const validCooperation = {
  name: bilingual("Dự án hợp tác"),
  location: bilingual("Hà Nội"),
  role: bilingual("Tổng thầu"),
  partner: bilingual("Đối tác A"),
  scale: bilingual("10 ha"),
  status: bilingual("Đang thi công"),
  image: "",
};

const validNews = {
  title: bilingual("Tiêu đề bài viết"),
  slug: "tieu-de-bai-viet",
  summary: bilingual("Tóm tắt đủ dài cho bài viết này."),
  content: bilingual(""),
  // Chuyên mục bắt buộc ở form Admin (API vẫn để tuỳ chọn) — bài không có
  // chuyên mục không xuất hiện ở trang danh mục nào cả.
  categoryId: "cat-1",
  author: "",
  image: "",
  eventDate: "",
};

const validPage = {
  slug: "gioi-thieu",
  title: bilingual("Giới thiệu"),
  content: bilingual("Đoạn nội dung đầu tiên."),
};

const validProject = {
  title: bilingual("Dự án Thiên Đức"),
  slug: "du-an-thien-duc",
  summary: bilingual("Mô tả ngắn đủ dài cho dự án."),
  location: bilingual(""),
  category: bilingual(""),
  image: "",
  status: "DANG_THI_CONG" as const,
};

const validUser = {
  name: "Nguyễn Văn A",
  email: "a@thienduc.vn",
  role: "EDITOR" as const,
};

/** Bộ 6 schema + payload hợp lệ tối thiểu, dùng cho các test dùng chung. */
const allSchemas = [
  ["banner", bannerSchema, validBanner],
  ["cooperation", cooperationSchema, validCooperation],
  ["news", newsSchema, validNews],
  ["page", pageSchema, validPage],
  ["project", projectSchema, validProject],
  ["user", userSchema, validUser],
] as const;

/* =========================================================================
   Hành vi dùng chung cho cả 6 schema
   ========================================================================= */

describe("6 schema FormDialog — hành vi chung", () => {
  it.each(allSchemas)("%s: payload hợp lệ tối thiểu được chấp nhận", (_n, schema, payload) => {
    expect(ok(schema.safeParse(payload))).toBe(true);
  });

  it.each(allSchemas)(
    "%s: field lạ bị LOẠI khỏi kết quả (Zod object mặc định strip)",
    (_n, schema, payload) => {
      const result = schema.safeParse({
        ...payload,
        khongTonTai: "x",
        password: "MatKhau123",
        passwordHash: "$2b$12$gia.mao",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("khongTonTai");
        expect(result.data).not.toHaveProperty("password");
        expect(result.data).not.toHaveProperty("passwordHash");
      }
    },
  );

  it.each(allSchemas)("%s: thiếu toàn bộ field → báo lỗi, không ném", (_n, schema) => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    expect(errorPaths(result).length).toBeGreaterThan(0);
  });

  it.each(allSchemas)("%s: sai kiểu (số thay chuỗi) bị từ chối", (_n, schema, payload) => {
    const [firstKey] = Object.keys(payload);
    const result = schema.safeParse({ ...payload, [firstKey]: 123 });
    expect(result.success).toBe(false);
  });
});

/* =========================================================================
   Chữ song ngữ: bắt buộc VI, tùy chọn EN, biên độ dài
   ========================================================================= */

describe("Chữ song ngữ — VI bắt buộc, EN tùy chọn", () => {
  it("banner: thiếu tiêu đề VI bị chặn, EN rỗng vẫn hợp lệ", () => {
    expect(
      errorPaths(bannerSchema.safeParse({ ...validBanner, title: bilingual("") })),
    ).toContain("title.vi");
    expect(ok(bannerSchema.safeParse({ ...validBanner, title: bilingual("Tiêu đề") }))).toBe(
      true,
    );
  });

  it("EN được nhập vẫn hợp lệ (song ngữ đầy đủ)", () => {
    expect(
      ok(
        bannerSchema.safeParse({
          ...validBanner,
          title: bilingual("Tiêu đề", "Headline"),
          subtitle: bilingual("Phụ đề", "Subtitle"),
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ["chuỗi rỗng", ""],
    ["chỉ khoảng trắng", "     "],
    ["tab + newline", "\t\n  \t"],
    ["non-breaking space", NBSP],
  ])("cooperation: tên %s bị chặn (trim rồi mới đo min)", (_label, value) => {
    expect(errorPaths(cooperationSchema.safeParse({ ...validCooperation, name: bilingual(value) })))
      .toContain("name.vi");
  });

  it("zero-width space KHÔNG bị `trim()` bỏ — đây là hành vi hiện tại, ghi nhận rõ", () => {
    // `String.prototype.trim()` chỉ bỏ khoảng trắng theo Unicode White_Space;
    // U+200B không thuộc nhóm đó nên chuỗi 3 ký tự này vượt min(2) và ĐƯỢC
    // chấp nhận. Backend `@IsNotBlank` cũng dùng cùng ngữ nghĩa trim nên hai
    // bên KHỚP nhau — test này khoá hành vi để đổi một bên là thấy ngay.
    expect(ok(cooperationSchema.safeParse({ ...validCooperation, name: bilingual(ZERO_WIDTH) })))
      .toBe(true);
  });

  it("khoảng trắng hai đầu được trim trước khi đo độ dài tối thiểu", () => {
    // "  ab  " -> "ab" = 2 ký tự, đúng bằng min(2) của cooperation.name.
    expect(ok(cooperationSchema.safeParse({ ...validCooperation, name: bilingual("  ab  ") })))
      .toBe(true);
    expect(errorPaths(cooperationSchema.safeParse({ ...validCooperation, name: bilingual("  a  ") })))
      .toContain("name.vi");
  });

  it.each([
    ["banner.title", bannerSchema, validBanner, "title"],
    ["cooperation.name", cooperationSchema, validCooperation, "name"],
    ["news.title", newsSchema, validNews, "title"],
    ["page.title", pageSchema, validPage, "title"],
    ["project.title", projectSchema, validProject, "title"],
  ] as const)(
    "%s: đúng trần %d ký tự OK, hơn 1 ký tự bị chặn (khớp TranslatedTextDto)",
    (_label, schema, payload, field) => {
      const atLimit = { ...payload, [field]: bilingual(long(MAX_TEXT_LENGTH)) };
      const overLimit = { ...payload, [field]: bilingual(long(MAX_TEXT_LENGTH + 1)) };
      expect(ok(schema.safeParse(atLimit))).toBe(true);
      expect(errorPaths(schema.safeParse(overLimit))).toContain(`${field}.vi`);
    },
  );

  it("field EN cũng bị chặn khi vượt trần", () => {
    const over = { ...validProject, title: bilingual("Hợp lệ", long(MAX_TEXT_LENGTH + 1)) };
    expect(errorPaths(projectSchema.safeParse(over))).toContain("title.en");
  });

  it("song ngữ tùy chọn (location/category) cho phép VI rỗng nhưng vẫn có trần", () => {
    expect(ok(projectSchema.safeParse({ ...validProject, location: bilingual("") }))).toBe(true);
    expect(
      errorPaths(projectSchema.safeParse({ ...validProject, location: bilingual(long(MAX_TEXT_LENGTH + 1)) })),
    ).toContain("location.vi");
  });

  it("summary có min riêng (10) — 9 ký tự bị chặn, 10 ký tự OK", () => {
    expect(errorPaths(newsSchema.safeParse({ ...validNews, summary: bilingual(long(9)) })))
      .toContain("summary.vi");
    expect(ok(newsSchema.safeParse({ ...validNews, summary: bilingual(long(10)) }))).toBe(true);
  });
});

/* =========================================================================
   Slug
   ========================================================================= */

describe("Slug — news / page / project dùng chung ràng buộc", () => {
  const slugSchemas = [
    ["news", newsSchema, validNews],
    ["page", pageSchema, validPage],
    ["project", projectSchema, validProject],
  ] as const;

  it.each(slugSchemas)("%s: slug hợp lệ", (_n, schema, payload) => {
    expect(ok(schema.safeParse({ ...payload, slug: "abc-123-xyz" }))).toBe(true);
  });

  it.each(slugSchemas)("%s: dưới 3 ký tự bị chặn", (_n, schema, payload) => {
    expect(errorPaths(schema.safeParse({ ...payload, slug: "ab" }))).toContain("slug");
  });

  it.each(slugSchemas)("%s: đúng trần %s ký tự OK, hơn 1 bị chặn", (_n, schema, payload) => {
    expect(ok(schema.safeParse({ ...payload, slug: "a".repeat(MAX_SLUG_LENGTH) }))).toBe(true);
    expect(errorPaths(schema.safeParse({ ...payload, slug: "a".repeat(MAX_SLUG_LENGTH + 1) })))
      .toContain("slug");
  });

  it.each([
    ["chữ HOA", "Bai-Viet"],
    ["dấu tiếng Việt", "bai-viết"],
    ["khoảng trắng", "bai viet"],
    ["gạch dưới", "bai_viet"],
    ["dấu chấm", "bai.viet"],
    ["dấu gạch chéo", "bai/viet"],
    ["ký tự đặc biệt", "bai-viet!"],
  ])("news: slug có %s bị chặn", (_label, slug) => {
    expect(errorPaths(newsSchema.safeParse({ ...validNews, slug }))).toContain("slug");
  });
});

/* =========================================================================
   URL: ảnh + href nội bộ
   ========================================================================= */

describe("Ảnh — đường dẫn nội bộ hoặc https, khớp @IsSafeImageRef", () => {
  const imageSchemas = [
    ["cooperation", cooperationSchema, validCooperation],
    ["news", newsSchema, validNews],
    ["project", projectSchema, validProject],
  ] as const;

  it.each(imageSchemas)("%s: ảnh rỗng hợp lệ (field tùy chọn)", (_n, schema, payload) => {
    expect(ok(schema.safeParse({ ...payload, image: "" }))).toBe(true);
  });

  it.each([
    ["đường dẫn nội bộ", "/images/x.jpg"],
    ["URL Cloudinary https", "https://res.cloudinary.com/demo/image/upload/x.jpg"],
  ])("project: ảnh %s được chấp nhận", (_label, image) => {
    expect(ok(projectSchema.safeParse({ ...validProject, image }))).toBe(true);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html;base64,PHNjcmlwdD4="],
    ["vbscript:", "vbscript:msgbox(1)"],
    ["http (mixed content)", "http://example.com/x.jpg"],
    ["protocol-relative", "//evil.example.com/x.jpg"],
    ["backslash lách", "/\\evil.example.com"],
    ["javascript có tab chèn giữa", "java\tscript:alert(1)"],
    ["javascript có newline chèn giữa", "java\nscript:alert(1)"],
    ["khoảng trắng đầu + javascript", "  javascript:alert(1)"],
    ["đường dẫn tương đối", "images/x.jpg"],
  ])("project: ảnh %s bị CHẶN", (_label, image) => {
    expect(errorPaths(projectSchema.safeParse({ ...validProject, image }))).toContain("image");
  });

  it("banner: ảnh bắt buộc — rỗng bị chặn", () => {
    expect(errorPaths(bannerSchema.safeParse({ ...validBanner, image: "" }))).toContain("image");
  });

  it("ảnh đúng trần 500 ký tự OK, hơn 1 bị chặn", () => {
    const base = "/i/";
    const atLimit = base + "a".repeat(MAX_URL_LENGTH - base.length);
    expect(ok(projectSchema.safeParse({ ...validProject, image: atLimit }))).toBe(true);
    expect(errorPaths(projectSchema.safeParse({ ...validProject, image: atLimit + "a" })))
      .toContain("image");
  });
});

describe("Banner href — chỉ đường dẫn nội bộ, khớp @IsSafeInternalPath", () => {
  it.each([["/du-an"], ["/tin-tuc/bai-viet"], ["/"]])("href %s hợp lệ", (href) => {
    expect(ok(bannerSchema.safeParse({ ...validBanner, href }))).toBe(true);
  });

  it.each([
    ["rỗng", ""],
    ["https tuyệt đối", "https://example.com"],
    ["javascript:", "javascript:alert(1)"],
    ["protocol-relative", "//evil.example.com"],
    ["backslash lách", "/\\evil.example.com"],
    ["tương đối", "du-an"],
  ])("href %s bị CHẶN", (_label, href) => {
    expect(errorPaths(bannerSchema.safeParse({ ...validBanner, href }))).toContain("href");
  });

  it("href https KHÔNG được nhận dù ảnh thì được (hai hàng rào khác nhau)", () => {
    const url = "https://res.cloudinary.com/demo/x.jpg";
    expect(errorPaths(bannerSchema.safeParse({ ...validBanner, href: url }))).toContain("href");
    expect(ok(bannerSchema.safeParse({ ...validBanner, image: url }))).toBe(true);
  });
});

/* =========================================================================
   Trần độ dài các field chữ thuần
   ========================================================================= */

describe("Trần độ dài field chữ thuần", () => {
  it("banner.objectPosition: đúng 60 OK, 61 bị chặn", () => {
    expect(
      ok(bannerSchema.safeParse({ ...validBanner, objectPosition: long(MAX_OBJECT_POSITION_LENGTH) })),
    ).toBe(true);
    expect(
      errorPaths(
        bannerSchema.safeParse({ ...validBanner, objectPosition: long(MAX_OBJECT_POSITION_LENGTH + 1) }),
      ),
    ).toContain("objectPosition");
  });

  it("objectPosition nhận giá trị CSS thật và rỗng", () => {
    expect(ok(bannerSchema.safeParse({ ...validBanner, objectPosition: "center 40%" }))).toBe(true);
    expect(ok(bannerSchema.safeParse({ ...validBanner, objectPosition: "" }))).toBe(true);
  });

  it("news.author: đúng 120 OK, 121 bị chặn", () => {
    expect(ok(newsSchema.safeParse({ ...validNews, author: long(MAX_AUTHOR_LENGTH) }))).toBe(true);
    expect(errorPaths(newsSchema.safeParse({ ...validNews, author: long(MAX_AUTHOR_LENGTH + 1) })))
      .toContain("author");
  });

  it("news.categoryId: đúng 60 OK, 61 bị chặn", () => {
    expect(ok(newsSchema.safeParse({ ...validNews, categoryId: long(MAX_CATEGORY_ID_LENGTH) })))
      .toBe(true);
    expect(
      errorPaths(newsSchema.safeParse({ ...validNews, categoryId: long(MAX_CATEGORY_ID_LENGTH + 1) })),
    ).toContain("categoryId");
  });
});

/* =========================================================================
   Nội dung dài: số đoạn + độ dài mỗi đoạn
   ========================================================================= */

describe("Nội dung dài (page bắt buộc, news tùy chọn)", () => {
  it("page: nội dung rỗng bị chặn (backend @ArrayNotEmpty)", () => {
    expect(errorPaths(pageSchema.safeParse({ ...validPage, content: bilingual("") })))
      .toContain("content.vi");
  });

  it("page: chỉ khoảng trắng cũng bị chặn", () => {
    expect(errorPaths(pageSchema.safeParse({ ...validPage, content: bilingual("   \n\n   ") })))
      .toContain("content.vi");
  });

  it("news: nội dung rỗng HỢP LỆ (bài chỉ có tóm tắt)", () => {
    expect(ok(newsSchema.safeParse({ ...validNews, content: bilingual("") }))).toBe(true);
  });

  it("đúng trần số đoạn (500) OK, 501 đoạn bị chặn", () => {
    const atLimit = Array.from({ length: MAX_CONTENT_BLOCKS }, (_, i) => `Đoạn ${i}`).join("\n\n");
    const overLimit = Array.from({ length: MAX_CONTENT_BLOCKS + 1 }, (_, i) => `Đoạn ${i}`).join("\n\n");
    expect(ok(pageSchema.safeParse({ ...validPage, content: bilingual(atLimit) }))).toBe(true);
    expect(errorPaths(pageSchema.safeParse({ ...validPage, content: bilingual(overLimit) })))
      .toContain("content.vi");
  });

  it("đoạn đúng trần 100.000 ký tự OK, 100.001 bị chặn", () => {
    expect(ok(pageSchema.safeParse({ ...validPage, content: bilingual(long(MAX_LONG_TEXT_LENGTH)) })))
      .toBe(true);
    expect(
      errorPaths(pageSchema.safeParse({ ...validPage, content: bilingual(long(MAX_LONG_TEXT_LENGTH + 1)) })),
    ).toContain("content.vi");
  });

  it("nhiều đoạn NGẮN cộng lại vượt 100.000 vẫn HỢP LỆ (đo theo đoạn, không theo tổng)", () => {
    const many = Array.from({ length: 30 }, () => long(5_000)).join("\n\n");
    expect(many.length).toBeGreaterThan(MAX_LONG_TEXT_LENGTH);
    expect(ok(pageSchema.safeParse({ ...validPage, content: bilingual(many) }))).toBe(true);
  });

  it("nội dung EN quá dài cũng bị chặn", () => {
    expect(
      errorPaths(
        newsSchema.safeParse({ ...validNews, content: bilingual("", long(MAX_LONG_TEXT_LENGTH + 1)) }),
      ),
    ).toContain("content.en");
  });
});

/* =========================================================================
   Enum + email
   ========================================================================= */

describe("Enum và email", () => {
  it.each([["DA_BAN_GIAO"], ["DANG_THI_CONG"], ["CHUAN_BI_KHOI_CONG"]])(
    "project: trạng thái %s hợp lệ",
    (status) => {
      expect(ok(projectSchema.safeParse({ ...validProject, status }))).toBe(true);
    },
  );

  it.each([["HOAN_THANH"], ["PUBLISHED"], [""], ["dang_thi_cong"]])(
    "project: trạng thái %s ngoài enum bị chặn",
    (status) => {
      expect(errorPaths(projectSchema.safeParse({ ...validProject, status }))).toContain("status");
    },
  );

  it.each([["EDITOR"], ["ADMIN"], ["SUPER_ADMIN"]])("user: vai trò %s hợp lệ", (role) => {
    expect(ok(userSchema.safeParse({ ...validUser, role }))).toBe(true);
  });

  it.each([["OWNER"], ["editor"], [""]])("user: vai trò %s ngoài enum bị chặn", (role) => {
    expect(errorPaths(userSchema.safeParse({ ...validUser, role }))).toContain("role");
  });

  it.each([
    ["rỗng", ""],
    ["thiếu @", "abc"],
    ["thiếu tên miền", "a@"],
    ["chỉ khoảng trắng", "   "],
  ])("user: email %s bị chặn", (_label, email) => {
    expect(errorPaths(userSchema.safeParse({ ...validUser, email }))).toContain("email");
  });

  it("user: họ tên dưới 2 ký tự bị chặn, đúng 2 ký tự OK", () => {
    expect(errorPaths(userSchema.safeParse({ ...validUser, name: "A" }))).toContain("name");
    expect(ok(userSchema.safeParse({ ...validUser, name: "An" }))).toBe(true);
  });

  it("user: KHÔNG có field mật khẩu trong schema", () => {
    const result = userSchema.safeParse({ ...validUser, password: "MatKhau123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("password");
    expect(Object.keys(userSchema.shape)).toEqual(["name", "email", "role"]);
  });
});

/* =========================================================================
   Ngày sự kiện
   ========================================================================= */

describe("news.eventDate — khớp @IsDateString()", () => {
  it.each([["rỗng", ""], ["ngày hợp lệ", "2026-07-31"]])("%s hợp lệ", (_label, eventDate) => {
    expect(ok(newsSchema.safeParse({ ...validNews, eventDate }))).toBe(true);
  });

  it.each([
    ["định dạng Việt Nam", "31/07/2026"],
    ["chữ", "hom-nay"],
    ["thiếu số 0", "2026-7-1"],
  ])("%s bị chặn", (_label, eventDate) => {
    expect(errorPaths(newsSchema.safeParse({ ...validNews, eventDate }))).toContain("eventDate");
  });
});

/* =========================================================================
   Chế độ tạo mới vs sửa
   ========================================================================= */

describe("Tạo mới vs sửa — cùng một schema, không có nhánh riêng", () => {
  it("schema KHÔNG đổi theo chế độ: cùng payload cho kết quả giống nhau", () => {
    // Các dialog dùng đúng MỘT schema cho cả hai nhánh; khác biệt chỉ ở giá trị
    // mặc định nạp vào form. Test này khoá điều đó: không có field nào chỉ bắt
    // buộc khi tạo mới, nên sửa một bản ghi cũ hợp lệ không bao giờ tự nhiên đỏ.
    const created = projectSchema.safeParse(validProject);
    const edited = projectSchema.safeParse({ ...validProject, title: bilingual("Tên đã sửa") });
    expect(created.success).toBe(true);
    expect(edited.success).toBe(true);
  });

  it("giữ nguyên giá trị cũ (không đổi gì) vẫn hợp lệ", () => {
    expect(ok(newsSchema.safeParse({ ...validNews }))).toBe(true);
    expect(ok(bannerSchema.safeParse({ ...validBanner }))).toBe(true);
  });

  it("dữ liệu đầy đủ mọi field tùy chọn vẫn hợp lệ", () => {
    expect(
      ok(
        newsSchema.safeParse({
          title: bilingual("Tiêu đề", "Title"),
          slug: "bai-viet-day-du",
          summary: bilingual("Tóm tắt tiếng Việt.", "English summary here."),
          content: bilingual("Đoạn 1.\n\nĐoạn 2.", "Para 1.\n\nPara 2."),
          categoryId: "cat-1",
          author: "Ban biên tập",
          image: "https://res.cloudinary.com/demo/image/upload/x.jpg",
          eventDate: "2026-07-31",
        }),
      ),
    ).toBe(true);
  });
});
