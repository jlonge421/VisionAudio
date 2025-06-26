const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');
const volumeValue = document.getElementById('volume-value');
const speedValue = document.getElementById('speed-value');
const sliderHandle = document.getElementById('slider-handle');
const sliderValue = document.getElementById('slider-value');
const pinchStatus = document.getElementById('pinch-status');
const audioSelect = document.getElementById('audio-select');

audioSelect.addEventListener('change', () => {
    const selectedAudioSrc = audioSelect.value;
    audio.src = selectedAudioSrc;
    audio.play();
});

// Set canvas dimensions
canvas.width = 640;
canvas.height = 480;

// Constants
const PINCH_THRESHOLD = 0.1; // Distance threshold for pinch detection
const VOLUME_MAX_DISTANCE = 0.3; // Maximum distance for volume control
const VOLUME_HAND_DISTANCE_MIN = 0.1; // Min distance between hands for volume control
const VOLUME_HAND_DISTANCE_MAX = 0.7; // Max distance between hands for volume control
const SLIDER_HEIGHT = 480; // Height of the slider area
const PLAYBACK_RATE_MIN = 0.5; // Minimum playback speed
const PLAYBACK_RATE_MAX = 2.0; // Maximum playback speed

// Smoothing and performance tuning for playback rate
let smoothedDistance = 0.1;
const SMOOTHING_FACTOR = 0.5; // Adjust for more or less smoothing (0-1)
let lastAppliedPlaybackRate = 1.0;

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Initialize camera
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({image: video});
    },
    width: 640,
    height: 480
});

camera.start();

// Function to calculate distance between two points
function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Function to update volume based on distance between hands
function updateVolume(distance) {
    let volume = (distance - VOLUME_HAND_DISTANCE_MIN) / (VOLUME_HAND_DISTANCE_MAX - VOLUME_HAND_DISTANCE_MIN);
    volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    audio.volume = volume;
    volumeValue.textContent = `${Math.round(volume * 100)}%`;
}

// Function to update playback rate based on pinch distance
function updatePlaybackRate(distance) {
    // 1. Smooth the raw distance value to reduce jitter
    smoothedDistance = SMOOTHING_FACTOR * distance + (1 - SMOOTHING_FACTOR) * smoothedDistance;

    // 2. Map the smoothed distance to the playback rate range
    const pinchRange = VOLUME_MAX_DISTANCE - PINCH_THRESHOLD;
    const effectiveDistance = Math.max(0, smoothedDistance - PINCH_THRESHOLD);
    let newPlaybackRate = PLAYBACK_RATE_MIN + (effectiveDistance / pinchRange) * (PLAYBACK_RATE_MAX - PLAYBACK_RATE_MIN);
    
    // 3. Clamp the playback rate to the defined min/max
    newPlaybackRate = Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, newPlaybackRate));
    
    // 4. Only update the playbackRate if it has changed by a meaningful amount
    if (Math.abs(newPlaybackRate - lastAppliedPlaybackRate) > 0.05) {
        audio.playbackRate = newPlaybackRate;
        lastAppliedPlaybackRate = newPlaybackRate;
        
        // Update the speed indicator text
        if (speedValue) {
            speedValue.textContent = `${newPlaybackRate.toFixed(2)}x`;
        }
    }
}

// Function to update slider based on hand position
function updateSlider(y) {
    const sliderPosition = Math.max(0, Math.min(1, 1 - y));
    sliderHandle.style.top = `${sliderPosition * 100}%`;
    sliderValue.textContent = `${Math.round(sliderPosition * 100)}%`;
}

function onResults(results) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw video frame
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    // Reset tracking info
    document.getElementById('left-index').textContent = 'Left Index: Not detected';
    document.getElementById('left-thumb').textContent = 'Left Thumb: Not detected';
    document.getElementById('right-index').textContent = 'Right Index: Not detected';
    document.getElementById('right-thumb').textContent = 'Right Thumb: Not detected';
    pinchStatus.textContent = 'Pinch Status: Not detected';
    
    // Two-hand gesture for volume control
    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
        const hand1 = results.multiHandLandmarks[0];
        const hand2 = results.multiHandLandmarks[1];
        const index1 = hand1[8];
        const index2 = hand2[8];

        const distance = calculateDistance(index1, index2);
        updateVolume(distance);

        // Visual feedback for hand distance
        ctx.beginPath();
        ctx.moveTo(index1.x * canvas.width, index1.y * canvas.height);
        ctx.lineTo(index2.x * canvas.width, index2.y * canvas.height);
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 4;
        ctx.stroke();

        const midX = (index1.x + index2.x) * canvas.width / 2;
        const midY = (index1.y + index2.y) * canvas.height / 2;
        ctx.fillStyle = '#00FF00';
        ctx.font = '16px Arial';
        ctx.fillText(distance.toFixed(2), midX, midY);
    }
    
    if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            
            // Draw hand landmarks
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 2
            });
            drawLandmarks(ctx, landmarks, {
                color: '#FF0000',
                lineWidth: 1
            });
            
            // Get hand index (0 for left, 1 for right)
            const handIndex = results.multiHandedness[i].index;
            
            // Update tracking info
            const prefix = results.multiHandedness[i].label === 'Left' ? 'left' : 'right';
            const indexFinger = landmarks[8]; // Index finger tip
            const thumb = landmarks[4]; // Thumb tip
            
            // Calculate distance between thumb and index finger
            const distance = calculateDistance(thumb, indexFinger);
            
            // Draw line between thumb and index finger
            ctx.beginPath();
            ctx.moveTo(thumb.x * canvas.width, thumb.y * canvas.height);
            ctx.lineTo(indexFinger.x * canvas.width, indexFinger.y * canvas.height);
            
            // Change color based on pinch detection
            const isPinched = distance < PINCH_THRESHOLD;
            ctx.strokeStyle = isPinched ? '#FF0000' : '#0000FF';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Add distance text
            const midX = (thumb.x + indexFinger.x) * canvas.width / 2;
            const midY = (thumb.y + indexFinger.y) * canvas.height / 2;
            ctx.fillStyle = isPinched ? '#FF0000' : '#0000FF';
            ctx.font = '16px Arial';
            ctx.fillText(`${distance.toFixed(2)}`, midX, midY);
            
            // Update pinch status
            if (isPinched) {
                pinchStatus.textContent = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Hand: Pinched!`;
                pinchStatus.style.color = '#FF0000';
            }

            // Control playback speed with left hand pinch
            if (prefix === 'left') {
                updatePlaybackRate(distance);
            }
            
            // Control slider with right hand vertical position
            if (prefix === 'right') {
                updateSlider(indexFinger.y);
            }
            
            document.getElementById(`${prefix}-index`).textContent = 
                `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Index: (${indexFinger.x.toFixed(2)}, ${indexFinger.y.toFixed(2)})`;
            
            document.getElementById(`${prefix}-thumb`).textContent = 
                `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Thumb: (${thumb.x.toFixed(2)}, ${thumb.y.toFixed(2)}) - Distance: ${distance.toFixed(2)}`;
        }
    }
} 