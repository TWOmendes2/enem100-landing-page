/** CONFIGURAÇÃO DA LP
 * preview = apresenta o fluxo sem enviar ou guardar dados pessoais.
 * api = envia leads via POST JSON ao seu backend, redirecionando apenas em caso de sucesso.
 * NUNCA publique em preview esperando receber leads reais.
 */
const CONFIG = Object.freeze({
  mode: 'apps_script',
  leadEndpoint: (window.ENEM100_CONFIG && window.ENEM100_CONFIG.leadEndpoint) || '',
  afterSignupPath: '#material',
  brandName: 'ENEM 100'
});

/** Funções puras para validar e preparar os dados de captação. */
function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function formatBrazilPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

function isValidBrazilPhone(value) {
  const d = onlyDigits(value);
  return d.length === 11 && /^[1-9]{2}9\d{8}$/.test(d) && !/^(\d)\1+$/.test(d);
}

function normalizeLead({name, email, phone}) {
  return {
    name: String(name ?? '').trim().replace(/\s+/g,' '),
    email: String(email ?? '').trim().toLowerCase(),
    phone: onlyDigits(phone)
  };
}

function getCampaignData(search='') {
  const params = new URLSearchParams(search);
  const fields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
  return Object.fromEntries(fields.filter(key => params.has(key))
    .map(key => [key, String(params.get(key)).slice(0, 250)]));
}

function getFirstName(value='') {
  return String(value).trim().split(/\s+/)[0] || '';
}

const form=document.querySelector('#lead-form');
const message=document.querySelector('#form-status');
const submitButton=document.querySelector('#submit-button');
const fields={name:document.querySelector('#full-name'),email:document.querySelector('#email'),phone:document.querySelector('#phone')};
const errors={name:document.querySelector('#name-error'),email:document.querySelector('#email-error'),phone:document.querySelector('#phone-error'),consent:document.querySelector('#consent-error')};
const consent=document.querySelector('#lead-consent');
const previewNotice=document.querySelector('#preview-disclaimer');

if(CONFIG.mode==='preview') previewNotice.hidden=false;

function showError(key,txt) {
  errors[key].textContent=txt;
  if(fields[key]) fields[key].setAttribute('aria-invalid',String(Boolean(txt)));
}
function clearErrors() {
  for(const key of Object.keys(errors))showError(key,'');
  message.textContent='';delete message.dataset.kind;
}
function setMessage(text,kind='error') {
  message.textContent=text;message.dataset.kind=kind;
}
fields.phone.addEventListener('input',(event)=>{
  event.target.value=formatBrazilPhone(event.target.value);
  showError('phone','');
});
for(const key of ['name','email']) fields[key].addEventListener('input',()=>showError(key,''));
consent.addEventListener('change',()=>showError('consent',''));

/** Envio por formulário invisível evita o bloqueio CORS do Google Apps Script. */
function submitLead(payload){
  return new Promise((resolve,reject)=>{
    if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(CONFIG.leadEndpoint)) {
      reject(new Error('Configure a URL /exec publicada no Google Apps Script.')); return;
    }
    const requestId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
    const frameName = 'enem100_frame_' + Date.now();
    const frame = document.createElement('iframe');
    frame.name=frameName; frame.style.display='none'; frame.setAttribute('aria-hidden','true');
    const transport = document.createElement('form');
    transport.method='POST'; transport.action=CONFIG.leadEndpoint; transport.target=frameName;
    transport.style.display='none';
    const campaign=payload.campaign||{};
    const params={name:payload.name,email:payload.email,phone:payload.phone,consent:String(payload.consent),consentAt:payload.consentAt,sourcePage:payload.sourcePage,requestId,website:'',...campaign};
    for(const [key,value] of Object.entries(params)){
      const input=document.createElement('input');input.type='hidden';input.name=key;input.value=String(value??'');transport.appendChild(input);
    }
    let finished=false;
    const cleanup=()=>{window.removeEventListener('message',onMessage);clearTimeout(timer);transport.remove();frame.remove();};
    const onMessage=(event)=>{
      // Apps Script usa sandbox em outro frame; validamos origem Google e requestId.
      // O HtmlService pode criar um iframe interno; não comparar event.source.
      if(!/^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|google\.com)$/.test(event.origin)) return;
      const data=event.data;
      if(!data || data.type!=='ENEM100_LEAD_RESULT' || data.requestId!==requestId || finished) return;
      finished=true;cleanup();
      data.ok?resolve():reject(new Error(data.message || 'Não foi possível salvar o cadastro.'));
    };
    const timer=setTimeout(()=>{if(finished)return;finished=true;cleanup();reject(new Error('Sem confirmação do Google Apps Script. Confira a implantação e se o aplicativo da Web está acessível a qualquer pessoa.'));},20000);
    window.addEventListener('message',onMessage);
    document.body.append(frame,transport); transport.submit();
  });
}

form.addEventListener('submit',async(event)=>{
  event.preventDefault();clearErrors();
  if(form.website.value) return; // honeypot; não envia robôs
  const lead=normalizeLead({name:fields.name.value,email:fields.email.value,phone:fields.phone.value});
  let invalid=false;
  if(lead.name.length<3||lead.name.length>110){showError('name','Informe seu nome completo.');invalid=true;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)){showError('email','Informe um e-mail válido.');invalid=true;}
  if(!isValidBrazilPhone(lead.phone)){showError('phone','Informe um WhatsApp válido com DDD e 9 dígitos.');invalid=true;}
  if(!consent.checked){showError('consent','Confirme a autorização para continuar.');invalid=true;}
  if(invalid){Object.entries(errors).find(([,el])=>el.textContent)?.[1]?.previousElementSibling?.focus?.();setMessage('Confira os campos destacados para continuar.');return;}

  const payload={
    ...lead, consent:true, consentAt:new Date().toISOString(),
    campaign:getCampaignData(window.location.search),
    sourcePage:window.location.origin+window.location.pathname
  };
  submitButton.disabled=true;
  submitButton.querySelector('span').textContent='PROCESSANDO INSCRIÇÃO...';
  setMessage('Validando suas informações...','success');
  try{
    if(CONFIG.mode==='apps_script') await submitLead(payload);
    else throw new Error('Modo de operação inválido.');
    // Sem dados pessoais no sessionStorage; guarda somente a autorização de navegação desta aba.
    sessionStorage.setItem('enem100_registration','ok');
    window.location.hash='material'; renderRoute();
  }catch(err){
    const txt=err.name==='AbortError'?'A conexão demorou demais. Tente novamente.':(err instanceof TypeError?'Erro de conexão. Tente novamente.':err.message);
    setMessage(txt);
  }finally{
    submitButton.disabled=false;
    submitButton.querySelector('span').textContent='RECEBER MATERIAL GRATUITO';
  }
});

const mobileCTA=document.querySelector('#mobile-cta');
if(mobileCTA && 'IntersectionObserver' in window){
  const firstSection=document.querySelector('.hero-content');
  const observer=new IntersectionObserver(([entry])=>{
    mobileCTA.classList.toggle('visible',!entry.isIntersecting);
  },{threshold:.1});
  observer.observe(firstSection);
}


const INLINE_PDF='assets/materiais/guia-enem100-2026.pdf';
function renderRoute() {
  const route=window.location.hash;
  const isMaterial=route==='#material';
  const isPrivacy=route==='#privacidade';
  const mainContent=Array.from(document.body.children).filter(el=>el.id!=='embedded-material'&&el.id!=='embedded-privacy'&&el.tagName!=='SCRIPT'&&el.tagName!=='STYLE');
  for(const el of mainContent)el.style.display=(isMaterial||isPrivacy)?'none':'';
  document.getElementById('embedded-material').style.display=isMaterial?'block':'none';
  document.getElementById('embedded-privacy').style.display=isPrivacy?'block':'none';
  const allowed=sessionStorage.getItem('enem100_registration')==='ok';
  const link=document.getElementById('material-download');
  link.hidden=!allowed;
  if(allowed)link.href=INLINE_PDF;
  document.getElementById('access-notice').hidden=allowed;
  document.getElementById('material-preview-note').hidden=CONFIG.mode!=='preview';
  document.body.classList.toggle('secondary-page',isMaterial||isPrivacy);
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',renderRoute);
renderRoute();
