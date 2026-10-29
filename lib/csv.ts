// Keep exported user text from being interpreted as spreadsheet formulas.
export function csvCell(value:unknown){
 const text=String(value??"");
 const formula=/^[\s\u0000-\u001f]*[=+\-@]/u.test(text.normalize("NFKC"));
 return '"'+(formula?"\t"+text:text).replaceAll('"','""')+'"';
}
