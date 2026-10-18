// SPDX-License-Identifier: BSL-1.0
let initialized;
let runtime;

export async function initialize(baseUrl) {
 if(initialized)return initialized;
 initialized=(async()=>{
  const root=new URL(baseUrl,globalThis.location?.href||import.meta.url);
  if(!root.pathname.endsWith('/'))root.pathname+='/';
  const rustRoot=new URL('rust/',root);
  const {createRuntime}=await import(new URL('runtime.js',rustRoot).href);
  runtime=await createRuntime(rustRoot.href);
 })();
 try{await initialized;}catch(error){initialized=undefined;throw error;}
}

export async function execute(source) {
 if(!initialized)throw new Error('Rust runtime has not been initialized');
 await initialized;
 return runtime.execute(String(source));
}
