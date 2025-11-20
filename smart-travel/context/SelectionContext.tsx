"use client";
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface Place {
  id: string;
  lat: number;
  lon: number;
  tags: { [key: string]: string };
}

interface SelectionContextType {
  selectedPlaces: Place[];
  addToSelection: (place: Omit<Place, 'id'>) => void;
  removeFromSelection: (placeId: string) => void;
  updatePlacesOrder: (newOrder: Place[]) => void;
  addStartingLocation: (location: { lat: number; lng: number; display: string }) => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export const SelectionProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);

  const addToSelection = (place: Omit<Place, 'id'>) => {
    setSelectedPlaces(prevPlaces => {
      // Avoid adding duplicates based on name
      if (prevPlaces.find(p => (p.tags['name:vi'] || p.tags.name) === (place.tags['name:vi'] || place.tags.name))) {
        return prevPlaces;
      }
      const newPlace = { ...place, id: `${Date.now()}-${Math.random()}` };
      return [...prevPlaces, newPlace];
    });
  };

  const addStartingLocation = (location: { lat: number; lng: number; display: string }) => {
    setSelectedPlaces(prevPlaces => {
      // Remove existing starting location if any (check by id or marker)
      const filteredPlaces = prevPlaces.filter(p => p.id !== 'starting-location');
      
      const startingPlace: Place = {
        id: 'starting-location',
        lat: location.lat,
        lon: location.lng,
        tags: {
          name: location.display,
          'name:vi': location.display,
          'place-type': 'starting-point'
        }
      };

      return [startingPlace, ...filteredPlaces];
    });
  };

  const removeFromSelection = (placeId: string) => {
    setSelectedPlaces(prevPlaces => prevPlaces.filter(p => p.id !== placeId));
  };

  const updatePlacesOrder = (newOrder: Place[]) => {
    setSelectedPlaces(newOrder);
  };

  return (
    <SelectionContext.Provider value={{ selectedPlaces, addToSelection, removeFromSelection, updatePlacesOrder, addStartingLocation }}>
      {children}
    </SelectionContext.Provider>
  );
};

export const useSelection = () => {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
};
