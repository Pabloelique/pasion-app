// Round the estimate up to cents so rounding never understates the shared cost.
export function contributionPerPerson(cost:number|null|undefined,people:number):number|null{
 if(cost===null||cost===undefined||!Number.isFinite(cost)||cost<0||
 !Number.isSafeInteger(people)||people<1)return null;
 return Math.ceil(Math.round(cost*100)/people)/100;
}
