(function () {
    'use strict';

    const data = window.CYCLING_HEAT_DATA;
    const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([31.08, 121.43], 10);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    const gradient = {
        0.14: '#83d4cd',
        0.36: '#359fa9',
        0.60: '#ecc174',
        0.82: '#ed8b61',
        1: '#d97759'
    };
    const routeLines = L.layerGroup(data.paths.filter(path => path.length > 1).map(path =>
        L.polyline(path, { color: '#188d91', weight: 1.2, opacity: 0.22, interactive: false })
    ));
    routeLines.addTo(map);
    const heatLayers = {
        routes: L.heatLayer(data.routes, {
            radius: 17, blur: 23, minOpacity: 0.09, maxZoom: 11, max: 8, gradient
        }),
        starts: L.heatLayer(data.starts, {
            radius: 22, blur: 25, minOpacity: 0.1, maxZoom: 11, max: 5, gradient
        }),
        ends: L.heatLayer(data.ends, {
            radius: 22, blur: 25, minOpacity: 0.1, maxZoom: 11, max: 5, gradient
        })
    };
    let activeHeat = heatLayers.routes;
    activeHeat.addTo(map);

    function updateHeatScale() {
        const mode = document.getElementById('heatMode').value;
        const points = data[mode];
        const bounds = map.getBounds();
        const south = bounds.getSouth();
        const north = bounds.getNorth();
        const west = bounds.getWest();
        const east = bounds.getEast();
        let visibleCount = 0;
        for (const [lat, lon] of points) {
            if (lat >= south && lat <= north && lon >= west && lon <= east) visibleCount++;
        }
        const routes = mode === 'routes';
        const reference = routes ? 7000 : 500;
        const base = routes ? 3.5 : 3;
        const minimum = routes ? 0.75 : 0.9;
        const zoomFactor = Math.pow(2, Math.max(0, 10 - map.getZoom()));
        const maximum = Math.max(minimum, Math.min(base * 1.3, base * Math.sqrt(visibleCount / reference)));
        activeHeat.setOptions({ max: maximum * zoomFactor });
    }
    map.on('moveend', updateHeatScale);
    updateHeatScale();

    const connections = L.layerGroup(data.connections.map(([start, end]) =>
        L.polyline([start, end], { color: '#347c86', weight: 1, opacity: 0.16, interactive: false })
    ));

    document.getElementById('heatMode').addEventListener('change', function () {
        map.removeLayer(activeHeat);
        activeHeat = heatLayers[this.value];
        if (this.value === 'routes' && document.getElementById('showPaths').checked) routeLines.addTo(map);
        else map.removeLayer(routeLines);
        activeHeat.addTo(map);
        updateHeatScale();
    });

    document.getElementById('showPaths').addEventListener('change', function () {
        if (this.checked && document.getElementById('heatMode').value === 'routes') routeLines.addTo(map);
        else map.removeLayer(routeLines);
    });

    const citySelect = document.getElementById('citySelect');
    const chinaRoutes = data.routes.filter(([lat, lon]) => lat >= 18 && lat <= 54 && lon >= 73 && lon <= 135);
    function showChina() {
        map.fitBounds(L.latLngBounds(chinaRoutes), { padding: [35, 35], maxZoom: 7 });
    }
    for (const [name] of data.cities) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        citySelect.append(option);
    }
    citySelect.addEventListener('change', function () {
        if (this.value === 'china') return showChina();
        if (this.value === 'world') {
            map.fitBounds(L.latLngBounds(data.routes), { padding: [35, 35], maxZoom: 7 });
            return;
        }
        const city = data.cities.find(([name]) => name === this.value);
        if (city) map.setView([city[1], city[2]], city[3]);
    });

    document.getElementById('showConnections').addEventListener('change', function () {
        if (this.checked) connections.addTo(map);
        else map.removeLayer(connections);
    });

    document.getElementById('fitAll').addEventListener('click', () => {
        citySelect.value = 'china';
        showChina();
    });
})();
