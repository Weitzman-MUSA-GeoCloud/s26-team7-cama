/* global maplibregl */
import 'maplibre-gl';

async function initMap() {
  // Fetch a Shortbread compatible style
  const response = await fetch('https://tiles.versatiles.org/assets/styles/colorful/style.json');
  const style = await response.json();

  // Get the Map Container Element
  const mapElement = document.getElementById('map');
  const tileUrl = mapElement.dataset.tileUrl;

  // Override the source to use the OpenStreetMap Foundation Vector Tiles
  style.sources['versatiles-shortbread'] = {
    type: 'vector',
    url: tileUrl,
  };

  const map = new maplibregl.Map({
    container: 'map',
    style: style,
    center: [-75.1652, 39.9526], // Philadelphia
    zoom: 12,
    hash: 'view',
    attributionControl: false, // We will manually add one
  });

  map.addControl(new maplibregl.NavigationControl());

  // Custom Attribution for OSM Policies compliance
  const emailContact = 'mjumbe@design.upenn.edu';
  const fixthemapLink = '<a href="https://www.openstreetmap.org/fixthemap" target="_blank">Fix the map</a>';
  const mailToLink = `<a href="mailto:${emailContact}">Contact App Admin</a>`;

  map.addControl(new maplibregl.AttributionControl({
    customAttribution: `${fixthemapLink} | ${mailToLink}`,
  }));
}

initMap();
