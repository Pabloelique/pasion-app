type Phase="preparación"|"permiso"|"suscripción"|"guardado";
export function pushActivationError(error:unknown,phase:Phase):string{
 const e=error&&typeof error==="object"?error as {code?:unknown;name?:unknown;message?:unknown}:null;
 const code=typeof e?.code==="string"&&/^[A-Z0-9]{3,12}$/.test(e.code)?e.code:"";
 const name=typeof e?.name==="string"?e.name:"";
 const reference=" ["+phase+(code?": "+code:"")+"]";
 if(phase==="guardado")return "El permiso del móvil está concedido, pero no se ha podido guardar la activación en tu cuenta. Mantén la conexión y vuelve a intentarlo. Si se repite, comunica este código."+reference;
 if(name==="NotAllowedError")return "El iPhone o navegador ha bloqueado las notificaciones. Revisa Ajustes → Notificaciones → PASIÓN APP, permite los avisos y vuelve a abrirla desde su icono."+reference;
 if(name==="InvalidStateError")return "El navegador conserva una suscripción que no se puede usar. Cierra PASIÓN APP, vuelve a abrirla desde su icono y reintenta la activación."+reference;
 if(name==="AbortError"||name==="NetworkError")return "El dispositivo no ha podido conectar con el servicio de notificaciones. Comprueba la conexión y vuelve a intentarlo."+reference;
 if(error instanceof Error&&error.name==="Error")return error.message+reference;
 return "El dispositivo no ha podido completar la activación. Cierra PASIÓN APP y vuelve a abrirla desde su icono. Si se repite, comunica este código."+reference;
}
