import fs from 'fs';

async function run() {
  const url = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  console.log('Fetching countries geojson...');
  const res = await fetch(url);
  const data = await res.json();
  const pak = data.features.find(f => f.properties.name === 'Pakistan');
  if (!pak) {
    console.error('Pakistan not found!');
    return;
  }
  // Coordinates format in GeoJSON: [[[lon, lat], ...]]
  // Let's print them in JSON format so we can copy them
  console.log(JSON.stringify(pak.geometry.coordinates));
  fs.writeFileSync('pak_coords.json', JSON.stringify(pak.geometry.coordinates));
}

run().catch(console.error);
