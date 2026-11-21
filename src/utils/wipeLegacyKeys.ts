export function wipeLegacyGothwadKeys(): boolean {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gothwad_')) {
        keysToRemove.push(k);
      }
    }
    if (keysToRemove.length === 0) return false;
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
    return true;
  } catch {
    return false;
  }
}
