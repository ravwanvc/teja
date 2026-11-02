import {env} from 'cloudflare:workers';
import {getAppUser,sameOrigin} from '../../../lib/auth.js';
export async function POST(req){
 if(!sameOrigin(req))return Response.json({error:'Origin'},{status:403});
 const u=await getAppUser();if(!u)return Response.json({error:'Hisobga kiring'},{status:401});
 if(Number(req.headers.get('content-length'))>2200000)return Response.json({error:'Rasm 2 MB dan kichik bo‘lsin'},{status:413});
 const f=await req.formData(),file=f.get('avatar');
 if(!file||typeof file.arrayBuffer!=='function'||file.size>2000000)return Response.json({error:'JPG, PNG yoki WebP, 2 MB gacha'},{status:400});
 const data=new Uint8Array(await file.arrayBuffer());
 const type=data[0]===255&&data[1]===216?'image/jpeg':data[0]===137&&data[1]===80&&data[2]===78?'image/png':String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP'?'image/webp':null;
 if(!type)return Response.json({error:'Faqat JPG, PNG yoki WebP'},{status:400});
 const key='avatars/'+u.userId+'/'+crypto.randomUUID();
 const previous=await env.DB.prepare('SELECT avatar FROM users WHERE id=?').bind(u.userId).first();
 await env.BUCKET.put(key,data,{httpMetadata:{contentType:type}});
 const avatar='/api/profile?image='+encodeURIComponent(key);
 await env.DB.prepare('UPDATE users SET avatar=? WHERE id=?').bind(avatar,u.userId).run();
 if(previous?.avatar?.startsWith('/api/profile?image=')){try{await env.BUCKET.delete(decodeURIComponent(previous.avatar.split('image=')[1]));}catch{}}
 return Response.json({ok:true,avatar});
}
export async function GET(req){const key=new URL(req.url).searchParams.get('image')||'';if(!/^avatars\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(key))return new Response('Not found',{status:404});const image=await env.BUCKET.get(key);if(!image)return new Response('Not found',{status:404});return new Response(image.body,{headers:{'Content-Type':image.httpMetadata.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=86400'}});}
