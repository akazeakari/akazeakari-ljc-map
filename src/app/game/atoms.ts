import { atomWithStorage } from 'jotai/utils'

type LocationInfo = {
    lat: number;
    lng: number;
    country?: string;
    city?: string;
    state?: string;
    county?: string;
}

export const markersAtom = atomWithStorage<Array<{ lat: number, lng: number }>>('markers', []);
export const closestLocationInfoAtom = atomWithStorage<LocationInfo | null>('closestLocationInfo', null); 