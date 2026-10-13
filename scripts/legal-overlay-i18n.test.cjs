'use strict';
// Offline content/lifecycle regression, not a rendering test. Reuse the small
// DOM fixture from the Airport boundary test; execute legal.js and i18n itself.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'airport-netlify-independence.test.cjs'), 'utf8');
const definitions = fixture.slice(fixture.indexOf('class Events {'), fixture.indexOf('function storage('));
assert(definitions.startsWith('class Events {') && definitions.includes('class Element'));
const legalSource = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'assets/js/legal.js');

async function environment(earlyLanguage) {
  const box = {assert, console, URL, URLSearchParams}; vm.createContext(box);
  vm.runInContext(definitions + '\nglobalThis.fixtureTypes={Events,Element,Event};', box);
  const {Events, Element, Event} = box.fixtureTypes;
  // Parse the real overlay template into the minimal DOM. No style engine,
  // geometry or emulation of the product's translation/visibility logic.
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    get(){return this._html || '';},
    set(html){
      this.replaceChildren();this._html=html;
      if(!/<[a-z]/i.test(html)){this.textContent=html;return;}
      const stack=[this];
      for(const token of html.match(/<[^>]+>|[^<]+/g)||[]){
        if(token.startsWith('</')){stack.pop();continue;}
        const tag=/^<([a-z][\w-]*)/i.exec(token);
        if(!tag)continue;
        const node=this.ownerDocument.createElement(tag[1]);
        const attrs=token.slice(tag[0].length,-1);
        for(const a of attrs.matchAll(/([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g)){
          const val=a[2]??a[3]??'';node.setAttribute(a[1],val);
          if(a[1]==='hidden')node.hidden=true;
          if(a[1]==='data-i18n')node.dataset.i18n=val;
        }
        stack.at(-1).append(node);
        if(!['input','br','img','hr'].includes(tag[1]))stack.push(node);
      }
    }
  });
  const document=new Events(), window=new Events();
  document.createElement=t=>new Element(t,document);
  document.body=document.createElement('body');document.head=document.createElement('head');
  document.documentElement=document.createElement('html');document.readyState='complete';
  document.querySelectorAll=s=>[...document.body.querySelectorAll(s),...document.head.querySelectorAll(s)];
  document.getElementById=id=>document.querySelectorAll('#'+id)[0]||null;
  document.querySelector=s=>document.querySelectorAll(s)[0]||null;
  const trip=document.createElement('main');document.body.append(trip);
  const trigger=document.createElement('a');trigger.href='legal/privacy.html';trip.append(trigger);
  let requested=[];
  const fetch=async url=>{
    assert(/^\/assets\/i18n\/[a-z/-]+\.json$/.test(url),'Only local dictionaries are permitted');
    requested.push(url);const file=path.join(root,url.slice(1));
    return {ok:fs.existsSync(file),status:fs.existsSync(file)?200:404,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
  };
  Object.assign(window,{document,fetch});
  Object.assign(box,{window,document,fetch,CustomEvent:Event,location:{pathname:'/',search:'?lang=en',hostname:'local.pixkuy.test'},navigator:{language:'en'},localStorage:{getItem(){return null;},setItem(){}}});
  const run=file=>vm.runInContext(fs.readFileSync(file,'utf8'),box,{filename:file,timeout:2000});
  for(const f of ['catalog','loader','dom','selector'])run(path.join(root,'assets/js/i18n',f+'.js'));
  let readyResolve;const ready=new Promise(resolve=>readyResolve=resolve);
  window.addEventListener('pixkuy:i18n-applied',readyResolve);
  if(!earlyLanguage){
    run(legalSource);
    document.dispatchEvent(new Event('click',{target:trigger}));
  }
  run(path.join(root,'assets/js/i18n.js'));await ready;
  if(earlyLanguage)run(legalSource);
  assert.equal(window.__pixkuyI18nRuntime,undefined,'Do not inject the missing legacy runtime');
  return {window,document,trip,trigger,Event,requested};
}
function click(c,node){const e=new c.Event('click',{target:node});c.document.dispatchEvent(e);assert(e.defaultPrevented);}
function content(c,mode){
  const overlay=c.document.getElementById('pixkuy-legal-overlay');
  assert.equal(overlay.getAttribute('data-mode'),mode);
  const section=overlay.querySelector('[data-legal-section="'+mode+'"]');assert.equal(section.hidden,false);
  for(const node of section.querySelectorAll('[data-i18n]')){
    const key=node.getAttribute('data-i18n'),expected=c.window.__pixkuyI18nModules.getValue(c.window.__pixkuyI18nDict,key);
    assert.equal(typeof expected,'string',key+' exists');
    assert.equal(node.innerHTML,expected,key+' populated from current dictionary');
  }
  if(mode==='terms')assert(overlay.querySelector('[data-legal-terms-sections="1"]').children.length>0);
  return overlay;
}
(async()=>{
  for(const early of [true,false]){
    const c=await environment(early);
    for(const mode of ['cancellations','privacy','terms']){
      c.trigger.href='legal/'+mode+'.html';click(c,c.trigger);const overlay=content(c,mode);
      assert.equal(c.trip.inert,true);assert.equal(overlay.getAttribute('aria-hidden'),'false');
      assert.equal(c.document.activeElement,overlay.querySelector("button[data-legal-close='1']"));
      c.document.dispatchEvent(new c.Event('keydown',{key:'Escape'}));
      assert.equal(c.trip.inert,false);assert.equal(c.document.activeElement,c.trigger);
    }
    const overlay=c.document.getElementById('pixkuy-legal-overlay');
    for(const lang of ['es','en','fr','de','it','pt','ru','ko','zh-hans']){
      // Same real loader, limited to the legal fragment for key/content coverage.
      const dict=await c.window.__pixkuyI18nModules.loadTranslationsForLang(lang,['legal']);
      c.window.__pixkuyI18nDict=dict;c.document.documentElement.lang=lang;
      c.window.__pixkuyI18nModules.applyI18nToDom(dict,lang);
      c.window.dispatchEvent(new c.Event('pixkuy:i18n-applied',{detail:{lang}}));
      content(c,'terms'); // Dynamic terms must update on the event, before reopening.
      for(const mode of ['privacy','cancellations','terms']){
        c.window.PixkuyLegalOverlay.open('legal/'+mode+'.html');content(c,mode);
        assert(overlay.getAttribute('aria-label'));
      }
      c.window.PixkuyLegalOverlay.close();
    }
    console.log('PASS: language '+(early?'before':'after')+' overlay creation; click/API; content/terms; nine languages; close/focus commands.');
  }
  console.log('LIMIT: minimal DOM; no browser, CSS rendering, actual focus/scroll, network or services.');
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
