const {chromium,expect}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const user={id:'visual',name:'Admin',email:'visual@example.test',role:'SUPER_ADMIN'};
 const token='x.'+Buffer.from(JSON.stringify({sub:user.id,email:user.email,role:user.role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.x';
 await page.addInitScript(token=>sessionStorage.setItem('td_admin_access_token',token),token);
 await page.route('**/*',async route=>{if(route.request().resourceType()!=='fetch')return route.continue();const p=new URL(route.request().url()).pathname;await route.fulfill({json:{success:true,data:p.endsWith('/auth/me')?user:[]}});});
 const cases=[['du-an','T\u1ea1o d\u1ef1 \u00e1n','T\u00ean d\u1ef1 \u00e1n','Slug d\u1ef1 \u00e1n'],['tin-tuc','Vi\u1ebft tin','Ti\u00eau \u0111\u1ec1 b\u00e0i vi\u1ebft','\u0110\u01b0\u1eddng d\u1eabn b\u00e0i vi\u1ebft'],['trang','T\u1ea1o trang','Ti\u00eau \u0111\u1ec1 trang','Slug trang n\u1ed9i dung']];
 for(const [path,button,titleLabel,slugLabel] of cases){
  await page.goto(`http://127.0.0.1:5181/admin/${path}`);await page.getByRole('button',{name:button,exact:true}).click();
  const dialog=page.getByRole('dialog'); const title=dialog.getByRole('textbox',{name:titleLabel,exact:true});const slug=dialog.getByRole('textbox',{name:slugLabel,exact:true});
  await title.fill('d');await expect(slug).toHaveValue('d');
  await title.dispatchEvent('compositionstart');await title.fill('');await title.fill('\u0111');await title.dispatchEvent('compositionend',{data:'\u0111'});
  await title.fill('Khu \u0111\u00f4 th\u1ecb H\u01b0ng Ph\u00fa');await expect(slug).toHaveValue('khu-do-thi-hung-phu');
  await title.fill('');await expect(slug).toHaveValue('');await title.fill('D\u1ef1 \u00e1n B\u1ebfn Tre');await expect(slug).toHaveValue('du-an-ben-tre');
  await slug.fill('duong-dan-rieng');await title.fill('T\u00ean m\u1edbi');await expect(slug).toHaveValue('duong-dan-rieng');
  await dialog.getByRole('button',{name:'H\u1ee7y',exact:true}).click();await page.getByRole('button',{name:button,exact:true}).click();await title.fill('Khu \u0111\u00f4 th\u1ecb H\u01b0ng Ph\u00fa');await expect(slug).toHaveValue('khu-do-thi-hung-phu');
  await page.screenshot({path:`artifacts/auto-slug-${path}.png`});console.log('PASS',path,'Vietnamese composition, clear/retype, manual override, reopen reset');
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
