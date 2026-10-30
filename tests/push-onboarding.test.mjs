import {strict as assert} from "node:assert";
import {test} from "node:test";
import {canDismissPush,readPushOnboarding,recordPushFailure,writePushOnboarding} from "../lib/push-onboarding.ts";

test("initial onboarding stays required; two failed attempts allow continuing",()=>{
 assert.equal(canDismissPush({failures:0}),false);
 const first=recordPushFailure({failures:0},"failed");
 assert.equal(canDismissPush(first),false);
 assert.equal(canDismissPush(recordPushFailure(first,"failed")),true);
 for(const reason of ["unsupported","denied"])assert.equal(canDismissPush({failures:0,reason}),true);
});
test("dismissal and attempts persist per account in this browser; success can reset them",()=>{
 const values=new Map();
 Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key)=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
 Object.defineProperty(globalThis,"window",{configurable:true,value:new EventTarget()});
 writePushOnboarding("account-a",{failures:2,reason:"failed",dismissed:true});
 assert.equal(readPushOnboarding("account-a").dismissed,true);
 assert.deepEqual(readPushOnboarding("account-b"),{failures:0});
 writePushOnboarding("account-a",{failures:0});
 assert.equal(readPushOnboarding("account-a").dismissed,false);
 values.set("pasion-push-onboarding-state-v1:bad","invalid JSON");
 assert.deepEqual(readPushOnboarding("bad"),{failures:0});
 values.set("pasion-push-onboarding-state-v1:bad",'{"failures":-1,"dismissed":true}');
 assert.deepEqual(readPushOnboarding("bad"),{failures:0});
 Object.defineProperty(globalThis,"localStorage",{configurable:true,get(){throw new Error("storage blocked");}});
 writePushOnboarding("blocked",{failures:0,reason:"denied",dismissed:true});
 assert.equal(readPushOnboarding("blocked").dismissed,true);
});
