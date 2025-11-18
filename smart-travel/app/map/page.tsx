'use client';

import dynamic from 'next/dynamic';
import RoutePlanner from '@/components/map/RoutePlanner';
import { useSearchParams } from 'next/navigation';
import { useSelection } from '@/context/SelectionContext';
import React, { Suspense, useState } from 'react';

const MapView = dynamic(() => import('@/components/map/MapView'), {
    ssr: false
});

const MapContent = () => {
    const { selectedPlaces, updatePlacesOrder } = useSelection();
    const searchParams = useSearchParams();
    const routeParam = searchParams.get('route');
    const [routeData, setRouteData] = useState<{ route: [number, number][], waypoints: any[] }>({ route: [], waypoints: [] });
    const [highlightedSegment, setHighlightedSegment] = useState<[number, number][] | null>(null);

    const handleOrderChange = (newOrder: any[]) => {
        updatePlacesOrder(newOrder);
    };

    const handleWaypointEnter = (waypointIndex: number) => {
        if (!routeData.waypoints || waypointIndex >= routeData.waypoints.length - 1) {
            setHighlightedSegment(null);
            return;
        }

        const findClosestCoordIndex = (point: any, coords: [number, number][]) => {
            let closestIndex = 0;
            let minDistance = Infinity;
            coords.forEach((coord, index) => {
                const distance = Math.hypot(coord[0] - point.location[1], coord[1] - point.location[0]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = index;
                }
            });
            return closestIndex;
        };

        const startPoint = routeData.waypoints[waypointIndex];
        const endPoint = routeData.waypoints[waypointIndex + 1];

        const startIndex = findClosestCoordIndex(startPoint, routeData.route);
        const endIndex = findClosestCoordIndex(endPoint, routeData.route);

        if (startIndex !== -1 && endIndex !== -1) {
            const segment = routeData.route.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
            setHighlightedSegment(segment);
        }
    };

    const handleWaypointLeave = () => {
        setHighlightedSegment(null);
    };

    // Use the waypoints from the fetched route data for the planner
    const plannerPlaces = routeData.waypoints.length > 0 
        ? routeData.waypoints.map(wp => ({
            lat: wp.location[1],
            lon: wp.location[0],
            tags: { name: wp.name }
        }))
        : selectedPlaces;

    return (
        <div className="relative h-screen p-8">
            <h2 className="text-xl font-semibold mb-4">Xem lộ trình của chuyến đi</h2>
            <div className="absolute top-22 right-12 z-20">
                <RoutePlanner 
                    places={selectedPlaces} 
                    onWaypointEnter={handleWaypointEnter}
                    onWaypointLeave={handleWaypointLeave}
                    onOrderChange={handleOrderChange}
                />
            </div>
            <div className="absolute inset-0 z-10 p-8 mt-10">
                <MapView 
                    places={selectedPlaces} 
                    onRouteFetched={setRouteData}
                    highlightedSegment={highlightedSegment}
                />
            </div>
        </div>
    );
}

const MapPage = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MapContent />
        </Suspense>
    );
};

export default MapPage;
