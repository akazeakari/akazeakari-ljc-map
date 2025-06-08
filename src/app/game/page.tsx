"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Map, Marker } from '@vis.gl/react-maplibre';
import { useAtom } from 'jotai'
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
import { selectedRegionAtom, locationAtom, markersAtom, closestLocationInfoAtom } from '@/app/atom'
import { useRouter } from 'next/navigation'
import { CityLevelLocation, generateLocationHint } from './handle';
import Image from 'next/image'

function StreetView({ latitude, longitude }: { latitude: number, longitude: number }) {
    const mapRef = useRef<HTMLDivElement>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // 检查API密钥是否配置
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            setError('Google Maps API 密钥未配置，請聯繫管理員')
            console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set')
            return
        }

        // 验证经纬度是否为有效数字
        console.log('Street View coordinates:', latitude, longitude)
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            setError('無效的經緯度座標')
            return
        }

        if (!mapRef.current) {
            setError('Google Street View 容器未就緒')
            return
        }

        // 检查 Google Maps API 是否已加载
        if (!window.google || !window.google.maps) {
            setError('Google Maps API 未載入，請重新整理頁面')
            console.error('Google Maps API not loaded')
            return
        }

        // 检查街景服务是否可用
        if (!window.google.maps.StreetViewPanorama) {
            setError('Google Street View 服務不可用')
            console.error('Street View Panorama not available')
            return
        }

        try {
            const panorama = new window.google.maps.StreetViewPanorama(
                mapRef.current,
                {
                    position: { lat: latitude, lng: longitude },
                    addressControlOptions: {
                        position: window.google.maps.ControlPosition.BOTTOM_CENTER,
                    },
                    linksControl: false,
                    panControl: false,
                    enableCloseButton: false,
                    addressControl: false,
                    clickToGo: false,
                    zoomControl: true,
                    fullscreenControl: false,
                }
            )

            // 添加載入狀態監聽
            panorama.addListener('status_changed', () => {
                const status = panorama.getStatus()
                console.log('Street View status:', status)
                if (status === window.google.maps.StreetViewStatus.OK) {
                    setIsLoaded(true)
                    setError(null)
                } else if (status === window.google.maps.StreetViewStatus.ZERO_RESULTS) {
                    setError('此位置沒有可用的街景圖像')
                    setIsLoaded(false)
                } else {
                    setError('無法載入街景，請稍後重試')
                    setIsLoaded(false)
                }
            })

            return () => {
                // 清理監聽器
                if (window.google && window.google.maps && window.google.maps.event) {
                    window.google.maps.event.clearInstanceListeners(panorama)
                }
            }
        } catch (error) {
            console.error('Error creating Street View panorama:', error)
            setError('建立街景視圖時發生錯誤')
        }
    }, [latitude, longitude])

    return (
        <div ref={mapRef} className="w-full h-full">
            {!isLoaded && (
                <div className="w-full h-full flex items-center justify-center">
                    {error ? (
                        <div className="text-center">
                            <p className="text-red-400 mb-2">{error}</p>
                            <p className="text-amber-200/60 text-sm">請檢查網路連接或重新整理頁面</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-300"></div>
                            <p className="text-amber-200/80">載入街景中...</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function MapView({ latitude, longitude }: { latitude: number, longitude: number }) {
    const [markers, setMarkers] = useAtom(markersAtom);
    const [lastMarkerTime, setLastMarkerTime] = useState<number>(0);
    const [countdown, setCountdown] = useState<number>(0);

    // 預設中心點設置為日本
    const defaultCenter = { latitude, longitude, zoom: 1 };

    // 初始化視圖狀態
    const [viewState, setViewState] = useState(defaultCenter);

    // 優化倒計時效果
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [countdown]);

    const onMove = useCallback((evt: { viewState: { latitude: number; longitude: number; zoom: number } }) => {
        setViewState(evt.viewState);
    }, []);

    const handleMapClick = useCallback((evt: { lngLat: { lat: number; lng: number } }) => {
        const currentTime = Date.now();
        if (currentTime - lastMarkerTime < 1000) {
            const remainingTime = Math.ceil((1000 - (currentTime - lastMarkerTime)) / 1000);
            setCountdown(remainingTime);
            toast.warning(`操作過快，請等待${remainingTime}秒後再添加標記`);
            return;
        }

        const { lat, lng } = evt.lngLat;
        setMarkers(prev => [...prev, { lat, lng }]);
        setLastMarkerTime(currentTime);
    }, [lastMarkerTime, setMarkers]);

    return (
        <Map
            {...viewState}
            onMove={onMove}
            onClick={handleMapClick}
            mapStyle='https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json'
        >
            {markers.map((marker, index) => (
                <Marker
                    key={index}
                    longitude={marker.lng}
                    latitude={marker.lat}
                >
                    <div className="relative">
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2">
                            <span className="text-white font-bold text-sm">{index + 1}</span>
                        </div>
                    </div>
                </Marker>
            ))}
        </Map>
    );
}

export default function Game() {
    const [markers, setMarkers] = useAtom(markersAtom)
    const [selectedRegion, setSelectedRegion] = useAtom(selectedRegionAtom)
    const [location, setLocation] = useAtom(locationAtom)
    const [tab, setTab] = useState("create");
    const [closestLocationInfo, setClosestLocationInfo] = useAtom(closestLocationInfoAtom);
    const [hint, setHint] = useState<string | null>(null);
    const router = useRouter()

    // 添加调试信息
    useEffect(() => {
        console.log('=== 調試信息 ===')
        console.log('API Key:', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? '已配置' : '未配置')
        console.log('Google Maps API:', window.google ? '已載入' : '未載入')
        console.log('Street View API:', window.google?.maps?.StreetViewPanorama ? '可用' : '不可用')
        console.log('Location:', location)
        console.log('================')
    }, [location])

    // 計算最近的標記點和距離
    const getClosestMarker = useCallback(() => {
        if (!markers.length || !location) return null;
        
        const distances = markers.map(marker => {
            const distance = Math.round(
                6371 * Math.acos(
                    Math.cos(location.latitude * Math.PI / 180) *
                    Math.cos(marker.lat * Math.PI / 180) *
                    Math.cos((marker.lng - location.longitude) * Math.PI / 180) +
                    Math.sin(location.latitude * Math.PI / 180) *
                    Math.sin(marker.lat * Math.PI / 180)
                )
            );
            return { ...marker, distance };
        });
        
        return distances.reduce((prev, current) => 
            prev.distance < current.distance ? prev : current
        );
    }, [markers, location]);

    const closestMarker = getClosestMarker();
    
    useEffect(() => {
        const fetchClosestLocation = async () => {
            if (!closestMarker || markers.length === 0) return;
            
            // 如果已經有儲存的位置資訊，並且座標相同，則不需要重新獲取
            if (closestLocationInfo && 
                closestMarker.lat === closestLocationInfo.lat && 
                closestMarker.lng === closestLocationInfo.lng) {
                return;
            }
            
            try {
                const locationInfo = await CityLevelLocation(closestMarker.lat, closestMarker.lng);
                setClosestLocationInfo({
                    ...locationInfo,
                    lat: closestMarker.lat,
                    lng: closestMarker.lng
                });
            } catch {
                console.error('獲取最近點地點資訊失敗:');
            }
        };
        
        fetchClosestLocation();
    }, [closestMarker, closestLocationInfo, setClosestLocationInfo, markers.length]);

    // 重置遊戲時也要清除儲存的位置資訊
    const handleReset = () => {
        setMarkers([]);
        setSelectedRegion("All");
        setLocation(null);
        setClosestLocationInfo(null);
        router.push("/");
    };

    return (
        <div className="flex flex-col-reverse lg:flex-row side-bg h-screen">
            <Tabs
                value={tab}
                onValueChange={setTab}
                className="w-full lg:w-3/4 h-screen lg:h-screen rounded-none py-4 lg:py-8 px-4 lg:px-6"
            >
                <TabsList className='border-bg rounded-none mx-auto w-full max-w-sm'>
                    <TabsTrigger
                        className='data-[state=active]:bg-amber-300/20 data-[state=active]:text-amber-100/90 bg-black/90 text-amber-200/90 transition-colors text-xs sm:text-sm'
                        value="create"
                    >
                        出題篇
                    </TabsTrigger>
                    <TabsTrigger
                        className='data-[state=active]:bg-amber-300/20 data-[state=active]:text-amber-100/90 bg-black/90 text-amber-200/90 transition-colors text-xs sm:text-sm'
                        value="solve"
                    >
                        解題篇
                    </TabsTrigger>
                </TabsList>
                <TabsContent forceMount className={`${tab === "create" ? "mt-4" : "hidden mt-4"}`} value="create">
                    {location && location.latitude && location.longitude ? (
                        <StreetView latitude={47.1763891} longitude={-122.4211769} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-lg">
                            <div className="text-amber-200/80 text-center">
                                <div className="animate-pulse rounded-full h-8 w-8 bg-amber-300/20 mx-auto mb-2"></div>
                                <p>等待位置資料載入...</p>
                            </div>
                        </div>
                    )}
                </TabsContent>
                <TabsContent forceMount className={`${tab === "solve" ? "mt-4" : "hidden mt-4"}`} value="solve">
                    <MapView
                        latitude={markers.length > 0 ? markers[markers.length - 1].lat : 0}
                        longitude={markers.length > 0 ? markers[markers.length - 1].lng : 0}
                    />
                </TabsContent>
            </Tabs>
            <div className='w-full lg:w-1/4 h-auto lg:h-screen page-bg p-3 sm:p-4 lg:p-6 flex flex-col'>       
                    {location && (
                        <div className="mb-4 p-3 bg-black/40 rounded-lg border border-amber-300/50 shadow-inner">
                            {markers.length > 0 ? (() => {
                                // 計算兩點間距離（單位：公里）
                                const lastMarker = markers[markers.length - 1];
                                const latDiff = lastMarker.lat - location.latitude;
                                const lngDiff = lastMarker.lng - location.longitude;
                                const distance = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111);

                        
                                const maxDistance = 20000;
                                const progressValue = Math.min(distance, maxDistance);

                                return (
                                    <>
                                        <div className="text-amber-100/90 text-xs mb-2">距離目標位置</div>
                                        <div className="w-full h-4 bg-amber-300/20 rounded overflow-hidden mb-2 border border-amber-300/30">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-300/80 to-yellow-400/80 transition-all duration-500"
                                                style={{
                                                    width: `${100 - (progressValue / maxDistance) * 100}%`,
                                                    minWidth: '8%',
                                                    boxShadow: '0 0 6px 2px #FFD70044'
                                                }}
                                            />
                                        </div>
                                        <div className="text-amber-200/80 text-xs font-mono">
                                            {distance < 50 ? "極度接近" :
                                             distance < 100 ? "非常接近" : 
                                             distance < 300 ? "比較接近" :
                                             distance < 800 ? "有點距離" :
                                             distance < 2000 ? "距離較遠" :
                                             distance < 5000 ? "距離很遠" :
                                             "距離極遠"}
                                        </div>
                                    </>
                                );
                            })() : (
                                <>
                                    <div className="text-amber-100/90 text-xs mb-2">尚未選擇預測點</div>
                                    <div className="text-amber-200/70 text-xs">
                                        請在地圖上標記您的預測位置
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    {/* 遊戲資訊面板 */}
                    <div className="mb-4 p-3 bg-black/40 rounded-lg border border-amber-300/50 shadow-inner">
                        <div className="text-amber-100/90 text-xs mb-2">遊戲資訊</div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-amber-200/80">
                                <span>選擇區域:</span>
                                <span className="font-mono">{selectedRegion === "All" ? "全世界" : selectedRegion}</span>
                            </div>
                            <div className="flex justify-between text-amber-200/80">
                                <span>標記次數:</span>
                                <span className="font-mono">{markers.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* 操作按鈕區域 */}
                    <div className="flex flex-col justify-center h-full">
                        <div className="flex sm:flex-col flex-row gap-3 sm:gap-6 w-full sm:mx-auto">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button 
                                        variant="default"
                                        className="text-amber-100/90 button-bg sm:px-6 sm:py-4 rounded-lg  sm:w-full text-sm hover:bg-amber-300/30 transition-all duration-200 shadow-lg hover:shadow-xl"
                                        onClick={() => {
                                            if (markers.length === 0) {
                                                toast.error('請先在地圖上標記您的預測位置！');
                                                return;
                                            }
                                        }}
                                    >
                                        <Image src="/icon.svg" alt="提交答案" width={16} height={16} className="mr-2" />
                                        提交答案
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-black/95 border-amber-300/50 text-white">
                                    <DialogHeader>
                                        <DialogTitle className="text-amber-100/90">答案揭曉</DialogTitle>
                                        <DialogDescription className="text-amber-200/80">
                                            正確位置資訊如下：
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3 mt-4">
                                        {/* 遊戲結果顯示 */}
                                        {markers.length > 0 && location && closestMarker && (
                                            <div className={`p-4 rounded-lg border text-center ${
                                                closestMarker.distance <= 100
                                                    ? 'bg-green-300/10 border-green-300/50'
                                                    : closestMarker.distance <= 500
                                                    ? 'bg-yellow-300/10 border-yellow-300/50'
                                                    : 'bg-red-300/10 border-red-300/50'
                                            }`}>
                                                <div className={`text-lg font-bold mb-2 ${
                                                    closestMarker.distance <= 100
                                                        ? 'text-green-300'
                                                        : closestMarker.distance <= 500
                                                        ? 'text-yellow-300'
                                                        : 'text-red-300'
                                                }`}>
                                                    {closestMarker.distance <= 100
                                                        ? '🎉 遊戲成功！'
                                                        : closestMarker.distance <= 500
                                                        ? '👍 不錯的猜測！'
                                                        : '❌ 遊戲失敗'
                                                    }
                                                </div>
                                                <div className={`text-sm ${
                                                    closestMarker.distance <= 100
                                                        ? 'text-green-200/80'
                                                        : closestMarker.distance <= 500
                                                        ? 'text-yellow-200/80'
                                                        : 'text-red-200/80'
                                                }`}>
                                                    {closestMarker.distance <= 100
                                                        ? `恭喜！您的最佳猜測距離實際位置僅 ${closestMarker.distance} 公里！`
                                                        : closestMarker.distance <= 500
                                                        ? `不錯！您的最佳猜測距離實際位置 ${closestMarker.distance} 公里。`
                                                        : `很遺憾，您的最佳猜測距離實際位置 ${closestMarker.distance} 公里。`
                                                    }
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="p-4 bg-amber-300/10 rounded-lg border border-amber-300/30">
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-amber-100/90">國家:</span>
                                                    <span className="font-mono text-amber-200/80">{location?.country || '未知'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-amber-100/90">城市:</span>
                                                    <span className="font-mono text-amber-200/80">{location?.city || '未知'}</span>
                                                </div>
                                                {location?.state && (
                                                    <div className="flex justify-between">
                                                        <span className="text-amber-100/90">州/省:</span>
                                                        <span className="font-mono text-amber-200/80">{location.state}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-amber-100/90">經緯度:</span>
                                                    <span className="font-mono text-amber-200/80">
                                                        {location?.latitude.toFixed(4)}, {location?.longitude.toFixed(4)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* 遊戲資料統計 */}
                                        <div className="p-4 bg-amber-300/10 rounded-lg border border-amber-300/30">
                                            <div className="text-amber-100/90 text-sm mb-2">遊戲統計</div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-amber-100/90">標記次數:</span>
                                                    <span className="font-mono text-amber-200/80">{markers.length}</span>
                                                </div>
                                                {markers.length > 0 && location && closestMarker && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span className="text-amber-100/90">最佳預測:</span>
                                                            <span className="font-mono text-amber-200/80">{closestMarker.distance} 公里</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-amber-100/90">最佳位置:</span>
                                                            <span className="font-mono text-amber-200/80">
                                                                {closestMarker.lat.toFixed(4)}, {closestMarker.lng.toFixed(4)}
                                                            </span>
                                                        </div>
                                                        {closestLocationInfo && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span className="text-amber-100/90">預測國家:</span>
                                                                    <span className="font-mono text-amber-200/80">{closestLocationInfo.country || '未知'}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-amber-100/90">預測城市:</span>
                                                                    <span className="font-mono text-amber-200/80">{closestLocationInfo.city || '未知'}</span>
                                                                </div>
                                                                {closestLocationInfo.state && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-amber-100/90">預測州/省:</span>
                                                                        <span className="font-mono text-amber-200/80">{closestLocationInfo.state}</span>
                                                                    </div>
                                                                )}
                                                                {closestLocationInfo.county && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-amber-100/90">預測縣/區:</span>
                                                                        <span className="font-mono text-amber-200/80">{closestLocationInfo.county}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button 
                                        variant="default"
                                        className="text-amber-100/90 button-bg sm:px-6 sm:py-4 rounded-lg sm:w-full  text-sm hover:bg-amber-300/30 transition-all duration-200 shadow-lg hover:shadow-xl"
                                        onClick={async () => {
                                            if (!location) {
                                                toast.error('無法獲取位置提示！');
                                                return;
                                            }
                                            const hint = await generateLocationHint(location);
                                            if (hint) {
                                                setHint(hint);
                                            } else {
                                                toast.error('生成提示失敗，請稍後重試！');
                                            }
                                        }}
                                    >
                                        <Image src="/icon.svg" alt="獲取提示" width={16} height={16} className="mr-2" />
                                        獲取提示
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-black/95 border-amber-300/50 text-white">
                                    <DialogHeader>
                                        <DialogTitle className="text-amber-100/90">位置提示</DialogTitle>
                                        <DialogDescription className="text-amber-200/80">
                                            這個提示可能對你有所幫助：
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 bg-amber-300/10 rounded-lg border border-amber-300/30">
                                        <p className="text-amber-100/90 text-sm leading-relaxed">
                                            {hint || '正在生成提示...'}
                                        </p>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button 
                                variant="outline"
                                className="text-amber-200/80 border-amber-300/50 bg-transparent sm:px-6 sm:py-4 rounded-lg sm:w-full  text-sm hover:bg-amber-300/20 hover:text-amber-100/90 transition-all duration-200"
                                onClick={handleReset}
                            >
                                <Image src="/icon.svg" alt="重新開始" width={16} height={16} className="mr-2" />
                                重新開始
                            </Button>
                        </div>
                    </div>

                  
            </div>
        </div>
    )
}