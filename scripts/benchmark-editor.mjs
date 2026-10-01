/* global window, document, CanvasRenderingContext2D, innerWidth, innerHeight, HTMLElement */
/* eslint no-unused-vars: ["error", {"ignoreRestSiblings": true}] */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = {}
const allowedArgs = new Set(['url', 'mode', 'label', 'widths', 'trials', 'generate', 'fixtures', 'repo', 'revision', 'out', 'executable'])
for (const item of process.argv.slice(2)) {
  const index = item.indexOf('=')
  const key = item.slice(0, index).replace(/^--/, '')
  if (index < 1 || !allowedArgs.has(key)) throw new Error(`Unknown argument ${item}; use key=value. See docs/film-first-performance.md.`)
  args[key] = item.slice(index + 1)
}
const require = createRequire(path.join(projectRoot, 'package.json'))
const { chromium } = require('@playwright/test')
const sharp = require('sharp')
const dir = path.resolve(args.out || path.join(os.tmpdir(), 'photochrome-benchmark'))
const baseURL = args.url || 'http://127.0.0.1:5173'
if (!['http:', 'https:'].includes(new URL(baseURL).protocol)) throw new Error('url must use HTTP or HTTPS')
const mode = args.mode || 'integrated'
const label = args.label || mode
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Label accepts letters, digits, underscores and hyphens')
const widths = (args.widths || '1200,393').split(',').map(Number)
const trials = Number(args.trials || 6)
if (!widths.length || widths.some(width => !Number.isInteger(width) || width < 320) || !Number.isInteger(trials) || trials < 1 || trials > 100) throw new Error('Use valid viewport widths and 1–100 trials')
if (!['integrated', 'baseline'].includes(mode)) throw new Error('mode must be integrated or baseline')
if (args.fixtures && !['asymmetric', 'real'].includes(args.fixtures)) throw new Error('fixtures must be real or asymmetric')
await fs.mkdir(path.join(dir,'fixtures'),{recursive:true})
const fixtures=[]
for(let i=0;i<4;i++) {
  const file=path.join(dir,'fixtures',`asymmetric-12mp-${i+1}.jpg`)
  try { await fs.access(file) } catch {
    const svg=`<svg width="4000" height="3000" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="${['#194c6b','#673719','#216039','#5f2464'][i]}"/><stop offset="1" stop-color="#e6b889"/></linearGradient><pattern id="p" width="90" height="70" patternUnits="userSpaceOnUse"><path d="M0 0L90 70M45 0L90 35" stroke="#ffffff" opacity=".18" stroke-width="5"/></pattern></defs><rect width="4000" height="3000" fill="url(#g)"/><rect width="4000" height="3000" fill="url(#p)"/><rect x="110" y="180" width="1100" height="800" fill="#c62632"/><circle cx="3150" cy="2050" r="610" fill="#2b6bae"/><path d="M1800 700L2650 300L2500 1250Z" fill="#ead144"/><text x="170" y="2850" font-family="sans-serif" font-size="280" fill="white">12MP ${i+1} LEFT</text></svg>`
    await sharp(Buffer.from(svg)).jpeg({quality:92}).toFile(file)
  }
  const st=await fs.stat(file); fixtures.push({path:file,width:4000,height:3000,bytes:st.size})
}
const photoSources=['alexander-awerin-3yqVPhHHsdI-unsplash.webp','alexander-awerin-AQI2wTv1SWo-unsplash.webp','alexander-awerin-yafEjegDFl4-unsplash.webp']
const photoFixtures=[]
for(let i=0;i<4;i++){
  const source=path.join(projectRoot,'img',photoSources[i%3])
  const file=path.join(dir,'fixtures',`real-photo-12mp-${i+1}.jpg`)
  const sourceMeta=await sharp(source).metadata()
  try{await fs.access(file)}catch{
    let pipeline=sharp(source)
    if(i===3)pipeline=pipeline.extract({left:Math.floor(sourceMeta.width*.2),top:0,width:Math.floor(sourceMeta.width*.8),height:Math.floor(sourceMeta.height*.8)})
    await pipeline.resize(4000,3000,{fit:'cover',position:i===3?'southeast':'centre'}).jpeg({quality:92}).toFile(file)
  }
  photoFixtures.push({path:file,width:4000,height:3000,bytes:(await fs.stat(file)).size,source,sourceWidth:sourceMeta.width,sourceHeight:sourceMeta.height,kind:'resampled repository photo; not native 12MP camera capture',alternateCrop:i===3})
}
const diagnosticFixtures=[...fixtures]
fixtures.splice(0,fixtures.length,...(args.fixtures==='asymmetric'?diagnosticFixtures:photoFixtures))
if(args.generate === 'true') { console.log(JSON.stringify(fixtures,null,2)); process.exit(0) }
const sourceRepo=path.resolve(args.repo||projectRoot)
const sourceEvidence={repo:sourceRepo,revision:args.revision||null}
try{sourceEvidence.gitHead=execFileSync('git',['-C',sourceRepo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();sourceEvidence.gitDirty=!!execFileSync('git',['-C',sourceRepo,'status','--porcelain'],{encoding:'utf8'}).trim()}catch(e){sourceEvidence.gitUnavailable=e.message}
const hash=createHash('sha256')
async function hashTree(relative){for(const entry of(await fs.readdir(path.join(sourceRepo,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(relative,entry.name);if(entry.isDirectory())await hashTree(file);else{hash.update(file);hash.update(await fs.readFile(path.join(sourceRepo,file)))}}}
await hashTree('src')
for(const file of ['index.html','package.json','package-lock.json','vite.config.ts'])hash.update(await fs.readFile(path.join(sourceRepo,file)))
sourceEvidence.sourceTreeSHA256=hash.digest('hex')
sourceEvidence.lockfileSHA256=createHash('sha256').update(await fs.readFile(path.join(sourceRepo,'package-lock.json'))).digest('hex')
for(const fixture of fixtures)fixture.sha256=createHash('sha256').update(await fs.readFile(fixture.path)).digest('hex')
const token=`photochrome-benchmark-${process.pid}`
const browser=await chromium.launch({executablePath:args.executable||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox',`--pc-benchmark-token=${token}`]})
let hostLoad
try { hostLoad=execFileSync('cat',['/proc/loadavg'],{encoding:'utf8'}).trim() } catch { hostLoad=os.loadavg() }
const evidence={mode,label,sourceEvidence,methodologyVersion:'film-first12mp-v1',measurementScriptSHA256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),browserVersion:browser.version(),hostLoad,baseURL,date:new Date().toISOString(),fixtures,diagnosticFixtures,trials,widths,runs:[],notes:[
  'Desktop Linux headless Chromium measurements; not physical-device evidence.',
  'Latency is action start to final Preview canvas putImageData followed by 250ms quiet; timeout is reported as failure, not settlement.',
  'CDP backingStorageSize is renderer-observed backing storage, not total browser/GPU/process memory; native RSS summed across Chromium process tree is resident pages and may double-count shared pages.',
  'Computed RGBA ownership counts deduplicate unchanged original/transformed buffer aliases; they are structural estimates, not measured allocation peaks.',
  'Default fixture workload is actual repository Unsplash photo content resampled to12MP, including an alternate crop; it is not native camera12MP. Separate asymmetric diagnostic JPEGs remain available via fixtures=asymmetric.',
  'ImageData constructor and Canvas getImageData weakly track observed main-thread ArrayBuffers and shapes; worker-internal allocations and native image/GPU buffers are outside this attribution. WeakRef dereferencing can modestly affect GC liveness, so use identical instrumentation in both comparison runs.',
  'Record concurrent test load externally; compare baseline and integrated runs using same dependencies, fixtures, viewport, trial count and idle host.'
]}
const median=x=>{if(!x.length)return null;const sorted=[...x].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2}
function rss() {
  try {
  const rows=execFileSync('ps',['-eo','pid=,ppid=,rss=,args='],{encoding:'utf8'}).trim().split('\n').map(l=>{const m=l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],ppid:+m[2],rss:+m[3],cmd:m[4]}:null}).filter(Boolean)
  const pids=new Set(rows.filter(r=>r.cmd.includes(`--pc-benchmark-token=${token}`)&&!r.cmd.includes('ps -eo')).map(r=>r.pid))
  for(let n=0;n<10;n++) for(const r of rows) if(pids.has(r.ppid))pids.add(r.pid)
  return {rssBytes:rows.filter(r=>pids.has(r.pid)).reduce((s,r)=>s+r.rss*1024,0),processes:pids.size}
  } catch(error) { return { rssBytes:null, processes:null, rssUnavailable:error.message } }
}
try {
for(const width of widths) {
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true})
  await context.addInitScript(()=>{
    window.__pcMeasure={paints:[],longTasks:[],canvasWrites:[],bufferEvents:[],liveBuffers:[]}
    const tracked=new WeakSet()
    const track=(data,origin)=>{if(tracked.has(data.data.buffer))return;tracked.add(data.data.buffer);window.__pcMeasure.bufferEvents.push({time:performance.now(),origin,width:data.width,height:data.height,bytes:data.data.byteLength});window.__pcMeasure.liveBuffers.push({ref:new WeakRef(data.data.buffer),bytes:data.data.byteLength,width:data.width,height:data.height,origin})}
    const OriginalImageData=window.ImageData
    window.ImageData=new Proxy(OriginalImageData,{construct(target,args,newTarget){const value=Reflect.construct(target,args,newTarget);track(value,'ImageData constructor');return value}})
    const getImageData=CanvasRenderingContext2D.prototype.getImageData
    CanvasRenderingContext2D.prototype.getImageData=function(...a){const value=getImageData.apply(this,a);track(value,'Canvas getImageData');return value}

    const original=CanvasRenderingContext2D.prototype.putImageData
    CanvasRenderingContext2D.prototype.putImageData=function(...a){const result=original.apply(this,a);const time=performance.now(),rect=this.canvas.getBoundingClientRect();const panel=this.canvas.closest('[role="tabpanel"]'),clip=panel?.getBoundingClientRect();const visible=rect.width>0&&rect.height>0&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight&&(!clip||(rect.bottom>clip.top&&rect.top<clip.bottom&&rect.right>clip.left&&rect.left<clip.right));window.__pcMeasure.canvasWrites.push({time,width:this.canvas.width,height:this.canvas.height,recipeCard:!!this.canvas.closest('[data-recipe-card]'),visible});if(this.canvas.getAttribute('aria-label')==='Preview')window.__pcMeasure.paints.push({time,width:this.canvas.width,height:this.canvas.height});return result}
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.__pcMeasure.longTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true})
  })
  const page=await context.newPage();const cdp=await context.newCDPSession(page)
  const run={width,memory:[],actions:[],gates:[],computedRGBA:{model:'baseline18d eager originals; re-evaluate against final implementation, not measured allocation',original4x12MP:192000000,preview4x1600x1200:30720000,unchangedRetainedUniqueBytes:222720000,afterOneQuarterTurnAdditionalOriginalAndPreviewBytes:55680000}}
  evidence.runs.push(run)
  let phase='demo',stopped=false
  const sample=async()=>{try{const heap=await cdp.send('Runtime.getHeapUsage');const buffers=await page.evaluate(()=>{const rows=window.__pcMeasure?.liveBuffers?.filter(x=>(x.ref.deref()?.byteLength||0)>0)||[];return {observedLiveRGBABackingBytes:rows.reduce((n,x)=>n+x.bytes,0),observedLiveBuffers:rows.map(({ref,...x})=>x),canvases:Array.from(document.querySelectorAll('canvas')).map(c=>({width:c.width,height:c.height,ariaLabel:c.getAttribute('aria-label'),recipeCard:!!c.closest('[data-recipe-card]')}))}});run.memory.push({time:Date.now(),phase,...heap,...buffers,...rss()})}catch(e){run.gates.push(`memory sample: ${e.message}`)}}
  const sampler=(async()=>{while(!stopped){await sample();await new Promise(r=>setTimeout(r,150))}})()
  async function action(name,fn,needsPaint=true){
    phase=name;const start=await page.evaluate(()=>performance.now());let error=null
    try{await fn();if(needsPaint)await page.waitForFunction(s=>{const p=window.__pcMeasure.paints;return p.some(v=>v.time>=s)&&performance.now()-p[p.length-1].time>250},start,{timeout:30000});else await page.waitForTimeout(300)}catch(e){error=e.message}
    const end=await page.evaluate(()=>{const {liveBuffers,...values}=window.__pcMeasure;return {now:performance.now(),...values}});const paints=end.paints.filter(p=>p.time>=start);const tasks=end.longTasks.filter(t=>t.start>=start&&t.start<=end.now)
    const writes=end.canvasWrites.filter(x=>x.time>=start&&x.time<=end.now);run.actions.push({name,start,end:end.now,elapsedMs:end.now-start,latencyMs:error||!needsPaint?null:paints.at(-1).time-start,longTaskTotalMs:tasks.reduce((s,t)=>s+t.duration,0),longTasks:tasks,paints,recipePreviewWrites:writes.filter(x=>x.recipeCard).length,visibleRecipePreviewWrites:writes.filter(x=>x.recipeCard&&x.visible).length,bufferEvents:end.bufferEvents.filter(x=>x.time>=start&&x.time<=end.now),error})
    await sample()
  }
  try {
  await page.goto(baseURL);await page.locator('canvas[aria-label="Preview"]').waitFor({state:'visible',timeout:30000});await page.waitForTimeout(600)
  await action('load-four-12mp',()=>page.getByLabel('Choose photos or video to edit',{exact:true}).setInputFiles(fixtures.map(f=>f.path)))
  const visible=selector=>page.locator(selector).filter({visible:true})
  async function selectLook(index){
    if(mode==='baseline'){
      const film=index%2?'Astia':'Provia',name=index%2?'Astia Soft Daylight':'Provia Daylight'
      await page.locator(`[aria-label="${film} presets"]`).filter({visible:true}).getByRole('button',{name:new RegExp(`^Apply preset ${name}(?:, selected)?$`)}).click()
    }else await page.getByRole('button',{name:index%2?'Select film Velvia':'Select film Provia',exact:true}).filter({visible:true}).click()
  }
  for(let i=0;i<trials;i++)await action(`look-change-${i}`,()=>selectLook(i))
  async function openAdvanced(){
    if(mode==='baseline'){
      const buttons=visible('button[aria-label="Open Adjust inspector"]');if(await buttons.count())await buttons.click();else {
        const adjust=page.getByRole('button',{name:'Adjust',exact:true}).filter({visible:true});await adjust.click()
        const highlight=page.getByRole('button',{name:'Adjust Highlight',exact:true}).filter({visible:true});if(await highlight.count())await highlight.click()
      }
    }else await page.getByRole('button',{name:/^(Open Advanced settings|Advanced settings|Advanced)$/}).filter({visible:true}).click()
  }
  await action('open-advanced',openAdvanced,false)
  const panel=page.getByRole('region',{name:'Advanced settings',exact:true})
  if(mode!=='baseline') {
    await action('advanced-recipes-browse',async()=>{
      await panel.getByRole('tab',{name:'Recipes',exact:true}).click()
      const cards=panel.locator('[data-recipe-card]')
      run.catalog={totalCards:await cards.count(),viewportVisibleCards:await cards.evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();const clip=n.closest('[role="tabpanel"]')?.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&(!clip||(r.bottom>clip.top&&r.top<clip.bottom&&r.right>clip.left&&r.left<clip.right))}).length)}
      const scroller=panel.getByRole('tabpanel')
      for(let i=0;i<4;i++){await scroller.evaluate((node,direction)=>node.scrollTop=direction?node.scrollHeight:0,i%2);await page.waitForTimeout(350)}
    },false)
  }
  const manual=page.getByRole('tab',{name:'Manual',exact:true}).filter({visible:true});if(await manual.count())await action('open-manual-tab',()=>manual.click(),false)
  const sliders=visible('[role="slider"][aria-label="Highlight"],#slider-highlight [role="slider"]')
  if(await sliders.count()){
    for(let i=0;i<trials;i++)await action(`manual-highlight-${i}`,async()=>{await sliders.focus();await page.keyboard.press(i%2?'ArrowLeft':'ArrowRight')})
    for(let i=0;i<trials;i++)await action(`manual-burst-${i}`,async()=>{await sliders.focus();for(let n=0;n<8;n++)await page.keyboard.press(i%2?(n<6?'ArrowLeft':'ArrowRight'):(n<6?'ArrowRight':'ArrowLeft'))})
  } else run.gates.push('Manual slider unavailable through configured selectors; adjustment workload not measured.')
  const cancel=page.getByRole('button',{name:'Cancel',exact:true}).filter({visible:true});if(await cancel.count())await action('cancel-color-draft',()=>cancel.click())
  await action('rotate-approved-12mp',async()=>{await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur()});await page.keyboard.press('r')})
  const openCrop=async()=>{
    if(width<768)await page.getByRole('navigation',{name:'Editor modes',exact:true}).getByRole('button',{name:'Crop',exact:true}).click()
    const crop=page.getByRole('button',{name:/^(Open Crop inspector|Open crop session)$/}).filter({visible:true});await crop.click()
  }
  await action('open-crop',openCrop,false)
  await action('fine-angle-draft-12mp',async()=>{const angle=page.getByRole('slider',{name:'Crop angle',exact:true}).filter({visible:true});await angle.focus();await page.keyboard.press('ArrowRight')})
  // Mobile crop exposes Done in the fixed action zone as well as an Apply in the expanded panel.
  const commit=width<768?page.getByRole('button',{name:'Done',exact:true}).filter({visible:true}):page.getByRole('button',{name:'Apply',exact:true}).filter({visible:true})
  if(await commit.count())await action('apply-geometry',()=>commit.click(),false)
  if(width<768)await page.getByRole('navigation',{name:'Editor modes',exact:true}).getByRole('button',{name:'Films',exact:true}).click()
  const ready=async()=>{
    await page.getByLabel('Applied color',{exact:true}).filter({visible:true}).waitFor({state:'visible'})
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Applied color"]')?.textContent?.match(/Preparing:|Unavailable:/))
  }
  const dismissCompletion=async()=>{const back=page.getByRole('button',{name:'Back to editor',exact:true});await back.waitFor({state:'visible',timeout:30000});await back.click()}
  await ready()
  await action('export-single-12mp',async()=>{
    await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur()})
    const pending=page.waitForEvent('download',{timeout:180000});await page.keyboard.press('Control+s');const download=await pending
    const file=path.join(dir,`${label}-${width}-single.jpg`);await download.saveAs(file)
    const metadata=await sharp(file).metadata();run.export={path:file,bytes:(await fs.stat(file)).size,width:metadata.width,height:metadata.height,format:metadata.format}
    if(metadata.width!==3000||metadata.height!==4000)throw new Error('Single export lost full-resolution12MP quarter-turn dimensions')
  },false)
  await dismissCompletion();await ready()
  await action('apply-color-all',async()=>{await page.getByRole('button',{name:'Apply current color to all 4 images',exact:true}).filter({visible:true}).click();await page.getByRole('status',{name:'Applying preset to all images',exact:true}).waitFor({state:'hidden',timeout:30000})},false)
  await action('export-four-12mp-batch',async()=>{
    const pending=page.waitForEvent('download',{timeout:240000});await page.getByRole('button',{name:'Export all photos',exact:true}).filter({visible:true}).click();const download=await pending
    const file=path.join(dir,`${label}-${width}-batch.zip`);await download.saveAs(file);run.batchExport={path:file,bytes:(await fs.stat(file)).size}
    const {unzipSync}=require('fflate');const entries=unzipSync(await fs.readFile(file));run.batchExport.members=[]
    for(const [name,bytes]of Object.entries(entries))if(name.endsWith('.jpg')){const meta=await sharp(bytes).metadata();run.batchExport.members.push({name,width:meta.width,height:meta.height,bytes:bytes.length})}
    if(run.batchExport.members.length!==4)throw new Error('Batch does not contain all four JPEGs')
  },false)
  await dismissCompletion()
  phase='post-export';await page.waitForTimeout(500);await sample()
  run.gates.push('Failure/cancellation/append atomicity and exact-request Retry require existing E2E lifecycle evidence; this measurement run does not claim those gates passed.')
  phase='disposed';await page.goto('about:blank');await cdp.send('HeapProfiler.collectGarbage');await page.waitForTimeout(500);await sample()
  } catch(error) { run.gates.push(`Workload aborted: ${error.message}`) } finally {
  stopped=true;await sampler
  const phases=[...new Set(run.memory.map(m=>m.phase))];run.phasePeaks=Object.fromEntries(phases.map(p=>{const rows=run.memory.filter(m=>m.phase===p);return [p,{peakBackingStorageBytes:Math.max(...rows.map(m=>m.backingStorageSize||0)),peakRSSBytes:Math.max(...rows.map(m=>m.rssBytes||0)),peakObservedLiveRGBABackingBytes:Math.max(...rows.map(m=>m.observedLiveRGBABackingBytes||0)),sampleCount:rows.length}]}))
  run.summary={backingStorageSupported:run.memory.some(m=>typeof m.backingStorageSize==='number'),lookMedianMs:median(run.actions.filter(a=>a.name.startsWith('look-change')).map(a=>a.latencyMs).filter(v=>v!==null)),manualBurstMedianMs:median(run.actions.filter(a=>a.name.startsWith('manual-burst')).map(a=>a.latencyMs).filter(v=>v!==null)),manualMedianMs:median(run.actions.filter(a=>a.name.startsWith('manual-highlight')).map(a=>a.latencyMs).filter(v=>v!==null)),peakBackingStorageBytes:Math.max(...run.memory.map(m=>m.backingStorageSize||0)),peakJSUsedBytes:Math.max(...run.memory.map(m=>m.usedSize||0)),peakBrowserRSSBytes:Math.max(...run.memory.map(m=>m.rssBytes||0)),failedActions:run.actions.filter(a=>a.error).map(a=>a.name)}
  await context.close()
  await fs.writeFile(path.join(dir,`${label}.json`),JSON.stringify(evidence,null,2))
  }
}
}finally{await browser.close();await fs.writeFile(path.join(dir,`${label}.json`),JSON.stringify(evidence,null,2))}
console.log(JSON.stringify(evidence.runs.map(r=>({width:r.width,...r.summary,gates:r.gates})),null,2))

if (evidence.runs.some(run => run.summary.failedActions.length || run.gates.some(gate => gate.startsWith('Workload aborted:')))) process.exitCode = 1
