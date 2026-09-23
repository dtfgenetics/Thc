#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, math, os, sys

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'apps/growlens-web/public/atlas'
MIRROR=ROOT/'site/public-route-patch/atlas'
OUT_REL=Path('media/leaf-module/PA-LEAF-002-leaf-anatomy-plate.png')
REG_REL=Path('data/media-registry-v1.json')
W,H=3600,2400

def font(size,bold=False):
    candidates=[
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p,size)
    return ImageFont.load_default()

BG=(5,15,10,255); PANEL=(9,27,18,255); LINE=(121,163,135,255)
GREEN=(61,125,72,255); GREEN2=(78,148,88,255); VEIN=(178,217,158,255)
TEXT=(231,241,233,255); MUTED=(147,169,154,255); ACCENT=(185,239,143,255)
GOLD=(214,186,111,255)

im=Image.new('RGBA',(W,H),BG)
d=ImageDraw.Draw(im)

# subtle scientific grid
for x in range(0,W,120): d.line((x,0,x,H),fill=(17,42,28,90),width=1)
for y in range(0,H,120): d.line((0,y,W,y),fill=(17,42,28,90),width=1)

# header
d.text((150,110),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
d.text((150,175),'Cannabis leaf anatomy',font=font(92,True),fill=TEXT)
d.text((150,290),'Illustrative botanical plate · macroscopic structures · not to scale',font=font(34),fill=MUTED)
d.line((150,355,W-150,355),fill=LINE,width=2)

cx,cy=1830,1320

def rotate(pt,ang,origin):
    x,y=pt; ox,oy=origin
    a=math.radians(ang)
    return (ox+(x-ox)*math.cos(a)-(y-oy)*math.sin(a),
            oy+(x-ox)*math.sin(a)+(y-oy)*math.cos(a))

def leaflet_polygon(center,length,width,angle,serrations=16):
    # local axis points upward from base
    bx,by=center
    left=[]; right=[]
    for i in range(serrations+1):
        t=i/serrations
        y=by-length*t
        envelope=math.sin(math.pi*t)**0.78
        serr=1.0 + (0.13 if i%2 else -0.035)
        half=width*envelope*serr
        left.append((bx-half,y))
        right.append((bx+half,y))
    pts=left+right[::-1]
    return [rotate(p,angle,center) for p in pts]

def vein_line(base,tip,angle):
    rb=rotate(base,angle,base)
    rt=rotate(tip,angle,base)
    d.line((rb[0],rb[1],rt[0],rt[1]),fill=VEIN,width=10)

# petiole
d.line((cx,2080,cx,1580),fill=(111,162,91,255),width=46)
d.line((cx,2080,cx,1580),fill=VEIN,width=8)

# leaflets: central + paired
leaf_specs=[
    ((cx,1580),900,245,0),
    ((cx-30,1600),760,215,-39),
    ((cx+30,1600),760,215,39),
    ((cx-45,1640),620,185,-66),
    ((cx+45,1640),620,185,66),
    ((cx-55,1690),460,150,-88),
    ((cx+55,1690),460,150,88),
]
for idx,(center,length,width,angle) in enumerate(leaf_specs):
    poly=leaflet_polygon(center,length,width,angle)
    d.polygon(poly,fill=GREEN2 if idx<3 else GREEN,outline=(103,169,103,255))
    tip=(center[0],center[1]-length)
    tip=rotate(tip,angle,center)
    d.line((center[0],center[1],tip[0],tip[1]),fill=VEIN,width=8)
    # secondary veins
    for k in range(2,8):
        t=k/9
        p=(center[0],center[1]-length*t)
        pr=rotate(p,angle,center)
        spread=width*math.sin(math.pi*t)*0.72
        for side in (-1,1):
            q=(p[0]+side*spread,p[1]-length*0.035)
            qr=rotate(q,angle,center)
            d.line((pr[0],pr[1],qr[0],qr[1]),fill=(145,196,129,210),width=4)

# central attachment/rachis region
d.ellipse((cx-36,1544,cx+36,1616),fill=(133,176,96,255),outline=VEIN,width=4)

# callouts
def callout(anchor,box_xy,title,body,side='left',accent=ACCENT):
    x,y=box_xy; bw,bh=650,145
    d.rounded_rectangle((x,y,x+bw,y+bh),radius=20,fill=PANEL,outline=(74,113,86,255),width=2)
    d.text((x+24,y+20),title,font=font(31,True),fill=accent)
    d.text((x+24,y+68),body,font=font(23),fill=MUTED)
    edge=(x+bw,y+bh//2) if side=='left' else (x,y+bh//2)
    elbow=((edge[0]+anchor[0])//2,edge[1])
    d.line((anchor[0],anchor[1],elbow[0],elbow[1],edge[0],edge[1]),fill=accent,width=4)
    d.ellipse((anchor[0]-8,anchor[1]-8,anchor[0]+8,anchor[1]+8),fill=accent)

callout((cx,2000),(170,1880),'Petiole','Connects the leaf blade to the stem','left')
callout((cx-350,1120),(170,1380),'Leaflet','One blade segment of the compound fan leaf','left')
callout((cx-600,880),(170,820),'Serrated margin','Toothed outer edge of the leaflet','left')
callout((cx,1000),(2780,760),'Primary vein / midrib','Main vascular axis within a leaflet','right')
callout((cx+360,1190),(2780,1120),'Secondary venation','Branching veins distribute water and assimilates','right')
callout((cx+520,1510),(2780,1480),'Leaf blade / lamina','Broad photosynthetic tissue surface','right')

# surface insets
ix,iy=2700,1840
d.rounded_rectangle((ix,iy,3430,2260),radius=24,fill=PANEL,outline=(74,113,86,255),width=2)
d.text((ix+28,iy+25),'SURFACE ORIENTATION',font=font(25,True),fill=GOLD)
# adaxial
d.rounded_rectangle((ix+30,iy+85,ix+340,iy+340),radius=18,fill=(53,116,65,255))
for yy in range(iy+115,iy+320,48):
    d.line((ix+60,yy,ix+310,yy+18),fill=(97,155,97,180),width=4)
d.text((ix+55,iy+352),'Adaxial (upper)',font=font(23,True),fill=TEXT)
# abaxial
d.rounded_rectangle((ix+390,iy+85,ix+700,iy+340),radius=18,fill=(75,127,79,255))
for yy in range(iy+120,iy+320,55):
    for xx in range(ix+425,ix+680,60):
        d.ellipse((xx-8,yy-5,xx+8,yy+5),outline=(180,220,170,220),width=3)
d.text((ix+420,iy+352),'Abaxial (lower)',font=font(23,True),fill=TEXT)
d.text((ix+390,iy+390),'Stomata are commonly concentrated on the lower surface;',font=font(18),fill=MUTED)

# footer / disclaimer
d.line((150,2290,W-150,2290),fill=LINE,width=2)
d.text((150,2320),'Teaching Healthy Cultivation · DTF Genetics',font=font(24,True),fill=TEXT)
footer='Illustrative reference. Tissue-level structure varies with development and genotype; use microscopy for cellular-scale study.'
bbox=d.textbbox((0,0),footer,font=font(20))
d.text((W-150-(bbox[2]-bbox[0]),2324),footer,font=font(20),fill=MUTED)

# metadata
im.info['Description']='THC Living Plant Atlas illustrative Cannabis leaf anatomy plate'
im.info['Author']='DTF Genetics / Teaching Healthy Cultivation'
for base in (APP,MIRROR):
    out=base/OUT_REL
    out.parent.mkdir(parents=True,exist_ok=True)
    im.convert('RGB').save(out,'PNG',optimize=True)

asset={
  'assetId':'PA-LEAF-002',
  'entityId':'leaf-module',
  'class':'labeled-botanical-plate',
  'src':'/atlas/'+str(OUT_REL).replace('\\','/'),
  'source':'Original THC Living Plant Atlas educational illustration based on standard Cannabis macroscopic leaf anatomy terminology.',
  'creator':'DTF Genetics / Teaching Healthy Cultivation',
  'license':'DTF Genetics original educational asset',
  'captureType':'illustration',
  'plantStage':'general mature leaf anatomy',
  'organ':'Cannabis compound fan leaf',
  'illustrativeOrMeasured':'illustrative',
  'alt':'Illustrative Cannabis fan leaf anatomy plate labeling petiole, leaflets, serrated margins, leaf blade, primary vein, secondary venation, and upper and lower leaf surfaces.',
  'title':'Cannabis leaf anatomy plate',
  'sourcePage':'/atlas/leaf-module/',
  'notes':'Illustrative, not to scale; no measured microscopy claims.'
}
reg=json.loads((APP/REG_REL).read_text())
rec=next((r for r in reg['records'] if r['entityId']=='leaf-module'),None)
if not rec:
    raise SystemExit('leaf-module media record missing')
idx=next((i for i,a in enumerate(rec['assets']) if a['assetId']==asset['assetId']),None)
if idx is None: rec['assets'].append(asset)
else: rec['assets'][idx]=asset
have={a['class'] for a in rec['assets']}
rec['status']='approved' if all(k in have for k in rec['required']) else 'in-production'
for base in (APP,MIRROR):
    (base/REG_REL).write_text(json.dumps(reg,indent=2)+'\n')
print(f'Built {OUT_REL} at {W}x{H}; leaf-module status={rec["status"]}; classes={sorted(have)}')


# ---- Stomatal surface educational assets ----
def draw_guard_pair(draw, center, aperture, cell_h=520, cell_w=165, fill=(99,167,102,255), outline=(190,226,173,255)):
    cx0,cy0=center
    # surrounding epidermal-cell guide network
    for dx,dy in [(-430,-250),(0,-300),(430,-240),(-460,80),(450,100),(-360,330),(30,350),(380,320)]:
        draw.rounded_rectangle((cx0+dx-150,cy0+dy-90,cx0+dx+150,cy0+dy+90),radius=55,outline=(77,113,82,150),width=5)
    # two guard cells as thick curved capsules
    for side in (-1,1):
        gx=cx0+side*(aperture/2+cell_w*.70)
        box=(gx-cell_w,cy0-cell_h/2,gx+cell_w,cy0+cell_h/2)
        draw.ellipse(box,fill=fill,outline=outline,width=8)
        cut_shift=side*(-cell_w*.62)
        cut=(gx-cell_w*.62+cut_shift,cy0-cell_h*.34,gx+cell_w*.62+cut_shift,cy0+cell_h*.34)
        draw.ellipse(cut,fill=PANEL)
    # pore
    draw.rounded_rectangle((cx0-aperture/2,cy0-cell_h*.28,cx0+aperture/2,cy0+cell_h*.28),radius=max(8,int(aperture/2)),fill=(2,8,5,255),outline=(127,178,130,180),width=4)

def build_stoma_plate():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG); dr=ImageDraw.Draw(img)
    for x in range(0,sw,120): dr.line((x,0,x,sh),fill=(17,42,28,90),width=1)
    for y in range(0,sh,120): dr.line((0,y,sw,y),fill=(17,42,28,90),width=1)
    dr.text((150,110),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,175),'Stomatal opening and closure',font=font(82,True),fill=TEXT)
    dr.text((150,285),'Illustrative guard-cell states · conceptual physiology · not to scale',font=font(34),fill=MUTED)
    dr.line((150,355,sw-150,355),fill=LINE,width=2)
    panels=[(180,520,1710,'OPEN','Higher guard-cell turgor'),(3420-1710,1890,1710,'CLOSED','Lower guard-cell turgor')]
    # explicit panel geometry
    for x0,title,aperture,sub in [(160,'OPEN',190,'Pore open for gas exchange'),(1830,'CLOSED',28,'Pore narrowed / closed')]:
        dr.rounded_rectangle((x0,470,x0+1610,1910),radius=32,fill=PANEL,outline=(74,113,86,255),width=3)
        dr.text((x0+60,520),title,font=font(46,True),fill=ACCENT if title=='OPEN' else GOLD)
        dr.text((x0+60,590),sub,font=font(28),fill=MUTED)
        draw_guard_pair(dr,(x0+805,1160),aperture)
        dr.text((x0+610,1580),'guard cells',font=font(26,True),fill=TEXT)
        dr.line((x0+760,1548,x0+690,1395),fill=ACCENT,width=4)
        dr.text((x0+650,1690),'stomatal pore',font=font(26,True),fill=TEXT)
        dr.line((x0+800,1660,x0+805,1420),fill=ACCENT,width=4)
        dr.text((x0+60,1815),'surrounding epidermal cells',font=font(23),fill=MUTED)
    # conceptual flux arrows in open panel
    dr.line((560,880,820,1040),fill=(126,201,223,255),width=14); dr.polygon([(820,1040),(775,1010),(800,980)],fill=(126,201,223,255))
    dr.text((380,810),'CO₂ in',font=font(27,True),fill=(126,201,223,255))
    dr.line((1080,1040,1340,880),fill=(214,186,111,255),width=14); dr.polygon([(1340,880),(1285,892),(1310,925)],fill=(214,186,111,255))
    dr.text((1300,810),'H₂O vapor out',font=font(27,True),fill=GOLD)
    dr.line((150,2030,sw-150,2030),fill=LINE,width=2)
    note='Conceptual illustration: aperture responds to guard-cell water status and ion/osmotic regulation; real responses depend on light, CO₂, humidity/VPD, ABA and plant water status.'
    dr.text((150,2080),note,font=font(24),fill=MUTED)
    dr.text((150,2200),'Teaching Healthy Cultivation · DTF Genetics',font=font(24,True),fill=TEXT)
    dr.text((150,2250),'Use measured microscopy for cell dimensions or stomatal-density claims.',font=font(21),fill=MUTED)
    rel=Path('media/stomatal-surface/PA-STOMA-002-open-closed-stomata-plate.png')
    for base in (APP,MIRROR):
        out=base/rel; out.parent.mkdir(parents=True,exist_ok=True); img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

def build_stoma_sequence():
    sw,sh=3600,1500
    img=Image.new('RGBA',(sw,sh),BG); dr=ImageDraw.Draw(img)
    dr.text((120,80),'THC LIVING PLANT ATLAS',font=font(34,True),fill=ACCENT)
    dr.text((120,140),'Conceptual stomatal response sequence',font=font(66,True),fill=TEXT)
    dr.text((120,235),'Open → decreasing guard-cell turgor → partial closure → closed',font=font(28),fill=MUTED)
    apertures=[190,125,70,22]
    titles=['1 · Open','2 · Turgor decreasing','3 · Partial closure','4 · Closed']
    for i,(ap,title) in enumerate(zip(apertures,titles)):
        x=100+i*875
        dr.rounded_rectangle((x,350,x+800,1280),radius=28,fill=PANEL,outline=(74,113,86,255),width=3)
        dr.text((x+35,390),title,font=font(28,True),fill=ACCENT if i<2 else GOLD)
        draw_guard_pair(dr,(x+400,820),ap,cell_h=390,cell_w=120)
        if i<3:
            dr.text((x+770,770),'→',font=font(58,True),fill=LINE)
    dr.text((120,1360),'Illustrative sequence · not a time-calibrated simulation · guard-cell behavior is context dependent.',font=font(24),fill=MUTED)
    rel=Path('media/stomatal-surface/PA-STOMA-003-stomatal-response-sequence.png')
    for base in (APP,MIRROR):
        out=base/rel; out.parent.mkdir(parents=True,exist_ok=True); img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

stoma_plate=build_stoma_plate()
stoma_sequence=build_stoma_sequence()
reg=json.loads((APP/REG_REL).read_text())
srec=next((r for r in reg['records'] if r['entityId']=='stomatal-surface'),None)
if not srec: raise SystemExit('stomatal-surface media record missing')
assets=[
 {'assetId':'PA-STOMA-002','entityId':'stomatal-surface','class':'labeled-botanical-plate','src':'/atlas/'+str(stoma_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration based on standard stomatal anatomy and guard-cell physiology.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'general leaf physiology','organ':'stomatal complex / leaf epidermis','illustrativeOrMeasured':'illustrative','alt':'Illustrative open and closed stomatal complexes showing guard cells, stomatal pore, surrounding epidermal cells, and conceptual gas exchange arrows.','title':'Open and closed stomata plate','sourcePage':'/atlas/leaf-module/stomata/','notes':'Illustrative, not to scale; not measured microscopy.'},
 {'assetId':'PA-STOMA-003','entityId':'stomatal-surface','class':'animation-sequence','src':'/atlas/'+str(stoma_sequence).replace('\\','/'),'source':'Original THC Living Plant Atlas educational sequence based on standard guard-cell physiology.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration sequence','plantStage':'general leaf physiology','organ':'stomatal complex / leaf epidermis','illustrativeOrMeasured':'illustrative','alt':'Four-stage illustrative stomatal response sequence from open pore through decreasing guard-cell turgor and partial closure to closed pore.','title':'Stomatal response sequence','sourcePage':'/atlas/leaf-module/stomata/','notes':'Conceptual sequence, not time calibrated and not measured microscopy.'}
]
for asset in assets:
    found=next((i for i,a in enumerate(srec['assets']) if a['assetId']==asset['assetId']),None)
    if found is None: srec['assets'].append(asset)
    else: srec['assets'][found]=asset
have={a['class'] for a in srec['assets']}
srec['status']='approved' if all(k in have for k in srec['required']) else 'in-production'
for base in (APP,MIRROR):
    (base/REG_REL).write_text(json.dumps(reg,indent=2)+'\n')
print(f'Built stomatal assets: {stoma_plate}, {stoma_sequence}; status={srec["status"]}; missing={[k for k in srec["required"] if k not in have]}')
