/**
 * Duration Estimation Service
 * 
 * Estimates how long activities take and whether they span multiple time blocks.
 * Used for AI itinerary generation to avoid overpacking schedules.
 */

export type SpanType = 'single' | 'multi_block' | 'all_day';

export interface DurationEstimate {
  estimatedDurationMinutes: number;
  spanType: SpanType;
  durationSource: 'category_heuristic' | 'name_pattern' | 'ai_estimate';
}

// Time block budgets (in minutes)
export const TIME_BLOCK_BUDGETS = {
  morning: 240,    // 4 hours (8am - 12pm)
  afternoon: 300,  // 5 hours (12pm - 5pm)
  evening: 240,    // 4 hours (5pm - 9pm)
  flexible: 180,   // 3 hours (buffer time)
};

// Category-based duration heuristics
const CATEGORY_DURATIONS: Record<string, DurationEstimate> = {
  // Things to do - varies widely
  'ski resort': { estimatedDurationMinutes: 300, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'skiing': { estimatedDurationMinutes: 300, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'theme park': { estimatedDurationMinutes: 360, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'amusement park': { estimatedDurationMinutes: 360, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'national park': { estimatedDurationMinutes: 300, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'state park': { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'category_heuristic' },
  'hiking trail': { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'category_heuristic' },
  'backpacking': { estimatedDurationMinutes: 480, spanType: 'all_day', durationSource: 'category_heuristic' },
  'cave': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'cavern': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'museum': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'art gallery': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'aquarium': { estimatedDurationMinutes: 150, spanType: 'single', durationSource: 'category_heuristic' },
  'zoo': { estimatedDurationMinutes: 240, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'botanical garden': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'beach': { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'category_heuristic' },
  'winery': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'brewery': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'spa': { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'category_heuristic' },
  'golf course': { estimatedDurationMinutes: 270, spanType: 'multi_block', durationSource: 'category_heuristic' },
  'scenic railway': { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'category_heuristic' },
  'cog railway': { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'category_heuristic' },
  'scenic drive': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'viewpoint': { estimatedDurationMinutes: 30, spanType: 'single', durationSource: 'category_heuristic' },
  'observation deck': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
  'shopping': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'market': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'tour': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'walking tour': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'boat tour': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'helicopter tour': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
  
  // Places to eat
  'restaurant': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'fine dining': { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'category_heuristic' },
  'cafe': { estimatedDurationMinutes: 45, spanType: 'single', durationSource: 'category_heuristic' },
  'coffee shop': { estimatedDurationMinutes: 30, spanType: 'single', durationSource: 'category_heuristic' },
  'bar': { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'category_heuristic' },
  'fast food': { estimatedDurationMinutes: 30, spanType: 'single', durationSource: 'category_heuristic' },
  'food truck': { estimatedDurationMinutes: 20, spanType: 'single', durationSource: 'category_heuristic' },
  'bakery': { estimatedDurationMinutes: 20, spanType: 'single', durationSource: 'category_heuristic' },
  'ice cream': { estimatedDurationMinutes: 20, spanType: 'single', durationSource: 'category_heuristic' },
  
  // Places to stay (check-in/check-out time)
  'hotel': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
  'resort': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
  'airbnb': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
  'hostel': { estimatedDurationMinutes: 45, spanType: 'single', durationSource: 'category_heuristic' },
  'campground': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
};

// Name patterns that indicate specific durations
const NAME_PATTERNS: Array<{ pattern: RegExp; estimate: DurationEstimate }> = [
  // Multi-block / All-day activities
  { pattern: /ski\s*(resort|area|mountain)/i, estimate: { estimatedDurationMinutes: 300, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /skiing/i, estimate: { estimatedDurationMinutes: 300, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /snowboard/i, estimate: { estimatedDurationMinutes: 300, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /backpack/i, estimate: { estimatedDurationMinutes: 480, spanType: 'all_day', durationSource: 'name_pattern' } },
  { pattern: /theme\s*park/i, estimate: { estimatedDurationMinutes: 360, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /disney/i, estimate: { estimatedDurationMinutes: 480, spanType: 'all_day', durationSource: 'name_pattern' } },
  { pattern: /universal\s*studios/i, estimate: { estimatedDurationMinutes: 480, spanType: 'all_day', durationSource: 'name_pattern' } },
  { pattern: /safari/i, estimate: { estimatedDurationMinutes: 240, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /golf\s*(course|club)/i, estimate: { estimatedDurationMinutes: 270, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /scuba|diving/i, estimate: { estimatedDurationMinutes: 240, spanType: 'multi_block', durationSource: 'name_pattern' } },
  
  // Medium activities (2-3 hours)
  { pattern: /cave|cavern/i, estimate: { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /cog\s*railway/i, estimate: { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /scenic\s*(railway|train)/i, estimate: { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /museum/i, estimate: { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /aquarium/i, estimate: { estimatedDurationMinutes: 150, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /zoo/i, estimate: { estimatedDurationMinutes: 240, spanType: 'multi_block', durationSource: 'name_pattern' } },
  { pattern: /spa/i, estimate: { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /hike|trail|hiking/i, estimate: { estimatedDurationMinutes: 180, spanType: 'single', durationSource: 'name_pattern' } },
  
  // Quick activities (< 1 hour)
  { pattern: /viewpoint|overlook|vista/i, estimate: { estimatedDurationMinutes: 30, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /observation\s*(deck|tower)/i, estimate: { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'name_pattern' } },
  
  // Dining patterns
  { pattern: /fine\s*dining/i, estimate: { estimatedDurationMinutes: 120, spanType: 'single', durationSource: 'name_pattern' } },
  { pattern: /rooftop\s*(bar|restaurant)/i, estimate: { estimatedDurationMinutes: 90, spanType: 'single', durationSource: 'name_pattern' } },
];

// Default durations by primary category - more conservative estimates
const DEFAULT_BY_CATEGORY: Record<string, DurationEstimate> = {
  'things to do': { estimatedDurationMinutes: 150, spanType: 'single', durationSource: 'category_heuristic' },
  'places to eat': { estimatedDurationMinutes: 60, spanType: 'single', durationSource: 'category_heuristic' },
  'places to stay': { estimatedDurationMinutes: 45, spanType: 'single', durationSource: 'category_heuristic' },
};

/**
 * Estimate duration for a place based on its name and category
 */
export function estimateDuration(
  name: string,
  categoryPrimary: string,
  additionalContext?: string
): DurationEstimate {
  const nameLower = name.toLowerCase();
  const contextLower = (additionalContext || '').toLowerCase();
  const combined = `${nameLower} ${contextLower}`;
  
  // First, check name patterns (most specific)
  for (const { pattern, estimate } of NAME_PATTERNS) {
    if (pattern.test(combined)) {
      return estimate;
    }
  }
  
  // Then check category keywords in the name
  for (const [keyword, estimate] of Object.entries(CATEGORY_DURATIONS)) {
    if (combined.includes(keyword.toLowerCase())) {
      return estimate;
    }
  }
  
  // Fall back to primary category default
  const categoryDefault = DEFAULT_BY_CATEGORY[categoryPrimary.toLowerCase()];
  if (categoryDefault) {
    return categoryDefault;
  }
  
  // Ultimate fallback
  return {
    estimatedDurationMinutes: 90,
    spanType: 'single',
    durationSource: 'category_heuristic',
  };
}

/**
 * Calculate approximate travel time between two points using Haversine distance
 */
export function calculateTravelTime(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: 'driving' | 'walking' = 'driving'
): number {
  // Haversine formula to calculate distance in km
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  // Convert to miles and estimate time
  const distanceMiles = distanceKm * 0.621371;
  
  // Average speeds (accounting for traffic, parking, etc.)
  const avgSpeedMph = mode === 'driving' ? 25 : 3; // Urban driving ~25mph, walking ~3mph
  
  // Calculate time in minutes and add buffer for parking/transitions
  const baseTimeMinutes = (distanceMiles / avgSpeedMph) * 60;
  const buffer = mode === 'driving' ? 10 : 5; // 10 min for parking, 5 min for walking
  
  return Math.round(baseTimeMinutes + buffer);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate travel times between all places in a list
 * Returns a map of "placeId1-placeId2" -> travel time in minutes
 */
export function calculateTravelTimeMatrix(
  places: Array<{ id: number; lat: number | null; lng: number | null }>
): Map<string, number> {
  const matrix = new Map<string, number>();
  
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const p1 = places[i];
      const p2 = places[j];
      
      if (p1.lat && p1.lng && p2.lat && p2.lng) {
        const travelTime = calculateTravelTime(p1.lat, p1.lng, p2.lat, p2.lng);
        matrix.set(`${p1.id}-${p2.id}`, travelTime);
        matrix.set(`${p2.id}-${p1.id}`, travelTime); // Symmetric
      }
    }
  }
  
  return matrix;
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Check if a schedule block is overpacked
 */
export function isBlockOverpacked(
  activities: Array<{ durationMinutes: number }>,
  travelTimesBetween: number[],
  blockBudget: number,
  bufferMinutes: number = 15
): { isOverpacked: boolean; totalMinutes: number; budgetMinutes: number } {
  const totalActivity = activities.reduce((sum, a) => sum + a.durationMinutes, 0);
  const totalTravel = travelTimesBetween.reduce((sum, t) => sum + t, 0);
  const totalMinutes = totalActivity + totalTravel + bufferMinutes;
  
  return {
    isOverpacked: totalMinutes > blockBudget,
    totalMinutes,
    budgetMinutes: blockBudget,
  };
}
