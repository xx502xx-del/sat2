const fs = require('fs');

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson for Kyrgyzstan...');
  const res = await fetch(url);
  const data = await res.json();
  const kgz = data.features.find(f => f.properties.name === 'Kyrgyzstan');
  if (!kgz) {
    console.error('Kyrgyzstan not found in GeoJSON!');
    return;
  }
  const preciseCoords = kgz.geometry.coordinates;

  const file = './dist/assets/index-BNxUlhcr.js';
  let content = fs.readFileSync(file, 'utf8');

  // Inject Kyrgyzstan cities dictionary
  const kgzCities = '"قيرغيزستان":[{name:"بيشكيك",lat:42.8746,lon:74.5698},{name:"أنديجان",lat:40.7821,lon:72.3442},{name:"أوزكند",lat:40.7686,lon:73.3006},{name:"طلاس",lat:42.5228,lon:72.2428},{name:"إيسيك كول",lat:42.4907,lon:78.3932},{name:"خان تنغري",lat:42.2133,lon:80.1775},{name:"نارين",lat:41.4287,lon:75.9911}],';
  content = content.replace('العراق:[{name:"الأنبار"', kgzCities + 'العراق:[{name:"الأنبار"');

  // Inject Kyrgyzstan boundaries
  const kgzBounds = `"قيرغيزستان":${JSON.stringify(preciseCoords)},`;
  content = content.replace('العراق:[[[45.420618', kgzBounds + 'العراق:[[[45.420618');

  fs.writeFileSync(file, content);
  console.log('Patched Kyrgyzstan successfully!');
}

run().catch(console.error);
