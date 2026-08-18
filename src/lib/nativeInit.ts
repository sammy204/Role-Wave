import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

export async function setNativeSystemBarAppearance(color: string, darkBackground: boolean) {
  if (Capacitor.getPlatform() !== 'android') return;

  await EdgeToEdge.setStatusBarColor({ color });
  await SystemBars.setStyle({
    style: darkBackground ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  });
}

export async function initNativePlatform() {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await setNativeSystemBarAppearance('#FBFAF7', false);
  } catch {
    // Native system-bar APIs may be unavailable in some environments.
  }
}
