const fs = require('fs');
let c = fs.readFileSync('/var/www/kibilov-frontend/src/app/layout.tsx', 'utf8');

const oldMeta = `export const metadata: Metadata = {
  title: 'Kibilov AutoParts — ავტონაწილების ონლაინ მაღაზია',
  description: 'ავტონაწილები ყველა მარკისთვის. BOG, TBC გადახდა. სწრაფი მიტანა რუსთავი, თბილისი, მთელ საქართველოში.',
  keywords: 'ავტონაწილები, auto parts, автозапчасти, kibilov, რუსთავი, გეორგია',
  openGraph: {
    title: 'Kibilov AutoParts',
    description: 'ავტონაწილების ონლაინ მაღაზია',
    siteName: 'Kibilov AutoParts',
    locale: 'ka_GE',
    type: 'website',
  },
};`;

const newMeta = `export const metadata: Metadata = {
  title: 'Kibilov AutoParts — ავტონაწილები საქართველოში | AI ძებნა',
  description: 'ავტონაწილები ყველა მარკისთვის — BMW, Mercedes, Toyota, VW, Opel და სხვა. AI ძებნა ქართულად. სწრაფი მიტანა თბილისი, რუსთავი, მთელ საქართველოში. VIN სკანირება, ტექპასპორტი.',
  keywords: 'ავტონაწილები, auto parts, автозапчасти, kibilov, კიბილოვი, რუსთავი, თბილისი, BMW ნაწილები, Mercedes ნაწილები, Toyota ნაწილები, სამუხრუჭე ხუნდი, ამორტიზატორი, ფილტრი, VIN',
  authors: [{ name: 'Kibilov AutoParts', url: 'https://kibilov.ge' }],
  creator: 'Kibilov AutoParts',
  publisher: 'Kibilov AutoParts',
  metadataBase: new URL('https://kibilov.ge'),
  alternates: { canonical: 'https://kibilov.ge' },
  openGraph: {
    title: 'Kibilov AutoParts — ავტონაწილები საქართველოში',
    description: 'AI ძებნა ქართულად. BMW, Mercedes, Toyota და 30+ მარკა. VIN სკანირება.',
    siteName: 'Kibilov AutoParts',
    locale: 'ka_GE',
    type: 'website',
    url: 'https://kibilov.ge',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Kibilov AutoParts' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kibilov AutoParts — ავტონაწილები საქართველოში',
    description: 'AI ძებნა ქართულად. BMW, Mercedes, Toyota და 30+ მარკა.',
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: '' },
};`;

if (c.includes(oldMeta)) {
  c = c.replace(oldMeta, newMeta);
  console.log('✅ metadata გაუმჯობესდა');
} else {
  console.log('❌ not found');
}
fs.writeFileSync('/var/www/kibilov-frontend/src/app/layout.tsx', c);
