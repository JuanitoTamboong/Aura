// src/command/AuraWeather.ts
// 
// Free weather lookup using Open-Meteo (no API key required).
// Reverse geocoding via BigDataCloud (no API key required).

import React from "react";
import { 
  FaSun, 
  FaCloudSun, 
  FaCloud, 
  FaCloudRain, 
  FaBolt, 
  FaSnowflake, 
  FaSmog 
} from "react-icons/fa6";

export interface WeatherResult {
  success: boolean;
  location: string;
  message: string;   // short spoken summary
  markdown: string;  // rich text response for the modal
  weatherIcon?: React.ReactNode; // SVG icon for the UI
}

interface GeoCoords {
  latitude: number;
  longitude: number;
  name: string;
}

// ─── Weather code → label (WMO codes) ──────────────────────────────
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light rain showers", 81: "Rain showers", 82: "Violent rain showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm + hail", 99: "Severe thunderstorm",
};

const describeCode = (code: number) => WEATHER_CODES[code] ?? "Unknown";

// Returns the actual React SVG Icon based on the weather code
const getWeatherIcon = (code: number) => {
  if (code === 0) return <FaSun size={42} color="#fbbf24" />;
  if (code <= 2) return <FaCloudSun size={42} color="#38bdf8" />;
  if (code === 3) return <FaCloud size={42} color="#94a3b8" />;
  if (code >= 45 && code <= 48) return <FaSmog size={42} color="#a1a1aa" />;
  if (code >= 51 && code <= 67) return <FaCloudRain size={42} color="#60a5fa" />;
  if (code >= 71 && code <= 86) return <FaSnowflake size={42} color="#e0f2fe" />;
  if (code >= 95) return <FaBolt size={42} color="#f87171" />;
  return <FaSun size={42} color="#fbbf24" />;
};

// ─── 1. Resolve a city name → coordinates ───────────────────────────
const geocodeCity = async (city: string): Promise<GeoCoords | null> => {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;

    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    };
  } catch {
    return null;
  }
};

// ─── 2. Ask browser for current location ────────────────────────────
const getBrowserCoords = (): Promise<{ lat: number; lon: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });

// ─── 3. Reverse geocode coordinates → friendly name ─────────────────
const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  try {
    // BigDataCloud allows free client-side reverse geocoding
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (!res.ok) return "Your Location";
    
    const data = await res.json();
    const city = data.city || data.locality || data.principalSubdivision;
    const country = data.countryName;
    
    if (city && country) return `${city}, ${country}`;
    return city || country || "Your Location";
  } catch {
    return "Your Location";
  }
};

// ─── 4. Fetch forecast from Open-Meteo ──────────────────────────────
const fetchWeather = async (coords: GeoCoords): Promise<WeatherResult> => {
  const { latitude, longitude, name } = coords;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather fetch failed");

  const w = await res.json();
  const cur = w?.current;
  const daily = w?.daily;
  if (!cur || !daily) throw new Error("Malformed weather response");

  const curLabel = describeCode(cur.weather_code);
  const todayLabel = describeCode(daily.weather_code?.[0] ?? 0);

  const temp = Math.round(cur.temperature_2m);
  const feels = Math.round(cur.apparent_temperature);
  const high = Math.round(daily.temperature_2m_max[0]);
  const low  = Math.round(daily.temperature_2m_min[0]);
  const rain = daily.precipitation_probability_max?.[0] ?? 0;
  const humidity = cur.relative_humidity_2m;
  const wind = Math.round(cur.wind_speed_10m);

  // Spoken summary (what Aura actually says out loud)
  const rainNote = rain >= 40 ? ` There's a ${rain}% chance of rain today.` : "";
  const message = `In ${name}, it's currently ${temp}°C with ${curLabel.toLowerCase()}. Today's high is ${high}°C, low ${low}°C.${rainNote}`;

  // Text for the modal (The icon is handled separately)
  const markdown =
    `**Current Weather in ${name}**\n\n` +
    `- **Condition:** ${curLabel}\n` +
    `- **Temperature:** ${temp}°C (feels like ${feels}°C)\n` +
    `- **Humidity:** ${humidity}%\n` +
    `- **Wind:** ${wind} km/h\n\n` +
    `**Today's Forecast**\n\n` +
    `- **High / Low:** ${high}°C / ${low}°C\n` +
    `- **Rain chance:** ${rain}%\n` +
    `- **Overall:** ${todayLabel}`;

  return { 
    success: true, 
    location: name, 
    message, 
    markdown, 
    weatherIcon: getWeatherIcon(cur.weather_code) 
  };
};

// ─── 5. Public entry point ──────────────────────────────────────────
export const getWeather = async (cityQuery?: string): Promise<WeatherResult> => {
  try {
    let coords: GeoCoords;

    if (cityQuery && cityQuery.trim()) {
      const found = await geocodeCity(cityQuery.trim());
      if (!found) {
        return {
          success: false,
          location: cityQuery,
          message: `I couldn't find a place called ${cityQuery}.`,
          markdown: `❌ **Location not found:** \`${cityQuery}\`\n\nTry a different spelling or a larger nearby city.`,
        };
      }
      coords = found;
    } else {
      // No city given → try browser geolocation
      const { lat, lon } = await getBrowserCoords();
      const friendlyName = await reverseGeocode(lat, lon);
      coords = { latitude: lat, longitude: lon, name: friendlyName };
    }

    return await fetchWeather(coords);
  } catch (err: any) {
    if (err?.code === 1 || err?.message?.toLowerCase?.().includes("denied")) {
      return {
        success: false,
        location: "unknown",
        message: "I need location permission to check the weather. Please allow it in your browser settings, or tell me a city name.",
        markdown: "⚠️ **Location permission denied.**\n\nAllow location access in your browser, or say:\n\n> *\"What's the weather in Tokyo?\"*",
      };
    }

    return {
      success: false,
      location: "unknown",
      message: "I couldn't fetch the weather right now. Try again in a moment.",
      markdown: `❌ **Weather unavailable.**\n\n${err?.message ?? "Unknown error."}`,
    };
  }
};