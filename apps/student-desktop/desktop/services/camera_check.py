import cv2
import numpy as np
import os
import sys

def _get_cascade():
    candidates = [
        os.path.join(os.path.dirname(__file__), 'haarcascade_frontalface_default.xml'),
        os.path.join(getattr(sys, '_MEIPASS', ''), 'services', 'haarcascade_frontalface_default.xml'),
        os.path.join(getattr(sys, '_MEIPASS', ''), 'haarcascade_frontalface_default.xml'),
        os.path.join(os.path.dirname(sys.executable), 'services', 'haarcascade_frontalface_default.xml'),
        os.path.join(getattr(cv2, 'data', None) and getattr(cv2.data, 'haarcascades', '') or '', 'haarcascade_frontalface_default.xml')
    ]
    for p in candidates:
        if p and os.path.exists(p):
            try:
                casc = cv2.CascadeClassifier(p)
                if not casc.empty():
                    print(f"[CameraCheck] Successfully loaded face cascade from: {p}")
                    return casc
            except Exception as e:
                print(f"[CameraCheck Warning] Error loading cascade from {p}: {e}")
    print("[CameraCheck Warning] No valid haarcascade XML found. Using graceful fallback.")
    return None

# Load OpenCV's face detector
face_cascade = _get_cascade()

def analyze_camera_frame(frame):
    """
    Evaluates upper-body framing with automatic low-light compensation.
    Tuple-safe version.
    """
    if frame is None:
        return "not-detected", "No camera feed received!"

    if face_cascade is None or face_cascade.empty():
        # Safe fallback: don't crash WebSocket if classifier couldn't be loaded
        return "perfect", "Camera active."

    h, w, _ = frame.shape
    
    # 1. Low-Light Compensation Pipeline
    ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
    
    # FIX: Unpack the tuple safely into individual color channels
    y, cr, cb = cv2.split(ycrcb)
    
    # Apply CLAHE to the Brightness (Y) channel only
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    y_enhanced = clahe.apply(y)
    
    # Safely merge the newly enhanced Y channel with the old Cr and Cb channels
    enhanced_ycrcb = cv2.merge((y_enhanced, cr, cb))
    enhanced_bgr = cv2.cvtColor(enhanced_ycrcb, cv2.COLOR_YCrCb2BGR)
    gray = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2GRAY)

    # 2. Detect faces using the enhanced image
    try:
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(28, 28)
        )
    except Exception as e:
        print(f"[CameraCheck Warning] detectMultiScale error: {e}")
        return "perfect", "Camera active."

    if len(faces) == 0:
        return "not-detected", "Dim light detected: Please center your face in the guide!"

    # Multi-person interference detection (Adviser feedback: background person interference)
    if len(faces) > 1:
        sorted_faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        primary = sorted_faces[0]
        secondary = sorted_faces[1]
        primary_area = primary[2] * primary[3]
        secondary_area = secondary[2] * secondary[3]
        
        # If secondary face is at least 15% of the primary face area or wider than 7% of screen
        if secondary_area > 0.15 * primary_area or (secondary[2] / float(w)) > 0.07:
            return "too-far", "Multiple people detected! Please ensure only 1 student is in the camera view."

    # Find the primary face
    (fx, fy, fw, fh) = max(faces, key=lambda f: f[2] * f[3])
    face_ratio = fw / float(w)
    face_center_x = (fx + fw / 2.0) / float(w)

    # 3. Distance & Framing Validations
    if face_ratio > 0.42 or fy < int(h * 0.02):
        return "too-close", "Step back a bit so your upper body fits!"

    if face_ratio < 0.08:
        return "too-far", "Step closer to the camera!"

    if face_center_x < 0.20 or face_center_x > 0.80:
        return "too-far", "Center your body in the frame!"

    return "perfect", "Framing & Lighting Verified! Click Start."
