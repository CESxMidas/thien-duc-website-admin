// Script QA CommonJS độc lập, chỉ dùng dữ liệu giả trong trình duyệt cách ly.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const uuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor={id:uuid(1),name:'Quản trị kiểm thử',email:'qa@bulk.e2e.test',role:'SUPER_ADMIN',canDeleteCms:true,isActive:true};
const date='2026-10-30T01:00:00.000Z';
const image='/qa-image.svg';
const projects=[2,3].map((n)=>({id:uuid(n),slug:`demo-${n}`,title:{vi:`Dự án ${n===2?'A':'B'}`},summary:{vi:'Mô tả kiểm thử.'},status:'DANG_THI_CONG',contentStatus:'DRAFT',scheduledAt:null,publishedAt:null,image:null,location:{vi:'Bến Tre'},category:{vi:'Khu đô thị'},description:{vi:'Tổng quan.'},highlights:[],quickFacts:[],mapLocation:null,createdAt:date,updatedAt:date,items:[4,5].map((i)=>({id:uuid(n*10+i),slug:`item-${i}`,projectId:uuid(n),title:{vi:`Hạng mục ${i}`},summary:{vi:'Mô tả'},isActive:true,order:i,image:null,highlights:[],quickFacts:[],galleryImages:[],createdAt:date,updatedAt:date})),galleryImages:[6,7].map((i)=>({id:uuid(n*10+i),projectId:uuid(n),projectItemId:null,url:image,caption:{vi:`Ảnh ${i}`},isActive:true,order:i,createdAt:date})),_count:{galleryImages:2}}));
let media=[1,2,3].map((n)=>({id:uuid(100+n),publicId:`projects/anh-${n}`,url:image,bytes:10000,width:1200,height:800,format:'jpg',folder:'projects',isActive:true,createdAt:date,updatedAt:date}));
let news=[1,2].map((n)=>({id:uuid(200+n),slug:`tin-${n}`,title:{vi:`Tin ${n}`},content:[],status:'DRAFT',categoryId:null,category:null,image:null,gallery:[],author:'Thiên Đức',createdAt:date,updatedAt:date,publishedAt:null,eventDate:null,scheduledAt:null}));
let trash=[];
const mutations=[],unknown=[],errors=[];
async function main(){
 const dist=path.resolve('dist');
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;let file=path.resolve(dist,'.'+pathname);assert(file.startsWith(dist));try{const stat=await fs.stat(file);if(!stat.isFile())throw Error();}catch{file=path.join(dist,'admin/index.html');}const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2'})[ext]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=500;res.end('QA server error');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  const token=[Buffer.from('{"alg":"none"}').toString('base64url'),Buffer.from(JSON.stringify({sub:actor.id,email:actor.email,role:actor.role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'qa-only'].join('.');
  await context.addInitScript(token=>localStorage.setItem('td_admin_access_token',token),token);
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname.replace(/^\/api/,'');
   if(request.resourceType()==='image'){await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e7d8c5"/></svg>'});return;}
   let value;
   if(p==='/auth/me')value=actor;
   else if(p==='/settings/branding')value={};
   else if(p==='/projects/admin')value=projects;
   else if(p.startsWith('/projects/admin/'))value=projects.find(row=>p.endsWith(row.slug));
   else if(p==='/news/admin')value=news;
   else if(p.startsWith('/news/categories'))value=[];
   else if(p==='/media')value=media;
   else if(p==='/users')value=[actor,{...actor,id:uuid(80),name:'Biên tập viên',email:'editor@bulk.e2e.test',role:'EDITOR'}];
   else if(p==='/users/profile-requests')value=[];
   else if(/^\/cms-trash\/[^/]+\/bulk-delete$/.test(p)){
    const body=request.postDataJSON(),kind=p.split('/')[2];mutations.push({kind,...body});
    let source=kind==='media'?media:kind==='news'?news:kind==='projects'?projects:[];
    for(const id of body.ids){const row=source.find(item=>item.id===id);if(row&&body.mode==='trash')trash.push({id,title:row.title??row.publicId,deletedAt:date});}
    if(kind==='media')media=media.filter(row=>!body.ids.includes(row.id));
    if(kind==='news')news=news.filter(row=>!body.ids.includes(row.id));
    if(body.mode==='permanent')trash=trash.filter(row=>!body.ids.includes(row.id));
    value={succeededIds:body.ids,failed:[],remainingIds:[]};
   }else if(/^\/cms-trash\/[^/]+$/.test(p))value={items:trash,total:trash.length,page:1,pageSize:30};
   if(value!==undefined){await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:value})});return;}
   if(url.origin===origin){await route.continue();return;}
   unknown.push(p);await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:[]})});
  });
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
  for(const width of [1440,375]){
   await page.setViewportSize({width,height:1000});
   await page.goto(origin+'/admin/du-an');await page.getByRole('heading',{name:'Dự án',exact:true}).waitFor();
   await page.getByRole('checkbox',{name:'Chọn Dự án A',exact:true}).check();
   assert.equal(await page.getByRole('dialog').count(),0);
   await page.getByRole('button',{name:'Xóa 1 mục đã chọn',exact:true}).click();
   await page.getByRole('radio',{name:/Xóa vĩnh viễn/}).check();
   assert(await page.getByRole('button',{name:'Xóa vĩnh viễn',exact:true}).isDisabled());
   assert(await page.getByRole('checkbox',{name:/Tôi hiểu/}).isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`artifacts/cms-bulk-confirm-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Hủy',exact:true}).click();
   await page.locator('tbody').getByText('Dự án A',{exact:true}).click();
   await page.getByRole('button',{name:'Sửa thông tin',exact:true}).click();
   await page.getByRole('checkbox',{name:'Chọn Ảnh 6',exact:true}).check();
   await page.screenshot({path:`artifacts/cms-bulk-gallery-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Quản lý hạng mục',exact:true}).click();
   await page.getByRole('checkbox',{name:'Chọn Hạng mục 4',exact:true}).check();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`artifacts/cms-bulk-items-${width}.png`,fullPage:true});
   await page.goto(origin+'/admin/thu-vien');await page.getByRole('heading',{name:'Thư viện ảnh',exact:true}).waitFor();
   await page.getByRole('checkbox',{name:'Chọn tất cả đang hiển thị',exact:true}).check();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`artifacts/cms-bulk-media-${width}.png`,fullPage:true});
  }
  assert.equal(mutations.length,0);
  await page.getByRole('button',{name:'Xóa 3 mục đã chọn',exact:true}).click();
  await page.getByRole('button',{name:'Chuyển vào thùng rác',exact:true}).click();
  await page.getByText('Thư mục này chưa có ảnh',{exact:true}).waitFor();
  assert.equal(mutations[0].mode,'trash');assert.equal(mutations[0].ids.length,3);
  await page.goto(origin+'/admin/thung-rac');await page.getByRole('checkbox',{name:'Chọn tất cả đang hiển thị',exact:true}).check();
  await page.getByRole('button',{name:'Xóa 3 mục đã chọn',exact:true}).click();
  assert.equal(await page.getByRole('radio').count(),0);
  await page.getByRole('checkbox',{name:/Tôi hiểu/}).check();
  await page.getByRole('button',{name:'Xóa vĩnh viễn',exact:true}).click();
  await page.getByText('Không có nội dung trong thùng rác.',{exact:true}).waitFor();
  assert.equal(mutations[1].mode,'permanent');assert.equal(mutations[1].confirm,true);
  assert.deepEqual(errors,[]);console.log('PASS browser: chọn không mở nhầm, hủy không ghi API, PC/mobile bảng + hạng mục + thư viện, chọn nhiều vào thùng rác và purge có xác nhận.',{mutations:mutations.length,unknown});
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
