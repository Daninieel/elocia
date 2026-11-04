/**
 * cameraManager.ts
 * Centralized registry and lifecycle manager for all camera MediaStreams in the Student Desktop app.
 * Guarantees that tracks are properly stopped and never leak in the background.
 */

const activeStreams = new Set<MediaStream>();

/**
 * Stop all tracks on a MediaStream and remove it from the active registry.
 */
export function stopStreamTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        if (track.readyState !== 'ended') {
          track.stop();
        }
      } catch (err) {
        console.warn('[CameraManager] Error stopping track:', err);
      }
    });
  } catch (err) {
    console.warn('[CameraManager] Error accessing tracks on stream:', err);
  }
  activeStreams.delete(stream);
}

/**
 * Safely stops a MediaStream and detaches/stops any MediaStream currently assigned to an HTMLVideoElement.
 */
export function stopMediaStream(
  stream?: MediaStream | null,
  videoElement?: HTMLVideoElement | null
): void {
  // 1. Stop explicitly passed stream
  if (stream) {
    stopStreamTracks(stream);
  }

  // 2. Stop any stream assigned to videoElement.srcObject
  if (videoElement) {
    if (videoElement.srcObject) {
      if (videoElement.srcObject instanceof MediaStream) {
        stopStreamTracks(videoElement.srcObject);
      }
      videoElement.srcObject = null;
    }
    // Also pause the element to free decoding pipeline
    try {
      videoElement.pause();
    } catch {}
  }
}

/**
 * Request a camera stream with cancellation protection.
 * If the caller unmounted or cancelled while getUserMedia was resolving,
 * the newly acquired stream is immediately stopped before returning null.
 */
export async function requestCameraStream(
  constraints: MediaStreamConstraints,
  isCancelled?: () => boolean
): Promise<MediaStream | null> {
  if (isCancelled && isCancelled()) {
    return null;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser or environment.');
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // If the caller cancelled while awaiting the hardware:
  if (isCancelled && isCancelled()) {
    console.info('[CameraManager] Camera stream acquired after cancellation. Immediately stopping tracks.');
    stopStreamTracks(stream);
    return null;
  }

  activeStreams.add(stream);

  // Auto-prune when all tracks end
  stream.getVideoTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      const allEnded = stream.getTracks().every((t) => t.readyState === 'ended');
      if (allEnded) {
        activeStreams.delete(stream);
      }
    }, { once: true });
  });

  return stream;
}

/**
 * Global failsafe: stops all registered streams and scans the DOM for any
 * video elements holding an active MediaStream.
 */
export function stopAllActiveCameraStreams(): void {
  // 1. Stop all registered streams in memory
  if (activeStreams.size > 0) {
    console.info(`[CameraManager] Stopping ${activeStreams.size} registered active camera stream(s).`);
    activeStreams.forEach((stream) => {
      stopStreamTracks(stream);
    });
    activeStreams.clear();
  }

  // 2. Scan DOM for any video elements with active srcObject streams
  try {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video) => {
      if (video.srcObject && video.srcObject instanceof MediaStream) {
        console.info('[CameraManager] Cleaning up lingering stream found on DOM video element.');
        stopStreamTracks(video.srcObject);
        video.srcObject = null;
      }
      try {
        video.pause();
      } catch {}
    });
  } catch (err) {
    console.warn('[CameraManager] Error inspecting DOM video elements:', err);
  }
}

