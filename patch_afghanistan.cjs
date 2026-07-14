const fs = require('fs');

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson for Afghanistan...');
  const res = await fetch(url);
  const data = await res.json();
  const afg = data.features.find(f => f.properties.name === 'Afghanistan');
  if (!afg) {
    console.error('Afghanistan not found in GeoJSON!');
    return;
  }
  const preciseCoords = afg.geometry.coordinates;

  const file = './dist/assets/index-BNxUlhcr.js';
  let content = fs.readFileSync(file, 'utf8');

  // Inject Afghanistan cities dictionary
  const afgCities = '"أفغانستان":[{name:"كابول",lat:34.5553,lon:69.2075},{name:"جلال أباد",lat:34.4261,lon:70.4514},{name:"فيض أباد",lat:37.1166,lon:70.5800},{name:"قندوز",lat:36.7290,lon:68.8680},{name:"مزار",lat:36.6998,lon:67.1164},{name:"ساريبول",lat:35.8632,lon:66.2636},{name:"قندهار",lat:31.6289,lon:65.7372},{name:"هرات",lat:34.3529,lon:62.2040},{name:"غورماج",lat:35.7305,lon:63.7826}],';
  content = content.replace('العراق:[{name:"الأنبار"', afgCities + 'العراق:[{name:"الأنبار"');

  // Inject Afghanistan boundaries
  const afgBounds = `"أفغانستان":${JSON.stringify(preciseCoords)},`;
  content = content.replace('العراق:[[[45.420618', afgBounds + 'العراق:[[[45.420618');

  fs.writeFileSync(file, content);
  console.log('Patched Afghanistan successfully!');
}

run().catch(console.error);
