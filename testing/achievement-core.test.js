const assert = require('node:assert/strict');
const achievements = require('../static/js/achievement-core.js');

const place = (name, city, country = '中国', extra = {}) => ({name, city, country, ...extra});
const trips = [
  {id: 'train-1', mode: 'train', date: null, service: 'G1111', model: 'CRH380A',
    origin: place('香港西九龙', '香港'), destination: place('深圳北', '深圳'),
    departureTime: '08:00', arrivalTime: '09:00'},
  {id: 'air-1', mode: 'air', date: '2025-01-02', departureDate: '2025-01-02', arrivalDate: '2025-01-02',
    service: 'HU100', model: 'A321-200', origin: place('香港', '香港', 'Hong Kong (China)', {code: 'HKG'}),
    destination: place('深圳宝安', '深圳', 'China', {code: 'SZX'}), departureTime: '10:00', arrivalTime: '11:00'},
  {id: 'train-2', mode: 'train', date: '2025-01-03', service: 'G2222', model: 'CRH380AL',
    origin: place('深圳北', '深圳'), destination: place('深圳北', '深圳'),
    departureTime: '12:00', arrivalTime: '13:00'},
];
const result = achievements.build(trips, [{model: 'CRH380A'}, {model: 'CRH380AL'}, {model: 'CRH3A'}]);
assert.equal(result.counts.city, 2, '香港和深圳在火车与飞机之间共享计数');
assert.equal(result.entries.city.find(row => row.name === '香港').count, 2);
assert.equal(result.entries.city.find(row => row.name === '香港').when.date, null);
assert.equal(result.entries.station.find(row => row.name === '深圳北').count, 2, '同一行程两端相同车站只算一次');
assert.equal(result.counts.airport, 2);
assert.deepEqual(result.repeatedServices.map(row => row.display), ['G1111', 'G2222']);
assert.equal(result.collections.find(row => row.prefix === 'CRH380A').completed, true);
assert.equal(result.collections.find(row => row.prefix === 'CRH3').total, 1, 'CRH3 系列不包含 CRH380');
assert.ok(result.unlocked.some(row => row.title === 'CRH380A 全收集'));
assert.equal(achievements.nextMilestone('station', 100), 150);
assert.equal(achievements.nextMilestone('station', 195), 200);
assert.equal(achievements.nextMilestone('aircraft-model', 200), 250);
assert.equal(achievements.isMilestone('station', 150), true);
assert.equal(achievements.isMilestone('station', 175), false);

const manyTrips = Array.from({length: 199}, (_, index) => ({
  id: `many-${index}`, mode: 'train', date: '2025-02-01', service: `G${index + 3000}`, model: 'CRH1A',
  origin: place('总站', '总站城'), destination: place(`车站${index + 1}`, `城市${index + 1}`),
  departureTime: '08:00', arrivalTime: '09:00',
}));
const many = achievements.build(manyTrips);
assert.deepEqual(many.unlocked.filter(row => row.category === 'station').map(row => row.threshold), [1, 5, 10, 50, 100, 150, 200]);
assert.deepEqual(achievements.groupUnlocked(many.unlocked).find(group => group.category === 'station').items.map(row => row.threshold), [200, 150, 100, 50, 10, 5, 1]);
console.log('achievement-core: OK');
