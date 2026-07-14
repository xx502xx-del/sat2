const fs = require('fs');

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson for Uzbekistan...');
  const res = await fetch(url);
  const data = await res.json();
  const uzb = data.features.find(f => f.properties.name === 'Uzbekistan');
  if (!uzb) {
    console.error('Uzbekistan not found in GeoJSON!');
    return;
  }
  const preciseCoords = uzb.geometry.coordinates;

  const file = './dist/assets/index-BNxUlhcr.js';
  let content = fs.readFileSync(file, 'utf8');

  // Inject Uzbekistan cities dictionary
  const uzbCities = '"أوزبكستان":[{name:"سمرقند",lat:39.6542,lon:66.9597},{name:"بخارى",lat:39.7747,lon:64.4286},{name:"طشقند",lat:41.2995,lon:69.2401},{name:"جيزك",lat:40.1190,lon:67.8420},{name:"قرشي",lat:38.8612,lon:65.7959},{name:"خيوة",lat:41.3783,lon:60.3639},{name:"نكوص",lat:42.4531,lon:59.6022}],';
  content = content.replace('العراق:[{name:"الأنبار"', uzbCities + 'العراق:[{name:"الأنبار"');

  // Inject Uzbekistan boundaries
  const uzbBounds = `"أوزبكستان":${JSON.stringify(preciseCoords)},`;
  content = content.replace('العراق:[[[45.420618', uzbBounds + 'العراق:[[[45.420618');

  fs.writeFileSync(file, content);
  console.log('Patched Uzbekistan successfully!');
}

run().catch(console.error);
