import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.MOONJANG_HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const MAX_BODY = 8_000;
const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    clarification: { type: 'string' },
    analysis: { type: 'object', additionalProperties: false, properties: {
      meaning: { type: 'string' }, formation: { type: 'string' }, usage: { type: 'string' }, restrictions: { type: 'string' }, similarForms: { type: 'string' }
    }, required: ['meaning','formation','usage','restrictions','similarForms'] },
    exercises: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      direction: { type: 'string', enum: ['kk-ko','ko-kk'] }, number: { type: 'integer' }, prompt: { type: 'string' }, answer: { type: 'string' }, explanation: { type: 'string' }
    }, required: ['direction','number','prompt','answer','explanation'] } }
  }, required: ['clarification','analysis','exercises']
};
function send(res, status, data, type='application/json; charset=utf-8') { res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(type.startsWith('application/json') ? JSON.stringify(data) : data); }
function getBody(req) { return new Promise((resolve,reject)=>{let raw='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>MAX_BODY){reject(Error('Слишком большой запрос.'));req.destroy();return}raw+=chunk});req.on('end',()=>{try{resolve(JSON.parse(raw))}catch{reject(Error('Некорректный JSON.'))}});req.on('error',reject)}); }
function extractText(response) { if(typeof response.output_text==='string')return response.output_text;return (response.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''); }
function validate(data) {
  if(data.clarification?.trim()) return data.clarification;
  if(!data.analysis||!Array.isArray(data.exercises)||data.exercises.length!==60)return 'Модель вернула не 60 заданий. Попробуйте ещё раз.';
  for(const d of ['kk-ko','ko-kk']){const rows=data.exercises.filter(x=>x.direction===d);if(rows.length!==30||new Set(rows.map(x=>x.number)).size!==30||rows.some(x=>!Number.isInteger(x.number)||x.number<1||x.number>30))return 'Модель вернула неполный или повторяющийся список заданий. Попробуйте ещё раз.'}
  if(data.exercises.some(x=>!x.prompt?.trim()||!x.answer?.trim()))return 'В части заданий нет исходного предложения или перевода. Попробуйте ещё раз.';
  return null;
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='POST'&&url.pathname==='/api/generate'){
    if(!process.env.OPENAI_API_KEY)return send(res,503,{message:'ИИ-сервис не настроен. См. README: задайте OPENAI_API_KEY и запустите сервер через node server.mjs.'});
    try{
      const body=await getBody(req),grammar=typeof body.grammar==='string'?body.grammar.trim():'';
      if(!grammar||grammar.length>200)return send(res,400,{message:'Введите название грамматики длиной до 200 символов.'});
      const instructions=`You are an expert Korean grammar teacher and professional Kazakh translator. First analyze the exact Korean grammar form, its functions, conjugation, natural contexts, restrictions, exceptions, and differences from similar forms. If the user input is genuinely ambiguous and cannot be safely resolved, return a short clarification in Russian and empty exercises; do not guess. Otherwise create exactly 60 distinct high-quality exercises: 30 kk-ko (Kazakh prompts to translate into natural Korean) and 30 ko-kk (Korean prompts to translate into natural Kazakh). Every expected Korean answer for kk-ko must naturally practice the requested target grammar; avoid forcing it where unnatural. Order each direction by increasing difficulty, use varied topics, natural language, and nuanced complex sentences. The ko-kk block should be more advanced than kk-ko. Provide aligned natural translations, not literal calques. Number each direction 1 through 30. Add concise explanation only where helpful, otherwise empty string. All user-facing language and prompts must follow their specified language, not Russian except clarification.`;
      const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,store:false,instructions,input:`Target grammar: ${grammar}`,max_output_tokens:14000,text:{format:{type:'json_schema',name:'moonjang_exercises',strict:true,schema}}})});
      const payload=await upstream.json().catch(()=>({}));
      if(!upstream.ok)return send(res,502,{message:payload.error?.message||`ИИ-сервис вернул ошибку (${upstream.status}). Проверьте ключ, модель и доступ API.`});
      const text=extractText(payload);let data;try{data=JSON.parse(text)}catch{return send(res,502,{message:'Не удалось разобрать ответ модели. Повторите попытку.'})}
      const issue=validate(data);if(issue)return send(res,422,{message:issue});
      send(res,200,{analysis:data.analysis,exercises:data.exercises});
    }catch(err){if(!res.headersSent)send(res,500,{message:err.message||'Ошибка локального сервера.'})}
    return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{message:'Метод не поддерживается.'});
  const rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const file=path.resolve(ROOT,'.'+rel);
  if(!file.startsWith(ROOT+path.sep))return send(res,403,{message:'Доступ запрещён.'});
  try{const data=await readFile(file);const ext=path.extname(file);const type=({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'})[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data)}catch{send(res,404,{message:'Файл не найден.'})}
});
server.listen(PORT,HOST,()=>console.log(`moonjang: http://${HOST}:${PORT}`));
