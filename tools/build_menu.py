import json, sys
# Amed Cafe no longer serves food: drinks and shisha only.
# (en, ar, ku) names; price; optional options [(en,ar,ku,price)]; optional note (en,ar,ku)
SINGLE_DOUBLE=[("Single","سنگل","تەک",1500),("Double","دبل","دەبل",3000)]
C=[
 ("coffee",("Coffee","قهوة","قەهوە"),None,[
  (("Turkish coffee","قهوة تركية","قەهوا تورکی"),1500,SINGLE_DOUBLE),
  (("Kurdish coffee (kezwan)","قهوة بطم","قەهوا کەزوانێ"),1500,SINGLE_DOUBLE),
  (("Espresso","اسبريسو","ئێسپرێسۆ"),1500,SINGLE_DOUBLE),
  (("Americano","امريكانو","ئەمریکانۆ"),3000)]),
 ("hot",("Hot drinks","مشروبات ساخنة","ڤەخوارنێن گەرم"),None,[
  (("Cappuccino","كابتشينو","کاپوچینۆ"),3000),
  (("Nescafé","نسكافيه","نسکافێ"),1500,[("Regular","عادي","نورمال",1500),("With milk","بالحليب","ب شیر",2000)]),
  (("Plain milk","حليب سادة","شیرێ سادە"),1000),
  (("Honey milk","حليب بالعسل","شیرێ ب هنگڤین"),2000),
  (("Hot chocolate","شوكولاتة ساخنة","چکلێتا گەرم"),3000),
  (("Sahlab","سحلب","سەحلەب"),3000),
  (("Ginger, lemon & honey","زنجبيل بالليمون والعسل","زەنجەبیل و لەیمون و هنگڤین"),2000)]),
 ("latte",("Latte","لاتيه","لاتێ"),None,[
  (("Classic latte","لاتيه كلاسيك","لاتێ کلاسیک"),3000),
  (("Caramel latte","لاتيه كراميل","لاتێ کەرامێل"),3000),
  (("Vanilla latte","لاتيه فانيلا","لاتێ ڤانێلا"),3000),
  (("Cookies latte","لاتيه كوكيز","لاتێ کوکیز"),3000),
  (("Chocolate latte","لاتيه شوكولا","لاتێ شکولاتا"),3000),
  (("Dark chocolate latte","لاتيه شوكولا غامق","لاتێ دارک"),3000),
  (("Amed latte","لاتيه Amed","لاتێ ئامەد"),3000)]),
 ("iced-coffee",("Iced coffee","قهوة مثلجة","ئایس کافێ"),None,[
  (("Classic","كلاسيك","کلاسیک"),2000),
  (("Spanish latte","لاتيه إسباني","لاتێ ئیسپانی"),3000),
  (("Caramel","كراميل","کەرامێل مەکیاتۆ"),2500),
  (("Mocha","موكا","مۆکا"),2500),
  (("Vanilla","فانيلا","ڤانێلا"),2500),
  (("White chocolate","شوكولا بيضاء","شکولاتا سپی"),2500),
  (("Amed iced coffee","Amed","ئامەد"),2500),
  (("Iced Americano","امريكانو","ئەمریکانۆ"),3000)]),
 ("tea",("Tea","شاي","چای"),None,[
  (("Iraqi tea","شاي عراقي","چایا عێراقی"),500),
  (("Green tea","شاي أخضر","چایا کەسک"),1000),
  (("Flavoured tea","شاي بنكهات","چایا ب تام"),1000,[("Blueberry","توت","توو",1000),("Lemon & mint","ليمون ونعناع","لەیمون و نەعناع",1000),("Peach","خوخ","خۆخ",1000)]),
  (("Iced tea","شاي مثلج","چایا تەزی"),3000,[("Blueberry","توت","توو",3000),("Peach","خوخ","خۆخ",3000),("Lemon & mint","ليمون ونعناع","لەیمون و نەعناع",3000),("Lemon","ليمون","لەیمون",3000)])]),
 ("juices",("Fresh juices","عصائر طبيعية","شەربەتێن سروشتی"),None,[
  (("Lemon & mint (Bolo)","ليمون ونعناع (بولو)","لەیمون و نەعناع (بولو)"),3500),
  (("Orange","برتقال","پرتەقال"),3500),
  (("Lemon","ليمون","لەیمون"),3500),
  (("Orange & lemon","برتقال وليمون","پرتەقال و لەیمون"),3500),
  (("Pomegranate","رمان","هنار"),3500)]),
 # New product (Nov 2026): Asary fruit syrup by Hala.eco, from Thamir's flyer. 9 flavours, 3 ways to serve.
 ("asary",("Asary fruit drinks","عصاري","عەساری"),None,[
  (("With mineral water","مع مياه معدنية","دگەل ئاڤا سروشتی"),1500),
  (("With sparkling water","مع مياه غازية","دگەل ئاڤا گازی"),2000),
  (("With milk","مع الحليب","دگەل شیری"),2500)],
  {"new":True,"banner":"media/new/asary-bottles.jpg",
   "desc":{"en":"Natural fruit syrup: 60% fruit, 75% less fructose sugar. Choose your flavour:",
           "ar":"شراب فواكه طبيعي: 60% فاكهة، وسكر فركتوز أقل بنسبة 75%. اختر نكهتك:",
           "ku":"شەربەتا مێوێن سروشتی: 60% مێوە، و 75% شەکرا فرەکتۆزێ کێمتر. تاما خۆ هەلبژێرە:"},
   "flavours":[{"name":dict(zip(("en","ar","ku"),n)),"img":"media/new/flavours/"+f+".jpg"} for f,n in [
     ("peach",("Peach","خوخ","خۆخ")),
     ("lemon-lime",("Lemon & lime","ليمون و لايم","لیمون و لایم")),
     ("cherry",("Cherry","كرز","گێلاس")),
     ("blackcurrant",("Blackcurrant","كشمش أسود","کشمشا رەش")),
     ("cola",("Cola","كولا","کۆلا")),
     ("grape",("Grape","عنب","تری")),
     ("elderflower-mint",("Elderflower & mint","زهرة البيلسان والنعناع","گۆڵ بەیبوون و نعناع")),
     ("mango",("Mango","مانجو","مانگۆ")),
     ("raspberry",("Raspberry","توت العليق","تووا سۆر"))]]}),
 ("mojito",("Mojito","موهيتو","مۆهیتۆ"),None,[
  (("Classic mojito","موهيتو كلاسيك","مۆهیتۆ کلاسیک"),2000),
  (("Strawberry mojito","موهيتو فراولة","مۆهیتۆیا فراولایێ"),2000),
  (("Red mojito","موهيتو ريد","مۆهیتۆ رێد"),2000),
  (("Kiwi mojito","موهيتو كيوي","مۆهیتۆ کیڤی"),2000),
  (("Vimto","فيمتو","ڤیمتۆ"),2000),
  (("Lemon & mint mojito (special)","موهيتو ليمون ونعناع خاص","مۆهیتۆیا لەیمون و نەعناعێ تایبەت"),2000),
  (("Amed mojito","موهيتو Amed","مۆهیتۆ ئامەد"),2000)]),
 ("smoothie",("Smoothie","سموذي","سمووزی"),None,[
  (("Strawberry","فراولة","فراولا"),2500),
  (("Blueberry","بلوبيري","بلوبێری"),2500),
  (("Mango","مانجو","مانگۆ"),2500),
  (("Chocolate","شوكولا","شکولاتا"),2500),
  (("Caramel","كراميل","کەرامێل"),2500),
  (("Pistachio","فستق","فستق"),3000)]),
 ("milkshake",("Milkshake","ميلك شيك","میلک شەیک"),None,[
  (("Chocolate","شوكولا","شکولاتا"),3000),
  (("Banana","موز","مۆز"),3000),
  (("Caramel","كراميل","کەرامێل"),3000),
  (("Oreo","أوريو","ئۆریۆ"),3000),
  (("Lotus","لوتس","لۆتۆس"),3000),
  (("Amed milkshake","ميلك شيك Amed","میلک شەیکا ئامەد"),3000)]),
 ("cocktail",("Cocktails","كوكتيل","کۆکتێل"),None,[
  (("Banana milk cocktail","كوكتيل حليب وموز","کۆکتێلا شیر و مۆزێ"),3000),
  (("Amed cocktail","كوكتيل Amed","کۆکتێلا ئامەد"),5000,[("Special","خاص","تایبەت",5000),("Royal","ملكي","شاهانە",5000),("Legendary","أسطوري","ئەفسانە",5000)]),
  (("Piña colada","بينا كولادا","پینا کۆلادا"),5000)]),
 ("cold",("Soft drinks","مشروبات باردة","ڤەخوارنێن سار"),None,[
  (("Water","ماء","ئاڤ"),250),
  (("Coca-Cola","كوكا كولا","کۆکا کۆلا"),1000),
  (("Sprite","سبرايت","سپرایت"),1000),
  (("Gazoz","گازوز","گازوز"),1000),
  (("Soda","صودا","سۆدا"),1000,[("Plain","سادة","سادە",1000),("Lemon","ليمون","لەیمون",1500)])]),
 ("energy",("Energy drinks","مشروبات الطاقة","ڤەخوارنێن بهێزکەر"),None,[
  (("Tiger","تايجر","تایگەر"),1500,[("Regular","عادي","نورمال",1500),("Mexican","مكسيكي","مەکسیکی",2000)]),
  (("Blink","بلنك","بلینک"),1500),
  (("Smart","سمارت","سمارت"),1500),
  (("Smart Zero","سمارت زيرو","سمارت زیرۆ"),1500),
  (("White Tiger","وايت تايجر","وایت تایگەر"),2000),
  (("Red Bull","ريد بول","رێد بوڵ"),2500,[("Regular","عادي","نورمال",2500),("Mexican","مكسيكي","مەکسیکی",3000)])]),
 ("shisha",("Shisha","أركيلة","نێرگەلە"),"shisha-gold.png",[
  (("Gum & mint","علك ونعناع","علک و نەعناع"),5000),
  (("Lemon & mint","ليمون ونعناع","لەیمون و نەعناع"),5000),
  (("Double apple","تفاحتين","دوو سێڤ"),5000),
  (("Royal mix","خلطة رويال","تێکەلا رۆیال"),5000),
  (("English mix","خلطة إنجليزية","تێکەلا ئینگلیزی"),5000),
  (("Head change","تبديل حجر","گوهۆڕینا سەری"),3000),
  (("Half kilo of tobacco","نصف كيلو معسل","نیڤ کیلۆ مەعسەل"),20000),
  (("1 kilo of tobacco","كيلو معسل","کیلۆیەک مەعسەل"),40000)]),
]
L=("en","ar","ku")
out={"note":"Amed Cafe menu (drinks and shisha; no food), prices in IQD. Source: menu.instalacarte.com (English section's prices and availability), Arabic and Badini names from the site's Arabic and Kurdish sections.","sample":False,"categories":[]}
for cid,cn,photo,items,*extra in C:
    cat={"id":cid,"name":dict(zip(L,cn))}
    if photo: cat["photo"]=photo
    if extra: cat.update(extra[0])  # optional: new (badge), banner (wide photo), desc (en/ar/ku)
    cat["items"]=[]
    for it in items:
        names,price=it[0],it[1]; o={"name":dict(zip(L,names)),"price":price}
        if len(it)>2 and it[2]: o["options"]=[{"name":dict(zip(L,x[:3])),"price":x[3]} for x in it[2]]
        if len(it)>3 and it[3]: o["note"]=dict(zip(L,it[3]))
        cat["items"].append(o)
    out["categories"].append(cat)
json.dump(out,open(sys.argv[1],"w"),ensure_ascii=False,indent=1)
print(len(out["categories"]),"categories",sum(len(c["items"]) for c in out["categories"]),"items")
