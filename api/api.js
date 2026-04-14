import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lume_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lume_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ───
export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const register = (data) =>
  api.post('/auth/register', data);

export const getMe = () =>
  api.get('/auth/me');

// ─── Warehouse ───
export const getWarehouses = () =>
  api.get('/warehouse');

export const getWarehouseCells = (warehouseId, viewport) =>
  api.get(`/warehouse/${warehouseId}/cells`, { params: viewport });

export const getWarehouseStats = (warehouseId) =>
  api.get(`/warehouse/${warehouseId}/stats`);

export const bookCell = (warehouseId, cellId) =>
  api.post(`/warehouse/${warehouseId}/cells/${cellId}/book`);

export const releaseCell = (warehouseId, cellId) =>
  api.post(`/warehouse/${warehouseId}/cells/${cellId}/release`);

export const occupyCell = (warehouseId, cellId) =>
  api.post(`/warehouse/${warehouseId}/cells/${cellId}/occupy`);

export const createWarehouse = (data) =>
  api.post('/warehouse', data);

// ─── Shipments ───
export const getShipments = (params) =>
  api.get('/shipments', { params });

export const createShipment = (data) =>
  api.post('/shipments', data);

export const updateShipmentStatus = (id, status) =>
  api.patch(`/shipments/${id}/status`, { status });

export default api;
