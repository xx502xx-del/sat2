const fs = require('fs');

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson for India...');
  const res = await fetch(url);
  const data = await res.json();
  const ind = data.features.find(f => f.properties.name === 'India');
  if (!ind) {
    console.error('India not found in GeoJSON!');
    return;
  }
  const preciseCoords = ind.geometry.coordinates;

  const file = './dist/assets/index-BNxUlhcr.js';
  let content = fs.readFileSync(file, 'utf8');

  // Inject India cities dictionary
  const indCities = '"الهند":[{name:"كوشي",lat:9.9312,lon:76.2673},{name:"مونار",lat:10.0889,lon:77.0595},{name:"كولام",lat:8.8932,lon:76.6141},{name:"كانور",lat:11.8745,lon:75.3704},{name:"غوا",lat:15.4909,lon:73.8278},{name:"بونة",lat:18.5204,lon:73.8567},{name:"ناشيك",lat:19.9975,lon:73.7898},{name:"سورات",lat:21.1702,lon:72.8311},{name:"أحمد أباد",lat:23.0225,lon:72.5714},{name:"غوجارات",lat:23.2156,lon:72.6369},{name:"إندور",lat:22.7196,lon:75.8577},{name:"راجستان",lat:26.9124,lon:75.7873},{name:"ناجبور",lat:21.1458,lon:79.0882},{name:"نيودلهي",lat:28.6139,lon:77.2090},{name:"البنجاب",lat:30.7333,lon:76.7794},{name:"لكناو",lat:26.8467,lon:80.9462},{name:"بنارس",lat:25.3176,lon:82.9739},{name:"تشيناي",lat:13.0827,lon:80.2707},{name:"فيشاخاباتنام",lat:17.6868,lon:83.2185},{name:"بيهار",lat:25.5941,lon:85.1376}],';
  content = content.replace('العراق:[{name:"الأنبار"', indCities + 'العراق:[{name:"الأنبار"');

  // Inject India boundaries
  const indBounds = `"الهند":${JSON.stringify(preciseCoords)},`;
  content = content.replace('العراق:[[[45.420618', indBounds + 'العراق:[[[45.420618');

  fs.writeFileSync(file, content);
  console.log('Patched India successfully!');
}

run().catch(console.error);
