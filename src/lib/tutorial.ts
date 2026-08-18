export type TutorialRole = 'candidate' | 'employer';

export function tutorialStorageKey(userId: string, role: TutorialRole) {
  return `rolewave-tutorial-v2-complete:${role}:${userId}`;
}

export function resetTutorial(userId: string, role: TutorialRole) {
  try {
    window.localStorage.removeItem(tutorialStorageKey(userId, role));
  } catch {
    // The next dashboard visit can still attempt to start the tour.
  }
}
