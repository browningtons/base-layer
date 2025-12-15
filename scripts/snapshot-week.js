import fs from 'fs';

const today = new Date();
today.setDate(today.getDate() - today.getDay());
today.setHours(0,0,0,0);

const weekKey = today.toISOString().slice(0,10);
const outputPath = `data/weekly/${weekKey}.json`;

const categories = ['body', 'mind', 'family', 'social'];

const snapshot = {
  week: weekKey,
  createdAt: new Date().toISOString(),
  categories: {}
};

for (const cat of categories) {
  snapshot.categories[cat] = {};
}

fs.mkdirSync('data/weekly', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));

console.log(`Weekly snapshot created: ${outputPath}`);
