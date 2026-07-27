import { test, expect, type Page } from '@playwright/test';
import { FRONTEND_URL, seedAccounts, uniqueE2eEmail } from '../helpers/config';
import {
  authedGet,
  apiLogin,
  clearOutbox,
  clearTestContacts,
  getOutbox,
  getTestContacts,
  setMailFailMode,
} from '../helpers/api';

const seed = seedAccounts();
const CONTACT_URL = `${FRONTEND_URL}/lien-he`;
const VALID_PHONE = '0901234567';
const NOTIFY_TO = 'receiver@test.local';

test.afterAll(async () => {
  await setMailFailMode(false);
  await clearTestContacts();
});

async function gotoContact(page: Page): Promise<void> {
  await page.goto(CONTACT_URL, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu' })).toBeVisible();
  // Chờ React hydrate xong (mạng lắng) để form dùng onSubmit của JS, không phải
  // submit gốc của trình duyệt — tránh reload khi tương tác quá sớm.
  await page.waitForLoadState('networkidle');
}

interface ContactInput {
  name: string;
  phone: string;
  email: string;
  message: string;
  inquiry?: string;
}

async function fillContact(page: Page, data: ContactInput): Promise<void> {
  await page.locator('#contact-name').fill(data.name);
  await page.locator('#contact-phone').fill(data.phone);
  await page.locator('#contact-email').fill(data.email);
  await page
    .locator('#contact-inquiry')
    .selectOption(data.inquiry ?? 'tu-van-du-an');
  await page.locator('#contact-message').fill(data.message);
}

/** Điền + gửi, chờ phản hồi POST /contact, trả status của phản hồi. */
async function submitContact(page: Page, data: ContactInput): Promise<number> {
  await fillContact(page, data);
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/contact') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
  return (await respPromise).status();
}

test.describe('§10 — Form liên hệ công khai', () => {
  test('trang liên hệ mở được với đầy đủ trường', async ({ page }) => {
    await gotoContact(page);
    await expect(page.locator('#contact-name')).toBeVisible();
    await expect(page.locator('#contact-phone')).toBeVisible();
    await expect(page.locator('#contact-inquiry')).toBeVisible();
    await expect(page.locator('#contact-message')).toBeVisible();
  });

  test('validate trường bắt buộc: bấm gửi khi trống → hiện lỗi, không gửi', async ({
    page,
  }) => {
    await gotoContact(page);
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    await expect(page.locator('#contact-name-error')).toBeVisible();
    await expect(page.locator('#contact-phone-error')).toBeVisible();
    await expect(page.locator('#contact-message-error')).toBeVisible();
    // Vẫn ở form (chưa chuyển sang màn thành công).
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('validate email và độ dài nội dung', async ({ page }) => {
    await gotoContact(page);
    await page.locator('#contact-email').fill('sai-dinh-dang');
    await page.locator('#contact-email').blur();
    await expect(page.locator('#contact-email-error')).toBeVisible();
    await page.locator('#contact-message').fill('ngắn');
    await page.locator('#contact-message').blur();
    await expect(page.locator('#contact-message-error')).toBeVisible();
    await page.locator('#contact-phone').fill('123');
    await page.locator('#contact-phone').blur();
    await expect(page.locator('#contact-phone-error')).toBeVisible();
  });

  test('gửi hợp lệ → UI thành công + lưu DB + email giả đúng người nhận', async ({
    page,
  }) => {
    await clearOutbox();
    const email = uniqueE2eEmail('contact');
    const message = 'Tôi muốn được tư vấn dự án Hưng Phú tại Bến Tre.';
    await gotoContact(page);
    const status = await submitContact(page, {
      name: 'Nguyễn Văn Liên Hệ',
      phone: VALID_PHONE,
      email,
      message,
    });
    expect(status).toBeLessThan(400);

    // UI thành công.
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText('Đã gửi yêu cầu thành công')).toBeVisible();

    // Lưu DB (đúng nội dung).
    const rows = await getTestContacts(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Nguyễn Văn Liên Hệ');
    expect(rows[0].phone).toBe(VALID_PHONE);
    expect(rows[0].message).toBe(message);
    expect(rows[0].inquiryType).toBe('tu-van-du-an');

    // Email giả được tạo, đúng người nhận.
    const contactMails = (await getOutbox()).filter((m) => m.type === 'contact');
    expect(contactMails.length).toBeGreaterThan(0);
    expect(contactMails[0].to).toBe(NOTIFY_TO);
  });

  test('nội dung độc hại được escape trong email (chống chèn HTML)', async ({
    page,
  }) => {
    await clearOutbox();
    const email = uniqueE2eEmail('contact-xss');
    await gotoContact(page);
    await submitContact(page, {
      name: 'XSS <script>alert(1)</script>',
      phone: VALID_PHONE,
      email,
      message: 'Nội dung có <script>alert(2)</script> cần được escape an toàn.',
    });
    await expect(page.getByRole('status')).toBeVisible();
    const mail = (await getOutbox()).find((m) => m.type === 'contact');
    expect(mail).toBeTruthy();
    expect(mail!.html).toContain('&lt;script&gt;');
    expect(mail!.html).not.toContain('<script>alert');
  });

  test('giả lập lỗi provider email: lead vẫn lưu, UI vẫn thành công, không có email', async ({
    page,
  }) => {
    await clearOutbox();
    await setMailFailMode(true);
    const email = uniqueE2eEmail('contact-failmail');
    await gotoContact(page);
    await submitContact(page, {
      name: 'Lỗi Email',
      phone: VALID_PHONE,
      email,
      message: 'Nội dung khi provider email lỗi vẫn phải lưu được lead.',
    });
    await expect(page.getByRole('status')).toBeVisible();
    // Lead vẫn lưu.
    expect(await getTestContacts(email)).toHaveLength(1);
    // Không có email liên hệ nào được tạo (provider "lỗi").
    expect((await getOutbox()).filter((m) => m.type === 'contact')).toHaveLength(
      0,
    );
    await setMailFailMode(false);
  });

  test('UI theo đúng hợp đồng API: lead xuất hiện qua GET /contact (admin)', async ({
    page,
  }) => {
    await clearOutbox();
    const email = uniqueE2eEmail('contact-contract');
    await gotoContact(page);
    await submitContact(page, {
      name: 'Hợp Đồng API',
      phone: VALID_PHONE,
      email,
      message: 'Kiểm tra hợp đồng API giữa frontend và backend.',
    });
    await expect(page.getByRole('status')).toBeVisible();

    const token = (await apiLogin(seed.superAdmin.email, seed.superAdmin.password))
      .body!.data!.accessToken;
    const list = await authedGet('/contact', token);
    expect(list.status).toBe(200);
    const data = (list.body as { data: { email: string; status: string }[] })
      .data;
    const found = data.find((c) => c.email === email);
    expect(found).toBeTruthy();
    expect(found!.status).toBe('NEW');
  });

  test('chống gửi trùng: sau khi gửi, form được thay bằng màn thành công (không gửi lại)', async ({
    page,
  }) => {
    await clearOutbox();
    const email = uniqueE2eEmail('contact-dup');
    await gotoContact(page);
    await submitContact(page, {
      name: 'Gửi Trùng',
      phone: VALID_PHONE,
      email,
      message: 'Kiểm tra chống gửi trùng: form bị thay bằng màn thành công.',
    });
    await expect(page.getByRole('status')).toBeVisible();
    // Nút gửi (đúng "Gửi yêu cầu") biến mất — form bị thay bằng màn thành công.
    await expect(
      page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }),
    ).toHaveCount(0);
    // Đúng một lead được tạo.
    expect(await getTestContacts(email)).toHaveLength(1);
  });

  test('lỗi backend hiển thị an toàn, không lộ stack trace', async ({
    page,
  }) => {
    await gotoContact(page);
    // Ép POST /contact trả 400 để kiểm UI xử lý an toàn.
    await page.route('**/contact', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'VALIDATION', message: 'Dữ liệu không hợp lệ' },
          }),
        });
      }
      return route.continue();
    });
    await fillContact(page, {
      name: 'Lỗi Backend',
      phone: VALID_PHONE,
      email: uniqueE2eEmail('contact-error'),
      message: 'Kiểm tra xử lý lỗi backend an toàn không lộ stack trace.',
    });
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();
    // Hiện thông báo lỗi thân thiện, KHÔNG chuyển sang thành công.
    // (getByRole('alert') dính thêm __next-route-announcer__ nên lọc theo text.)
    await expect(page.getByText('Không gửi được yêu cầu')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    // Không lộ chi tiết nội bộ backend (mã lỗi/khung stack) — chỉ thông báo thân thiện.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('VALIDATION');
    expect(body).not.toContain('Dữ liệu không hợp lệ');
    expect(body).not.toMatch(/\n\s+at\s+\S/); // khung stack "\n    at ..."
  });
});
