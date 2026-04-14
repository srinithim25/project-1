import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export const useSocket = (warehouseId, onCellUpdate, onShipmentUpdate) => {
  const joined = useRef(false);

  useEffect(() => {
    if (!warehouseId) return;

    // Singleton socket
    if (!socketInstance) {
      socketInstance = io('/', { path: '/socket.io', transports: ['websocket'] });
    }

    if (!joined.current) {
      socketInstance.emit('join:warehouse', warehouseId);
      joined.current = true;
    }

    const handleCell = (cell) => onCellUpdate && onCellUpdate(cell);
    const handleShipment = (shipment) => onShipmentUpdate && onShipmentUpdate(shipment);

    socketInstance.on('cell:updated', handleCell);
    socketInstance.on('shipment:new', handleShipment);
    socketInstance.on('shipment:updated', handleShipment);

    return () => {
      socketInstance.off('cell:updated', handleCell);
      socketInstance.off('shipment:new', handleShipment);
      socketInstance.off('shipment:updated', handleShipment);
      socketInstance.emit('leave:warehouse', warehouseId);
      joined.current = false;
    };
  }, [warehouseId]);

  const emitOptimistic = useCallback((cell) => {
    socketInstance?.emit('cell:optimistic', { warehouseId, cell });
  }, [warehouseId]);

  return { emitOptimistic };
};
