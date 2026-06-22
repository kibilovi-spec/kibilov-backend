const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const MAIN_CATS = [
  { slug:'savali', nameKa:'სავალი ნაწილები', nameEn:'Chassis Parts', nameRu:'Ходовая часть', icon:'🔩', order:1 },
  { slug:'amortizacia', nameKa:'ამორტიზაცია', nameEn:'Suspension', nameRu:'Амортизация', icon:'⚙️', order:2 },
  { slug:'brakes', nameKa:'სამუხრუჭე სისტემა', nameEn:'Brake System', nameRu:'Тормозная система', icon:'🛑', order:3 },
  { slug:'steering', nameKa:'საჭის ნაწილები', nameEn:'Steering Parts', nameRu:'Рулевые детали', icon:'🎯', order:4 },
  { slug:'engines', nameKa:'ძრავის ნაწილები', nameEn:'Engine Parts', nameRu:'Детали двигателя', icon:'🔧', order:5 },
  { slug:'cooling', nameKa:'გაგრილების სისტემა', nameEn:'Cooling System', nameRu:'Система охлаждения', icon:'❄️', order:6 },
  { slug:'filters', nameKa:'ფილტრები', nameEn:'Filters', nameRu:'Фильтры', icon:'🔬', order:7 },
  { slug:'electrics', nameKa:'ელექტროობა', nameEn:'Electrics', nameRu:'Электрика', icon:'⚡', order:8 },
  { slug:'clutch', nameKa:'გადაბმულობის ნაწილები', nameEn:'Clutch Parts', nameRu:'Сцепление', icon:'🔗', order:9 },
  { slug:'driveshaft', nameKa:'დაკიდების სისტემა', nameEn:'Drive System', nameRu:'Привод', icon:'🔄', order:10 },
  { slug:'body', nameKa:'ძარის ნაწილები', nameEn:'Body Parts', nameRu:'Кузов', icon:'🚗', order:11 },
  { slug:'oils-fluids', nameKa:'საპოხი საშუალებები', nameEn:'Oils & Fluids', nameRu:'Масла и жидкости', icon:'🛢️', order:12 },
  { slug:'glass', nameKa:'მინები', nameEn:'Glass', nameRu:'Стёкла', icon:'🪟', order:13 },
  { slug:'tires', nameKa:'საბურავები', nameEn:'Tires', nameRu:'Шины', icon:'🔵', order:14 },
  { slug:'accessories', nameKa:'აქსესუარები', nameEn:'Accessories', nameRu:'Аксессуары', icon:'🎁', order:15 },
];
const SUBS = {
  savali:[
    {ka:'გიტარა და მისი ნაწილები',en:'CV Axle & Parts',ru:'Полуось и детали',slug:'savali-gitara'},
    {ka:'შარავოები და წევის დაბოლოებები',en:'Ball Joints & Tie Rod Ends',ru:'Шаровые и наконечники',slug:'savali-sharavoebi'},
    {ka:'სტუპიცები და მისი საკისრები',en:'Hubs & Bearings',ru:'Ступицы и подшипники',slug:'savali-stupicebi'},
    {ka:'სალნიკები',en:'Oil Seals',ru:'Сальники',slug:'savali-salnikebi'},
    {ka:'ყუმბარები',en:'CV Boots',ru:'Пыльники',slug:'savali-yumbarebi'},
    {ka:'სტერჟინები',en:'Steering Rods',ru:'Тяги',slug:'savali-sterjinebi'},
    {ka:'პილნიკები',en:'CV Joints',ru:'ШРУСы',slug:'savali-pilnikebi'},
    {ka:'სუხოის რეზინები და დამჭერები',en:'Rubber Mounts',ru:'Резинки и крепления',slug:'savali-sukho'},
    {ka:'უკანა წამყვანის ნაწილები',en:'Rear Drive Parts',ru:'Задний привод',slug:'savali-ukana'},
    {ka:'ჭანჭიკები და ქანჩები',en:'Bolts & Nuts',ru:'Болты и гайки',slug:'savali-boltebi'},
    {ka:'სხვა სავალი ნაწილები',en:'Other Chassis Parts',ru:'Прочее',slug:'savali-other'},
  ],
  amortizacia:[
    {ka:'წინა ამორტიზატორები',en:'Front Shock Absorbers',ru:'Передние амортизаторы',slug:'amort-wina'},
    {ka:'უკანა ამორტიზატორები',en:'Rear Shock Absorbers',ru:'Задние амортизаторы',slug:'amort-ukana'},
    {ka:'ამორტიზატორის მილისები',en:'Shock Absorber Bearings',ru:'Подшипники амортизатора',slug:'amort-milisi'},
    {ka:'ამორტიზატორის ბალიშები',en:'Shock Absorber Mounts',ru:'Опоры амортизатора',slug:'amort-balishi'},
    {ka:'ამორტიზატორის საკისრები',en:'Shock Absorber Bearings',ru:'Подшипники стойки',slug:'amort-sakirsi'},
    {ka:'კაპოტის ამორტიზატორი',en:'Hood Struts',ru:'Амортизаторы капота',slug:'amort-kapoti'},
    {ka:'საბარგულის ამორტიზატორი',en:'Trunk Struts',ru:'Амортизаторы багажника',slug:'amort-sabarguli'},
    {ka:'ზამბარები და მისი ნაწილები',en:'Springs & Parts',ru:'Пружины и детали',slug:'amort-zambara'},
    {ka:'რესორები',en:'Leaf Springs',ru:'Рессоры',slug:'amort-resori'},
    {ka:'რესორის დამჭერები',en:'Spring Clamps',ru:'Стремянки рессор',slug:'amort-resori-damch'},
    {ka:'რესორის მილისები',en:'Spring Bushings',ru:'Втулки рессор',slug:'amort-resori-mil'},
  ],
  brakes:[
    {ka:'მუხრუჭის ცილინდრი',en:'Brake Cylinder',ru:'Тормозной цилиндр',slug:'brake-cilindri'},
    {ka:'ვაკუუმნასოსი და მისი ნაწილები',en:'Vacuum Pump & Parts',ru:'Вакуумный насос',slug:'brake-vakuum'},
    {ka:'სუპორტი და მისი ნაწილები',en:'Brake Caliper & Parts',ru:'Суппорт и детали',slug:'brake-suporti'},
    {ka:'საყრდენი დისკი',en:'Brake Disc',ru:'Тормозной диск',slug:'brake-diski'},
    {ka:'წინა სამუხრუჭე ხუნდი',en:'Front Brake Pads',ru:'Передние тормозные колодки',slug:'brake-pads-front'},
    {ka:'უკანა სამუხრუჭე ხუნდი',en:'Rear Brake Pads',ru:'Задние тормозные колодки',slug:'brake-pads-rear'},
    {ka:'სამუხრუჭე მილი',en:'Brake Hose',ru:'Тормозной шланг',slug:'brake-mili'},
    {ka:'ტორსები',en:'Brake Drums',ru:'Тормозные барабаны',slug:'brake-torsi'},
    {ka:'მუხრუჭის სენსორი',en:'Brake Sensor',ru:'Датчик тормоза',slug:'brake-sensori'},
  ],
  steering:[
    {ka:'საჭის მექანიზმი',en:'Steering Gear',ru:'Рулевой механизм',slug:'steer-meqanizmi'},
    {ka:'ჰიდრავლიკის ტუმბო',en:'Power Steering Pump',ru:'Насос гидроусилителя',slug:'steer-tumbo'},
    {ka:'ჰიდრავლიკის მილი',en:'Power Steering Hose',ru:'Шланг гидроусилителя',slug:'steer-hose'},
    {ka:'საჭის მექანიზმის სალნიკები',en:'Steering Seals',ru:'Сальники рулевого',slug:'steer-salniki'},
    {ka:'ამნთები და ნაილები',en:'Steering Joints',ru:'Карданчики рулевые',slug:'steer-amntebi'},
    {ka:'სახელურები',en:'Steering Handles',ru:'Рулевые рычаги',slug:'steer-saxelurebi'},
    {ka:'საჭის სხვა ნაწილები',en:'Other Steering Parts',ru:'Прочие рулевые детали',slug:'steer-other'},
  ],
  engines:[
    {ka:'ძრავის თავი და მისი ნაწილები',en:'Cylinder Head & Parts',ru:'Головка блока и детали',slug:'eng-tavi'},
    {ka:'ცეპი და მისი ნაწილები',en:'Timing Chain & Parts',ru:'Цепь и детали',slug:'eng-cepi'},
    {ka:'კოლცოები და ვკლადიშები',en:'Rings & Bearings',ru:'Кольца и вкладыши',slug:'eng-kolco'},
    {ka:'ზეთის ტუმბოები და მისი ნაწილები',en:'Oil Pump & Parts',ru:'Масляный насос и детали',slug:'eng-oil-tumbo'},
    {ka:'საწვავის ტუმბოები და მისი ნაწილები',en:'Fuel Pump & Parts',ru:'Топливный насос',slug:'eng-fuel-tumbo'},
    {ka:'ტურბოები და მისი ნაწილები',en:'Turbo & Parts',ru:'Турбины и детали',slug:'eng-turbo'},
    {ka:'შუასადებები',en:'Gaskets',ru:'Прокладки',slug:'eng-gasket'},
    {ka:'ზეთის რადიატორები',en:'Oil Coolers',ru:'Масляные радиаторы',slug:'eng-oil-rad'},
    {ka:'ანთების ნაწილები',en:'Ignition Parts',ru:'Детали зажигания',slug:'eng-anteba'},
    {ka:'სენსორები',en:'Sensors',ru:'Датчики',slug:'eng-sensor'},
    {ka:'ღვედის დამჭიმები',en:'Belt Tensioners',ru:'Натяжители ремня',slug:'eng-tensioner'},
    {ka:'ღვედები',en:'Belts',ru:'Ремни',slug:'eng-ghvedi'},
    {ka:'ძრავის და კოლოფის ბალიშები',en:'Engine & Gearbox Mounts',ru:'Подушки двигателя',slug:'eng-balishi'},
    {ka:'სალნიკები',en:'Engine Oil Seals',ru:'Сальники двигателя',slug:'eng-salniki'},
    {ka:'მაყუჩი და მისი ნაწილები',en:'Exhaust & Parts',ru:'Глушитель и детали',slug:'eng-mayuchi'},
    {ka:'ტროსები',en:'Cables',ru:'Тросы',slug:'eng-trosi'},
    {ka:'სხვა საძრავო ნაწილები',en:'Other Engine Parts',ru:'Прочие детали двигателя',slug:'eng-other'},
  ],
  cooling:[
    {ka:'ავზები და მისი ნაწილები',en:'Tanks & Parts',ru:'Бачки и детали',slug:'cool-avzi'},
    {ka:'თერმოსტატები და მისი ნაწილები',en:'Thermostats & Parts',ru:'Термостаты и детали',slug:'cool-termostati'},
    {ka:'წყლის ტუმბოები',en:'Water Pumps',ru:'Водяные насосы',slug:'cool-tumbo'},
    {ka:'რადიატორები',en:'Radiators',ru:'Радиаторы',slug:'cool-radiatori'},
    {ka:'რადიატორის დამჭერები და სხვა',en:'Radiator Brackets',ru:'Крепления радиатора',slug:'cool-rad-damcheri'},
    {ka:'შლანგები',en:'Hoses',ru:'Шланги',slug:'cool-shlang'},
    {ka:'ჰიდრომუფთები',en:'Hydraulic Couplings',ru:'Гидромуфты',slug:'cool-hidromufta'},
    {ka:'ვენტილატორები',en:'Fans',ru:'Вентиляторы',slug:'cool-ventilatori'},
  ],
  filters:[
    {ka:'ჰაერის ფილტრი',en:'Air Filter',ru:'Воздушный фильтр',slug:'filt-haeri'},
    {ka:'საწვავის ფილტრი და მისი ნაწილები',en:'Fuel Filter & Parts',ru:'Топливный фильтр',slug:'filt-sawvavi'},
    {ka:'ზეთის ფილტრი და მისი ნაწილები',en:'Oil Filter & Parts',ru:'Масляный фильтр',slug:'filt-zetis'},
    {ka:'სალონის ფილტრი',en:'Cabin Filter',ru:'Салонный фильтр',slug:'filt-saloni'},
    {ka:'გადაცემათა კოლოფის ფილტრი',en:'Gearbox Filter',ru:'Фильтр коробки передач',slug:'filt-kolofi'},
  ],
  electrics:[
    {ka:'დინამოს ნაწილები',en:'Alternator Parts',ru:'Детали генератора',slug:'elec-dinamo'},
    {ka:'სტარტერის ნაწილები',en:'Starter Parts',ru:'Детали стартера',slug:'elec-starteri'},
    {ka:'ნათურები',en:'Bulbs & Lights',ru:'Лампы и фары',slug:'elec-nathura'},
    {ka:'სხვა ელექტრო ნაწილები',en:'Other Electrical Parts',ru:'Прочие электродетали',slug:'elec-other'},
    {ka:'ხმის და ვიდეო სისტემები',en:'Audio & Video Systems',ru:'Аудио и видео',slug:'elec-audio'},
    {ka:'GPS მოწყობილობები',en:'GPS Devices',ru:'GPS устройства',slug:'elec-gps'},
  ],
  clutch:[
    {ka:'გადაბმულობის კომპლექტები',en:'Clutch Kits',ru:'Комплекты сцепления',slug:'clutch-komplekti'},
    {ka:'მახავიკები',en:'Flywheels',ru:'Маховики',slug:'clutch-maxaviki'},
    {ka:'პლიტები და ფერადოები',en:'Clutch Plates & Discs',ru:'Диски сцепления',slug:'clutch-plita'},
    {ka:'გადაბმულობის ცილინდრები',en:'Clutch Cylinders',ru:'Цилиндры сцепления',slug:'clutch-cilindri'},
    {ka:'გადაბმულობის სხვა ნაწილები',en:'Other Clutch Parts',ru:'Прочие детали сцепления',slug:'clutch-other'},
    {ka:'გადაბმულობის პედლები',en:'Clutch Pedal & Parts',ru:'Педаль сцепления',slug:'clutch-pedali'},
    {ka:'ტროსები',en:'Clutch Cables',ru:'Тросы сцепления',slug:'clutch-trosi'},
  ],
  driveshaft:[
    {ka:'კარდანი და მისი ნაწილები',en:'Driveshaft & Parts',ru:'Кардан и детали',slug:'drive-kardani'},
    {ka:'პოდვესნოი',en:'Drive Bearing',ru:'Подвесной подшипник',slug:'drive-podvesnoi'},
    {ka:'გადაბმულობის ჯვარა',en:'Universal Joint',ru:'Крестовина',slug:'drive-jvara'},
  ],
  body:[
    {ka:'კარის ნაწილები',en:'Door Parts',ru:'Детали дверей',slug:'body-kari'},
    {ka:'საკეტები',en:'Locks',ru:'Замки',slug:'body-saketi'},
    {ka:'ფიქსატორები',en:'Fixators',ru:'Фиксаторы',slug:'body-fiksatori'},
    {ka:'სახელურები',en:'Handles',ru:'Ручки',slug:'body-saxeluri'},
    {ka:'ტროსები',en:'Body Cables',ru:'Тросы кузова',slug:'body-trosi'},
    {ka:'ფარები და მისი ნაწილები',en:'Headlights & Parts',ru:'Фары и детали',slug:'body-parebi'},
    {ka:'სარკეები',en:'Mirrors',ru:'Зеркала',slug:'body-sarke'},
    {ka:'სარკის ხუფები',en:'Mirror Covers',ru:'Крышки зеркал',slug:'body-sarke-xufi'},
    {ka:'ბამპერები და მისი ნაწილები',en:'Bumpers & Parts',ru:'Бамперы и детали',slug:'body-bamperi'},
    {ka:'პირნაკეთობები',en:'Trim & Parts',ru:'Молдинги и детали',slug:'body-pirnak'},
    {ka:'მინის რეზინები',en:'Window Seals',ru:'Резинки стёкол',slug:'body-mine-rezini'},
    {ka:'საშხეფრები',en:'Wipers',ru:'Дворники',slug:'body-sashxefri'},
    {ka:'წინა ფრთები',en:'Front Fenders',ru:'Передние крылья',slug:'body-wina-frta'},
    {ka:'გვერდითი თუნუქები',en:'Side Panels',ru:'Боковые панели',slug:'body-gverditi'},
    {ka:'კარის თუნუქები',en:'Door Panels',ru:'Двери',slug:'body-kari-tunuki'},
    {ka:'საფეხურები',en:'Running Boards',ru:'Пороги',slug:'body-safexuri'},
    {ka:'უკანა ფრთები',en:'Rear Fenders',ru:'Задние крылья',slug:'body-ukana-frta'},
    {ka:'ბალკები',en:'Beams',ru:'Балки',slug:'body-balka'},
    {ka:'დგარები',en:'Pillars',ru:'Стойки',slug:'body-dgari'},
    {ka:'სხვა ძარის ნაწილები',en:'Other Body Parts',ru:'Прочие детали кузова',slug:'body-other'},
    {ka:'სავარძლები და მისი ნაწილები',en:'Seats & Parts',ru:'Сиденья и детали',slug:'body-savardzeli'},
  ],
  'oils-fluids':[
    {ka:'ძრავის ზეთები',en:'Engine Oils',ru:'Моторные масла',slug:'oil-engine'},
    {ka:'გადაცემათა კოლოფის ზეთები',en:'Transmission Oils',ru:'Трансмиссионные масла',slug:'oil-trans'},
    {ka:'სამუხრუჭე სითხეები',en:'Brake Fluids',ru:'Тормозные жидкости',slug:'oil-brake'},
    {ka:'ტაოტები',en:'Greases',ru:'Смазки',slug:'oil-taoti'},
    {ka:'ანტიფრიზები',en:'Antifreeze',ru:'Антифриз',slug:'oil-antifreeze'},
    {ka:'გერმეტიკები',en:'Sealants',ru:'Герметики',slug:'oil-germetiki'},
    {ka:'სარეცხები',en:'Cleaners',ru:'Очистители',slug:'oil-sarecxi'},
    {ka:'წებოები',en:'Adhesives',ru:'Клеи',slug:'oil-cebo'},
    {ka:'სხვა საპოხი',en:'Other Fluids',ru:'Прочие жидкости',slug:'oil-other'},
  ],
  glass:[
    {ka:'წინა საქარე მინები',en:'Front Windshields',ru:'Лобовые стёкла',slug:'glass-wina'},
    {ka:'უკანა საქარე მინები',en:'Rear Windshields',ru:'Задние стёкла',slug:'glass-ukana'},
    {ka:'უკანა კარის მინები',en:'Rear Door Glass',ru:'Стёкла задних дверей',slug:'glass-ukana-kari'},
    {ka:'წინა კარის მინები',en:'Front Door Glass',ru:'Стёкла передних дверей',slug:'glass-wina-kari'},
    {ka:'გვერდითი მინები',en:'Side Glass',ru:'Боковые стёкла',slug:'glass-gverditi'},
    {ka:'სახურავის მინები',en:'Roof Glass',ru:'Стёкла крыши',slug:'glass-saxuravi'},
  ],
  tires:[
    {ka:'საზაფხულო საბურავები',en:'Summer Tires',ru:'Летние шины',slug:'tires-summer'},
    {ka:'სასათბურამო საბურავები',en:'Winter Tires',ru:'Зимние шины',slug:'tires-winter'},
    {ka:'ყოვლისეზონიანი',en:'All Season',ru:'Всесезонные',slug:'tires-allseason'},
    {ka:'დისკები',en:'Rims',ru:'Диски',slug:'tires-rims'},
    {ka:'საბურავების სხვა',en:'Other Tires',ru:'Прочее',slug:'tires-other'},
  ],
  accessories:[
    {ka:'TUNING',en:'Tuning',ru:'Тюнинг',slug:'acc-tuning'},
    {ka:'სალონის აქსესუარები',en:'Interior Accessories',ru:'Аксессуары салона',slug:'acc-saloni'},
    {ka:'ძარის კარბონები',en:'Carbon Body Parts',ru:'Карбоновые детали',slug:'acc-carbon'},
    {ka:'სიგნალები',en:'Horns & Alarms',ru:'Сигналы',slug:'acc-signal'},
    {ka:'დენის ადაპტერები',en:'Power Adapters',ru:'Переходники питания',slug:'acc-adapter'},
    {ka:'აკუმულატორები',en:'Batteries',ru:'Аккумуляторы',slug:'acc-akumulatori'},
  ],
};
async function main() {
  console.log('🗑️  ძველი კატეგორიები იშლება...');
  await p.category.deleteMany({});
  console.log('✅ წაიშალა\n📁 მთავარი კატეგორიები ემატება...');
  const created = {};
  for (const c of MAIN_CATS) {
    const cat = await p.category.create({ data:{slug:c.slug,nameKa:c.nameKa,nameEn:c.nameEn,nameRu:c.nameRu,icon:c.icon,order:c.order,isActive:true} });
    created[c.slug] = cat.id;
    console.log('  ✅', c.nameKa);
  }
  console.log('\n📂 ქვეკატეგორიები ემატება...');
  for (const [ps, subs] of Object.entries(SUBS)) {
    const pid = created[ps];
    if (!pid) { console.log('  ❌', ps); continue; }
    for (let i=0;i<subs.length;i++) {
      const s=subs[i];
      await p.category.create({ data:{slug:s.slug,nameKa:s.ka,nameEn:s.en,nameRu:s.ru,icon:'📦',order:i+1,parentId:pid,isActive:true} });
      console.log('    ✅', s.ka);
    }
  }
  const total = await p.category.count();
  console.log('\n🎉 სულ', total, 'კატეგორია დაემატა!');
}
main().catch(console.error).finally(()=>p.$disconnect());
