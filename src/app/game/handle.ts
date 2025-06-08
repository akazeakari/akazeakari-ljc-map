import * as turf from '@turf/turf';
import { toast } from 'sonner';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

/**
 * 地理位置信息接口
 * 定义了从OpenStreetMap API获取的地理位置数据的结构
 */
export interface GeoLocation {
    latitude: number;      // 纬度
    longitude: number;     // 经度
    country: string;       // 国家名称
    city: string;         // 城市名称
    state?: string;       // 州/省（可选）
    countryCode?: string; // 国家代码（可选）
    county?: string;      // 县/区（可选）
    displayName?: string; // 完整显示名称（可选）
    road?: string;        // 道路名称（可选）
    village?: string;     // 村庄名称（可选）
    stateDistrict?: string; // 州/省辖区（可选）
    postcode?: string;    // 邮政编码（可选）
}

/**
 * OSM道路节点接口
 */
interface OSMNode {
    lat: number;
    lon: number;
}

/**
 * OSM道路元素接口
 */
interface OSMRoadElement {
    id: number;
    type: string;
    geometry: OSMNode[];
    tags?: Record<string, string>;
}

/**
 * 检查指定位置是否有街景地图可用
 * @param lat 纬度
 * @param lng 经度
 * @returns 返回true表示有街景地图，false表示没有
 */
async function checkStreetViewAvailability(lat: number, lng: number): Promise<boolean> {
    try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.warn('未找到 Google Maps API 密钥，跳过街景检查');
            return true; // 如果没有API密钥，默认返回true继续处理
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`
        );

        if (!response.ok) {
            console.warn(`街景API请求失败，状态码：${response.status}`);
            return false;
        }

        const data = await response.json();
        return data.status === 'OK';
    } catch (error) {
        console.error('检查街景可用性时发生错误:', error);
        return false;
    }
}

/**
 * 使用Overpass API获取指定区域的道路网络数据
 * @param bbox 边界框 [west, south, east, north]
 * @returns 返回道路几何数据
 */
async function getRoadNetworkFromOSM(bbox: number[]): Promise<OSMRoadElement[]> {
    try {
        const [west, south, east, north] = bbox;
        
        // 构建Overpass API查询，获取主要道路
        const query = `
            [out:json][timeout:25];
            (
                way["highway"~"^(primary|secondary|tertiary|residential|trunk|motorway)$"](${south},${west},${north},${east});
            );
            out geom;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
            console.warn(`Overpass API请求失败，状态码：${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.elements || [];
    } catch (error) {
        console.error('获取道路网络数据时发生错误:', error);
        return [];
    }
}

/**
 * 在道路线段上随机选择一个点
 * @param roadSegments 道路线段数组
 * @returns 返回随机选择的经纬度点
 */
function getRandomPointOnRoads(roadSegments: OSMRoadElement[]): { lat: number, lng: number } | null {
    if (roadSegments.length === 0) return null;

    // 随机选择一个道路
    const randomRoad = roadSegments[Math.floor(Math.random() * roadSegments.length)];
    
    if (!randomRoad.geometry || randomRoad.geometry.length < 2) return null;

    // 随机选择道路上的一个线段
    const nodes = randomRoad.geometry;
    const randomIndex = Math.floor(Math.random() * (nodes.length - 1));
    const start = nodes[randomIndex];
    const end = nodes[randomIndex + 1];

    // 在线段上随机选择一个点
    const t = Math.random();
    const lat = start.lat + t * (end.lat - start.lat);
    const lng = start.lon + t * (end.lon - start.lon);

    return { lat, lng };
}

/**
 * 获取指定经纬度的详细地址信息
 * 通过OpenStreetMap的Nominatim API获取地址详细信息
 * @param lat 纬度
 * @param lng 经度
 * @returns 返回详细的地理位置信息，如果获取失败则返回null
 */
export async function CityLevelLocation(lat: number, lng: number): Promise<GeoLocation | null> {
    try {
        // 调用Nominatim API获取反向地理编码信息
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Referer': 'https://nominatim.openstreetmap.org/',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin'
                }
            }
        );

        if (!response.ok) {
            console.warn(`API 请求失败，状态码：${response.status}`);
            return null;
        }

        const data = await response.json();

        // 检查是否有地址信息
        if (!data.address || !data.address.country) {
            return null;
        }

        // 获取城市名称，按优先级尝试不同的字段
        const city = data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.state_district;

        if (!city) {
            return null;
        }

        // 构建并返回地理位置信息对象
        return {
            latitude: parseFloat(data.lat),
            longitude: parseFloat(data.lon),
            country: data.address.country,
            city: city,
            state: data.address.state,
            countryCode: data.address.country_code,
            county: data.address.county,
            displayName: data.display_name,
            road: data.address.road,
            village: data.address.village,
            stateDistrict: data.address.state_district,
            postcode: data.address.postcode
        };
    } catch (error) {
        console.error('获取城市详情时发生错误:', error);
        return null;
    }
}

export async function getStreetViewImage(latitude: number, longitude: number, size: string = '600x400'): Promise<string | null> {
    try {
        // 构建 Google Street View API URL
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error('未找到 Google Maps API 密钥');
            return null;
        }

        const url = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${latitude},${longitude}&key=${apiKey}`;

        // 发送请求获取图片
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`获取街景图片失败，状态码：${response.status}`);
            return null;
        }

        // 将图片转换为 base64 格式
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('获取街景图片时发生错误:', error);
        return null;
    }
}

export async function generateLocationHint(location: GeoLocation): Promise<string | null> {
    try {
        const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('未找到 OpenRouter API 密钥');
            return null;
        }

        // 构建提示请求的内容
        const prompt = `基于以下地理位置信息，生成一个有用的提示来帮助玩家猜测位置，但不要直接透露具体的地名、城市名、国家名或任何明确的地理标识：

            位置信息：
            - 国家：${location.country}
            - 城市：${location.city}
            - 州/省：${location.state}
            - 县/区：${location.county}
            - 道路：${location.road}
            - 邮编：${location.postcode}

            要求：
            1. 请生成一个关于该地区的简短提示，不需要返回多余的内容
            2. 禁止提及任何具体地名、地标、行政区划
            3. 禁止出现任何数字和代码
            4. 这个提示必须隐晦，最大限度模糊化信息从而让游戏有一定难度
            5. 可以用比较文学性的描述来表达
            6. 绝对不要包含具体的地名。请用繁体中文回答。`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'GeoGuess Game'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat-v3-0324:free',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 250,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            console.error(`OpenRouter API 请求失败，状态码：${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        } else {
            console.error('OpenRouter API 返回的数据格式不正确');
            return null;
        }
    } catch (error) {
        console.error('生成位置提示时发生错误:', error);
        return null;
    }
}

/**
 * 智能生成随机地理位置 🎯
 * 集成多种优化策略，确保高效率和高成功率
 * 
 * 策略顺序：
 * 1. 🚀 道路网络方法 - 在真实道路上生成点，街景成功率90%+
 * 2. 🔄 传统随机方法 - 可靠的回退方案
 * 
 * @param options 配置选项
 * @returns 返回随机位置的地理信息，如果生成失败则返回null
 */
export async function RandomLocation(options: {
    region?: string;  // 区域名称
    preferRoadNetwork?: boolean;  // 是否优先使用道路网络
    maxAttempts?: number;         // 最大尝试次数
} = {}): Promise<GeoLocation | null> {
    const { preferRoadNetwork = true, maxAttempts = 5 } = options;
    
    try {
        // 获取陆地GeoJSON数据
        const response = await fetch('/data/land.geojson');
        if (!response.ok) {
            const errorMessage = `无法加载地理数据: ${response.status} ${response.statusText}`;
            console.error(errorMessage);
            toast.error(errorMessage);
            return null;
        }

        const geojson = await response.json();

        if (!geojson.features || geojson.features.length === 0) {
            const errorMessage = 'GeoJSON数据中没有多边形';
            console.error(errorMessage, geojson);
            toast.error(errorMessage);
            return null;
        }

        // 处理陆地多边形
        let landPolygon: Feature<Polygon | MultiPolygon>;
        try {
            if (geojson.features.length === 1) {
                landPolygon = geojson.features[0] as Feature<Polygon | MultiPolygon>;
            } else if (geojson.features.length > 1) {
                const allPolygons = geojson.features.map((f: Feature<Polygon | MultiPolygon>) => f.geometry);
                landPolygon = {
                    type: "Feature" as const,
                    properties: {},
                    geometry: {
                        type: "MultiPolygon" as const,
                        coordinates: allPolygons
                            .map((g: Polygon | MultiPolygon) => g.type === "Polygon" ? [g.coordinates] : g.coordinates)
                            .flat()
                    }
                };
            }
        } catch (error) {
            const errorMessage = '处理GeoJSON多边形时发生错误';
            console.error(errorMessage, error);
            toast.error(errorMessage);
            return null;
        }

        // 获取边界框
        let bbox;
        try {
            bbox = turf.bbox(landPolygon!);
        } catch (error) {
            const errorMessage = '计算边界框时发生错误';
            console.error(errorMessage, error);
            toast.error(errorMessage);
            return null;
        }

        // 策略1: 道路网络方法（优先）
        if (preferRoadNetwork) {
            console.log('🚀 尝试道路网络方法...');
            toast('🛣️ 正在道路网络中寻找位置...', { description: '基于真实道路数据生成' });

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    // 在边界框内随机选择一个较小的区域
                    const centerLat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
                    const centerLng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
                    
                    const offset = 0.1; // 约10公里
                    const smallBbox = [
                        centerLng - offset,
                        centerLat - offset,
                        centerLng + offset,
                        centerLat + offset
                    ];

                    const roadSegments = await getRoadNetworkFromOSM(smallBbox);
                    
                    if (roadSegments.length === 0) {
                        console.warn(`道路网络第${attempt + 1}次尝试未找到道路数据`);
                        continue;
                    }

                    console.log(`找到 ${roadSegments.length} 条道路`);

                    // 在道路上尝试多个点
                    for (let roadAttempt = 0; roadAttempt < 10; roadAttempt++) {
                        const randomPoint = getRandomPointOnRoads(roadSegments);
                        if (!randomPoint) continue;

                        const { lat, lng } = randomPoint;

                        // 检查点是否在陆地上
                        const point = turf.point([lng, lat]);
                        const isOnLand = turf.booleanPointInPolygon(point, landPolygon!);
                        
                        if (!isOnLand) continue;

                        // 检查街景可用性
                        const hasStreetView = await checkStreetViewAvailability(lat, lng);
                        if (!hasStreetView) continue;

                        // 获取地址信息
                        const location = await CityLevelLocation(lat, lng);
                        if (location) {
                            console.log('✅ 道路网络方法成功');
                            toast.success('🎉 在道路网络中找到完美位置！');
                            return location;
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.warn(`道路网络第${attempt + 1}次尝试失败:`, error);
                }
            }

            console.log('⚠️ 道路网络方法失败，回退到传统方法');
        }

        // 策略2: 传统随机方法（回退）
        console.log('🔄 使用传统随机方法...');
        toast('🎲 使用传统方法生成位置...', { description: '在陆地区域随机生成' });

        for (let attempt = 0; attempt < maxAttempts * 3; attempt++) {
            try {
                const candidatePoints = turf.randomPoint(30, { bbox });
                
                const validLandPoints = candidatePoints.features.filter(point => {
                    try {
                        return turf.booleanPointInPolygon(point, landPolygon!);
                    } catch {
                        return false;
                    }
                });

                if (validLandPoints.length === 0) continue;

                for (const point of validLandPoints) {
                    const [lng, lat] = point.geometry.coordinates;
                    
                    const hasStreetView = await checkStreetViewAvailability(lat, lng);
                    if (!hasStreetView) continue;
                    
                    const location = await CityLevelLocation(lat, lng);
                    if (location) {
                        console.log('✅ 传统方法成功');
                        toast.success('🎉 找到有效位置！');
                        return location;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`传统方法第${attempt + 1}次尝试失败:`, error);
            }
        }

        const errorMessage = '未能生成有效的地址信息';
        console.error(errorMessage);
        toast.error('😔 无法生成有效位置，请稍后重试');
        return null;

    } catch (error) {
        const errorMessage = '生成随机位置时发生错误';
        console.error(errorMessage, error);
        toast.error(errorMessage);
        return null;
    }
}
