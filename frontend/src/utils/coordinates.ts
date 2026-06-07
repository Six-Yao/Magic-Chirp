const GCJ_A = 6378245.0;
const GCJ_EE = 0.006693421622965943;

function outOfChina(longitude: number, latitude: number) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLatitude(longitudeOffset: number, latitudeOffset: number) {
  let value =
    -100 +
    2 * longitudeOffset +
    3 * latitudeOffset +
    0.2 * latitudeOffset * latitudeOffset +
    0.1 * longitudeOffset * latitudeOffset +
    0.2 * Math.sqrt(Math.abs(longitudeOffset));
  value += ((20 * Math.sin(6 * longitudeOffset * Math.PI) + 20 * Math.sin(2 * longitudeOffset * Math.PI)) * 2) / 3;
  value += ((20 * Math.sin(latitudeOffset * Math.PI) + 40 * Math.sin((latitudeOffset / 3) * Math.PI)) * 2) / 3;
  value += ((160 * Math.sin((latitudeOffset / 12) * Math.PI) + 320 * Math.sin((latitudeOffset * Math.PI) / 30)) * 2) / 3;
  return value;
}

function transformLongitude(longitudeOffset: number, latitudeOffset: number) {
  let value =
    300 +
    longitudeOffset +
    2 * latitudeOffset +
    0.1 * longitudeOffset * longitudeOffset +
    0.1 * longitudeOffset * latitudeOffset +
    0.1 * Math.sqrt(Math.abs(longitudeOffset));
  value += ((20 * Math.sin(6 * longitudeOffset * Math.PI) + 20 * Math.sin(2 * longitudeOffset * Math.PI)) * 2) / 3;
  value += ((20 * Math.sin(longitudeOffset * Math.PI) + 40 * Math.sin((longitudeOffset / 3) * Math.PI)) * 2) / 3;
  value += ((150 * Math.sin((longitudeOffset / 12) * Math.PI) + 300 * Math.sin((longitudeOffset / 30) * Math.PI)) * 2) / 3;
  return value;
}

export function wgs84ToGcj02(longitude: number, latitude: number) {
  if (outOfChina(longitude, latitude)) {
    return { longitude, latitude };
  }

  let transformedLatitude = transformLatitude(longitude - 105, latitude - 35);
  let transformedLongitude = transformLongitude(longitude - 105, latitude - 35);
  const radianLatitude = (latitude / 180) * Math.PI;
  let magic = Math.sin(radianLatitude);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  transformedLatitude = (transformedLatitude * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  transformedLongitude = (transformedLongitude * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radianLatitude) * Math.PI);

  return {
    latitude: latitude + transformedLatitude,
    longitude: longitude + transformedLongitude,
  };
}
