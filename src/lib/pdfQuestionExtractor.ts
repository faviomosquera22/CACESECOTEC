import "server-only";
import { PDF_MAX_BYTES, PDF_MAX_PAGES, parseQuestionLines, type PdfLine } from "@/lib/pdfQuestionImport";

type Box = [number,number,number,number];
type Matrix = [number,number,number,number,number,number];
const identity: Matrix=[1,0,0,1,0,0];
function multiply(a:Matrix,b:Matrix):Matrix { return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]; }
function transform(box:Box,m:Matrix):Box { const points=[[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]; }

export async function extractPdfQuestions(bytes: Uint8Array) {
  if (bytes.length > PDF_MAX_BYTES || new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-") throw new Error("Selecciona un PDF válido de hasta 4 MB.");
  const { getDocument, OPS }=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task=getDocument({data:bytes,useSystemFonts:true,fontExtraProperties:true,stopAtErrors:true});
  const timer=setTimeout(()=>{ void task.destroy(); },45000);
  try {
    const pdf=await task.promise;
    if(pdf.numPages>PDF_MAX_PAGES) throw new Error(`El PDF supera ${PDF_MAX_PAGES} páginas. Divídelo antes de subirlo.`);
    const lines:PdfLine[]=[];const warnings:string[]=[];let chars=0;
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++) {
      const page=await pdf.getPage(pageNumber);
      const [content,operators,annotations]=await Promise.all([page.getTextContent(),page.getOperatorList(),page.getAnnotations()]);
      const marks:{box:Box;underline:boolean}[]=[];
      for(const annotation of annotations) {
        if(["Highlight","Underline"].includes(annotation.subtype)) {
          // Each quad is a separate line; the whole annotation rectangle can cover distractors.
          const quads=annotation.quadPoints as ArrayLike<number> | undefined;
          if(quads?.length) for(let i=0;i+7<quads.length;i+=8) marks.push({box:[Math.min(quads[i],quads[i+2],quads[i+4],quads[i+6]),Math.min(quads[i+1],quads[i+3],quads[i+5],quads[i+7]),Math.max(quads[i],quads[i+2],quads[i+4],quads[i+6]),Math.max(quads[i+1],quads[i+3],quads[i+5],quads[i+7])],underline:annotation.subtype==="Underline"});
          else if(annotation.rect) marks.push({box:annotation.rect as Box,underline:annotation.subtype==="Underline"});
        }
      }
      let matrix:Matrix=identity;let fill="#000000";const stack:{matrix:Matrix;fill:string}[]=[];
      for(let i=0;i<operators.fnArray.length;i++) {
        const op=operators.fnArray[i];const args=operators.argsArray[i];
        if(op===OPS.save) stack.push({matrix:[...matrix],fill});
        else if(op===OPS.restore) {const state=stack.pop();if(state){matrix=state.matrix;fill=state.fill;}}
        else if(op===OPS.transform) matrix=multiply(matrix,args as Matrix);
        else if(op===OPS.setFillRGBColor) fill=String(args[0]);
        else if(op===OPS.constructPath && args[2]?.length===4) {
          const box=transform(Array.from(args[2]) as Box,matrix);const width=box[2]-box[0];const height=box[3]-box[1];
          const color=fill.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)?.slice(1).map(x=>parseInt(x,16));
          const colored=color && Math.max(...color)-Math.min(...color)>70 && Math.max(...color)>130;
          if(width>8 && height>2 && height<35 && colored && [OPS.fill,OPS.eoFill,OPS.fillStroke].includes(args[0])) marks.push({box,underline:false});
          if(width>8 && height<2 && [OPS.stroke,OPS.fill,OPS.fillStroke].includes(args[0])) marks.push({box,underline:true});
        }
      }
      const items=content.items.filter(item=>"str" in item && item.str.trim()).map(item=> {
        if(!("str" in item)) throw new Error("Texto no reconocido");
        let bold=false;
        if(page.commonObjs.has(item.fontName)) { const font=page.commonObjs.get(item.fontName);bold=Boolean(font.bold || /bold|black|heavy|semibold/i.test(font.name ?? "")); }
        const x=item.transform[4],y=item.transform[5],height=Math.max(item.height,Math.abs(item.transform[3]),5);
        const marked=marks.some(({box,underline})=> {
          const overlap=Math.min(x+item.width,box[2])-Math.max(x,box[0]);
          return overlap > Math.min(item.width*.5,15) && (underline ? Math.abs(y-box[3])<height*.35 : y+height*.35>=box[1] && y+height*.35<=box[3]);
        });
        return {text:item.str,x,y,height,width:item.width,bold,marked};
      }).sort((a,b)=>Math.abs(b.y-a.y)>Math.min(a.height,b.height)*.35?b.y-a.y:a.x-b.x);
      if(!items.length){warnings.push(`Página ${pageNumber}: sin texto extraíble (posible escaneo).`);continue;}
      let row:typeof items=[];
      function flush(){ if(!row.length)return; const text=row.map(item=>item.text).join(" ").replace(/\s+/g," ").trim();chars+=text.length;if(chars>1_200_000)throw new Error("El PDF contiene demasiado texto. Divídelo en archivos más pequeños."); const meaningful=row.filter(item=>!/^\s*[A-Ea-e][.)\-:]?\s*$/.test(item.text));const total=meaningful.reduce((n,item)=>n+item.text.length,0); const boldChars=meaningful.filter(item=>item.bold).reduce((n,item)=>n+item.text.length,0);lines.push({text,page:pageNumber,bold:total>0&&boldChars/total>.85,marked:row.some(item=>item.marked)});row=[]; }
      for(const item of items) { if(row.length && Math.abs(row[0].y-item.y)>Math.min(row[0].height,item.height)*.35) flush();row.push(item); } flush();page.cleanup();
    }
    if(!lines.length) throw new Error("Este PDF no contiene texto seleccionable. Sube una versión con reconocimiento de texto (OCR) o agrega las preguntas manualmente.");
    const candidates=parseQuestionLines(lines);
    if(!candidates.length) throw new Error("No se reconocieron preguntas. Usa preguntas numeradas (1., 2.…) y opciones A., B., C., D. en líneas separadas.");
    return {candidates,warnings,pages:pdf.numPages};
  } finally {clearTimeout(timer);await task.destroy();}
}
