import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:5001/api/ai' });

export const generateAIImage = async (prompt) => (await api.post('/generate', { prompt })).data.imageUrl;
export const inpaintAIImage = async (payload) => (await api.post('/inpaint', payload)).data.imageUrl;
export const removeBgAIImage = async (imageUrl) => (await api.post('/remove-bg', { imageUrl })).data.imageUrl;
export const generateAIVideo = async (payload) => (await api.post('/generate-video', payload)).data;
export const getAIConfig = async () => (await api.get('/config')).data;
export const saveAIConfig = async (payload) => (await api.post('/config', payload)).data;
