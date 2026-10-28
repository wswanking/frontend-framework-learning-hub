import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
export const hashes={};
export async function loadTs(url){
 const source=await readFile(url,'utf8');hashes[url.pathname]=createHash('sha256').update(source).digest('hex');
 let code=stripTypeScriptTypes(source);if(code.includes('from \"vue\"'))code=code.replaceAll('from \"vue\"',`from 'file://${url.pathname.split('/src/')[0]}/node_modules/vue/dist/vue.runtime.esm-bundler.js'`);
 const matches=[...code.matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/g)];
 for(const match of matches){const path=match[1].endsWith('.ts')?match[1]:match[1]+'.ts';const child=await toData(new URL(path,url));code=code.replace(match[0],`from '${child}'`);}
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
async function toData(url){const source=await readFile(url,'utf8');hashes[url.pathname]=createHash('sha256').update(source).digest('hex');let code=stripTypeScriptTypes(source);if(code.includes('from \"vue\"'))code=code.replaceAll('from \"vue\"',`from 'file://${url.pathname.split('/src/')[0]}/node_modules/vue/dist/vue.runtime.esm-bundler.js'`);for(const m of [...code.matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/g)])code=code.replace(m[0],`from '${await toData(new URL(m[1].endsWith('.ts')?m[1]:m[1]+'.ts',url))}'`);return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
