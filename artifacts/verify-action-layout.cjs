const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1920,height:1000}});
 const user={id:'visual',name:'Admin',email:'visual@example.test',role:'SUPER_ADMIN'};
 const token='x.'+Buffer.from(JSON.stringify({sub:user.id,email:user.email,role:user.role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.x';
 await page.addInitScript(token=>sessionStorage.setItem('td_admin_access_token',token),token);
 const base={title:{vi:'Du an test'},slug:'du-an-test',summary:{vi:'Test'},status:'DANG_THI_CONG',contentStatus:'DRAFT',publishedAt:null,scheduledAt:null,location:null,image:null,category:null,items:[],order:0,updatedAt:new Date().toISOString(),_count:{galleryImages:0}};
 const projects=[{...base,id:'draft'},{...base,id:'scheduled',slug:'scheduled',contentStatus:'PENDING',scheduledAt:'2030-01-01T01:00:00Z',publishedAt:'2030-01-01T01:00:00Z'}];
 await page.route('**/*',async route=>{
  const req=route.request(); if(req.resourceType()!=='fetch')return route.continue();
  const path=new URL(req.url()).pathname; const data=path.endsWith('/auth/me')?user:path.endsWith('/projects/admin')?projects:[];
  await route.fulfill({json:{success:true,data}});
 });
 await page.goto('http://127.0.0.1:5181/admin/du-an'); await page.locator('tbody tr').first().waitFor();
 for(const width of [1920,1440,1024,375]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
  const rows=await page.locator('tbody tr').all();
  for(const row of rows){const ys=await row.locator('td:last-child button').evaluateAll(btns=>btns.map(b=>Math.round(b.getBoundingClientRect().top+b.getBoundingClientRect().height/2)));assert(Math.max(...ys)-Math.min(...ys)<7,'wrapped actions '+width+': '+ys);}
 }
 projects[1]={...base,id:'published',slug:'published',contentStatus:'PUBLISHED',publishedAt:new Date().toISOString()};
 await page.reload(); await page.locator('tbody tr').first().waitFor();
 await page.setViewportSize({width:1920,height:1000});
 const space=await page.locator('tbody tr').first().locator('td:last-child').evaluate(cell=>{const buttons=[...cell.querySelectorAll('button')].map(el=>el.getBoundingClientRect());return {cell:cell.clientWidth,buttons:Math.max(...buttons.map(r=>r.right))-Math.min(...buttons.map(r=>r.left))};});
 assert(space.cell-space.buttons<40,'unused action column space '+JSON.stringify(space));console.log('Compact action column:',space);
 await page.screenshot({path:'artifacts/actions-inline-1920.png'});
 await page.locator('tbody tr').first().locator('td:last-child button').first().click();
 const dialog=page.getByRole('dialog'); await dialog.getByRole('radio').nth(1).check();
 assert(!/[\u201c\u201d\u2014\u2013\u2026\u2192\u00b7]/.test(await dialog.innerText()),'decorative punctuation in dialog');
 for(const width of [1440,375]){await page.setViewportSize({width,height:900});await page.screenshot({path:`artifacts/delete-dialog-${width}.png`});assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog overflow');}
 await browser.close(); console.log('PASS: actions remain on one row at 1920/1440/1024/375; no page overflow; permanent-delete dialog fits desktop/mobile. API requests intercepted; no data changed.');
})().catch(e=>{console.error(e);process.exit(1)});
