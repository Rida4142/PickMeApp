const NH = { headers: { 'User-Agent': 'PickMe-Hackathon/1.0' } };

function km(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const value = Math.sin(radians(b.lat - a.lat) / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(value));
}

async function getRoute(origin, destination) {
  if (!origin || !destination) return null;
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`, NH);
    const result = await response.json();
    if (result.code === 'Ok' && result.routes?.[0]) {
      const route = result.routes[0];
      return {
        points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceKm: +(route.distance / 1000).toFixed(1),
      };
    }
  } catch (_) {
    // The caller uses the straight-line fallback when routing is unavailable.
  }
  return { distanceKm: +(km(origin, destination) * 1.3).toFixed(1), points: null };
}

function pointToRouteDist(point, points) {
  if (!points?.length) return 0;
  return points.reduce((best, routePoint) => Math.min(best, km(point, routePoint)), Infinity);
}

function routeOverlap(points, origin, destination) {
  if (!points || points.length < 2) return { overlapScore: 0, distAlongRoute: 0 };
  let originDistance = Infinity;
  let destinationDistance = Infinity;
  let originIndex = -1;
  let destinationIndex = -1;
  points.forEach((point, index) => {
    const fromDistance = km(origin, point);
    const toDistance = km(destination, point);
    if (fromDistance < originDistance) { originDistance = fromDistance; originIndex = index; }
    if (toDistance < destinationDistance) { destinationDistance = toDistance; destinationIndex = index; }
  });
  let distanceAlongRoute = 0;
  for (let index = Math.min(originIndex, destinationIndex); index < Math.max(originIndex, destinationIndex); index += 1) {
    distanceAlongRoute += km(points[index], points[index + 1] || points[index]);
  }
  const totalDistance = points.reduce((total, point, index) => total + km(point, points[index + 1] || point), 0);
  const overlapScore = Math.max(0, 1 - (originDistance + destinationDistance) / Math.max(km(origin, destination), 0.1));
  return { overlapScore, distAlongRoute: distanceAlongRoute, fraction: totalDistance ? distanceAlongRoute / totalDistance : 0 };
}

module.exports = { NH, km, getRoute, pointToRouteDist, routeOverlap };
