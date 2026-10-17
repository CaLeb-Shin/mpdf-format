// Original MPDF practice material. No downloaded music, recordings, or notation.
// Rebuild: cd site && node scripts/generate-demo.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import * as PDFLib from 'pdf-lib'
import { createMpdf, renderPageButtons } from '../mpdf-browser.js'

globalThis.PDFLib = PDFLib
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib
const output = new URL('../samples/', import.meta.url)
await mkdir(output, { recursive: true })
const tempo = 120, beat = 60 / tempo, sampleRate = 22050, duration = 16.4
const melody = [
  [60,64,67,64], [62,67,71,67], [64,69,72,69], [60,65,69,65],
  [64,67,72,67], [65,69,72,69], [62,67,71,74], [72],
]
const chords = [[48,52,55], [43,50,55], [45,52,57], [41,48,53], [48,52,55], [41,48,53], [43,50,55], [48,52,55]]
const chordNames = ['C','G','Am','F','C','F','G','C']
const events = melody.flatMap((notes, bar) => notes.map((midi, i) => ({ midi, seconds: (bar*4+i)*beat, length: notes.length === 1 ? 4*beat : beat })))
function frequency(midi) { return 440 * 2**((midi-69)/12) }
function renderAudio(role) {
  const audio = new Float64Array(Math.ceil(duration*sampleRate))
  function add(midi, onset, length, gain, timbre) {
    const start = Math.round(onset*sampleRate), count = Math.min(audio.length-start, Math.ceil((length+.08)*sampleRate)), f = frequency(midi)
    for (let i=0; i<count; i++) {
      const t=i/sampleRate, phase=2*Math.PI*f*t
      const attack=Math.min(1,t/.015), release=Math.min(1,Math.max(0,(length+.08-t)/.10))
      let wave
      if (timbre === 'piano') wave=(Math.sin(phase)+.24*Math.sin(phase*2)+.12*Math.sin(phase*3))*Math.exp(-2.3*t)
      else if (timbre === 'flute') wave=Math.sin(phase+.006*Math.sin(2*Math.PI*5*t))+.11*Math.sin(phase*2)+.04*Math.sin(phase*3)
      else wave=Math.sin(phase)+.30*Math.sin(phase*2)*Math.exp(-6*t)+.15*Math.sin(phase*3)*Math.exp(-8*t)
      audio[start+i]+=gain*wave*attack*release
    }
  }
  if (role==='chords') chords.forEach((notes,bar) => notes.forEach((midi,i) => add(midi,bar*4*beat+i*.035,4*beat-i*.035-.04,.105,'piano')))
  else events.forEach(e=>add(e.midi,e.seconds,e.length-.055,.27,role==='source'?'flute':'bell'))
  const buffer=Buffer.alloc(44+audio.length*2)
  buffer.write('RIFF',0); buffer.writeUInt32LE(buffer.length-8,4); buffer.write('WAVEfmt ',8)
  buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(1,20); buffer.writeUInt16LE(1,22)
  buffer.writeUInt32LE(sampleRate,24); buffer.writeUInt32LE(sampleRate*2,28); buffer.writeUInt16LE(2,32); buffer.writeUInt16LE(16,34)
  buffer.write('data',36); buffer.writeUInt32LE(audio.length*2,40)
  for(let i=0;i<audio.length;i++) buffer.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,audio[i]))*32767),44+i*2)
  return new Uint8Array(buffer)
}

const score=await PDFDocument.create()
score.setTitle('A little practice'); score.setAuthor('MPDF original practice material'); score.setSubject('Eight original bars for MPDF playback, time markers and A-B repeat')
const page=score.addPage([595.28,841.89]), font=await score.embedFont(StandardFonts.Helvetica), bold=await score.embedFont(StandardFonts.HelveticaBold)
const ink=rgb(.15,.20,.22), muted=rgb(.45,.48,.47), orange=rgb(.85,.36,.13), line=rgb(.68,.70,.68)
function text(value,x,y,size=12,color=ink,f=font) { page.drawText(value,{x,y,size,font:f,color}) }
function stroke(x1,y1,x2,y2,thickness=.7,color=line) { page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness,color}) }
text('MPDF / ORIGINAL PRACTICE',44,795,9,orange,bold)
text('A little practice',44,757,29,ink,bold)
text('Eight bars to listen, mark a moment, and play it again.',44,731,11,muted)
text('C major',44,697,10,ink,bold); text('4/4',119,697,10,ink,bold); text('Quarter note = 120',160,697,10,ink,bold)
stroke(44,682,551,682,.6,rgb(.88,.87,.83))
const staffLeft=54, measureLeft=105, right=551, measureWidth=(right-measureLeft)/4, staffGap=11
function staffY(midi,bottom) {
  // C4 is one ledger line below the E4 bottom staff line.
  const semitone=midi%12, octave=Math.floor(midi/12)-1
  const step={0:0,2:1,4:2,5:3,7:4,9:5,11:6}[semitone]
  return bottom+(octave*7+step-(4*7+2))*staffGap/2
}
function treble(x,bottom) {
  // Vector G-clef, centered on G4 (the second staff line).
  page.drawSvgPath('M 18 0 C 7 -14 6 -38 17 -51 C 29 -65 33 -83 23 -86 C 13 -89 10 -67 15 -46 C 18 -31 27 -15 27 3 C 27 16 11 19 8 9 C 6 2 12 -3 17 1 M 16 -47 C -4 -40 -8 -21 5 -13 C 19 -4 37 -18 31 -31 C 26 -43 11 -39 10 -28 C 9 -22 14 -18 19 -20', {x,y:bottom+11,scale:.52,borderColor:ink,borderWidth:2.5})
}
for(let system=0;system<2;system++) {
  const bottom=system===0?590:398
  for(let lineIndex=0;lineIndex<5;lineIndex++) stroke(staffLeft,bottom+lineIndex*staffGap,right,bottom+lineIndex*staffGap,.65)
  treble(62,bottom)
  if(system===0) {text('4',88,bottom+25,16,ink,bold);text('4',88,bottom+4,16,ink,bold)}
  for(let local=0;local<4;local++) {
    const bar=system*4+local, left=measureLeft+local*measureWidth
    text(String(bar+1),left+6,bottom+61,8,muted)
    text(chordNames[bar],left+12,bottom+79,12,ink,bold)
    stroke(left+measureWidth,bottom,left+measureWidth,bottom+44,.8,ink)
    melody[bar].forEach((midi,index)=>{
      const x=left+17+index*(measureWidth-23)/4,y=staffY(midi,bottom),whole=melody[bar].length===1
      if(y<bottom) for(let ledger=bottom-11;ledger>=y;ledger-=11) stroke(x-8,ledger,x+8,ledger,.8,ink)
      if(y>bottom+44) for(let ledger=bottom+55;ledger<=y;ledger+=11) stroke(x-8,ledger,x+8,ledger,.8,ink)
      page.drawEllipse({x,y,xScale:whole?6.6:5.4,yScale:whole?4.1:3.6,rotate:degrees(-18),color:whole?rgb(1,1,1):ink,borderColor:ink,borderWidth:whole?1.4:.2})
      if(!whole) { const down=y>=bottom+22; stroke(x+(down?-4.5:4.5),y,x+(down?-4.5:4.5),y+(down?-30:30),.9,ink) }
    })
  }
  if(system===1) stroke(right-3,bottom,right-3,bottom+44,2,ink)
}
text('01 / LISTEN',44,306,10,orange,bold)
text('Choose Melody, Chords, or Original sound in the player.',44,286,11,ink)
text('02 / MARK',44,248,10,orange,bold)
text('Tap a time marker to jump to the first or second phrase.',44,228,11,ink)
text('03 / REPEAT',44,190,10,orange,bold)
text('Set A at 0:00 and B at 0:08 to practice the opening phrase.',44,170,11,ink)
stroke(44,121,551,121,.6,rgb(.88,.87,.83))
text('Melody and recordings created for this MPDF example. Free to practice and share.',44,99,8,muted)
text('The printed score stays readable in an ordinary PDF app.',44,84,8,muted)
text('1',545,51,9,muted)
const clean=await score.save()
await writeFile(new URL('practice-score.pdf',output),clean)
const files={
  'practice-melody.wav':renderAudio('melody'),
  'practice-chords.wav':renderAudio('chords'),
  'practice-source.wav':renderAudio('source'),
}
const manifest={
  mpdf:'1.0',title:'A little practice · MPDF',
  tracks:[
    {id:'melody',title:'악보 연주 · A little practice',src:'file:practice-melody.wav',start:0,end:16.4},
    {id:'chords',title:'피아노 코드 반주',src:'file:practice-chords.wav',start:0,end:16.4},
    {id:'source',title:'원음 · 부드러운 플루트',src:'file:practice-source.wav',start:0,end:16.4},
  ],
  cues:[{page:1,track:'melody',at:0}],options:{autoplay:false,followPage:false,loop:false},
  buttons:[
    {id:'b1d74ea0-0ca2-451f-8b98-c1502500c071',page:1,track:'melody',x:.89,y:.16},
    {id:'d2837613-d31f-451d-84e8-79a0527a7457',page:1,track:'source',x:.89,y:.388},
  ],
  timeMarkers:[
    {id:'4ed166cf-2666-46fa-bb53-ed271e8da95f',page:1,track:'melody',seconds:0,x:.22,y:.335},
    {id:'f83b2802-82d0-470a-8c76-146cb45b0016',page:1,track:'melody',seconds:8,x:.22,y:.563},
    {id:'6895baee-b7ca-4cd2-b3c6-307571a92938',page:1,track:'source',seconds:12,x:.59,y:.563},
  ],
  web:{buttonRendering:'baked'},
}
const drawn=await renderPageButtons(clean,manifest.buttons)
const publication={
  version:1,id:'36262f42-728d-40dd-893a-06543ee0487d',sourceNoteID:'mpdf-original-practice',
  createdAt:814060800,tempo,sourceStartSeconds:0,
  scoreTrackID:'melody',chordTrackID:'chords',sourceTrackID:'source',sharedReadOnly:true,
  tags:['연습용 예시','MPDF'],
}
const sharedFiles={...files,'seetogether-mpdf.json':new TextEncoder().encode(JSON.stringify(publication))}
const shared=await createMpdf(drawn,manifest,sharedFiles,{shared:true})
await writeFile(new URL('practice.mpdf',output),shared)
const originalManifest={...manifest,web:{...manifest.web,sourcePDFKey:'mpdf-web-source.pdf'}}
const original=await createMpdf(drawn,originalManifest,{...files,'mpdf-web-source.pdf':clean})
await writeFile(new URL('practice-original.pdf',output),original)
console.log(JSON.stringify({created:['practice-score.pdf','practice.mpdf','practice-original.pdf'],bytes:{score:clean.length,shared:shared.length,original:original.length},duration,tempo,bars:8},null,2))
