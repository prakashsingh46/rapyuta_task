const { Items, Auctions } = require('./store/db');

const dummyItems = [
  { name: 'Vintage Watch', description: 'Rare 1960s Swiss watch', basePrice: 100, minIncrement: 10 },
  { name: 'Antique Vase', description: 'Ming dynasty replica', basePrice: 200, minIncrement: 20 },
  { name: 'Classic Guitar', description: 'Acoustic guitar from 1975', basePrice: 150, minIncrement: 15 },
  { name: 'Oil Painting', description: 'Original landscape painting', basePrice: 300, minIncrement: 25 },
  { name: 'Diamond Ring', description: '2 carat diamond ring', basePrice: 500, minIncrement: 50 },
  { name: 'Leather Jacket', description: 'Vintage 1980s biker jacket', basePrice: 120, minIncrement: 10 },
  { name: 'Gold Necklace', description: '18K gold chain necklace', basePrice: 350, minIncrement: 25 },
  { name: 'Mechanical Keyboard', description: 'Rare Cherry MX Blue switches', basePrice: 80, minIncrement: 5 },
  { name: 'Signed Baseball', description: 'Autographed by legend player', basePrice: 250, minIncrement: 20 },
  { name: 'Antique Clock', description: 'Victorian era grandfather clock', basePrice: 400, minIncrement: 30 },
  { name: 'Rare Coin Set', description: 'Collection of 1800s silver coins', basePrice: 600, minIncrement: 50 },
  { name: 'Vintage Camera', description: 'Leica M3 from 1954', basePrice: 450, minIncrement: 35 },
  { name: 'First Edition Book', description: 'Classic novel first print', basePrice: 180, minIncrement: 15 },
  { name: 'Silver Bracelet', description: 'Handcrafted sterling silver', basePrice: 90, minIncrement: 10 },
  { name: 'Vinyl Record Collection', description: '50 classic rock albums', basePrice: 220, minIncrement: 20 }
];

console.log('Seeding database...');

Items.deleteAll();
Auctions.deleteAll();
console.log('Cleared existing data');

const createdItems = Items.insertMany(dummyItems);
console.log('Created ' + createdItems.length + ' items');

const auctions = createdItems.map(item => ({
  item: item._id,
  itemSnapshot: {
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl || '',
    basePrice: item.basePrice,
    minIncrement: item.minIncrement
  },
  timerDuration: 60,
  timerExtension: 10,
  status: 'pending',
  endsAt: null
}));

Auctions.insertMany(auctions);
console.log('Created ' + auctions.length + ' pending auctions');

console.log('\nSeeding complete!');
console.log('Items:');
createdItems.forEach((item, i) => {
  console.log('  ' + (i + 1) + '. ' + item.name + ' - $' + item.basePrice);
});
