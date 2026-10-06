#!/usr/bin/env python3
"""Render the next controlled batch of missing Encyclopedia teaching-visual candidates.

This renderer is intentionally deterministic and conservative:
- reads the controlled visual-production queue;
- renders only lessons whose raster artwork is still missing;
- uses the complete controlled science-teaching layout-family set assigned by the queue;
- preserves review boundaries: output is a candidate, never an approval.
"""
from __future__ import annotations
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import argparse, json, math, re, textwrap

ROOT=Path(__file__).resolve().parents[1]
QUEUE=ROOT/'content/encyclopedia/visual-production-queue-v1.json'
OUT=ROOT/'site/wordpress/assets/infographics'
W,H=1600,1000
BG=(247,250,247); PAPER=(255,255,255); INK=(28,34,30); MUTED=(93,104,97)
GREEN=(45,106,65); BLUE=(55,98,145); ORANGE=(181,110,45); RED=(158,67,60)
LINE=(205,214,207)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def font(size,bold=False):
    return ImageFont.truetype(BOLD if bold else FONT,size)

def clean(value):
    return re.sub(r'\s+',' ',str(value or '')).strip()

def short(value,limit=180):
    s=clean(value)
    if len(s)<=limit:return s
    cut=s[:limit].rsplit(' ',1)[0].rstrip(' ,;:')
    return cut+'…'

def sentences(value,max_items=2):
    s=clean(value)
    chunks=re.split(r'(?<=[.!?])\s+',s)
    return [c for c in chunks if c][:max_items]

def wrap(draw,text,xy,max_width,font_obj,fill=INK,line_gap=8,max_lines=7):
    x,y=xy; words=clean(text).split(); lines=[]; cur=''
    for word in words:
        test=(cur+' '+word).strip()
        if draw.textbbox((0,0),test,font=font_obj)[2] <= max_width:
            cur=test
        else:
            if cur: lines.append(cur)
            cur=word
    if cur: lines.append(cur)
    if len(lines)>max_lines:
        lines=lines[:max_lines]
        lines[-1]=short(lines[-1],max(20,len(lines[-1])-1))
    for line in lines:
        draw.text((x,y),line,font=font_obj,fill=fill)
        y += font_obj.size + line_gap
    return y

def panel(draw,xy,title,body='',accent=GREEN):
    x1,y1,x2,y2=xy
    draw.rounded_rectangle(xy,radius=24,fill=(248,250,248),outline=LINE,width=3)
    draw.rectangle((x1,y1,x1+10,y2),fill=accent)
    draw.text((x1+28,y1+22),short(title,52),font=font(25,True),fill=accent)
    wrap(draw,body,(x1+28,y1+62),x2-x1-54,font(18),INK,6,6)

def arrow(draw,a,b,color=GREEN,width=7):
    draw.line((a,b),fill=color,width=width)
    ang=math.atan2(b[1]-a[1],b[0]-a[0])
    for off in (2.65,-2.65):
        p=(b[0]-22*math.cos(ang+off),b[1]-22*math.sin(ang+off))
        draw.line((b,p),fill=color,width=width)

def canvas(item):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    d.rounded_rectangle((42,32,W-42,H-32),radius=30,fill=PAPER,outline=LINE,width=3)
    d.text((78,58),f"{item['lessonId']} · {short(item['title'],58)}",font=font(38,True),fill=INK)
    d.text((78,112),short(item.get('purpose','Controlled teaching visual candidate.'),116),font=font(20),fill=MUTED)
    d.line((78,158,W-78,158),fill=LINE,width=2)
    d.text((78,H-75),"Candidate teaching visual · requires independent science, accessibility, and asset QA before approval",font=font(17),fill=MUTED)
    return im,d

def labels(item):
    vals=[clean(x) for x in item.get('requiredLabels',[]) if clean(x)]
    return vals[:6] or ['Observation','Context','Measurement','Interpretation']

def science_points(item):
    out=[]
    for raw in item.get('accuracyRequirements',[])[:3]:
        ss=sentences(raw,1)
        if ss: out.append(short(ss[0],185))
    return out

def guards(item):
    return [short(x,175) for x in item.get('misconceptionGuards',[])[:2]]

def render_diagnostic(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    panel(d,(80,210,500,405),"Observe / classify",pts[0] if pts else item.get('purpose',''),BLUE)
    panel(d,(80,485,500,700),"Measure context",pts[1] if len(pts)>1 else "Record the relevant tissue, environment, timing, and measurement conditions.",GREEN)
    panel(d,(600,300,1000,610),"Differential", "Keep multiple plausible explanations open until observations and measurements discriminate among them.",ORANGE)
    panel(d,(1100,210,1520,405),"Verify",pts[2] if len(pts)>2 else "Use independent evidence or repeated observations before concluding cause.",GREEN)
    panel(d,(1100,485,1520,700),"Reassess",gs[0] if gs else "If evidence conflicts, revise the explanation rather than forcing the first hypothesis.",RED)
    arrow(d,(500,305),(600,390),BLUE); arrow(d,(500,590),(600,515),GREEN)
    arrow(d,(1000,390),(1100,305),GREEN); arrow(d,(1000,515),(1100,590),ORANGE)
    y=742
    d.text((80,y),"CONTROLLED TERMS",font=font(20,True),fill=INK); y+=34
    for lab in labs:
        d.rounded_rectangle((80,y,430,y+42),radius=14,fill=(239,246,241),outline=(181,203,188),width=2)
        d.text((96,y+9),short(lab,34),font=font(18,True),fill=GREEN); y+=50

def render_mechanism(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    titles=(labs+['Input','Process','Output'])[:3]
    panel(d,(90,270,465,560),titles[0],pts[0] if pts else item.get('purpose',''),BLUE)
    panel(d,(610,240,990,590),titles[1] if len(titles)>1 else 'Mechanism',pts[1] if len(pts)>1 else "Trace the controlled biological or physical process.",GREEN)
    panel(d,(1135,270,1510,560),titles[2] if len(titles)>2 else 'Outcome',pts[2] if len(pts)>2 else "Interpret the outcome only within the measured context.",ORANGE)
    arrow(d,(465,415),(610,415),BLUE); arrow(d,(990,415),(1135,415),GREEN)
    panel(d,(310,650,760,835),"Measurement / record","Record the variables that establish context, magnitude, time, and uncertainty.",BLUE)
    panel(d,(840,650,1290,835),"Evidence limit",gs[0] if gs else "Do not convert a context-dependent relationship into a universal target.",RED)

def render_comparison(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    left=labs[0] if labs else 'A'; right=labs[1] if len(labs)>1 else 'B'
    panel(d,(100,230,745,650),left,pts[0] if pts else item.get('purpose',''),GREEN)
    panel(d,(855,230,1500,650),right,pts[1] if len(pts)>1 else "Compare on the same controlled dimensions and sampling context.",BLUE)
    d.text((715,300),"↔",font=font(54,True),fill=ORANGE)
    y=700
    d.text((100,y),"Compare using:",font=font(22,True),fill=INK)
    x=280
    for lab in labs[2:6]:
        w=min(280,max(150,18*len(lab)))
        d.rounded_rectangle((x,y-8,x+w,y+42),radius=14,fill=(245,248,245),outline=LINE,width=2)
        d.text((x+14,y+5),short(lab,24),font=font(17,True),fill=INK); x+=w+18
        if x>1300: break
    panel(d,(240,790,1360,900),"Misconception guard",gs[0] if gs else "A label or appearance does not by itself establish mechanism, identity, quality, or outcome.",RED)

def render_measurement(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    steps=[
      (labs[0] if labs else 'Observe',pts[0] if pts else item.get('purpose',''),BLUE),
      (labs[1] if len(labs)>1 else 'Measure',pts[1] if len(pts)>1 else 'Use an appropriate instrument, sample, or controlled observation.',GREEN),
      (labs[2] if len(labs)>2 else 'Record','Preserve units, timing, location, method, and relevant conditions.',ORANGE),
      (labs[3] if len(labs)>3 else 'Interpret',pts[2] if len(pts)>2 else 'Compare evidence with the stated limits before acting.',GREEN),
    ]
    xs=[80,455,830,1205]
    for i,(title,body,col) in enumerate(steps):
        panel(d,(xs[i],280,xs[i]+315,610),title,body,col)
        if i<3: arrow(d,(xs[i]+315,445),(xs[i+1],445),col)
    panel(d,(230,690,1370,865),"Quality / interpretation guard",gs[0] if gs else "A measurement is evidence only when its method and context are known; one reading is not automatically a universal threshold.",RED)

def render_structure(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    panel(d,(90,235,505,650),"Structure under study",pts[0] if pts else item.get('purpose',''),GREEN)
    panel(d,(595,235,1005,650),"Function / relationship",pts[1] if len(pts)>1 else "Connect named structures to the function or process supported by the lesson evidence.",BLUE)
    panel(d,(1095,235,1510,650),"Observe / verify",pts[2] if len(pts)>2 else "Confirm identity and function with the lesson's stated observation or measurement method.",ORANGE)
    arrow(d,(505,440),(595,440),GREEN); arrow(d,(1005,440),(1095,440),BLUE)
    y=700
    d.text((90,y),"CONTROLLED LABELS",font=font(20,True),fill=INK); y+=38
    x=90
    for lab in labs:
        w=min(310,max(160,16*len(lab)))
        if x+w>1510: break
        d.rounded_rectangle((x,y,x+w,y+48),radius=14,fill=(239,246,241),outline=(181,203,188),width=2)
        d.text((x+14,y+12),short(lab,28),font=font(17,True),fill=GREEN); x+=w+16
    panel(d,(260,800,1340,905),"Interpretation guard",gs[0] if gs else "A simplified teaching map is not a scale anatomical drawing; verify structure and function in the lesson context.",RED)

def render_pedigree(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    steps=[
      (labs[0] if labs else 'Identity',pts[0] if pts else item.get('purpose',''),BLUE),
      (labs[1] if len(labs)>1 else 'Mating / inheritance',pts[1] if len(pts)>1 else 'Record the biological relationship or mating event explicitly.',GREEN),
      (labs[2] if len(labs)>2 else 'Population',pts[2] if len(pts)>2 else 'Keep family, generation, seed-lot, and individual identity separate.',ORANGE),
      (labs[3] if len(labs)>3 else 'Selection / claim','Carry only evidence-supported lineage or trait claims into the next controlled record.',GREEN),
    ]
    xs=[80,455,830,1205]
    for i,(title,body,col) in enumerate(steps):
        panel(d,(xs[i],270,xs[i]+315,620),title,body,col)
        if i<3: arrow(d,(xs[i]+315,445),(xs[i+1],445),col)
    panel(d,(220,700,1380,885),"Pedigree / naming guard",gs[0] if gs else "A name or generation label records identity history only when parentage, mating event, and source records are traceable.",RED)

def render_postharvest(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    names=(labs+['Harvest','Dry','Condition','Store'])[:4]
    bodies=[
      pts[0] if pts else item.get('purpose',''),
      pts[1] if len(pts)>1 else 'Control the relevant environment and record time, mass, temperature, humidity, and handling context.',
      pts[2] if len(pts)>2 else 'Use measured endpoints rather than calendar time alone.',
      'Protect identity, quality, safety, and traceability through packaging, storage, and verification.'
    ]
    cols=[BLUE,GREEN,ORANGE,GREEN]
    xs=[80,455,830,1205]
    for i in range(4):
        panel(d,(xs[i],270,xs[i]+315,620),names[i],bodies[i],cols[i])
        if i<3: arrow(d,(xs[i]+315,445),(xs[i+1],445),cols[i])
    panel(d,(220,700,1380,885),"Process-control guard",gs[0] if gs else "Postharvest outcomes depend on starting material, environment, time, handling, sanitation, and measurement method.",RED)

def render_environment(item,im,d):
    labs=labels(item); pts=science_points(item); gs=guards(item)
    panel(d,(90,235,500,610),labs[0] if labs else "Environmental driver",pts[0] if pts else item.get('purpose',''),BLUE)
    panel(d,(595,235,1005,610),labs[1] if len(labs)>1 else "Plant response",pts[1] if len(pts)>1 else "Response depends on genotype, developmental stage, interacting resources, duration, and tissue conditions.",GREEN)
    panel(d,(1100,235,1510,610),labs[2] if len(labs)>2 else "Measurement / decision",pts[2] if len(pts)>2 else "Measure the driver and plant response before changing a control target.",ORANGE)
    arrow(d,(500,420),(595,420),BLUE); arrow(d,(1005,420),(1100,420),GREEN)
    d.text((90,675),"RESPONSE IS CONTEXT-DEPENDENT — NO UNIVERSAL THRESHOLD IMPLIED",font=font(20,True),fill=RED)
    panel(d,(210,720,1390,890),"Evidence and target guard",gs[0] if gs else "Use measured response curves and local validation; equal setpoints can produce different tissue conditions or crop responses.",RED)

def output_name(item):
    return f"{item['lessonId']}_teaching-visual-candidate-v1.png"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--limit',type=int,default=72)
    ap.add_argument('--manifest',default='')
    args=ap.parse_args()
    q=json.loads(QUEUE.read_text(encoding='utf-8'))
    pending=[x for x in q.get('items',[]) if x.get('productionStatus')=='brief_ready_raster_artwork_needed']
    pending.sort(key=lambda x:(-int(x.get('visualPriorityScore',0)),int(x.get('number',0))))
    chosen=pending[:max(0,args.limit)]
    OUT.mkdir(parents=True,exist_ok=True)
    results=[]
    renderers={
      'diagnostic-decision-tree':render_diagnostic,
      'mechanism-process-diagram':render_mechanism,
      'comparison-matrix':render_comparison,
      'measurement-workflow':render_measurement,
      'labeled-structure-diagram':render_structure,
      'genetics-pedigree-diagram':render_pedigree,
      'postharvest-process-diagram':render_postharvest,
      'environment-response-chart':render_environment,
    }
    for item in chosen:
        im,d=canvas(item)
        renderers.get(item.get('visualFamily'),render_mechanism)(item,im,d)
        path=OUT/output_name(item)
        im.save(path,'PNG',optimize=True,dpi=(144,144))
        results.append({
          'lessonId':item['lessonId'],'number':item['number'],'title':item['title'],
          'visualFamily':item.get('visualFamily'),'visualPriorityScore':item.get('visualPriorityScore',0),
          'path':str(path.relative_to(ROOT)).replace('\\','/'),'status':'produced_pending_asset_qa'
        })
    report={
      'schemaVersion':'1.0.0','candidateOnly':True,'approvalEffect':'none',
      'pendingBefore':len(pending),'rendered':len(results),'pendingAfter':len(pending)-len(results),
      'results':results
    }
    target=Path(args.manifest) if args.manifest else ROOT/'data/encyclopedia-visual-render-last-run.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
