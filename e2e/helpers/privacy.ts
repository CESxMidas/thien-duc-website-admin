import { expect, type Page } from '@playwright/test';

/**
 * Xác nhận token bản rõ KHÔNG rò ra bất kỳ đâu người dùng/JS chạm được:
 * thanh địa chỉ, localStorage, sessionStorage, cookie, và text hiển thị.
 */
export async function assertNoTokenLeak(
  page: Page,
  token: string,
): Promise<void> {
  expect(page.url()).not.toContain(token);
  const dump = await page.evaluate(() => {
    const dumpStore = (s: Storage) => {
      const o: Record<string, string> = {};
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k) o[k] = s.getItem(k) ?? '';
      }
      return o;
    };
    return JSON.stringify({
      ls: dumpStore(localStorage),
      ss: dumpStore(sessionStorage),
    });
  });
  expect(dump).not.toContain(token);
  const cookies = await page.context().cookies();
  expect(JSON.stringify(cookies)).not.toContain(token);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(token);
}
