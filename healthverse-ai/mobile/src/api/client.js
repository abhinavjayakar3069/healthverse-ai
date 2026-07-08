// IMPORTANT: "localhost" on a phone/emulator refers to the PHONE, not your
// dev machine running the backend. Replace this with your computer's LAN
// IP (e.g. "http://192.168.1.42:8000") when testing on a real device or
// the Expo Go app. On an Android emulator specifically, "10.0.2.2" maps to
// your host machine. iOS simulator can use "localhost" directly since it
// shares the host's network.
export const API_BASE_URL = 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export const api = {
  predictDiabetes: (payload) =>
    request('/predict/diabetes', { method: 'POST', body: JSON.stringify(payload) }),

  predictHeart: (payload) =>
    request('/predict/heart', { method: 'POST', body: JSON.stringify(payload) }),

  predictKidney: (payload) =>
    request('/predict/kidney', { method: 'POST', body: JSON.stringify(payload) }),

  assessLiver: (payload) =>
    request('/assess/liver', { method: 'POST', body: JSON.stringify(payload) }),

  predictStroke: (payload) =>
    request('/predict/stroke', { method: 'POST', body: JSON.stringify(payload) }),

  predictHypertension: (payload) =>
    request('/predict/hypertension', { method: 'POST', body: JSON.stringify(payload) }),

  healthScore: (payload) =>
    request('/health-score', { method: 'POST', body: JSON.stringify(payload) }),

  chat: (message, history) =>
    request('/chat', { method: 'POST', body: JSON.stringify({ message, history }) }),

  symptomCheck: (message, history) =>
    request('/symptom-checker', { method: 'POST', body: JSON.stringify({ message, history }) }),

  analyzeMealPhoto: (imageBase64, mimeType = 'image/jpeg') =>
    request('/nutrition/analyze-photo', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
    }),

  airQuality: (location) =>
    request(`/environment/air-quality?location=${encodeURIComponent(location)}`, { method: 'GET' }),

  // Multipart upload, not JSON - can't use the shared `request()` helper
  // since it always sets Content-Type: application/json.
  transcribeAudio: async (audioUri) => {
    const form = new FormData();
    form.append('file', { uri: audioUri, name: 'recording.m4a', type: 'audio/m4a' });
    const res = await fetch(`${API_BASE_URL}/voice/transcribe`, { method: 'POST', body: form });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${detail}`);
    }
    return res.json();
  },

  doctorReport: (patientData) =>
    request('/doctor-report', { method: 'POST', body: JSON.stringify({ patient_data: patientData }) }),

  workoutPlan: (profile) =>
    request('/fitness/workout-plan', { method: 'POST', body: JSON.stringify(profile) }),

  scanPrescription: (imageBase64, mimeType = 'image/jpeg') =>
    request('/medicine/scan-prescription', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
    }),

  checkInteractions: (medications) =>
    request('/medicine/check-interactions', { method: 'POST', body: JSON.stringify({ medications }) }),

  createVideoRoom: () =>
    request('/doctor/create-video-room', { method: 'POST' }),
};

// Note: the backend also has /family, /mood, /health-score/history, and
// /emergency-profile endpoints (see backend/app/db.py) for a device_id-
// keyed SQLite store. The mobile app doesn't call them - AppContext
// persists this data locally via AsyncStorage instead, which is simpler
// and needs no network for basic CRUD. Those endpoints are tested and
// working; they're just a foundation for real multi-device sync later,
// not something currently wired up. Don't add calls to them without
// removing the AsyncStorage path first, or the two would conflict.
