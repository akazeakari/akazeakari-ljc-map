import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { GeoLocation } from './game/handle'

// 游戏相关的类型定义
type LocationInfo = {
    lat: number;
    lng: number;
    country?: string;
    city?: string;
    state?: string;
    county?: string;
}

// 主要的应用状态atoms
export const selectedRegionAtom = atom<string>("All");
export const locationAtom = atomWithStorage<GeoLocation | null>('location', null); 

// 游戏相关的atoms
export const markersAtom = atomWithStorage<Array<{ lat: number, lng: number }>>('markers', []);
export const closestLocationInfoAtom = atomWithStorage<LocationInfo | null>('closestLocationInfo', null); 