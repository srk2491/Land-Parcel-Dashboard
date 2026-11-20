from pathlib import Path
import json, re
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / 'public/source/land-details-20-11-2026.pdf'
OUT = ROOT / 'public'
MAIN_REGISTER_MAX_ID = 79

constituency, taluk, hobli = {}, {}, {}
def assign(target, label, spans):
    for start,end in spans:
        for n in range(start,end+1): target[n] = label
assign(constituency,'Anekal',[(1,31),(81,88)])
assign(constituency,'Bengaluru South',[(32,32),(80,80)])
assign(constituency,'Yeshwanthpur',[(33,41),(89,90)])
assign(constituency,'Mahadevapura',[(42,42),(49,49)])
assign(constituency,'Krishnarajapuram',[(43,48),(91,91)])
assign(constituency,'Byatarayanapura',[(50,64),(92,97),(100,101)])
assign(constituency,'Yelahanka',[(65,79),(98,99),(102,103)])
assign(taluk,'Anekal',[(1,14),(19,31),(81,88)])
assign(taluk,'Bengaluru South',[(15,18),(32,41),(80,80),(89,90)])
assign(taluk,'Bengaluru East',[(42,49),(91,91)])
assign(taluk,'Yelahanka',[(50,64),(92,97),(100,101)])
assign(taluk,'Bengaluru North',[(65,79),(98,99),(102,103)])
assign(hobli,'Sarjapura',[(1,6),(15,16),(29,31),(86,88)])
assign(hobli,'Jigani',[(7,14),(19,20),(81,81)])
assign(hobli,'Kasaba',[(21,26),(82,82)])
assign(hobli,'Attibele',[(27,28),(83,85)])
assign(hobli,'Begur',[(32,32),(80,80)])
assign(hobli,'Tavarekere',[(33,35)])
assign(hobli,'Kengeri',[(36,37),(89,89)])
assign(hobli,'Uttarahalli',[(38,41),(90,90)])
assign(hobli,'Bidarahalli',[(42,43)])
assign(hobli,'Krishnarajapuram',[(44,49),(91,91)])
assign(hobli,'Jala',[(50,64),(92,97),(100,101)])
assign(hobli,'Hesaraghatta',[(65,70),(102,103)])
assign(hobli,'Dasanapura',[(71,79),(98,99)])

# Search labels are transliterations; the source-row images preserve the original Kannada spelling.
villages = [
'Hegondanahalli','Hegondanahalli','Chambenahalli','Kade Agrahara','Kommasandra','Biskanhalli',
'S. Bhangipura','Hullalli','S. Bhangipura','Vabasandra','Vabasandra','Mahantalingapura',
'Mahantalingapura','Kallubalu','Yavare','Yavare','Kudurgere','Rayasandra','Bannerghatta',
'Shivanahalli','Kumbaranahalli','Soppahalli','Maneginahalli','Guddanahalli','Haladenahalli',
'Aravantigipura','Halahalli','Bhaktipura','Ramanayakanahalli','Kotaganahalli','Kotaganahalli',
'Vittasandra','Muddayyanapalya','Banchanakuppe','Banchanakuppe','Kumbalgodu','Maligondanahalli',
'Arehalli','Nelaguli','Vaddarahalli','Sankadakatte','Kada Agrahara','Kannuru','Horamavu',
'K. Narayanapura','Devasandra','Nimbakayipura','Kithaganur','Kodigehalli','Mahadev Kodigehalli',
'Kadiganahalli','Chikka Jala','Chikka Jala','Byanasahalli','Bayyappanahalli','Nallur Kunte',
'Hunasemaranahalli','Hunasemaranahalli','Hunasemaranahalli','Hunasemaranahalli','Maralakunte',
'Dodda Jala','Uttanahalli','Marenahalli','Sriramanahalli','Dasivekatte','Linganajogihalli',
'Kumbharahalli','Suradenapura','Sadenahalli','Thotigere','Kasavanahalli','Lakshmipura',
'Lakkasandra','Mallisandra','Mallisandra','Kithanahalli','Bommasettihalli','Thotigere',
'Nayanappanahalli','Koppa','Indluvada','Arehalli','Bidarakuppe','Bidarakuppe','Byalarahalli',
'Alibommasandra','Banasahalli','Kumbalgodu','Kembathnahalli','Kodathi','Bandi Kodigenahalli',
'Kuduragere','Kuduragere','Kuduragere','Tarahunase','Tarahunase','Gangenahalli','Lakkasandra',
'Byanasahalli','Byanasahalli','Dasanahalli','Addevishwanathapura'
]
assert len(villages)==103

status_categories = [
('available','Available at site'),('dispute','Land dispute / court record'),
('encroachment','Encroachment'),('no_approach_road','No approach road'),
('nala_or_pit','Nala / pit area'),('hill_or_rocky','Hill / rocky area'),
('survey_or_resurvey','Survey / re-survey'),('ashraya_scheme','Ashraya scheme')]
status_x = [
(818.4,833.76,852.24),(852.24,886.32,904.8),(904.8,945.6,971.52),
(971.52,996.36,1014.84),(1014.84,1030.2,1048.68),(1048.68,1064.04,1082.52),
(1082.52,1097.88,1116.36),(1116.36,1131.72,1150.2)]

def numeric_at(words,x0,x1,y0,y1):
    spans=[]
    for w in sorted(words,key=lambda q:q[0]):
        if x0<=w[0]<x1 and w[1]>=y0 and w[3]<=y1 and re.fullmatch(r'\d+',w[4]):
            if not any(w[4]==v and abs(w[0]-x)<.4 for x,v in spans): spans.append((w[0],w[4]))
    return int(spans[0][1]) if spans else None

doc=fitz.open(PDF_PATH)
records={}
for page_no,page in enumerate(doc,start=1):
    words=page.get_text('words')
    rules=[]
    for drawing in page.get_drawings():
        for item in drawing['items']:
            if item[0]=='re' and item[1].width>500 and item[1].height<1: rules.append(item[1].y0)
    rules=sorted(set(round(y,2) for y in rules))
    row_ids={}
    for w in words:
        if w[0]<70 and re.fullmatch(r'\d{1,3}',w[4]):
            n=int(w[4])
            if 1<=n<=MAIN_REGISTER_MAX_ID: row_ids.setdefault(n,w[1])
    for n,baseline in row_ids.items():
        if n in records: continue
        top=max((y for y in rules if y<=baseline+.5),default=baseline-25)
        bottom=min((y for y in rules if y>baseline+.5),default=baseline+25)
        survey_words=[w for w in sorted(words,key=lambda q:q[0]) if 327.96<=w[0]<358.68 and w[1]>=top and w[3]<=bottom+.5]
        survey=' '.join(w[4] for w in survey_words).strip()
        if not survey:
            for w in sorted(words,key=lambda q:q[0]):
                if 264.12<=w[0]<327.96 and w[1]>=top and w[3]<=bottom+.5:
                    m=re.search(r'(\d+)$',w[4])
                    if m: survey=m.group(1); break
        acres=numeric_at(words,358.68,384.6,top,bottom+.5) or 0
        guntas=numeric_at(words,384.6,414.72,top,bottom+.5) or 0
        statuses=[]
        for (key,label),(left,split,right) in zip(status_categories,status_x):
            a=numeric_at(words,left,split,top,bottom+.5)
            g=numeric_at(words,split,right,top,bottom+.5)
            if a is not None or g is not None:
                statuses.append({'key':key,'label':label,'acres':a or 0,'guntas':g or 0})
        row_path=OUT/'assets/source-rows'/f'parcel-{n:03d}.jpg'
        photo_path=OUT/'assets/photos'/f'parcel-{n:03d}.jpg'
        row_png=row_path.with_suffix('.png')
        pix=page.get_pixmap(matrix=fitz.Matrix(2.2,2.2),clip=fitz.Rect(40,top,807,bottom),alpha=False)
        pix.save(str(row_png))
        Image.open(row_png).convert('RGB').save(row_path,quality=88,optimize=True)
        row_png.unlink(missing_ok=True)
        photo_png=photo_path.with_suffix('.png')
        pix=page.get_pixmap(matrix=fitz.Matrix(3.4,3.4),clip=fitz.Rect(733,top,807,bottom),alpha=False)
        pix.save(str(photo_png))
        Image.open(photo_png).convert('RGB').save(photo_path,quality=84,optimize=True)
        photo_png.unlink(missing_ok=True)
        records[n]={
            'id':n,'constituency':constituency.get(n,'Not shown'),'taluk':taluk.get(n,'Not shown'),
            'hobli':hobli.get(n,'Not shown'),'village':villages[n-1],
            'surveyNo':survey or 'Not recorded','areaAcres':acres,'areaGuntas':guntas,
            'statusExtents':statuses,'page':page_no,
            'photo':'assets/photos/'+photo_path.name,'sourceRow':'assets/source-rows/'+row_path.name}

parcels=[records[n] for n in sorted(records)]
assert len(parcels)==MAIN_REGISTER_MAX_ID,f'expected {MAIN_REGISTER_MAX_ID} primary register rows; found {len(parcels)}'
raw_acres=sum(r['areaAcres'] for r in parcels); raw_guntas=sum(r['areaGuntas'] for r in parcels)
status_totals={}
for key,label in status_categories:
    entries=[s for r in parcels for s in r['statusExtents'] if s['key']==key]
    a=sum(s['acres'] for s in entries); g=sum(s['guntas'] for s in entries)
    status_totals[key]={'label':label,'parcelCount':len(entries),'acres':a,'guntas':g,'normalizedAcres':a+g//40,'normalizedGuntas':g%40}
payload={
    'sourceTitle':'Land details, 20 November 2026','sourcePdf':'source/land-details-20-11-2026.pdf',
    'scope':{
      'includedRows':'1-79',
      'excludedRows':'80-103',
      'excludedSection':'ಉಳಿಕೆ',
      'note':'The dashboard follows the primary register subtotal for rows 1-79. Rows 80-103 appear under the separate PDF section ಉಳಿಕೆ (remaining) and are excluded.'
    },
    'units':{'guntasPerAcre':40},
    'summary':{'parcelCount':len(parcels),'rawAcres':raw_acres,'rawGuntas':raw_guntas,
      'normalizedAcres':raw_acres+raw_guntas//40,'normalizedGuntas':raw_guntas%40,
      'statusTotals':status_totals,'coordinateCount':0},
    'statusCategories':[{'key':k,'label':label} for k,label in status_categories],
    'parcels':parcels}
(OUT/'data/parcels.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for asset_dir in (OUT/'assets/photos', OUT/'assets/source-rows'):
    for asset in asset_dir.glob('parcel-*.jpg'):
        match=re.search(r'parcel-(\d+)',asset.stem)
        if match and int(match.group(1))>MAIN_REGISTER_MAX_ID:
            asset.unlink()

print(json.dumps({'parcelCount':len(parcels),'primaryRegisterTotal':f"{payload['summary']['normalizedAcres']} acres {payload['summary']['normalizedGuntas']} guntas",'photoImages':len(list((OUT/'assets/photos').glob('*.jpg'))),'sourceRows':len(list((OUT/'assets/source-rows').glob('*.jpg'))),'statusTotals':status_totals},ensure_ascii=False,indent=2))
