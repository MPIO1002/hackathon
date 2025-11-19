"use client";
import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCar, faBicycle, faWalking, faEdit, faSave, faRobot } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/components/ui/ToastProvider';

interface Place {
  id: string;
  lat: number;
  lon: number;
  tags: {
    name?: string;
    'name:vi'?: string;
  };
}

interface RoutePlannerProps {
  places?: Place[];
  onWaypointEnter: (index: number) => void;
  onWaypointLeave: () => void;
  onOrderChange: (newOrder: Place[]) => void;
}

const RoutePlanner: React.FC<RoutePlannerProps> = ({ places = [], onWaypointEnter, onWaypointLeave, onOrderChange }) => {
  const [items, setItems] = useState<Place[]>(places);
  const [selectedVehicle, setSelectedVehicle] = useState('car');
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const { addToast } = useToast();

  // Use local state for editing to avoid re-rendering the map on every drag
  const [localItems, setLocalItems] = useState<Place[]>(places);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require a 5px drag to start
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    // Sync with external changes when not in editing mode
    if (!isEditing) {
      setLocalItems(places);
    }
  }, [places, isEditing]);

  const handleToggleEdit = () => {
    if (isEditing) {
      // When saving, call the callback to update the global state
      onOrderChange(localItems);
      setIsAdding(false); // Hide search bar on save
      setEditingItemId(null); // Reset editing item
    }
    setIsEditing(!isEditing);
  };

  const handleRemoveItem = (idToRemove: string) => {
    setLocalItems((currentItems) => currentItems.filter(item => item.id !== idToRemove));
  };

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setLocalItems((currentItems) => {
        const oldIndex = currentItems.findIndex(item => item.id === active.id);
        const newIndex = currentItems.findIndex(item => item.id === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
    }
  }

  // --- Search and Add new location logic ---
  const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;

  useEffect(() => {
    if ((!isAdding && editingItemId === null) || searchQuery.trim() === '') {
      setSuggestions([]);
      return;
    }

    const debounceTimeout = setTimeout(() => {
      fetch(`https://maps.vietmap.vn/api/autocomplete/v3?apikey=${VIETMAP_API_KEY}&text=${searchQuery}`)
        .then(response => response.json())
        .then(data => {
          setSuggestions(data);
        })
        .catch(error => console.error('Error fetching suggestions:', error));
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, isAdding, editingItemId, VIETMAP_API_KEY]);

  const handleSuggestionClick = async (suggestion: any) => {
    setSearchQuery('');
    setSuggestions([]);
    
    const isUpdating = editingItemId !== null;

    if (suggestion.ref_id) {
      try {
        const response = await fetch(`https://maps.vietmap.vn/api/place/v4?apikey=${VIETMAP_API_KEY}&refid=${suggestion.ref_id}`);
        const data = await response.json();
        if (data && data.lat && data.lng) {
          // Check for duplicates before adding or updating
          const alreadyExists = localItems.some(
            item => item.lat === data.lat && item.lon === data.lng && item.id !== editingItemId
          );

          if (alreadyExists) {
            addToast('Địa điểm này đã có trong lộ trình của bạn.', 'warning');
            // If updating, we might want to reset the input to its original value or just leave it.
            // For now, we just stop the process.
            setEditingItemId(null);
            return;
          }

          const newPlace: Place = {
            id: isUpdating ? editingItemId! : uuidv4(),
            lat: data.lat,
            lon: data.lng,
            tags: {
              name: data.name,
              'name:vi': data.display,
            },
          };

          if (isUpdating) {
            setLocalItems(current => current.map(item => item.id === editingItemId ? newPlace : item));
            setEditingItemId(null);
          } else {
            setLocalItems(current => [...current, newPlace]);
            setIsAdding(false);
          }
        }
      } catch (error) {
        console.error('Error fetching place details:', error);
      }
    }
  };

  const handleItemNameChange = (id: string, newName: string) => {
    setLocalItems(current => current.map(item => {
      if (item.id === id) {
        setSearchQuery(newName); // Update search query as user types
        // Update both name fields to ensure the input can be cleared
        return { ...item, tags: { ...item.tags, 'name:vi': newName, name: newName } };
      }
      return item;
    }));
  };

  const handleItemFocus = (id: string) => {
    setEditingItemId(id);
    const item = localItems.find(i => i.id === id);
    if (item) {
      setSearchQuery(item.tags['name:vi'] || item.tags.name || '');
    }
  };

  const handleItemBlur = () => {
    // Use a timeout to allow click on suggestion list
    setTimeout(() => {
      setEditingItemId(null);
      setSuggestions([]);
    }, 200);
  };

  // --- End Search ---

  const optimizeRoute = async () => {
    if (localItems.length < 2) {
      addToast('Cần ít nhất 2 địa điểm để tối ưu hóa lộ trình.', 'warning');
      return;
    }

    setIsOptimizing(true);
    try {
      // Build coordinates string in format: lon,lat;lon,lat;...
      const coordinates = localItems.map(p => `${p.lon},${p.lat}`).join(';');
      const url = `https://router.project-osrm.org/trip/v1/driving/${coordinates}?source=first&roundtrip=false&overview=full`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
        // Reorder places based on waypoints returned from OSRM
        const optimizedOrder = data.waypoints.map((wp: any) => localItems[wp.waypoint_index]);
        setLocalItems(optimizedOrder);
        onOrderChange(optimizedOrder);
        addToast('Lộ trình đã được tối ưu hóa!', 'success');
      } else {
        addToast('Không thể tối ưu hóa lộ trình. Vui lòng thử lại.', 'danger');
      }
    } catch (error) {
      console.error('Error optimizing route:', error);
      addToast('Lỗi khi tối ưu hóa lộ trình.', 'danger');
    } finally {
      setIsOptimizing(false);
    }
  };

  function addLocation() {
    setIsAdding(true);
  }

  const itemIds = localItems.map(i => i.id);

  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-lg w-96">
        <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-4">
                <button onClick={() => setSelectedVehicle('car')}>
                    <FontAwesomeIcon icon={faCar} className={`h-6 w-6 ${selectedVehicle === 'car' ? 'text-blue-500' : 'text-gray-500'}`} />
                </button>
                <button onClick={() => setSelectedVehicle('bike')}>
                    <FontAwesomeIcon icon={faBicycle} className={`h-6 w-6 ${selectedVehicle === 'bike' ? 'text-blue-500' : 'text-gray-500'}`} />
                </button>
                <button onClick={() => setSelectedVehicle('foot')}>
                    <FontAwesomeIcon icon={faWalking} className={`h-6 w-6 ${selectedVehicle === 'foot' ? 'text-blue-500' : 'text-gray-500'}`} />
                </button>
            </div>
            <div className="flex space-x-2">
                {!isEditing && localItems.length > 1 && (
                    <button 
                        onClick={optimizeRoute}
                        disabled={isOptimizing}
                        className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white px-3 py-1 rounded-md text-sm flex items-center space-x-2"
                    >
                        <FontAwesomeIcon icon={faRobot} className="h-4 w-4" />
                        <span>{isOptimizing ? 'Tối ưu...' : 'Tối ưu'}</span>
                    </button>
                )}
                <button onClick={handleToggleEdit} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm flex items-center space-x-2">
                    <FontAwesomeIcon icon={isEditing ? faSave : faEdit} className="h-4 w-4" />
                    <span>{isEditing ? 'Lưu' : 'Sửa'}</span>
                </button>
            </div>
        </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {localItems.map((item, index) => {
            const isCurrentlyEditingThisItem = editingItemId === item.id;
            const displayName = item.tags['name:vi'] || item.tags.name;
            
            // If editing, show the exact value, even if empty. Otherwise, fallback to 'Unknown'.
            const label = isCurrentlyEditingThisItem ? (item.tags['name:vi'] ?? '') : (displayName || 'Unknown');

            return (
              <div 
                key={item.id}
                className="relative"
                onMouseEnter={() => onWaypointEnter(index)}
                onMouseLeave={onWaypointLeave}
              >
                <SortableItem 
                  id={item.id} 
                  label={label} 
                  isEditing={isEditing} 
                  onRemove={handleRemoveItem}
                  onNameChange={handleItemNameChange}
                  onFocus={handleItemFocus}
                  onBlur={handleItemBlur}
                />
                {editingItemId === item.id && suggestions.length > 0 && (
                   <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion.display}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </SortableContext>
      </DndContext>

      {isEditing && !isAdding && (
        <div className="mt-4">
          <button onClick={addLocation} className="flex items-center text-blue-500">
            <FontAwesomeIcon icon={faPlus} className="h-5 w-5 mr-1" />
            Add location
          </button>
        </div>
      )}
      {isEditing && isAdding && (
        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion.display}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutePlanner;
