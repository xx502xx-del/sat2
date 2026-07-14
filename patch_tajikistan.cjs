const fs = require('fs');

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson for Tajikistan...');
  const res = await fetch(url);
  const data = await res.json();
  const tjk = data.features.find(f => f.properties.name === 'Tajikistan');
  if (!tjk) {
    console.error('Tajikistan not found in GeoJSON!');
    return;
  }
  const preciseCoords = tjk.geometry.coordinates;

  const file = './dist/assets/index-BNxUlhcr.js';
  let content = fs.readFileSync(file, 'utf8');

  // Inject Tajikistan cities dictionary
  const tjkCities = '"طاجيكستان":[{name:"دوشانبي",lat:38.5358,lon:68.7790},{name:"كولاب",lat:37.9103,lon:69.7789},{name:"خجند",lat:40.2853,lon:69.6222},{name:"بوختار",lat:37.8344,lon:68.7803},{name:"خوروغ",lat:37.4920,lon:71.5064},{name:"بانجيكينت",lat:39.4975,lon:67.6105}],';
  content = content.replace('العراق:[{name:"الأنبار"', tjkCities + 'العراق:[{name:"الأنبار"');

  // Inject Tajikistan boundaries
  const tjkBounds = `"طاجيكستان":${JSON.stringify(preciseCoords)},`;
  content = content.replace('العراق:[[[45.420618', tjkBounds + 'العراق:[[[45.420618');

  fs.writeFileSync(file, content);
  console.log('Patched Tajikistan successfully!');
}

run().catch(console.error);
