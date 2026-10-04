#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, textwrap

OUT=Path('site/wordpress/assets/infographics')
OUT.mkdir(parents=True,exist_ok=True)
W,H=1600,1000
BG=(248,250,247); INK=(25,32,28); GREEN=(46,108,65); BLUE=(53,96,145); ORANGE=(182,105,42); RED=(155,62,56); GRAY=(110,118,113)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def F(s,b=False): return ImageFont.truetype(BOLD if b else FONT,s)
def base(title,subtitle):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    d.rounded_rectangle((45,35,W-45,H-35),radius=28,outline=(205,214,207),width=3,fill=(255,255,255))
    d.text((80,65),title,font=F(42,True),fill=INK)
    d.text((80,125),subtitle,font=F(24),fill=GRAY)
    d.line((80,170,W-80,170),fill=(215,222,217),width=2)
    return im,d
def box(d,xy,title,body='',fill=(245,248,245),outline=(196,206,198),title_color=INK):
    d.rounded_rectangle(xy,radius=22,fill=fill,outline=outline,width=3)
    x1,y1,x2,y2=xy
    d.text((x1+24,y1+20),title,font=F(26,True),fill=title_color)
    if body:
        y=y1+60
        width=max(20,int((x2-x1)/15))
        for line in textwrap.wrap(body,width=width):
            d.text((x1+24,y),line,font=F(20),fill=INK); y+=28
def arrow(d,a,b,color=GREEN,width=8):
    d.line((a,b),fill=color,width=width)
    ang=math.atan2(b[1]-a[1],b[0]-a[0]); L=24
    for off in (2.6,-2.6):
        p=(b[0]-L*math.cos(ang+off),b[1]-L*math.sin(ang+off))
        d.line((b,p),fill=color,width=width)
def leaf(d,cx,cy,scale=1.0,fill=GREEN):
    d.ellipse((cx-42*scale,cy-110*scale,cx+42*scale,cy+110*scale),fill=fill,outline=(34,80,48),width=3)
    d.line((cx,cy-100*scale,cx,cy+105*scale),fill=(230,245,234),width=max(2,int(4*scale)))
def save(im,name): im.save(OUT/name,optimize=True)

# THC-ENC-098
im,d=base('THC-ENC-098 · CO₂ supply, ventilation, and enrichment','Measured photosynthetic input and occupational hazard — candidate teaching visual')
box(d,(90,235,450,430),'Enrichment','CO₂ enters the crop zone; distribution must reach the canopy, not only the controller.',fill=(238,247,240),outline=(126,173,139),title_color=GREEN)
box(d,(1150,235,1510,430),'Ventilation loss','Exhaust can remove enriched air rapidly; airflow and exchange rate change effective exposure.',fill=(240,245,250),outline=(135,165,195),title_color=BLUE)
box(d,(1080,650,1510,860),'Independent safety monitor','Plant-growth control is not life-safety control. Alarm, ventilation and entry procedures stay separate.',fill=(252,244,242),outline=(194,129,122),title_color=RED)
d.rounded_rectangle((570,280,1030,770),radius=26,fill=(241,248,242),outline=(144,177,151),width=3)
d.text((700,305),'CANOPY ZONE',font=F(28,True),fill=GREEN)
for x in (660,800,940): leaf(d,x,515,0.78)
for x in range(620,1020,80): d.line((x,225,x-35,300),fill=(214,170,64),width=5)
d.text((650,205),'Light + water + mineral supply + sink capacity',font=F(18),fill=ORANGE)
arrow(d,(450,335),(570,390),GREEN); arrow(d,(1030,420),(1150,335),BLUE); arrow(d,(1210,650),(1040,675),RED)
d.text((135,455),'CO₂ concentration',font=F(24,True),fill=INK)
d.text((135,500),'Response is conditional — “more” does not guarantee proportional crop gain.',font=F(20),fill=GRAY)
d.text((1175,455),'Asphyxiant',font=F(24,True),fill=RED)
d.text((1175,500),'Colorless and odorless; occupational controls govern worker safety.',font=F(20),fill=GRAY)
save(im,'THC-ENC-098_co2-supply-ventilation-enrichment.png')

# THC-ENC-103
im,d=base('THC-ENC-103 · Daily Light Integral calculation','DLI is a time-integrated photon dose, not an instantaneous PPFD reading')
box(d,(90,220,560,390),'Constant light','DLI = PPFD × photoperiod hours × 0.0036',fill=(240,247,242),outline=(130,172,140),title_color=GREEN)
box(d,(90,430,560,655),'Time-varying light','Integrate logged photon flux over each interval; spot readings can misrepresent the day.',fill=(240,245,250),outline=(135,165,195),title_color=BLUE)
box(d,(90,700,560,875),'Guardrail','Equal DLI can come from different intensity × duration patterns and need not produce equal plant response.',fill=(252,247,239),outline=(195,160,109),title_color=ORANGE)
x0,y0,x1,y1=680,765,1490,265
d.line((x0,y0,x1,y0),fill=INK,width=4); d.line((x0,y0,x0,y1),fill=INK,width=4)
d.text((1010,800),'Integration interval → time',font=F(22),fill=INK)
d.text((590,250),'Instantaneous PPFD',font=F(22,True),fill=INK)
pts=[]
for i,val in enumerate([0,80,220,430,620,720,650,540,420,260,120,40,0]):
    x=x0+i*(x1-x0)/12; y=y0-val*0.55; pts.append((x,y))
d.polygon([(x0,y0)]+pts+[(x1,y0)],fill=(221,238,224)); d.line(pts,fill=GREEN,width=7)
d.text((1030,300),'Temporal profile',font=F(26,True),fill=GREEN)
d.text((830,700),'Area under the curve = DLI',font=F(22,True),fill=BLUE)
save(im,'THC-ENC-103_daily-light-integral-calculation.png')

# THC-ENC-268
im,d=base('THC-ENC-268 · Heat stress','Diagnose with tissue temperature + duration + radiation + water status, not room air alone')
d.rounded_rectangle((600,260,1000,785),radius=28,fill=(245,249,245),outline=(156,180,160),width=3)
leaf(d,800,505,1.15); d.text((675,300),'LEAF / TISSUE',font=F(28,True),fill=GREEN)
box(d,(90,245,500,415),'Radiation load','Strong light can raise leaf temperature above room air.',fill=(252,247,238),outline=(201,163,102),title_color=ORANGE)
box(d,(90,455,500,625),'Transpirational cooling','Water supply, stomatal function and airflow can cool tissue.',fill=(239,246,251),outline=(132,164,194),title_color=BLUE)
box(d,(90,665,500,850),'Thermal duration','Severity depends on exposure time, tissue, genotype and acclimation.',fill=(250,243,242),outline=(192,129,121),title_color=RED)
box(d,(1090,245,1510,430),'Functional response','Photosynthesis can decline while respiration and water demand rise.',fill=(245,248,244),outline=(151,176,154),title_color=GREEN)
box(d,(1090,475,1510,650),'Thermal acclimation','Optima vary by genotype; experimental values are not universal injury thresholds.',fill=(245,248,244),outline=(151,176,154),title_color=GREEN)
box(d,(1090,700,1510,855),'Measure together','Leaf temperature + PPFD + VPD/water status + duration + recovery.',fill=(240,245,250),outline=(132,164,194),title_color=BLUE)
d.text((665,820),'Dark respiration ↑ under heat',font=F(22,True),fill=RED)
save(im,'THC-ENC-268_heat-stress-diagnostic-context.png')

# THC-ENC-269
im,d=base('THC-ENC-269 · Cold and chilling stress','Separate chilling, freezing, cold-root effects and cold + light interactions')
box(d,(90,230,510,410),'Chilling stress','Can occur above freezing: slower membranes, enzymes, root activity and photosynthetic repair.',fill=(239,246,251),outline=(135,166,196),title_color=BLUE)
box(d,(90,460,510,635),'Freezing injury','Adds ice formation and cellular dehydration risk; severity depends on tissue and exposure.',fill=(242,246,252),outline=(120,151,188),title_color=BLUE)
box(d,(90,685,510,860),'Cold acclimation','Response varies by genotype, age, tissue and duration; acclimation is not always protective.',fill=(245,247,250),outline=(150,164,180),title_color=INK)
d.rounded_rectangle((650,260,950,800),radius=30,fill=(246,249,251),outline=(150,170,190),width=3)
leaf(d,800,480,0.95,fill=(69,110,92)); d.text((690,300),'TISSUE RESPONSE',font=F(25,True),fill=BLUE)
d.rounded_rectangle((765,600,835,755),radius=30,fill=(235,240,245),outline=BLUE,width=4)
d.ellipse((745,700,855,810),fill=(112,155,200),outline=BLUE,width=4); d.line((800,620,800,720),fill=(112,155,200),width=18)
box(d,(1070,230,1510,410),'Photoinhibition interaction','Cold can slow repair while light continues excitation, increasing cold + light injury risk.',fill=(252,247,238),outline=(198,161,104),title_color=ORANGE)
box(d,(1070,460,1510,635),'Electrolyte leakage','A research injury metric—not a universal field threshold by itself.',fill=(248,245,245),outline=(180,145,145),title_color=RED)
box(d,(1070,685,1510,860),'Diagnosis rule','No frost does not rule out cold injury. Use tissue response, exposure history and crop context.',fill=(245,248,244),outline=(151,176,154),title_color=GREEN)
save(im,'THC-ENC-269_cold-chilling-stress.png')

# THC-ENC-270
im,d=base('THC-ENC-270 · High-light and photoinhibition injury','High photon exposure is not automatically injury: compare protection, repair and plant context')
box(d,(90,250,475,435),'Photoprotection','Regulated energy dissipation and acclimation can protect photosystems under high light.',fill=(240,247,242),outline=(130,172,140),title_color=GREEN)
box(d,(90,485,475,660),'Photoinhibition','Sustained loss of photosynthetic function when excitation exceeds protection + repair.',fill=(252,244,242),outline=(193,128,121),title_color=RED)
box(d,(90,710,475,855),'Fv/Fm','A chlorophyll-fluorescence indicator useful with context; not a stand-alone diagnosis.',fill=(240,245,250),outline=(133,165,194),title_color=BLUE)
for x in range(650,1010,70): d.line((x,235,x-20,350),fill=(221,173,59),width=7)
leaf(d,820,565,1.25)
d.text((660,760),'NONPHOTOCHEMICAL QUENCHING',font=F(22,True),fill=ORANGE)
d.text((685,805),'regulated dissipation of excess excitation',font=F(20),fill=GRAY)
box(d,(1090,250,1510,435),'Conditional tolerance','Water, CO₂, roots, nutrition, temperature, spectrum, photoperiod and acclimation all matter.',fill=(245,248,244),outline=(151,176,154),title_color=GREEN)
box(d,(1090,485,1510,660),'Photooxidative stress','Risk rises when absorbed energy outpaces photochemistry, dissipation, antioxidants and repair.',fill=(252,244,242),outline=(193,128,121),title_color=RED)
box(d,(1090,710,1510,855),'Guardrail','Top-canopy bleaching alone does not prove “light burn,” and no single PPFD is a universal injury threshold.',fill=(252,247,239),outline=(195,160,109),title_color=ORANGE)
save(im,'THC-ENC-270_high-light-photoinhibition.png')

# THC-ENC-362
im,d=base('THC-ENC-362 · Latitude, daylength, and seasonal flowering','Seasonal flowering emerges from photoperiod × twilight × genotype × plant history')
x0,y0,x1,y1=130,780,920,260
d.line((x0,y0,x1,y0),fill=INK,width=4); d.line((x0,y0,x0,y1),fill=INK,width=4)
d.text((360,820),'Date through growing season →',font=F(22),fill=INK); d.text((75,220),'Daylength',font=F(22,True),fill=INK)
for idx,(amp,offset,label,col) in enumerate([(210,0,'higher latitude',BLUE),(150,35,'mid latitude',GREEN),(95,70,'lower latitude',ORANGE)]):
    pts=[]
    for i in range(80):
        t=i/79*math.pi; x=x0+i*(x1-x0)/79; y=560-amp*math.sin(t)+offset; pts.append((x,y))
    d.line(pts,fill=col,width=6); d.text((700,300+idx*48),label,font=F(20,True),fill=col)
box(d,(1030,235,1510,385),'Photoperiod sensitivity','Critical daylength is cultivar-dependent; it is not universally 12 hours.',fill=(240,247,242),outline=(130,172,140),title_color=GREEN)
box(d,(1030,425,1510,575),'Civil twilight','Low-intensity twilight can be biologically effective and shifts the effective light-dark cycle.',fill=(240,245,250),outline=(133,165,194),title_color=BLUE)
box(d,(1030,615,1510,765),'Autoflowering','Reduced dependence on shortening days does not guarantee yield, uniformity or environmental independence.',fill=(252,247,239),outline=(195,160,109),title_color=ORANGE)
box(d,(1030,805,1510,910),'Genotype × environment','Use local sunrise/sunset/twilight plus direct cultivar observations.',fill=(245,248,244),outline=(151,176,154),title_color=INK)
d.text((165,205),'Latitude changes the seasonal daylength curve—not the flowering date by itself.',font=F(21),fill=GRAY)
save(im,'THC-ENC-362_latitude-daylength-seasonal-flowering.png')

print('Generated 6 review-pending PNG teaching-visual candidates in', OUT)
