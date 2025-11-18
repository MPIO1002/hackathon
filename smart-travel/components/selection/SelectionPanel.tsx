"use client";
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelection } from '@/context/SelectionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationCrosshairs, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';

const SelectionPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedPlaces, removeFromSelection } = useSelection();
  const router = useRouter();
  const pathname = usePathname();

  const handleCreateRoute = () => {
    if (selectedPlaces.length > 0) {
      const routeData = JSON.stringify(selectedPlaces);
      router.push(`/map?route=${encodeURIComponent(routeData)}`);
    }
  };

  if (pathname !== '/') {
    return null;
  }

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-40 transition-transform transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } w-80 flex flex-col`}
    >
      <div className="absolute top-1/2 -left-11 transform -translate-y-1/2 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative bg-white text-blue-900 p-3 rounded-l-lg shadow-lg"
        >
          <FontAwesomeIcon icon={faLocationCrosshairs} className="h-6 w-6" />
          {selectedPlaces.length > 0 && (
            <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">
              {selectedPlaces.length}
            </span>
          )}
        </button>
      </div>
      
      <div className="p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Địa điểm đã chọn</h3>
          <button onClick={() => setIsOpen(false)}>
            <FontAwesomeIcon icon={faTimes} className="h-6 w-6 text-gray-600" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          {selectedPlaces.length === 0 ? (
            <p className="text-gray-500">Chưa có địa điểm nào được chọn.</p>
          ) : (
            <ul>
              {selectedPlaces.map((place) => (
                <li key={place.id} className="flex justify-between items-center p-2 border-b border-gray-300">
                  <span>{place.tags['name:vi'] || place.tags.name}</span>
                  <button className="cursor-pointer" onClick={() => removeFromSelection(place.id)}>
                    <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-4">
            <button onClick={handleCreateRoute} className="w-full bg-[#333333] text-white py-2 rounded-lg">Tạo lộ trình</button>
        </div>
      </div>
    </div>
  );
};

export default SelectionPanel;
