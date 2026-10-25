import {chromium,expect} from '/workspace/PhotoChrome/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:440,height:950}});
await page.goto('http://127.0.0.1:4180/');
const movie=await fs.readFile('/workspace/artifacts/photochrome-guideline-refinement/PhotoChrome-mobile-guidelines.mp4');
await page.route('**/PhotoChrome-mobile-guidelines.mp4', async route => {
 const range=route.request().headers()['range'];
 if(range){const [startText,endText]=range.replace('bytes=','').split('-');const start=Number(startText)||0;const end=Math.min(endText?Number(endText):movie.length-1,movie.length-1);await route.fulfill({status:206,headers:{'content-type':'video/mp4','accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${movie.length}`},body:movie.subarray(start,end+1)});}
 else await route.fulfill({status:200,headers:{'content-type':'video/mp4','accept-ranges':'bytes'},body:movie});
});
await page.setContent('<style>body{margin:0;background:#101113}video{display:block;width:393px;height:892px;object-fit:contain}</style><video muted playsinline preload="auto" src="http://127.0.0.1:4180/PhotoChrome-mobile-guidelines.mp4"></video>');
const v=page.locator('video');
await expect.poll(()=>v.evaluate(e=>e.readyState)).toBeGreaterThanOrEqual(2);
const result=await v.evaluate(async e=>{await e.play();await new Promise(r=>setTimeout(r,1800));const progress=e.currentTime;e.pause();return{duration:e.duration,width:e.videoWidth,height:e.videoHeight,progress,error:e.error?.message??null};});
expect(result.progress).toBeGreaterThan(1);expect(result.height).toBeGreaterThan(result.width);expect(result.duration).toBeGreaterThan(45);expect(result.duration).toBeLessThan(90);expect(result.error).toBe(null);
const samples=[];
for(const at of [5,15,25,35,Math.floor(result.duration)-2]){
 await v.evaluate((e,t)=>new Promise(resolve=>{e.addEventListener('seeked',resolve,{once:true});e.currentTime=t;}),at);
 await v.evaluate(e=>e.play());await page.waitForTimeout(500);await v.evaluate(e=>e.pause());await expect.poll(()=>v.evaluate(e=>e.currentTime)).toBeGreaterThanOrEqual(at);
 const digest=await v.evaluate(async e=>{const c=document.createElement('canvas');c.width=e.videoWidth;c.height=e.videoHeight;const ctx=c.getContext('2d');ctx.drawImage(e,0,0);const bytes=ctx.getImageData(0,0,c.width,c.height).data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');});
 samples.push({at,digest});await v.screenshot({path:`/workspace/artifacts/photochrome-guideline-refinement/playback-${at}.png`});
}
expect(new Set(samples.map(s=>s.digest)).size).toBe(5);
await fs.writeFile('/workspace/artifacts/photochrome-guideline-refinement/playback-verification.json',JSON.stringify({passed:true,...result,samples},null,2));console.log(result);await browser.close();
