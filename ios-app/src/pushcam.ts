// Bridge to the native PushCam module (ios/PushCam): camera + pose events, sounds, run recording,
// the saved profile and the photo picker.

import { NativeEventEmitter, NativeModules, requireNativeComponent, type ViewProps } from 'react-native';
import type { PoseEvent, Sfx } from './game';

interface PushCamModule {
  start(): void;
  play(name: Sfx): void;
  startRecording(): Promise<void>;
  /** Stops recording; trims the last `trimSec` seconds (recorded after the player gave up). */
  stopRecording(trimSec: number): Promise<void>;
  /** Saves the last run's video to Photos. */
  saveRecording(): Promise<void>;
  /** Opens the iOS share sheet for the last run's video. */
  shareRecording(): Promise<void>;
  loadProfile(): Promise<{ profile: string | null; docs: string }>;
  saveProfile(json: string): void;
  /** File name of the cropped photo in Documents, or null when the player cancels. */
  pickPhoto(): Promise<string | null>;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

export const PushCam: PushCamModule = NativeModules.PushCam;
const emitter = new NativeEventEmitter(NativeModules.PushCam);

export const onPose = (cb: (ev: PoseEvent) => void) => emitter.addListener('pose', (ev) => cb(ev as PoseEvent));
export const onError = (cb: (ev: { message: string }) => void) => emitter.addListener('error', (ev) => cb(ev as { message: string }));

/** Full-screen mirrored front camera. */
export const CameraView = requireNativeComponent<ViewProps>('PushCamView');
