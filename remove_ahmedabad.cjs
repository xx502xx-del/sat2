const fs = require('fs');
const file = './dist/assets/index-BNxUlhcr.js';
let content = fs.readFileSync(file, 'utf8');

// Replace the Ahmedabad entry with an empty string
content = content.replace('{name:"أحمد أباد",lat:23.0225,lon:72.5714},', '');

fs.writeFileSync(file, content);
console.log('Removed Ahmed Abad successfully!');
