'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
// @ts-ignore: allow side-effect CSS import without type declarations
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { renderToStaticMarkup } from 'react-dom/server';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapPin, 
  faUtensils, 
  faCoffee, 
  faStore, 
  faLandmark, 
  faBed, 
  faTree,
  faFilm,
  faUniversity,
  faHospital
} from '@fortawesome/free-solid-svg-icons';

// Fix for default icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const getCustomIcon = (place: Place) => {
  let icon = faMapPin;
  let color = '#4A90E2'; // Default blue

  const category = 
    place.tags.amenity || 
    place.tags.shop || 
    place.tags.tourism || 
    place.tags.leisure ||
    place.tags.historic;

  switch (category) {
    case 'restaurant':
    case 'fast_food':
      icon = faUtensils;
      color = '#D0021B'; // Red
      break;
    case 'cafe':
      icon = faCoffee;
      color = '#50E3C2'; // Teal
      break;
    case 'supermarket':
    case 'convenience':
      icon = faStore;
      color = '#F5A623'; // Orange
      break;
    case 'hotel':
    case 'hostel':
    case 'guest_house':
        icon = faBed;
        color = '#4A4A4A';
        break;
    case 'attraction':
    case 'museum':
    case 'artwork':
      icon = faLandmark;
      color = '#7B68EE'; // Medium purple
      break;
    case 'park':
    case 'garden':
        icon = faTree;
        color = '#228B22';
        break;
    case 'cinema':
        icon = faFilm;
        color = '#000000';
        break;
    case 'university':
    case 'college':
    case 'school':
        icon = faUniversity;
        color = '#4169E1';
        break;
    case 'hospital':
    case 'clinic':
    case 'doctors':
        icon = faHospital;
        color = '#FF6347';
        break;
    default:
      icon = faMapPin;
      color = '#4A90E2';
  }

  const iconHtml = renderToStaticMarkup(
    <div style={{ position: 'relative', textAlign: 'center' }}>
      <svg width="38" height="48" viewBox="0 0 100 120" style={{ transform: 'translateY(10px)' }}>
        <path d="M50 0 C22.38 0 0 22.38 0 50 C0 85 50 120 50 120 C50 120 100 85 100 50 C100 22.38 77.62 0 50 0 Z" fill={color}></path>
      </svg>
      <div style={{ position: 'absolute', top: '20px', left: '0', right: '0', color: 'white' }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: '16px' }} />
      </div>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-leaflet-div-icon',
    iconSize: [38, 58],
    iconAnchor: [19, 58],
    popupAnchor: [0, -58]
  });
};

interface Place {
  lat: number;
  lon: number;
  tags: { [key: string]: string };
}

interface MapViewProps {
  places?: Place[];
  onRouteFetched: (data: { route: [number, number][], waypoints: any[] }) => void;
  highlightedSegment: [number, number][] | null;
}

const MapView: React.FC<MapViewProps> = ({ places = [], onRouteFetched, highlightedSegment }) => {
  const [route, setRoute] = useState<[number, number][]>([]);
  const defaultPosition: [number, number] = [10.776, 106.700]; // Saigon coordinates
  const position = places.length > 0 ? [places[0].lat, places[0].lon] : defaultPosition;
  const pathOptions = { color: 'blue', weight: 5, opacity: 0.5 };
  const highlightPathOptions = { color: 'orange', weight: 7, opacity: 1 };

  useEffect(() => {
    if (places.length > 1) {
      const coordinates = places.map(p => `${p.lon},${p.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

      fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const routeCoords = data.routes[0].geometry.coordinates;
            // OSRM returns [lon, lat], Leaflet needs [lat, lon]
            const latLngs = routeCoords.map((coord: [number, number]) => [coord[1], coord[0]]);
            setRoute(latLngs);
            onRouteFetched({ route: latLngs, waypoints: data.waypoints });
          }
        })
        .catch(error => console.error("Error fetching route:", error));
    } else {
      setRoute([]);
    }
  }, [places]);

  return (
    <MapContainer
      center={position}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {route.length > 0 && <Polyline pathOptions={pathOptions} positions={route} />}
      {highlightedSegment && <Polyline pathOptions={highlightPathOptions} positions={highlightedSegment} />}
      {places.length > 0 ? (
        places.map(place => {
          const placeName = place.tags['name:vi'] || place.tags.name || 'Unknown';
          return (
            <Marker key={placeName} position={[place.lat, place.lon]} icon={getCustomIcon(place)}>
              <Popup>
                {placeName}
              </Popup>
            </Marker>
          );
        })
      ) : (
        <Marker position={defaultPosition}>
          <Popup>
            <b>Xin chào!</b>
            <br />
            Đây là Sài Gòn.
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
};

export default MapView;
