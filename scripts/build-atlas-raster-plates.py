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
