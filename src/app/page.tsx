"use client"

import { useEffect, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useAtom } from "jotai"
import { useRouter } from "next/navigation"
import { RandomLocation } from "./game/handle";
import { toast } from "sonner";
import { markersAtom, closestLocationInfoAtom } from "./game/atoms";
import { selectedRegionAtom, locationAtom } from "./atom";
import Image from 'next/image'

export default function Home() {
    const router = useRouter()

    const [curtainState, setCurtainState] = useState({
        isVisible: true,
        isTitleVisible: false,
        isImageVisible: false
    });

    const [selectedRegion, setSelectedRegion] = useAtom(selectedRegionAtom)
    const [, setMarkers] = useAtom(markersAtom)
    const [, setLocation] = useAtom(locationAtom)
    const [, setClosestLocationInfo] = useAtom(closestLocationInfoAtom);

    useEffect(() => {
        const timers = [
            setTimeout(() => setCurtainState(prev => ({ ...prev, isTitleVisible: true })), 800),
            setTimeout(() => setCurtainState(prev => ({ ...prev, isImageVisible: true })), 1500),
            setTimeout(() => setCurtainState(prev => ({ ...prev, isTitleVisible: false })), 3500),
            setTimeout(() => setCurtainState(prev => ({ ...prev, isImageVisible: false })), 4000),
            setTimeout(() => setCurtainState(prev => ({ ...prev, isVisible: false })), 4500)
        ];

        return () => timers.forEach(timer => clearTimeout(timer));
    }, []);

    return (
        <main className="min-h-screen">
            {/* 啟動動畫幕布 */}
            <div
                className={`curtain fixed bottom-0 left-0 z-50 w-full h-full bg-black transition-all duration-1000 ease-in-out ${curtainState.isVisible ? "translate-y-0" : "-translate-y-full"
                    }`}
            >
                <div className="relative flex flex-col items-center justify-center w-full h-full">
                    <p
                        className={`font-serif text-white text-lg tracking-widest absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out ${curtainState.isTitleVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
                            }`}
                    >
                        歡迎來到 AveMujica 的世界
                    </p>
                    <Image
                        src="/images/bg_loading_title.png"
                        alt="Avemujica"
                        width={500}
                        height={300}
                        className={`transition-all duration-1000 ease-in-out ${curtainState.isImageVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
                            }`}
                    />
                </div>
            </div>

            {/* 主內容區域，響應式佈局 */}
            <div className="page-bg w-full h-screen flex items-center justify-center">
                <div className="flex flex-col items-center w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto px-2 sm:px-4">
                    {/* 頂部裝飾 */}
                    <Image 
                        src="/images/box_t.svg" 
                        alt="裝飾性頂部邊框" 
                        width={500}
                        height={100}
                        className="scale-150 sm:scale-100 md:scale-80 mt-2 mb-2"
                        style={{ maxWidth: "100%", height: "auto" }}
                    />
                    
                    {/* 內容卡片，適配移動端和桌面 */}
                    <div className="w-full bg-black/90 backdrop-blur-md rounded-xl border border-amber-300/40 p-4 sm:p-6 md:p-8 shadow-lg">
                        <div className="text-center mb-6 sm:mb-8">
                            <h2 className="font-serif text-white text-lg sm:text-xl tracking-wider py-2">
                                選擇一個地區
                            </h2>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Select value={selectedRegion} onValueChange={setSelectedRegion} defaultValue="All">
                                <SelectTrigger className="w-48 sm:w-56 focus-visible:ring-0 focus-visible:border-amber-300/50 bg-amber-300/10 border-amber-300/50  text-white hover:bg-amber-300/20 transition-colors focus:ring-amber-300/30">
                                    <SelectValue placeholder="選擇地區" />
                                </SelectTrigger>
                                <SelectContent className="bg-black/95 border-amber-300/50">
                                    <SelectItem value="All" className="outline-none focus:bg-amber-300/20 text-white focus:text-white hover:bg-amber-300/20">全世界</SelectItem>
                                    <SelectItem value="Asia" className="outline-none focus:bg-amber-300/20 text-white focus:text-white hover:bg-amber-300/20">亞洲</SelectItem>
                                    <SelectItem value="Europe" className="outline-none focus:bg-amber-300/20 text-white focus:text-white hover:bg-amber-300/20">歐洲</SelectItem>
                                    <SelectItem value="America" className="outline-none focus:bg-amber-300/20 text-white focus:text-white hover:bg-amber-300/20">美洲</SelectItem>
                                    <SelectItem value="Africa" className="outline-none focus:bg-amber-300/20 text-white focus:text-white hover:bg-amber-300/20">非洲</SelectItem>
                                    <SelectItem value="Oceania" className="outline-none focus:bg-amber-300/20 text-white focus:text-white hover:bg-amber-300/20">大洋洲</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button 
                                variant="default"
                                className="w-full sm:w-auto bg-amber-300/20 hover:bg-amber-300/30  border-amber-300/50 px-8"
                                onClick={() => {
                                    setMarkers([])
                                    setClosestLocationInfo(null)
                                    toast('位置正在生成中...', {
                                        duration: 1000
                                    })
                                    RandomLocation({region: selectedRegion}).then(location => {
                                        setLocation(location)
                                        if (location) {
                                            router.push('/game')
                                        } else {
                                            toast.error('位置生成失敗，請稍後再試')
                                        }
                                    })
                                }}
                            >
                                開始
                            </Button>
                        </div>

                        <div className="mt-8 text-yellow-300/80">
                            <ul className="space-y-4 list-none px-4">
                                <li className="flex items-center space-x-3">
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br from-yellow-200/80 to-yellow-400/60"></span>
                                    <span className="text-sm leading-relaxed">每輪遊戲將隨機生成一個街景位置</span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br from-yellow-200/80 to-yellow-400/60"></span>
                                    <span className="text-sm leading-relaxed">玩家需要根據街景環境判斷所在位置</span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br from-yellow-200/80 to-yellow-400/60"></span>
                                    <span className="text-sm leading-relaxed">在地圖上標記你認為正確的位置</span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-br from-yellow-200/80 to-yellow-400/60"></span>
                                    <span className="text-sm leading-relaxed">每次標記需要間隔3秒</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    {/* 底部裝飾 */}
                    <Image 
                        src="/images/box_b.svg" 
                        alt="裝飾性底部邊框" 
                        width={500}
                        height={100}
                        className="scale-150 sm:scale-100 md:scale-80 mt-2 mb-2"
                        style={{ maxWidth: "100%", height: "auto" }}
                    />
                </div>
            </div>
        </main>
    );
}
