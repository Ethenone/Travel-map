(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TravelAchievements = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const milestones = {
    city: [1, 5, 10, 50, 100],
    station: [1, 5, 10, 50, 100],
    airport: [1, 5, 10, 50, 100],
    'train-model': [1, 5, 10, 25, 50, 100],
    'aircraft-model': [1, 5, 10, 25, 50, 100],
  };
  const categories = {
    city: {title: '城市巡礼', unit: '座城市', icon: 'buildings'},
    station: {title: '车站巡礼', unit: '座车站', icon: 'train-front'},
    airport: {title: '机场巡礼', unit: '座机场', icon: 'airplane'},
    'train-model': {title: '列车图鉴', unit: '种车型', icon: 'train-lightrail-front'},
    'aircraft-model': {title: '云端机型', unit: '种机型', icon: 'airplane-engines'},
  };
  const clean = value => String(value ?? '').trim();
  const china = value => ['China', '中国', 'Hong Kong (China)'].includes(clean(value));
  const cityName = place => {
    const value = clean(place?.city);
    if (value === '香港特别行政区' || value === '香港') return '香港';
    return china(place?.country) ? value.replace(/市$/, '') : value;
  };
  const countryKey = place => china(place?.country) ? '中国' : clean(place?.country);
  const moment = (trip, arrival = false) => {
    const day = clean((arrival ? trip.arrivalDate : trip.departureDate) || trip.date);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!match) return Number.NEGATIVE_INFINITY;
    const clock = clean(arrival ? trip.arrivalTime : trip.departureTime);
    const parts = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clock);
    const minutes = parts ? Number(parts[1]) * 60 + Number(parts[2]) : 12 * 60;
    const offset = clean((arrival ? trip.destination : trip.origin)?.utcOffset);
    const zone = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset);
    const zoneMinutes = zone ? (zone[1] === '+' ? 1 : -1) * (Number(zone[2]) * 60 + Number(zone[3] || 0)) : 0;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, minutes) - zoneMinutes * 60000;
  };
  const when = (trip, arrival = false) => ({
    date: clean((arrival ? trip.arrivalDate : trip.departureDate) || trip.date) || null,
    time: clean(arrival ? trip.arrivalTime : trip.departureTime) || null,
    zone: clean((arrival ? trip.destination : trip.origin)?.utcOffset) || null,
  });
  const repeatedService = value => {
    const match = /^([A-Za-z]*)(\d)\2{3}$/.exec(clean(value).toUpperCase());
    return match ? match[0] : null;
  };
  const collectionSpecs = [
    {prefix: 'CRH380A', title: 'CRH380A 全收集'},
    {prefix: 'CRH380B', title: 'CRH380B 全收集'},
    {prefix: 'CR400AF', title: 'CR400AF 全收集'},
    {prefix: 'CR400BF', title: 'CR400BF 全收集'},
    {prefix: 'CRH380', title: 'CRH380 全收集'},
    {prefix: 'CRH1', title: 'CRH1 全收集'},
    {prefix: 'CRH2', title: 'CRH2 全收集'},
    {prefix: 'CRH3', excludePrefix: 'CRH380', title: 'CRH3 全收集'},
    {prefix: 'CRH5', title: 'CRH5 全收集'},
    {prefix: 'CRH6', title: 'CRH6 全收集'},
  ];
  const isMilestone = (category, count) => milestones[category].includes(count) || (count > 100 && count % 50 === 0);
  const nextMilestone = (category, count) =>
    milestones[category].find(value => value > count) ?? 100 + 50 * (Math.floor((count - 100) / 50) + 1);
  const achievementOrder = ['city', 'station', 'airport', 'train-model', 'aircraft-model', 'consecutive', 'collection'];
  const groupUnlocked = items => achievementOrder.map(category => ({
    category,
    items: items.filter(item => item.category === category).sort((a, b) =>
      a.stamp === b.stamp ? a.order - b.order || (a.threshold || 0) - (b.threshold || 0) : a.stamp - b.stamp).reverse(),
  })).filter(group => group.items.length);

  function build(trips, trainRoster = []) {
    const events = [];
    trips.forEach((trip, order) => {
      const once = new Set();
      const add = (category, name, key, place, arrival = false) => {
        if (!clean(name) || !clean(key)) return;
        const identity = `${category}\u0000${key}`;
        if (once.has(identity)) return;
        once.add(identity);
        events.push({category, name: clean(name), key, place, tripId: trip.id, order,
          slot: events.length, stamp: moment(trip, arrival), when: when(trip, arrival)});
      };
      for (const [place, arrival] of [[trip.origin, false], [trip.destination, true]]) {
        const country = countryKey(place);
        if (trip.mode === 'train') add('station', place?.name, `${country}|${clean(place?.name)}`, place, arrival);
        else add('airport', place?.name, clean(place?.code) || `${country}|${clean(place?.name)}`, place, arrival);
        const city = cityName(place);
        add('city', city, `${country}|${city}`, place, arrival);
      }
      if (trip.mode === 'train') {
        add('train-model', trip.model, clean(trip.model), null);
        const service = repeatedService(trip.service);
        if (service) events.push({category: 'service', display: service, tripId: trip.id, order,
          slot: events.length, stamp: moment(trip), when: when(trip)});
      } else add('aircraft-model', trip.model, clean(trip.model), null);
    });
    events.sort((a, b) => a.stamp - b.stamp || a.order - b.order || a.slot - b.slot);

    const entries = Object.fromEntries(Object.keys(milestones).map(key => [key, new Map()]));
    const unlocked = [];
    const seenServices = new Set();
    const repeatedServices = [];
    for (const event of events) {
      if (event.category === 'service') {
        if (!seenServices.has(event.display)) {
          seenServices.add(event.display);
          repeatedServices.push(event);
          unlocked.push({category: 'consecutive', title: '连号车次', detail: event.display,
            when: event.when, tripId: event.tripId, stamp: event.stamp, order: event.order});
        }
        continue;
      }
      const categoryEntries = entries[event.category];
      const previous = categoryEntries.get(event.key);
      if (previous) {
        previous.count += 1;
        continue;
      }
      categoryEntries.set(event.key, {...event, count: 1});
      const count = categoryEntries.size;
      if (isMilestone(event.category, count)) {
        unlocked.push({category: event.category,
          title: event.category === 'train-model' && count === 100 ? '遍观百车' : `${categories[event.category].title} · ${count}`,
          detail: `打卡 ${count} ${categories[event.category].unit}`,
          when: event.when, tripId: event.tripId, threshold: count, stamp: event.stamp, order: event.order});
      }
    }
    const collections = collectionSpecs.map(spec => {
      const names = [...new Set(trainRoster.map(row => clean(row.model)).filter(name =>
        name.startsWith(spec.prefix) && (!spec.excludePrefix || !name.startsWith(spec.excludePrefix))))];
      const models = names.map(model => ({model, visit: entries['train-model'].get(model) || null}));
      const seen = models.filter(item => item.visit).length;
      const completed = models.length > 0 && seen === models.length;
      if (completed) {
        const latest = models.map(item => item.visit).sort((a, b) => a.stamp - b.stamp || a.order - b.order).at(-1);
        unlocked.push({category: 'collection', title: spec.title,
          detail: `${seen} / ${models.length} 种系列车型`, when: latest.when, tripId: latest.tripId,
          stamp: latest.stamp, order: latest.order});
      }
      return {...spec, models, seen, total: models.length, completed};
    });
    return {
      categories, milestones, entries: Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, [...value.values()]])),
      counts: Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value.size])),
      unlocked, collections, repeatedServices,
    };
  }
  return {build, categories, milestones, isMilestone, nextMilestone, groupUnlocked, cityName, moment};
});
