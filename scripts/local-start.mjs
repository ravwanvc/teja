import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {root,syncLocalEnv} from './local-env.mjs';
process.chdir(root);
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1)}
const config=path.join(root,'dist/server/wrangler.json');
if(!existsSync(config)){console.log('Birinchi ishga tushirish: build tayyorlanmoqda.');run(['scripts/run-framework.mjs','build'])}
syncLocalEnv();
run(['scripts/db-migrate.mjs','apply']);
console.log('Admin sozlash kerak bo‘lsa: npm run admin:setup');
run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--inspector-port','0',...process.argv.slice(2)]);
