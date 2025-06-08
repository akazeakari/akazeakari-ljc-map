import * as turf from '@turf/turf';
import { toast } from 'sonner';

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
 * 生成随机地理位置
 * 通过GeoJSON数据在陆地区域内随机生成一个点，并获取该点的详细地址信息
 * @returns 返回随机位置的地理信息，如果生成失败则返回null
 */
export async function RandomLocation(): Promise<GeoLocation | null> {
    try {
        // 获取陆地GeoJSON数据
        const response = await fetch('/data/land.geojson');
        if (!response.ok) {
            toast.error('无法加载地理数据');
            return null;
        }

        const geojson = await response.json();

        if (!geojson.features || geojson.features.length === 0) {
            toast.error('GeoJSON数据中没有多边形');
            return null;
        }

        let landPolygon: any;
        if (geojson.features.length === 1) {
            landPolygon = geojson.features[0];
        } else if (geojson.features.length > 1) {
            // 合并所有多边形为MultiPolygon
            const allPolygons = geojson.features.map((f: any) => f.geometry);
            landPolygon = {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "MultiPolygon",
                    coordinates: allPolygons
                        .map((g: any) => g.type === "Polygon" ? [g.coordinates] : g.coordinates)
                        .flat()
                }
            };
        }

        // 获取边界框
        const bbox = turf.bbox(landPolygon);

        // 最多尝试5次生成有效位置，避免无限循环
        for (let attempt = 0; attempt < 5; attempt++) {
            // 每次生成更多候选点以提高成功率
            const candidatePoints = turf.randomPoint(100, { bbox });
            
            // 筛选出在陆地上的点
            const validPoints = candidatePoints.features.filter(point => {
                try {
                    return turf.booleanPointInPolygon(point, landPolygon);
                } catch (error) {
                    return false;
                }
            });

            if (validPoints.length === 0) {
                continue; // 继续下一次尝试
            }

            // 随机选择一个有效点
            const randomIndex = Math.floor(Math.random() * validPoints.length);
            const selectedPoint = validPoints[randomIndex];
            const [lng, lat] = selectedPoint.geometry.coordinates;

            // 只进行一次API调用，如果失败就尝试下一批点
            const location = await CityLevelLocation(lat, lng);
            if (location) {
                toast.dismiss(); // 清除loading提示
                return location;
            }

            // 添加短暂延迟避免API频率限制
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        toast.error('未能生成有效的地址信息');
        return null;
    } catch (error) {
        console.error('生成随机位置时发生错误:', error);
        toast.error('生成随机位置时发生错误');
        return null;
    }
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
