const fs = require('fs');

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson for Turkmenistan...');
  const res = await fetch(url);
  const data = await res.json();
  const tkm = data.features.find(f => f.properties.name === 'Turkmenistan');
  if (!tkm) {
    console.error('Turkmenistan not found in GeoJSON!');
    return;
  }
  const preciseCoords = tkm.geometry.coordinates;

  const file = './dist/assets/index-BNxUlhcr.js';
  let content = fs.readFileSync(file, 'utf8');

  // Inject Turkmenistan cities dictionary
  const tkmCities = '"تركمانستان":[{name:"عشق أباد",lat:37.9601,lon:58.3260},{name:"ماري",lat:37.5958,lon:61.8386},{name:"تركمانباشي",lat:40.0222,lon:52.9811},{name:"تركمان أباد",lat:39.0142,lon:63.5786},{name:"داشوغوز",lat:41.8361,lon:59.9667}],';
  content = content.replace('العراق:[{name:"الأنبار"', tkmCities + 'العراق:[{name:"الأنبار"');

  // Inject Turkmenistan boundaries
  const tkmBounds = `"تركمانستان":${JSON.stringify(preciseCoords)},`;
  content = content.replace('العراق:[[[45.420618', tkmBounds + 'العراق:[[[45.420618');

  fs.writeFileSync(file, content);
  console.log('Patched Turkmenistan successfully!');
}

run().catch(console.error);
