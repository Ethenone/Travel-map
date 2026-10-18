(function () {
    'use strict';

    const panel = document.querySelector('.road-panel');
    if (!panel || typeof map === 'undefined') return;

    const basemapControl = document.createElement('label');
    basemapControl.className = 'track-mode-control';
    basemapControl.innerHTML = '<span>底图样式</span><select id="basemapMode"><option value="tracks">深色轨迹</option><option value="city">浅色路网</option></select>';
    panel.insertBefore(basemapControl, panel.querySelector('.city-select'));

    const control = document.createElement('label');
    control.className = 'track-mode-control';
    control.innerHTML = '<span>轨迹图层</span><select id="trackMode"><option value="road">仅公路</option><option value="combined">铁路 + 公路</option></select>';
    panel.insertBefore(control, panel.querySelector('.city-select'));

    const legend = document.createElement('div');
    legend.className = 'track-mode-legend';
    legend.innerHTML = '<span><i></i>公路</span><span class="rail-key" hidden><i></i>铁路</span>';
    panel.insertBefore(legend, panel.querySelector('.city-select'));

    const status = document.createElement('div');
    status.className = 'track-mode-status';
    status.setAttribute('role', 'status');
    status.hidden = true;
    panel.insertBefore(status, panel.querySelector('.city-select'));

    const selector = control.querySelector('select');
    const basemapSelector = basemapControl.querySelector('select');
    const railKey = legend.querySelector('.rail-key');
    let railwayRequest;

    const basemapStyles = {
        tracks: 'https://demotiles.maplibre.org/style.json',
        city: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
                }
            },
            layers: [
                { id: 'city-road-background', type: 'background', paint: { 'background-color': '#f5f7f8' } },
                { id: 'city-road-network', type: 'raster', source: 'osm', paint: { 'raster-opacity': .58, 'raster-saturation': -.82, 'raster-contrast': -.32, 'raster-brightness-max': .98 } }
            ]
        }
    };

    basemapSelector.addEventListener('change', () => {
        map.setStyle(basemapStyles[basemapSelector.value]);
    });

    map.on('style.load', () => {
        const cityMode = basemapSelector.value === 'city';
        if (map.getLayer('road-tracks')) {
            map.setPaintProperty('road-tracks', 'line-color', cityMode ? '#08767d' : '#4dd7d0');
            map.setPaintProperty('road-tracks', 'line-opacity', cityMode ? .45 : .22);
            map.setPaintProperty('road-tracks', 'line-width', cityMode
                ? ['interpolate', ['linear'], ['zoom'], 2, 1.35, 13, 3.6]
                : ['interpolate', ['linear'], ['zoom'], 2, .7, 13, 2.8]);
        }
        if (map.getLayer('road-glow')) {
            map.setPaintProperty('road-glow', 'line-color', cityMode ? '#08767d' : '#4dd7d0');
            map.setPaintProperty('road-glow', 'line-opacity', cityMode ? .07 : .08);
        }
        legend.querySelector('span i').style.backgroundColor = cityMode ? '#08767d' : '#4dd7d0';
        railKey.querySelector('i').style.backgroundColor = cityMode ? '#b55e20' : '#ffb35c';
        if (selector.value === 'combined') setMode();
    });

    document.getElementById('resetButton').addEventListener('click', () => {
        if (basemapSelector.value === 'city') {
            map.setPaintProperty('road-tracks', 'line-opacity', .45);
        }
    });

    function showRailway(visible) {
        for (const id of ['rail-overlay-glow', 'rail-overlay-tracks']) {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
            }
        }
        railKey.hidden = !visible;
    }

    function loadRailway() {
        if (!railwayRequest) {
            railwayRequest = fetch('../data/rail_routes_real.geojson?v=jinwen-freight-1')
                .then(response => {
                    if (!response.ok) throw new Error('铁路轨迹加载失败');
                    return response.json();
                })
                .catch(error => {
                    railwayRequest = null;
                    throw error;
                });
        }
        return railwayRequest;
    }

    async function setMode() {
        const combined = selector.value === 'combined';
        const cityMode = basemapSelector.value === 'city';
        if (!combined) {
            showRailway(false);
            status.hidden = true;
            return;
        }

        if (map.getLayer('rail-overlay-tracks')) {
            showRailway(true);
            status.hidden = true;
            return;
        }

        status.textContent = '正在加载铁路轨迹…';
        status.hidden = false;
        try {
            const routes = await loadRailway();
            if (selector.value !== 'combined') return;
            if (!map.getSource('road-journeys')) {
                await new Promise(resolve => map.once('style.load', resolve));
            }
            if (selector.value !== 'combined') return;
            if (!map.getSource('rail-overlay')) {
                map.addSource('rail-overlay', { type: 'geojson', data: routes });
                map.addLayer({
                    id: 'rail-overlay-glow', type: 'line', source: 'rail-overlay',
                    paint: {
                        'line-color': cityMode ? '#b55e20' : '#ffb35c',
                        'line-width': cityMode ? 3.5 : 2.5,
                        'line-opacity': cityMode ? .05 : .035,
                        'line-blur': 2
                    }
                }, 'road-glow');
                map.addLayer({
                    id: 'rail-overlay-tracks', type: 'line', source: 'rail-overlay',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: {
                        'line-color': cityMode ? '#b55e20' : '#ffb35c',
                        'line-width': cityMode
                            ? ['interpolate', ['linear'], ['zoom'], 2, 1.15, 13, 3]
                            : ['interpolate', ['linear'], ['zoom'], 2, .55, 13, 1.7],
                        'line-opacity': cityMode ? .46 : .28
                    }
                }, 'road-glow');
                map.on('click', 'rail-overlay-tracks', event => {
                    const props = event.features[0].properties;
                    const popup = document.createElement('div');
                    popup.className = 'route-popup';
                    const title = document.createElement('strong');
                    title.textContent = String(props.train || '铁路轨迹');
                    popup.appendChild(title);
                    const details = document.createElement('span');
                    details.textContent = [props.from, props.to].filter(Boolean).join(' → ');
                    popup.appendChild(details);
                    new maplibregl.Popup({ closeButton: false, maxWidth: '280px' })
                        .setLngLat(event.lngLat).setDOMContent(popup).addTo(map);
                });
                map.on('mouseenter', 'rail-overlay-tracks', () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', 'rail-overlay-tracks', () => { map.getCanvas().style.cursor = ''; });
            }
            showRailway(true);
            status.hidden = true;
        } catch (error) {
            if (selector.value === 'combined') {
                status.textContent = '铁路轨迹加载失败，请重试';
                status.hidden = false;
            }
        }
    }

    selector.addEventListener('change', setMode);
})();
