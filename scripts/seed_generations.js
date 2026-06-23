require('dotenv').config({ path: '/var/www/kibilov-backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DATA = [
  // BMW 3 series
  { make:'BMW', model:'3 Series', generation:'E30', year_from:1982, year_to:1991, aliases:['e30','bmw e30','318i e30','320i e30'] },
  { make:'BMW', model:'3 Series', generation:'E36', year_from:1990, year_to:1999, aliases:['e36','bmw e36','318i e36','320i e36'] },
  { make:'BMW', model:'3 Series', generation:'E46', year_from:1997, year_to:2006, aliases:['e46','bmw e46','320d e46','318i e46'] },
  { make:'BMW', model:'3 Series', generation:'E90', year_from:2005, year_to:2012, aliases:['e90','bmw e90','320d e90','318d e90','325i e90'] },
  { make:'BMW', model:'3 Series', generation:'F30', year_from:2011, year_to:2019, aliases:['f30','bmw f30','320d f30','316d f30'] },
  { make:'BMW', model:'3 Series', generation:'G20', year_from:2018, year_to:null, aliases:['g20','bmw g20','320d g20'] },
  // BMW 5 series
  { make:'BMW', model:'5 Series', generation:'E39', year_from:1995, year_to:2003, aliases:['e39','bmw e39','520d e39','525i e39'] },
  { make:'BMW', model:'5 Series', generation:'E60', year_from:2003, year_to:2010, aliases:['e60','bmw e60','520d e60','525d e60'] },
  { make:'BMW', model:'5 Series', generation:'F10', year_from:2009, year_to:2017, aliases:['f10','bmw f10','520d f10','528i f10'] },
  { make:'BMW', model:'5 Series', generation:'G30', year_from:2017, year_to:null, aliases:['g30','bmw g30','520d g30'] },
  // BMW X5
  { make:'BMW', model:'X5', generation:'E53', year_from:1999, year_to:2006, aliases:['x5 e53','bmw x5 e53','e53'] },
  { make:'BMW', model:'X5', generation:'E70', year_from:2006, year_to:2013, aliases:['x5 e70','bmw x5 e70','e70'] },
  { make:'BMW', model:'X5', generation:'F15', year_from:2013, year_to:2018, aliases:['x5 f15','bmw x5 f15','f15'] },
  // Mercedes E-Class
  { make:'Mercedes-Benz', model:'E-Class', generation:'W210', year_from:1995, year_to:2003, aliases:['w210','mercedes w210','e-class w210'] },
  { make:'Mercedes-Benz', model:'E-Class', generation:'W211', year_from:2002, year_to:2009, aliases:['w211','mercedes w211','e-class w211','211'] },
  { make:'Mercedes-Benz', model:'E-Class', generation:'W212', year_from:2009, year_to:2016, aliases:['w212','mercedes w212','e-class w212'] },
  // Mercedes C-Class
  { make:'Mercedes-Benz', model:'C-Class', generation:'W203', year_from:2000, year_to:2007, aliases:['w203','mercedes w203','c-class w203'] },
  { make:'Mercedes-Benz', model:'C-Class', generation:'W204', year_from:2007, year_to:2014, aliases:['w204','mercedes w204','c-class w204'] },
  { make:'Mercedes-Benz', model:'C-Class', generation:'W205', year_from:2014, year_to:null, aliases:['w205','mercedes w205','c-class w205'] },
  // VW Golf
  { make:'Volkswagen', model:'Golf', generation:'Golf 4', year_from:1997, year_to:2004, aliases:['golf iv','golf4','golf mk4','golf 4','golfiv'] },
  { make:'Volkswagen', model:'Golf', generation:'Golf 5', year_from:2003, year_to:2008, aliases:['golf v','golf5','golf mk5','golf 5','golfv'] },
  { make:'Volkswagen', model:'Golf', generation:'Golf 6', year_from:2008, year_to:2013, aliases:['golf vi','golf6','golf mk6','golf 6','golfvi'] },
  { make:'Volkswagen', model:'Golf', generation:'Golf 7', year_from:2012, year_to:2020, aliases:['golf vii','golf7','golf mk7','golf 7','golfvii'] },
  // Toyota Camry
  { make:'Toyota', model:'Camry', generation:'XV40', year_from:2006, year_to:2011, aliases:['camry xv40','camry 40','camry 2006'] },
  { make:'Toyota', model:'Camry', generation:'XV50', year_from:2011, year_to:2017, aliases:['camry xv50','camry 50','camry 2012'] },
  { make:'Toyota', model:'Camry', generation:'XV70', year_from:2017, year_to:null, aliases:['camry xv70','camry 70','camry 2018'] },
];

(async () => {
  let inserted = 0;
  for (const row of DATA) {
    await prisma.$executeRaw`
      INSERT INTO vehicle_generations (make, model, generation, year_from, year_to, aliases)
      VALUES (${row.make}, ${row.model}, ${row.generation}, ${row.year_from}, ${row.year_to}, ${row.aliases})
      ON CONFLICT (make, model, generation) DO NOTHING
    `;
    inserted++;
  }
  console.log(`${inserted} generation ჩაიწერა`);
  await prisma.$disconnect();
})();
