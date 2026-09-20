'use strict';
// Browser acceptance against the real local page/API. Uses installed Chrome/Edge
// and native CDP; never reads an existing browser profile or installs packages.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
async function contracts(){
  const vm=require('node:vm'),crypto=require('node:crypto').webcrypto;
  const source=fs.readFileSync(path.join(__dirname,'../assets/js/forms/service-feedback.js'),'utf8').replace(/\r\n/g,'\n');
  const match=source.match(/  function newCommandKey\(\) \{[\s\S]*?\n  \}\n  async function bounded/);assert.ok(match,'Real renderer key function exists');
  const keyCode=match[0].slice(0,match[0].lastIndexOf('  async function bounded'))+';newCommandKey()';
  const normal=vm.runInNewContext(keyCode,{crypto});assert.match(normal,/^[0-9a-f-]{36}$/);
  const seen=new Set();for(let n=0;n<64;n++){const key=vm.runInNewContext(keyCode,{crypto:{getRandomValues:crypto.getRandomValues.bind(crypto)}});assert.match(key,/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/);assert.ok(!seen.has(key));seen.add(key);}
  assert.throws(()=>vm.runInNewContext(keyCode,{}),/SECURE_RANDOM_UNAVAILABLE/);
  assert.throws(()=>vm.runInNewContext(keyCode,{crypto:{}}),/SECURE_RANDOM_UNAVAILABLE/);
  const timeout=source.match(/  async function bounded\(promise\) \{[\s\S]*?\n  \}\n  function lockSubmission/);assert.ok(timeout);
  const code=timeout[0].slice(0,timeout[0].lastIndexOf('  function lockSubmission'));
  const active=new Set();const timers={setTimeout:fn=>{const t=setTimeout(fn,5);active.add(t);return t;},clearTimeout:t=>{clearTimeout(t);active.delete(t);}};
  assert.equal(await vm.runInNewContext(code+';bounded(Promise.resolve(42))',timers),42);assert.equal(active.size,0);
  await assert.rejects(vm.runInNewContext(code+';bounded(new Promise(()=>{}))',timers),/LOAD_TIMEOUT/);assert.equal(active.size,0);
  const keys=['clearRating','optionalRatingHint','receivedTitle','received','alreadyTitle','already','unavailableTitle','unavailable','retryTitle','loadError','contactRecorded','retrySubmission','uncertainSubmission'];
  for(const locale of ['es','en','de','fr','it','pt','ru','ko','zh-hans']){const ui=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/i18n',locale,'service-feedback.json'),'utf8')).feedback;for(const key of keys)assert.ok(typeof ui[key]==='string'&&ui[key].trim(),locale+': '+key);assert.notEqual(ui.already,ui.contactRecorded);}
  console.log('PASS: native and secure LAN keys; unavailable entropy rejects; bounded load and timer cleanup; nine locale state contracts.');
}
async function main(){
  if(process.argv.includes('--contracts'))return contracts();
  const privatePath=process.env.PIXKUY_FEEDBACK_BROWSER_FIXTURE;
  assert.ok(privatePath&&path.resolve(privatePath).startsWith(path.resolve(os.tmpdir())+path.sep),'QA fixture must be outside repositories');
  const fixture=JSON.parse(fs.readFileSync(privatePath,'utf8'));const url=new URL(fixture.url);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='8888'&&url.pathname==='/service-feedback.html','Only normal local Landing permitted');
  const output=path.resolve(process.env.PIXKUY_FEEDBACK_BROWSER_EVIDENCE||path.join(os.tmpdir(),'pixkuy-feedback-browser-evidence'));
  fs.mkdirSync(output,{recursive:true});
  assert.ok(!fs.existsSync(path.join(output,'browser-result.json')),'Existing evidence must be preserved');
  const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));assert.ok(chrome,'Installed browser unavailable');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pixkuy-feedback-browser-'));
  const child=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let socket;
  try{
    const portFile=path.join(profile,'DevToolsActivePort');for(let n=0;n<100&&!fs.existsSync(portFile);n++)await new Promise(r=>setTimeout(r,100));
    assert.ok(fs.existsSync(portFile),'Browser CDP startup failed');const port=Number(fs.readFileSync(portFile,'utf8').split('\n')[0]);
    const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
    let sequence=0;const pending=new Map();let externalRequests=0;
    // Exact local runner origins only; no arbitrary LAN range or external host.
    const allowedOrigins=new Set(['http://localhost:8888','http://127.0.0.1:8888','http://localhost:3002','http://127.0.0.1:3002','http://192.168.0.14:3002']);
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('CDP_TIMEOUT_'+method))},20000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}))});
    socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);if(p){clearTimeout(p.timeout);pending.delete(msg.id);if(msg.error)p.reject(new Error('CDP_COMMAND_FAILED'));else p.resolve(msg.result)}}else if(msg.method==='Fetch.requestPaused'){const target=new URL(msg.params.request.url);if(allowedOrigins.has(target.origin)||['data:','about:','blob:'].includes(target.protocol))void send('Fetch.continueRequest',{requestId:msg.params.requestId});else{externalRequests++;void send('Fetch.failRequest',{requestId:msg.params.requestId,errorReason:'BlockedByClient'})}}});
    await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,'Browser evaluation failed');return result.result.value};
    const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw new Error('PAGE_STATE_TIMEOUT')};
    await send('Page.navigate',{url:url.href});await wait('!!document.querySelector("#survey-content form")');
    assert.equal(await evaluate('location.hash'),'', 'Bearer fragment should be removed from address bar');
    await evaluate(`document.querySelector('.survey-rating input').click();document.querySelector('details').open=true;const text=document.querySelector('textarea');text.value='QA 👩‍👩‍👧‍👦 漢字';text.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#survey-contact').click();true`);
    assert.equal(await evaluate('document.querySelectorAll(".survey-stars").length'),6,'Commercial compatible scales use stars');
    const optionalCheck=await evaluate(`(()=>{const field=[...document.querySelectorAll('fieldset')].find(f=>f.querySelector('.survey-clear'));const values=field.querySelectorAll('.survey-stars input');values[1].click();const selected=field.querySelectorAll('[data-filled=true]').length;values[4].click();const changed=field.querySelectorAll('[data-filled=true]').length;field.querySelector('.survey-clear').click();const omitted=field.querySelectorAll('input:checked').length===0;field.querySelector('input[value=cannot_rate]').click();const cannot=field.querySelector('input:checked').value;const noFilled=field.querySelectorAll('[data-filled=true]').length===0;field.querySelector('.survey-clear').click();return {selected,changed,omitted,cannot,noFilled}})()`);
    assert.deepEqual(optionalCheck,{selected:2,changed:5,omitted:true,cannot:'cannot_rate',noFilled:true});
    assert.equal(await evaluate(`(()=>{const field=[...document.querySelectorAll('fieldset')].find(f=>f.querySelector('.survey-clear'));field.querySelector('.survey-stars input[value="4"]').click();field.querySelector('.survey-clear').click();return document.activeElement===field.querySelector('.survey-stars input')&&!field.querySelector('input:checked')})()`),true,'Clearing optional answer retains focus on an unchecked radio');
    const saved=await evaluate('({checked:Array.from(document.querySelectorAll("input:checked")).map(n=>n.id).sort(),text:document.querySelector("textarea").value})');
    const languages=await evaluate("Array.from(document.querySelectorAll('.lang-menu [data-lang]')).filter(b=>!b.closest('li').hidden).map(b=>b.dataset.lang)");assert.equal(languages.length,9);
    const evidence=[];
    for(const width of [320,360,390,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
      for(const locale of languages){
        await evaluate(`document.querySelector('#lang-trigger').click();document.querySelector('.lang-menu [data-lang='+${JSON.stringify(locale)}+']').click();true`);
        await wait('document.documentElement.lang==='+JSON.stringify(locale)+'&&!document.querySelector("button[type=submit]").disabled');
        assert.equal(await evaluate("[...document.querySelectorAll('[data-legal-page-shell] [data-i18n]')].every(n=>!!n.textContent.trim())"),true,'Every shared header/menu label is translated: '+locale);
        const current=await evaluate('({checked:Array.from(document.querySelectorAll("input:checked")).map(n=>n.id).sort(),text:document.querySelector("textarea").value,overflow:document.documentElement.scrollWidth>innerWidth})');
        assert.deepEqual(current.checked,saved.checked);assert.equal(current.text,saved.text);assert.equal(current.overflow,false,'Horizontal overflow: '+locale+' '+width);
        const touch=await evaluate(`(()=>{const boxes=[...document.querySelectorAll('.survey-stars input')].map(n=>n.getBoundingClientRect());const rows=[...document.querySelectorAll('.survey-stars')];return {count:boxes.length,sized:boxes.every(b=>b.width>=44&&b.width<=48&&b.height>=44&&b.height<=48),oneRow:rows.every(row=>{const b=[...row.querySelectorAll('input')].map(n=>n.getBoundingClientRect());return b.every((v,i)=>v.top===b[0].top&&(!i||v.left>=b[i-1].right))})}})()`);
        assert.ok(touch.count>0&&touch.sized&&touch.oneRow,'Effective touch targets and nonoverlapping star row');
        const compact=await evaluate(`(()=>{const options=[...document.querySelectorAll('.survey-choice')].filter(n=>n.getClientRects().length),captions=[...document.querySelectorAll('.survey-question legend')];return {touch:options.every(n=>{const b=n.getBoundingClientRect(),i=n.querySelector('input').getBoundingClientRect();return b.height>=44&&Math.abs(b.width-i.width)<=2&&Math.abs(b.height-i.height)<=2}),labels:options.every(n=>{const b=n.getBoundingClientRect(),s=n.querySelector('span').getBoundingClientRect();return s.left>=b.left&&s.right<=b.right&&s.top>=b.top&&s.bottom<=b.bottom}),hiddenEmptyStatus:[...document.querySelectorAll('.survey-stars')].filter(n=>!n.querySelector('input:checked')).every(n=>n.nextElementSibling.classList.contains('survey-sr-only')),singleCommentCaption:captions.filter(n=>n.closest('details')).every(n=>n.classList.contains('survey-sr-only')),choiceRows:[...document.querySelectorAll('fieldset[data-type="single_choice"] .survey-choices')].map(n=>new Set([...n.children].map(c=>c.getBoundingClientRect().top)).size)}})()`);
        const optionalPresentation=await evaluate(`(()=>{const mobile=matchMedia('(max-width:759px)').matches;return [...document.querySelectorAll('fieldset[data-type=rating] .survey-cannot')].every(n=>{const optional=n.closest('fieldset').dataset.required==='false',selected=!!n.querySelector('input:checked');return !!n.getClientRects().length===(!mobile||!optional||selected)})})()`);
        assert.ok(optionalPresentation,'Only unselected optional cannot-rate alternatives are hidden on mobile; selected states and required alternatives remain accessible');
        const commentPresentation=await evaluate("(()=>{const t=document.querySelector('textarea');return !matchMedia('(max-width:759px)').matches||(!t.closest('details')&&t.getClientRects().length>0)})()");
        assert.ok(commentPresentation,'Mobile comments remain visible without changing their configured desktop disclosure');
        assert.ok(compact.touch&&compact.labels&&compact.hiddenEmptyStatus&&compact.singleCommentCaption,'Compact controls preserve full targets, labels and accessible hidden state');
        const scaleLayout=await evaluate(`(()=>{const labels=[...document.querySelectorAll('.survey-rating label')];let brokenWords=0,clippedLabels=0;for(const label of labels){const span=label.querySelector('span'),node=span?.firstChild;if(!node)continue;const box=span.getBoundingClientRect(),outer=label.getBoundingClientRect();if(box.left<outer.left-1||box.right>outer.right+1)clippedLabels++;if(!/^(zh|ko)/.test(document.documentElement.lang)){for(const word of new Intl.Segmenter(document.documentElement.lang,{granularity:'word'}).segment(node.textContent)){if(!word.isWordLike)continue;const range=document.createRange();range.setStart(node,word.index);range.setEnd(node,word.index+word.segment.length);if(range.getClientRects().length>1)brokenWords++;}}}return {count:labels.length,brokenWords,clippedLabels}})()`);
        assert.ok(scaleLayout.count>0&&scaleLayout.brokenWords===0&&scaleLayout.clippedLabels===0,'Complete scale words and labels: '+locale+' '+width);
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const file=`survey-${locale}-${width}.png`;fs.writeFileSync(path.join(output,file),Buffer.from(shot.data,'base64'));evidence.push({locale,width,statePreserved:true,horizontalOverflow:false,starTargets:touch,compactControls:compact,screenshot:file});
      }
    }
    assert.equal(externalRequests,0,'Page attempted external resources');
    fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({status:'PASS',languages,views:evidence,externalRequests,credentialsExcluded:true,syntheticAnswersVisible:true},null,2));
    console.log('PASS public browser: 9 languages × mobile/desktop, input preservation, no horizontal overflow or external resources.');
  }finally{socket?.close();child.kill();}
}
main().catch(()=>{console.error('Feedback browser acceptance failed; no fixture URL or token is printed.');process.exitCode=1});
