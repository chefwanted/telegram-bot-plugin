/**
 * P2000 Region Filters
 * Utrecht province regions and cities
 */

// Core municipalities in Utrecht province (no duplicates)
export const UTRECHT_MUNICIPALITIES = [
  'Utrecht',
  'Amersfoort',
  'Zeist',
  'Nieuwegein',
  'Veenendaal',
  'IJsselstein',
  'Houten',
  'Soest',
  'Abcoude',
  'Amerongen',
  'Baarn',
  'Bunnik',
  'Bunschoten',
  'De Bilt',
  'De Ronde Venen',
  'Eemnes',
  'Leersum',
  'Loenen',
  'Lopik',
  'Montfoort',
  'Oudewater',
  'Renswoude',
  'Rhenen',
  'Stichtse Vecht',
  'Utrechtse Heuvelrug',
  'Vianen',
  'Wijk bij Duurstede',
  'Woerden',
  'Woudenberg',
] as const;

// Utrecht city neighborhoods and landmarks
export const UTRECHT_LOCATIONS = [
  'Utrecht Centraal',
  'Utrecht CS',
  'Jaarbeurs',
  'Hoog Catharijne',
  'Neude',
  'Domplein',
  'Maliebaan',
  'Wilhelminapark',
  'Lombok',
  'Oog in Al',
  'Overvecht',
  'Utrecht Noordwest',
  'Utrecht Zuidwest',
  'Utrecht Oost',
  'Utrecht West',
  'Leidsche Rijn',
  'Vleuten',
  'De Meern',
  'Haarzuilens',
  'Vleuterweide',
  'Terwijde',
  'Kanaleneiland',
  'Lunetten',
  'Tuindorp',
  'Zuilen',
  'Ondiep',
  'Wittevrouwen',
  'Voordorp',
  'Rijnsweerd',
] as const;

// Combined list for backwards compatibility
export const UTRECHT_REGIONS = [
  ...UTRECHT_MUNICIPALITIES,
  ...UTRECHT_LOCATIONS,
];

/**
 * Check if a message is from Utrecht region
 * Uses word boundary matching to prevent false positives
 * (e.g., "Oost" should not match "Oosterhout")
 */
export function isUtrechtRegion(message: string): boolean {
  return UTRECHT_REGIONS.some(region => matchesRegion(message, region));
}

/**
 * Match a region with word boundaries to prevent false positives
 * Handles Dutch word boundaries including common suffixes
 */
function matchesRegion(message: string, region: string): boolean {
  // Escape special regex characters in region name
  const escapedRegion = region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Use word boundaries - \b works for most cases
  // Also handle Dutch-specific cases with lookahead/lookbehind
  const pattern = new RegExp(
    `(?:^|[\\s,;:\\-\\.\\(])${escapedRegion}(?:[\\s,;:\\-\\.\\)]|$)`,
    'i'
  );
  
  return pattern.test(message);
}

/**
 * Extract the region from a message
 * Prioritizes municipalities over generic locations
 */
export function extractRegion(message: string): string | undefined {
  // First try to find a municipality (more specific)
  const municipality = UTRECHT_MUNICIPALITIES.find(region => matchesRegion(message, region));
  if (municipality) return municipality;
  
  // Then try locations
  return UTRECHT_LOCATIONS.find(region => matchesRegion(message, region));
}

/**
 * Get all Utrecht regions
 */
export function getAllRegions(): string[] {
  return [...UTRECHT_REGIONS];
}

/**
 * Get all municipalities
 */
export function getMunicipalities(): readonly string[] {
  return UTRECHT_MUNICIPALITIES;
}

/**
 * Get all locations/neighborhoods
 */
export function getLocations(): readonly string[] {
  return UTRECHT_LOCATIONS;
}

/**
 * Validate if a given region name is valid
 */
export function isValidRegion(region: string): boolean {
  const lower = region.toLowerCase();
  return UTRECHT_REGIONS.some(r => r.toLowerCase() === lower);
}

/**
 * Get common Utrecht cities (for user selection)
 */
export const COMMON_UTRECHT_CITIES = [
  'Utrecht',
  'Amersfoort',
  'Zeist',
  'Nieuwegein',
  'Veenendaal',
  'IJsselstein',
  'Houten',
  'Soest',
  'Vianen',
  'Woerden',
  'Baarn',
  'Bunschoten',
] as const;
