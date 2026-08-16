import { log } from "@/lib/logger.server";

export interface LiveWeatherData {
  location: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_c: number;
    temperature_f: number;
    feels_like_c: number;
    feels_like_f: number;
    condition: string;
    humidity: number;
    cloud_cover: number;
    wind_speed_kmh: number;
    wind_direction: number;
    precipitation_mm: number;
    is_day: boolean;
  };
  forecast_today: {
    max_c: number;
    min_c: number;
    rain_probability_pct: number;
  };
  forecast_3day?: Array<{
    date: string;
    condition: string;
    max_c: number;
    min_c: number;
    rain_probability_pct: number;
  }>;
  source: {
    name: string;
    url: string;
    domain: string;
  };
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  62: "Rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

/**
 * Fetches real-time live weather conditions and forecasts worldwide using Open-Meteo.
 * Does not require API keys and updates in real-time from national meteorological models.
 */
export async function getLiveWeatherServer(locationQuery: string): Promise<LiveWeatherData> {
  const query = locationQuery.trim();
  if (!query) throw new Error("Location query cannot be empty");

  // 1. Geocoding
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const geoRes = await fetch(geoUrl, {
    headers: { "User-Agent": "Remispace-Weather/1.0" },
  });

  if (!geoRes.ok) {
    log("error", "weather_geocoding_failed", { status: geoRes.status, query });
    throw new Error(`Failed to locate "${query}" for weather lookup`);
  }

  const geoData = (await geoRes.json()) as {
    results?: Array<{
      id: number;
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
      timezone?: string;
    }>;
  };

  if (!geoData.results || geoData.results.length === 0) {
    throw new Error(`Location "${query}" was not found. Please specify a valid city or region.`);
  }

  const loc = geoData.results[0]!;
  const { latitude, longitude, name, country = "", admin1, timezone = "UTC" } = loc;
  const fullLocationName = `${name}${admin1 ? `, ${admin1}` : ""}${country ? `, ${country}` : ""}`;

  // 2. Fetch current weather and 3-day forecast
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(timezone)}&forecast_days=3`;

  const weatherRes = await fetch(weatherUrl, {
    headers: { "User-Agent": "Remispace-Weather/1.0" },
  });

  if (!weatherRes.ok) {
    log("error", "weather_fetch_failed", { status: weatherRes.status, query, latitude, longitude });
    throw new Error(`Failed to retrieve live weather data for "${fullLocationName}"`);
  }

  const data = (await weatherRes.json()) as {
    timezone: string;
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      is_day: number;
      precipitation: number;
      weather_code: number;
      cloud_cover: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const current = data.current;
  const condition = WEATHER_CODE_MAP[current.weather_code] || "Variable conditions";

  const cToF = (c: number) => Math.round((c * 9) / 5 + 32);

  const forecast3Day = (data.daily?.time ?? []).map((date, idx) => ({
    date,
    condition: WEATHER_CODE_MAP[data.daily?.weather_code?.[idx] ?? 0] || "Clear",
    max_c: data.daily?.temperature_2m_max?.[idx] ?? current.temperature_2m,
    min_c: data.daily?.temperature_2m_min?.[idx] ?? current.temperature_2m,
    rain_probability_pct: data.daily?.precipitation_probability_max?.[idx] ?? 0,
  }));

  return {
    location: fullLocationName,
    country,
    latitude,
    longitude,
    timezone: data.timezone,
    current: {
      time: current.time,
      temperature_c: current.temperature_2m,
      temperature_f: cToF(current.temperature_2m),
      feels_like_c: current.apparent_temperature,
      feels_like_f: cToF(current.apparent_temperature),
      condition,
      humidity: current.relative_humidity_2m,
      cloud_cover: current.cloud_cover,
      wind_speed_kmh: current.wind_speed_10m,
      wind_direction: current.wind_direction_10m,
      precipitation_mm: current.precipitation,
      is_day: current.is_day === 1,
    },
    forecast_today: {
      max_c: data.daily?.temperature_2m_max?.[0] ?? current.temperature_2m,
      min_c: data.daily?.temperature_2m_min?.[0] ?? current.temperature_2m,
      rain_probability_pct: data.daily?.precipitation_probability_max?.[0] ?? 0,
    },
    forecast_3day: forecast3Day,
    source: {
      name: "Open-Meteo Global Weather Service",
      url: "https://open-meteo.com",
      domain: "open-meteo.com",
    },
  };
}
