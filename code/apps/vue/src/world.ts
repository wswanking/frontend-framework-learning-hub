import atlas from 'world-atlas/countries-110m.json';
import { feature } from 'topojson-client';

const topology = atlas as unknown as Parameters<typeof feature>[0];
export const world = feature(topology, 'countries');
export const countryNames: Record<string, string> = {
  China: 'CN', Germany: 'DE', 'United States of America': 'US', Brazil: 'BR', 'South Africa': 'ZA',
  Australia: 'AU', Japan: 'JP', France: 'FR', Canada: 'CA', Argentina: 'AR', Egypt: 'EG', 'New Zealand': 'NZ',
};
