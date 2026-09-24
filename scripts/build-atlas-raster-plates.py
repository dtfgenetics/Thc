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


# ---- Root system + uptake educational assets ----
def root_label(draw, anchor, box, title, body, side='left', accent=ACCENT):
    x,y=box; bw,bh=700,145
    draw.rounded_rectangle((x,y,x+bw,y+bh),radius=20,fill=PANEL,outline=(74,113,86,255),width=2)
    draw.text((x+24,y+18),title,font=font(31,True),fill=accent)
    draw.text((x+24,y+67),body,font=font(22),fill=MUTED)
    edge=(x+bw,y+bh//2) if side=='left' else (x,y+bh//2)
    elbow=((edge[0]+anchor[0])//2,edge[1])
    draw.line((anchor[0],anchor[1],elbow[0],elbow[1],edge[0],edge[1]),fill=accent,width=4)
    draw.ellipse((anchor[0]-8,anchor[1]-8,anchor[0]+8,anchor[1]+8),fill=accent)

def branch_root(draw, pts, width, fill, seed=0):
    draw.line(pts,fill=fill,width=width,joint='curve')
    # small lateral branches distributed along the main segment
    for i in range(1,len(pts)-1):
        x,y=pts[i]
        for side in (-1,1):
            dx=(70+22*i)*side
            dy=90+30*((i+seed)%3)
            draw.line((x,y,x+dx,y+dy),fill=fill,width=max(3,width//3))
            if width>18:
                draw.line((x+dx,y+dy,x+dx+40*side,y+dy+72),fill=(170,196,154,230),width=3)

def build_root_architecture():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG); dr=ImageDraw.Draw(img)
    for x in range(0,sw,120): dr.line((x,0,x,sh),fill=(17,42,28,90),width=1)
    for y in range(0,sh,120): dr.line((0,y,sw,y),fill=(17,42,28,90),width=1)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),'Cannabis root-system architecture',font=font(82,True),fill=TEXT)
    dr.text((150,280),'Illustrative architecture · relative proportions vary with genotype, stage, substrate and container geometry',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)

    cx=1830
    # substrate horizon
    dr.line((880,660,2780,660),fill=(159,128,89,210),width=7)
    dr.text((920,610),'ROOT-ZONE / SUBSTRATE INTERFACE',font=font(22,True),fill=GOLD)
    # stem and crown
    dr.line((cx,410,cx,680),fill=(77,137,74,255),width=64)
    dr.ellipse((cx-90,610,cx+90,760),fill=(113,139,92,255),outline=(190,211,168,255),width=4)
    root=(205,196,169,255); fine=(186,207,172,245)
    # primary structural root
    primary=[(cx,700),(cx-20,930),(cx+20,1190),(cx-35,1470),(cx+10,1780),(cx-55,2150)]
    branch_root(dr,primary,34,root,1)
    # major laterals
    laterals=[
      [(cx-5,900),(1510,1030),(1240,1240),(1020,1510),(870,1810)],
      [(cx+5,940),(2150,1050),(2400,1270),(2600,1510),(2730,1780)],
      [(cx-15,1200),(1450,1320),(1270,1530),(1170,1800),(1090,2080)],
      [(cx+10,1290),(2180,1400),(2370,1600),(2460,1880),(2520,2140)],
      [(cx-25,1530),(1600,1680),(1510,1930),(1460,2200)],
      [(cx+10,1600),(2050,1760),(2110,2000),(2140,2220)]
    ]
    for i,p in enumerate(laterals): branch_root(dr,p,20,root,i)
    # fine root web
    for j in range(22):
        y=920+j*55
        side=-1 if j%2==0 else 1
        x0=cx+side*(80+(j%5)*60)
        x1=x0+side*(220+35*(j%4))
        dr.line((x0,y,x1,y+110+(j%3)*30),fill=fine,width=5)

    root_label(dr,(cx,690),(130,560),'Root crown','Stem-to-root transition zone','left')
    root_label(dr,(cx,1220),(130,930),'Primary structural axis','Major descending root framework','left')
    root_label(dr,(1190,1450),(130,1300),'Lateral roots','Branches expand explored root-zone volume','left')
    root_label(dr,(2380,1640),(2780,1210),'Fine roots','High-surface-area absorbing network','right')
    root_label(dr,(cx-55,2150),(2780,1640),'Root tip','Active growth front at distal root ends','right')
    root_label(dr,(1070,2040),(2780,1940),'Absorbing region','Young fine-root regions support water/ion uptake','right')

    dr.line((150,2280,sw-150,2280),fill=LINE,width=2)
    dr.text((150,2315),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path('media/root-system/PA-ROOT-002-root-architecture-plate.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

def arrow(draw,a,b,color,width=18):
    draw.line((a[0],a[1],b[0],b[1]),fill=color,width=width)
    ang=math.atan2(b[1]-a[1],b[0]-a[0])
    size=38
    left=(b[0]-size*math.cos(ang-math.pi/6),b[1]-size*math.sin(ang-math.pi/6))
    right=(b[0]-size*math.cos(ang+math.pi/6),b[1]-size*math.sin(ang+math.pi/6))
    draw.polygon([b,left,right],fill=color)

def build_root_to_shoot():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG);dr=ImageDraw.Draw(img)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),'Root-to-shoot water pathway',font=font(82,True),fill=TEXT)
    dr.text((150,280),'Conceptual hydraulic pathway · water potential gradients drive flow; transport is not an active pump',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)
    water=(106,194,222,255); mineral=(211,184,111,255)
    steps=[
      (330,1220,'01','Rhizosphere','Water + dissolved ions'),
      (900,1220,'02','Fine roots','Radial entry through young absorbing tissue'),
      (1470,1220,'03','Root xylem','Axial transport enters vascular system'),
      (2040,1220,'04','Stem xylem','Continuous upward water column'),
      (2610,1220,'05','Leaf veins','Water distributed through venation'),
      (3180,1220,'06','Mesophyll → stomata','Evaporation and vapor loss to air')
    ]
    for x,y,n,title,body in steps:
        dr.rounded_rectangle((x-235,y-250,x+235,y+250),radius=28,fill=PANEL,outline=(74,113,86,255),width=3)
        dr.ellipse((x-44,y-190,x+44,y-102),fill=water)
        dr.text((x-24,y-176),n,font=font(25,True),fill=BG)
        dr.text((x-190,y-55),title,font=font(30,True),fill=TEXT)
        # wrap body manually
        words=body.split(); lines=[]; line=''
        for w in words:
            test=(line+' '+w).strip()
            if dr.textbbox((0,0),test,font=font(20))[2]>380:
                lines.append(line);line=w
            else: line=test
        if line: lines.append(line)
        for k,line in enumerate(lines[:3]): dr.text((x-190,y+10+k*34),line,font=font(20),fill=MUTED)
    for i in range(len(steps)-1):
        arrow(dr,(steps[i][0]+235,1220),(steps[i+1][0]-235,1220),water,16)
    # context rows
    dr.rounded_rectangle((200,520,3400,800),radius=26,fill=(7,20,14,255),outline=(66,107,80,255),width=2)
    dr.text((260,565),'DRIVING CONTEXT',font=font(24,True),fill=ACCENT)
    contexts=['substrate water status','root hydraulic conductance','xylem continuity','leaf energy balance','VPD / humidity','stomatal aperture']
    for i,t in enumerate(contexts):
        x=260+(i%3)*1040;y=625+(i//3)*75
        dr.text((x,y),'• '+t,font=font(24),fill=TEXT)
    dr.rounded_rectangle((240,1640,3360,2050),radius=28,fill=PANEL,outline=(74,113,86,255),width=3)
    dr.text((300,1690),'NUTRIENT NOTE',font=font(24,True),fill=GOLD)
    note1='Many mineral ions move toward roots with mass flow and diffusion, cross root tissues selectively, and can enter xylem transport.'
    note2='Visual wilt, tip burn, or deficiency-like patterns do not by themselves prove where this pathway is failing.'
    dr.text((300,1760),note1,font=font(26),fill=TEXT)
    dr.text((300,1825),note2,font=font(26),fill=MUTED)
    dr.text((300,1935),'Interpret with substrate moisture, pH/EC, root condition, temperature, humidity/VPD, light and time course.',font=font(23),fill=MUTED)
    dr.line((150,2240,sw-150,2240),fill=LINE,width=2)
    dr.text((150,2280),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path('media/root-system/PA-ROOT-003-root-to-shoot-water-pathway.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

def build_root_tip_plate():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG);dr=ImageDraw.Draw(img)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),'Root-tip developmental zones',font=font(82,True),fill=TEXT)
    dr.text((150,280),'Illustrative longitudinal view · developmental boundaries are gradual, not hard anatomical lines',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)
    # central root cylinder
    x0,x1=1370,2230
    zones=[
      (1750,2190,(143,126,92,255),'Root cap'),
      (1430,1750,(99,150,97,255),'Apical meristem'),
      (1000,1430,(76,139,82,255),'Elongation zone'),
      (520,1000,(57,119,72,255),'Differentiation / maturation zone')
    ]
    for top,bottom,color,label in zones:
        dr.rounded_rectangle((x0,top,x1,bottom),radius=95,fill=color,outline=(186,211,172,255),width=4)
        dr.text((x0+80,(top+bottom)//2-25),label,font=font(28,True),fill=TEXT)
    # tapered tip
    dr.polygon([(x0,2190),(x1,2190),(1800,2320)],fill=(143,126,92,255))
    # root hairs in maturation zone
    for i in range(18):
        y=570+i*23
        length=110+(i%4)*36
        dr.line((x0,y,x0-length,y+(-18 if i%2 else 18)),fill=(203,215,190,255),width=5)
        dr.line((x1,y,x1+length,y+(18 if i%2 else -18)),fill=(203,215,190,255),width=5)
    # internal cell guides
    for y in range(1080,1690,80): dr.line((x0+160,y,x1-160,y),fill=(163,199,152,130),width=3)
    root_label(dr,(1800,2260),(120,1810),'Root cap','Protective tissue at the advancing tip','left',GOLD)
    root_label(dr,(1810,1600),(120,1440),'Apical meristem','Region of active cell division','left')
    root_label(dr,(1810,1190),(120,1030),'Elongation zone','New cells increase in length','left')
    root_label(dr,(1420,720),(2780,590),'Root-hair region','Differentiated epidermal cells increase surface area','right')
    root_label(dr,(1810,780),(2780,970),'Maturation zone','Tissues differentiate toward specialized functions','right')
    dr.rounded_rectangle((2600,1510,3400,2040),radius=24,fill=PANEL,outline=(74,113,86,255),width=2)
    dr.text((2650,1560),'OBSERVATION RULE',font=font(24,True),fill=ACCENT)
    rules=['Young tips are often pale/cream.','Root hairs are delicate and transient.','Browning alone is not a diagnosis.','Interpret with oxygen, moisture, temperature, pathogens and time.']
    for i,t in enumerate(rules): dr.text((2650,1640+i*80),'• '+t,font=font(22),fill=TEXT if i<2 else MUTED)
    dr.line((150,2280,sw-150,2280),fill=LINE,width=2)
    dr.text((150,2315),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path('media/root-tip/PA-RTIP-003-root-tip-anatomy-plate.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

root_arch=build_root_architecture()
root_flow=build_root_to_shoot()
root_tip_plate=build_root_tip_plate()
reg=json.loads((APP/REG_REL).read_text())
rootrec=next((r for r in reg['records'] if r['entityId']=='root-system'),None)
tiprec=next((r for r in reg['records'] if r['entityId']=='root-tip'),None)
if not rootrec or not tiprec: raise SystemExit('root media records missing')
root_assets=[
 {'assetId':'PA-ROOT-002','entityId':'root-system','class':'labeled-botanical-plate','src':'/atlas/'+str(root_arch).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration based on general Cannabis/hemp root-system architecture and plant root morphology.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'general established plant','organ':'Cannabis root system','illustrativeOrMeasured':'illustrative','alt':'Illustrative Cannabis root-system plate labeling root crown, primary structural axis, lateral roots, fine roots, root tips, and absorbing regions.','title':'Cannabis root-system architecture plate','sourcePage':'/atlas/root-system/','notes':'Illustrative, not to scale; root architecture varies strongly with genotype and growing environment.'},
 {'assetId':'PA-ROOT-003','entityId':'root-system','class':'process-diagram','src':'/atlas/'+str(root_flow).replace('\\','/'),'source':'Original THC Living Plant Atlas process diagram based on established plant water-transport physiology.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'general active growth','organ':'root-to-shoot hydraulic pathway','illustrativeOrMeasured':'illustrative','alt':'Conceptual root-to-shoot water pathway from rhizosphere through fine roots, root and stem xylem, leaf veins, mesophyll, and stomata.','title':'Root-to-shoot water pathway','sourcePage':'/atlas/water-relations/','notes':'Conceptual hydraulic pathway, not a quantitative flow model.'}
]
for asset in root_assets:
    idx=next((i for i,a in enumerate(rootrec['assets']) if a['assetId']==asset['assetId']),None)
    if idx is None: rootrec['assets'].append(asset)
    else: rootrec['assets'][idx]=asset
tipasset={'assetId':'PA-RTIP-003','entityId':'root-tip','class':'labeled-botanical-plate','src':'/atlas/'+str(root_tip_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration based on standard angiosperm root-tip developmental anatomy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'actively growing root tip','organ':'root tip / young absorbing root','illustrativeOrMeasured':'illustrative','alt':'Illustrative longitudinal root-tip plate showing root cap, apical meristem, elongation zone, differentiation and maturation zone, and root hairs.','title':'Root-tip developmental zones','sourcePage':'/atlas/root-system/','notes':'Illustrative, not to scale; developmental zone boundaries are gradual.'}
idx=next((i for i,a in enumerate(tiprec['assets']) if a['assetId']==tipasset['assetId']),None)
if idx is None: tiprec['assets'].append(tipasset)
else: tiprec['assets'][idx]=tipasset
for recx in (rootrec,tiprec):
    have={a['class'] for a in recx['assets']}
    recx['status']='approved' if all(k in have for k in recx['required']) else 'in-production'
for base in (APP,MIRROR):
    (base/REG_REL).write_text(json.dumps(reg,indent=2)+'\n')
print('Built root assets:',root_arch,root_flow,root_tip_plate,'root-status=',rootrec['status'],'tip-status=',tiprec['status'])


# ---- Flower + trichome educational assets ----
def build_flower_anatomy_plate():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG);dr=ImageDraw.Draw(img)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),'Female flower anatomy',font=font(82,True),fill=TEXT)
    dr.text((150,280),'Illustrative Cannabis inflorescence map · macroscopic structures · not to scale',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)
    cx,cy=1800,1330
    # inflorescence axis
    dr.line((cx,2050,cx,720),fill=(80,137,73,255),width=74)
    # stacked bracts + sugar leaves
    for row,y in enumerate(range(1750,760,-150)):
        span=420-row*28
        for side in (-1,1):
            bx=cx+side*(150+(row%2)*45)
            pts=[(bx,y+80),(bx+side*span,y),(bx+side*(span*.45),y-145),(bx,y-40)]
            dr.polygon(pts,fill=(61,126,68,255),outline=(120,181,111,255))
        # bract bodies
        for side in (-1,1):
            bx=cx+side*(95+(row%3)*24)
            dr.ellipse((bx-115,y-120,bx+115,y+90),fill=(87,139,76,255),outline=(159,200,139,255),width=4)
            # stigmas
            for off in (-28,24):
                sx=bx+off; sy=y-78
                dr.arc((sx-70,sy-125,sx+70,sy+15),200 if side<0 else -20,330 if side<0 else 110,fill=(225,205,173,255),width=9)
    # top meristem/floral cluster
    dr.ellipse((cx-220,570,cx+220,930),fill=(94,150,80,255),outline=(176,211,155,255),width=4)
    # trichome dots
    for yy in range(780,1740,70):
        for xx in range(cx-240,cx+250,70):
            if (xx+yy)%3:
                dr.ellipse((xx-8,yy-8,xx+8,yy+8),fill=(220,235,205,230))
    root_label(dr,(cx,1870),(120,1760),'Inflorescence axis','Central support for clustered floral organs','left')
    root_label(dr,(cx-180,1410),(120,1290),'Bract','Leaf-like floral structure surrounding pistillate tissue','left')
    root_label(dr,(cx+430,1210),(2760,1040),'Sugar leaf','Small leaf associated with the floral cluster','right')
    root_label(dr,(cx+70,970),(2760,710),'Stigma','Pollen-receptive surface extending from the pistillate flower','right',GOLD)
    root_label(dr,(cx-65,1510),(2760,1390),'Pistillate flower','Female floral unit nested within the inflorescence','right')
    root_label(dr,(cx+210,1590),(120,820),'Trichome-bearing surface','Resin glands are abundant on bracts and sugar leaves','left')
    dr.rounded_rectangle((2520,1760,3420,2180),radius=24,fill=PANEL,outline=(74,113,86,255),width=2)
    dr.text((2580,1810),'STRUCTURE → SCALE',font=font(24,True),fill=ACCENT)
    for i,t in enumerate(['Flower cluster','Bract / sugar leaf','Stigma / ovary region','Trichome-bearing epidermis','Glandular trichome']):
        dr.text((2580,1880+i*52),('→ ' if i else '• ')+t,font=font(22),fill=TEXT if i<2 else MUTED)
    dr.line((150,2280,sw-150,2280),fill=LINE,width=2)
    dr.text((150,2315),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path('media/flower-anatomy/PA-FLOWER-003-flower-anatomy-plate.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

def build_bract_plate():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG);dr=ImageDraw.Draw(img)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),'Bract anatomy and context',font=font(82,True),fill=TEXT)
    dr.text((150,280),'Illustrative Cannabis floral bract · tissue relationships · not to scale',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)
    cx,cy=1800,1280
    # bract as teardrop
    pts=[]
    for i in range(80):
        t=i/79
        y=1950-1350*t
        half=520*(math.sin(math.pi*t)**0.72)*(1-0.24*t)
        pts.append((cx-half,y))
    pts += [(2*cx-x,y) for x,y in pts[::-1]]
    dr.polygon(pts,fill=(67,128,73,255),outline=(154,199,139,255))
    dr.line((cx,1900,cx,690),fill=VEIN,width=12)
    for y in range(900,1750,150):
        width=400*(1-abs(1325-y)/700)
        dr.line((cx,y,cx-width,y-90),fill=(139,187,127,210),width=5)
        dr.line((cx,y,cx+width,y-90),fill=(139,187,127,210),width=5)
    # ovary/pistillate tissue inside
    dr.ellipse((cx-170,1280,cx+170,1730),fill=(126,143,88,255),outline=(211,190,132,255),width=5)
    # stigmas
    dr.arc((cx-260,860,cx+20,1330),190,330,fill=(231,210,180,255),width=14)
    dr.arc((cx-20,860,cx+260,1330),210,350,fill=(231,210,180,255),width=14)
    # trichomes
    for a in range(-150,151,30):
        tx=cx+a*2.4; ty=1040+abs(a)*2
        dr.line((tx,ty,tx,ty-55),fill=(223,236,208,255),width=4)
        dr.ellipse((tx-12,ty-78,tx+12,ty-54),fill=(232,240,214,255))
    root_label(dr,(cx,1840),(120,1700),'Bract base','Attachment to the floral axis','left')
    root_label(dr,(cx-420,1220),(120,1080),'Bract blade','Protective leaf-like floral tissue','left')
    root_label(dr,(cx,1510),(2780,1450),'Ovary / ovule region','Pistillate reproductive tissue lies within','right',GOLD)
    root_label(dr,(cx+120,1120),(2780,920),'Stigmas','Extend outward as pollen-receptive surfaces','right')
    root_label(dr,(cx,990),(2780,610),'Trichome-bearing epidermis','Dense glandular trichomes commonly occur on bract surfaces','right')
    dr.line((150,2280,sw-150,2280),fill=LINE,width=2)
    dr.text((150,2315),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path('media/bract/PA-BRACT-002-bract-anatomy-plate.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

def build_stigma_plate():
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG);dr=ImageDraw.Draw(img)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),'Stigma and pistillate context',font=font(82,True),fill=TEXT)
    dr.text((150,280),'Illustrative reproductive anatomy · stigma morphology changes with age and pollination status',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)
    cx=1800
    # ovary and bract
    dr.ellipse((cx-350,1350,cx+350,2050),fill=(116,136,81,255),outline=(204,189,128,255),width=6)
    dr.polygon([(cx-720,1900),(cx-520,980),(cx,760),(cx+520,980),(cx+720,1900),(cx,2170)],fill=(58,119,68,190),outline=(140,188,127,255))
    # two stigmas
    for side in (-1,1):
        pts=[(cx+side*70,1420),(cx+side*180,1120),(cx+side*330,900),(cx+side*430,610)]
        dr.line(pts,fill=(235,218,190,255),width=24,joint='curve')
        # papillate texture
        for k in range(10):
            x=cx+side*(150+28*k);y=1170-55*k
            dr.ellipse((x-13,y-13,x+13,y+13),fill=(245,228,200,255))
    root_label(dr,(cx+420,650),(2760,550),'Stigma surface','Pollen-receptive outer tissue','right',GOLD)
    root_label(dr,(cx+170,1100),(2760,900),'Stigma branch','Extends from the pistillate flower','right')
    root_label(dr,(cx,1710),(120,1590),'Ovary region','Contains ovule-bearing reproductive tissue','left')
    root_label(dr,(cx-560,1400),(120,1190),'Bract','Surrounding floral tissue','left')
    dr.rounded_rectangle((2450,1510,3400,2070),radius=24,fill=PANEL,outline=(74,113,86,255),width=2)
    dr.text((2510,1560),'OBSERVATION RULE',font=font(24,True),fill=ACCENT)
    rules=['Color alone does not prove pollination.','Age, humidity and tissue damage alter appearance.','Use flower context and time course.','Microscopy is needed for cellular-scale claims.']
    for i,t in enumerate(rules):dr.text((2510,1640+i*82),'• '+t,font=font(22),fill=TEXT if i<2 else MUTED)
    dr.line((150,2280,sw-150,2280),fill=LINE,width=2)
    dr.text((150,2315),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path('media/stigma/PA-STIGMA-003-stigma-anatomy-plate.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

def build_trichome_plate(entity_dir, asset_id, title, focus='whole'):
    sw,sh=3600,2400
    img=Image.new('RGBA',(sw,sh),BG);dr=ImageDraw.Draw(img)
    dr.text((150,105),'THC LIVING PLANT ATLAS',font=font(38,True),fill=ACCENT)
    dr.text((150,170),title,font=font(78,True),fill=TEXT)
    dr.text((150,280),'Illustrative glandular trichome anatomy · informed by Cannabis microscopy · not to scale',font=font(31),fill=MUTED)
    dr.line((150,350,sw-150,350),fill=LINE,width=2)
    cx=1800
    # epidermis
    dr.rounded_rectangle((900,1860,2700,2100),radius=80,fill=(55,110,64,255),outline=(132,178,122,255),width=5)
    for x in range(1000,2600,190):
        dr.line((x,1870,x+80,2085),fill=(103,157,103,130),width=3)
    # stalk
    dr.rounded_rectangle((1615,960,1985,1885),radius=150,fill=(88,139,82,255),outline=(176,211,158,255),width=6)
    # cell guides
    for y in range(1110,1800,150):dr.line((1640,y,1960,y),fill=(145,190,135,170),width=4)
    # narrow neck
    dr.rounded_rectangle((1705,830,1895,1080),radius=75,fill=(110,154,91,255),outline=(190,218,170,255),width=5)
    # gland head
    dr.ellipse((1280,380,2320,1080),fill=(180,191,122,235),outline=(231,230,182,255),width=8)
    # disc cells
    for x in range(1450,2200,180):
        dr.ellipse((x-90,830,x+90,1010),fill=(112,151,88,255),outline=(193,211,152,255),width=4)
    # cuticular cavity highlight
    dr.arc((1370,430,2230,970),190,350,fill=(245,237,194,255),width=14)
    if focus=='whole':
        root_label(dr,(1800,1950),(120,1770),'Epidermal base','Trichome emerges from the organ surface','left')
        root_label(dr,(1800,1450),(120,1300),'Multicellular stalk','Supports the secretory head','left')
        root_label(dr,(1800,900),(2780,1230),'Neck / stipe region','Constriction between stalk and secretory head','right')
        root_label(dr,(1800,650),(2780,720),'Glandular head','Secretory disc cells lie beneath the cuticle','right',GOLD)
    else:
        root_label(dr,(1800,890),(120,1240),'Secretory disc cells','Specialized cells associated with metabolite biosynthesis','left')
        root_label(dr,(1800,520),(2780,520),'Cuticle / storage cavity','Secreted metabolites accumulate beneath the cuticular envelope','right',GOLD)
        root_label(dr,(1800,990),(2780,1180),'Stipe / neck','Connects gland head to stalk','right')
    dr.rounded_rectangle((240,520,950,970),radius=24,fill=PANEL,outline=(74,113,86,255),width=2)
    dr.text((290,565),'SCALE NOTE',font=font(24,True),fill=ACCENT)
    dr.text((290,640),'Use measured microscopy for',font=font(22),fill=TEXT)
    dr.text((290,690),'size, density, maturity or',font=font(22),fill=TEXT)
    dr.text((290,740),'cell-count claims.',font=font(22),fill=TEXT)
    dr.text((290,820),'This plate is explanatory.',font=font(22),fill=MUTED)
    dr.line((150,2280,sw-150,2280),fill=LINE,width=2)
    dr.text((150,2315),'Teaching Healthy Cultivation · DTF Genetics',font=font(23,True),fill=TEXT)
    rel=Path(f'media/{entity_dir}/{asset_id}.png')
    for base in (APP,MIRROR):
        out=base/rel;out.parent.mkdir(parents=True,exist_ok=True);img.convert('RGB').save(out,'PNG',optimize=True)
    return rel

flower_plate=build_flower_anatomy_plate()
bract_plate=build_bract_plate()
stigma_plate=build_stigma_plate()
trich_plate=build_trichome_plate('trichomes-resin','PA-TRICH-003-trichome-anatomy-plate','Glandular trichome anatomy','whole')
cst_plate=build_trichome_plate('capitate-stalked-trichome','PA-CST-002-capitate-stalked-trichome-plate','Capitate-stalked trichome','whole')
gland_plate=build_trichome_plate('trichome-gland-head','PA-GLAND-002-gland-head-anatomy-plate','Trichome gland-head anatomy','head')

reg=json.loads((APP/REG_REL).read_text())
records={r['entityId']:r for r in reg['records']}
new_assets=[
 {'assetId':'PA-FLOWER-003','entityId':'flower-anatomy','class':'labeled-botanical-plate','src':'/atlas/'+str(flower_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration based on Cannabis pistillate inflorescence anatomy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'flowering','organ':'female Cannabis inflorescence','illustrativeOrMeasured':'illustrative','alt':'Illustrative female Cannabis flower anatomy plate labeling inflorescence axis, bract, sugar leaf, stigma, pistillate flower, and trichome-bearing surfaces.','title':'Female Cannabis flower anatomy','sourcePage':'/atlas/flower-anatomy/','notes':'Illustrative and not to scale.'},
 {'assetId':'PA-BRACT-002','entityId':'bract','class':'labeled-botanical-plate','src':'/atlas/'+str(bract_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration based on Cannabis floral bract anatomy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'flowering','organ':'floral bract','illustrativeOrMeasured':'illustrative','alt':'Illustrative Cannabis bract plate showing bract blade, ovary region, stigmas, and trichome-bearing epidermis.','title':'Cannabis bract anatomy','sourcePage':'/atlas/flower-anatomy/','notes':'Illustrative and not to scale.'},
 {'assetId':'PA-STIGMA-003','entityId':'stigma','class':'labeled-botanical-plate','src':'/atlas/'+str(stigma_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration based on Cannabis pistillate reproductive anatomy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'flowering','organ':'stigma / pistillate flower','illustrativeOrMeasured':'illustrative','alt':'Illustrative Cannabis stigma plate showing stigma surface and branch, ovary region, and surrounding bract.','title':'Cannabis stigma anatomy','sourcePage':'/atlas/reproductive-biology/','notes':'Illustrative and not to scale.'},
 {'assetId':'PA-TRICH-003','entityId':'trichomes-resin','class':'labeled-botanical-plate','src':'/atlas/'+str(trich_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration informed by published Cannabis glandular-trichome microscopy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'flowering','organ':'glandular trichome','illustrativeOrMeasured':'illustrative','alt':'Illustrative glandular trichome anatomy showing epidermal base, multicellular stalk, neck, and glandular head.','title':'Glandular trichome anatomy','sourcePage':'/atlas/trichomes-resin/','notes':'Illustrative; use measured microscopy for quantitative claims.'},
 {'assetId':'PA-CST-002','entityId':'capitate-stalked-trichome','class':'labeled-botanical-plate','src':'/atlas/'+str(cst_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration informed by published Cannabis capitate-stalked trichome microscopy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'flowering','organ':'capitate-stalked glandular trichome','illustrativeOrMeasured':'illustrative','alt':'Illustrative capitate-stalked Cannabis trichome showing epidermal base, multicellular stalk, neck, and glandular head.','title':'Capitate-stalked trichome anatomy','sourcePage':'/atlas/trichomes-resin/','notes':'Illustrative and not to scale.'},
 {'assetId':'PA-GLAND-002','entityId':'trichome-gland-head','class':'labeled-botanical-plate','src':'/atlas/'+str(gland_plate).replace('\\','/'),'source':'Original THC Living Plant Atlas educational illustration informed by published Cannabis trichome-head microscopy.','creator':'DTF Genetics / Teaching Healthy Cultivation','license':'DTF Genetics original educational asset','captureType':'illustration','plantStage':'flowering','organ':'glandular trichome head','illustrativeOrMeasured':'illustrative','alt':'Illustrative Cannabis trichome gland-head plate showing secretory disc-cell region, cuticular storage cavity, and stipe connection.','title':'Trichome gland-head anatomy','sourcePage':'/atlas/trichomes-resin/','notes':'Illustrative and not to scale.'}
]
for asset in new_assets:
    rec=records[asset['entityId']]
    idx=next((i for i,a in enumerate(rec['assets']) if a['assetId']==asset['assetId']),None)
    if idx is None: rec['assets'].append(asset)
    else: rec['assets'][idx]=asset
for rec in records.values():
    have={a['class'] for a in rec['assets']}
    rec['status']='approved' if all(k in have for k in rec['required']) else ('in-production' if rec['assets'] else 'production-needed')
for base in (APP,MIRROR):
    (base/REG_REL).write_text(json.dumps(reg,indent=2)+'\n')
print('Built flower/trichome plates:',flower_plate,bract_plate,stigma_plate,trich_plate,cst_plate,gland_plate)
