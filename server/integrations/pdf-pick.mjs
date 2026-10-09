// Welches PDF eines Vorgangs gelesen wird: zuerst die Vorlage, dann Beschlussvorschlag oder Bericht, sonst irgendein PDF.
export const pickPdf=topic=>(topic.documents||[]).find(d=>/vorlage/i.test(d.title)&&d.kind==='application/pdf')||(topic.documents||[]).find(d=>/beschlussvorschlag|bericht/i.test(d.title)&&d.kind==='application/pdf')||(topic.documents||[]).find(d=>d.kind==='application/pdf');
