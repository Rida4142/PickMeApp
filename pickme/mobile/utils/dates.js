export const today = () => new Date().toISOString().slice(0, 10);

export const plusDays = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

export const formatTime = (value) => {
  const [hour, minute] = (value || '08:30').split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

export const formatDate = (value) => new Date(`${value || today()}T12:00:00`).toLocaleDateString(undefined, {
  month: 'short', day: 'numeric', year: 'numeric',
});
