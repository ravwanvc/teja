// Linux CI fallback when Playwright's browser CDN is unavailable.
// Uses the Chromium binary distributed in the installed npm package.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {brotliDecompressSync} from 'node:zlib';
const require=createRequire(import.meta.url);
const packageRoot=path.dirname(require.resolve('@sparticuz/chromium/package.json'));
const dir=mkdtempSync(path.join(tmpdir(),'teja-chromium-'));
for(const name of ['chromium','fonts.tar','swiftshader.tar']){
 const target=path.join(dir,name);writeFileSync(target,brotliDecompressSync(readFileSync(path.join(packageRoot,'bin',name+'.br'))));
 if(name.endsWith('.tar')){const result=spawnSync('tar',['--no-same-owner','-xf',target,'-C',dir]);if(result.status!==0)throw Error('Could not extract browser assets')}
}
const executable=path.join(dir,'chromium');chmodSync(executable,0o755);
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{stdio:'inherit',env:{...process.env,PLAYWRIGHT_EXECUTABLE_PATH:executable,FONTCONFIG_PATH:path.join(dir,'fonts'),LD_LIBRARY_PATH:dir+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'')}});
child.on('exit',code=>process.exitCode=code??1);
