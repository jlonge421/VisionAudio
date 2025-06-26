<script>
  import { onMount, onDestroy } from 'svelte';
  import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
  import { Camera } from '@mediapipe/camera_utils';
  import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

  // --- Svelte Bindings & UI State ---
  let videoElement;
  let canvasElement;
  let isPlaying = false;
  let playButtonText = 'Play';
  let isDarkMode = true; // Dark mode as default
  let selectedTrack = '/SoundHelix-Song-1.mp3';
  let isHighQualityMode = false; // Toggle between SoundTouch and basic playbackRate

  // Available music tracks
  const musicTracks = [
    { name: 'SoundHelix Song 1', url: '/SoundHelix-Song-1.mp3' },
    { name: 'Electronic Beat', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { name: 'Ambient Chill', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { name: 'Upbeat Rock', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' }
  ];

  let volumeValue = '100%';
  let speedValue = '1.00x';
  let frequencyValue = '1.00x'; // New frequency display
  let sliderValue = '50%';
  let sliderHandleStyle = 'top: 50%;';
  let leftIndexText = 'Left Index: Not detected';
  let leftThumbText = 'Left Thumb: Not detected';
  let rightIndexText = 'Right Index: Not detected';
  let rightThumbText = 'Right Thumb: Not detected';
  let pinchStatusText = 'Pinch Status: Not detected';
  let pinchStatusColor = '#007bff';

  // --- Web Audio API & Soundtouch State ---
  let audioContext;
  let soundTouchNode;
  let gainNode;
  let currentSource;

  // --- Constants and Logic ---
  const PINCH_THRESHOLD = 0.1;
  const VOLUME_MAX_DISTANCE = 0.3;
  const VOLUME_HAND_DISTANCE_MIN = 0.1;
  const VOLUME_HAND_DISTANCE_MAX = 0.7;
  const SLIDER_HEIGHT = 480;
  
  // Speed control - wide dramatic range with achievable hand distances
  const SPEED_CONTROL_MIN_DISTANCE = 0.03; // Very close pinch for slowest speed (0.1x)
  const SPEED_CONTROL_MAX_DISTANCE = 0.6; // Wide opening for fastest speed (2.0x)
  const PLAYBACK_RATE_MIN = 0.1; // Much slower minimum
  const PLAYBACK_RATE_MAX = 2.0; // Much faster maximum
  
  // Frequency control - pitch shifting range
  const FREQ_CONTROL_MIN_DISTANCE = 0.03; // Very close pinch for lowest pitch
  const FREQ_CONTROL_MAX_DISTANCE = 0.6; // Wide opening for highest pitch
  const FREQUENCY_MIN = 0.25; // Quarter pitch (two octaves down) - much more dramatic
  const FREQUENCY_MAX = 4.0; // Quadruple pitch (two octaves up) - much more dramatic
  
  let smoothedDistance = 0.3; // Start closer to middle range
  let smoothedFreqDistance = 0.3; // For frequency smoothing
  const SMOOTHING_FACTOR = 0.92; // Less aggressive smoothing for better responsiveness
  const FREQ_SMOOTHING_FACTOR = 0.85; // Even less smoothing for frequency - much faster response
  let lastAppliedPlaybackRate = 1.0;
  let lastAppliedFrequency = 1.0;
  let lastUpdateTime = 0; // Throttle parameter updates
  let lastFreqUpdateTime = 0; // Throttle frequency updates

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }

  function toggleQualityMode() {
    isHighQualityMode = !isHighQualityMode;
    if (isPlaying) {
      // Restart audio with new mode
      if (currentSource) {
        currentSource.stop();
      }
      isPlaying = false;
      playButtonText = 'Play';
      setupAndPlayAudio();
    }
  }

  function onTrackChange() {
    if (isPlaying) {
      // Stop current audio and restart with new track
      if (currentSource) {
        currentSource.stop();
      }
      isPlaying = false;
      playButtonText = 'Play';
      setupAndPlayAudio();
    }
  }

  async function setupAndPlayAudio() {
    if (isPlaying) {
      audioContext.suspend();
      isPlaying = false;
      playButtonText = 'Play';
      return;
    }
    
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
        isPlaying = true;
        playButtonText = 'Pause';
        return;
    }

    try {
      if (!audioContext) {
        audioContext = new AudioContext();
        gainNode = audioContext.createGain();
        
        if (isHighQualityMode) {
          // High quality mode with SoundTouch (independent pitch and tempo control)
          await audioContext.audioWorklet.addModule('/soundtouch-worklet.js');
          soundTouchNode = new AudioWorkletNode(audioContext, 'soundtouch-processor');
          soundTouchNode.connect(gainNode);
        }
        
        gainNode.connect(audioContext.destination);
      }

      // Stop any existing source
      if (currentSource) {
        currentSource.stop();
      }
      
      const response = await fetch(selectedTrack);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      currentSource = audioContext.createBufferSource();
      currentSource.buffer = audioBuffer;
      currentSource.loop = true;

      if (isHighQualityMode && soundTouchNode) {
        // Connect through SoundTouch for independent pitch and tempo control
        currentSource.connect(soundTouchNode);
      } else {
        // Direct connection for basic speed control (pitch and tempo linked)
        currentSource.connect(gainNode);
      }

      currentSource.start();
      isPlaying = true;
      playButtonText = 'Pause';

    } catch (e) {
      console.error('Error setting up audio:', e);
      alert('There was an error setting up the audio. Check the console.');
    }
  }

  function calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function updateVolume(distance) {
    let volume = (distance - VOLUME_HAND_DISTANCE_MIN) / (VOLUME_HAND_DISTANCE_MAX - VOLUME_HAND_DISTANCE_MIN);
    volume = Math.max(0, Math.min(1, volume));
    if (gainNode) {
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    }
    volumeValue = `${Math.round(volume * 100)}%`;
  }

  function updatePlaybackRate(distance) {
    const now = Date.now();
    // Faster updates for better responsiveness (max 20 updates per second)
    if (now - lastUpdateTime < 50) {
      return;
    }
    lastUpdateTime = now;

    // Less aggressive smoothing for better responsiveness
    smoothedDistance = SMOOTHING_FACTOR * smoothedDistance + (1 - SMOOTHING_FACTOR) * distance;
    
    // Use much more achievable distance range for human hands
    const speedRange = SPEED_CONTROL_MAX_DISTANCE - SPEED_CONTROL_MIN_DISTANCE;
    const effectiveDistance = Math.max(0, Math.min(speedRange, smoothedDistance - SPEED_CONTROL_MIN_DISTANCE));
    
    // Linear mapping for more predictable control
    const normalizedDistance = effectiveDistance / speedRange;
    let newPlaybackRate = PLAYBACK_RATE_MIN + normalizedDistance * (PLAYBACK_RATE_MAX - PLAYBACK_RATE_MIN);
    
    newPlaybackRate = Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, newPlaybackRate));

    // Much more sensitive updates
    if (Math.abs(newPlaybackRate - lastAppliedPlaybackRate) > 0.005) {
      try {
        if (isHighQualityMode && soundTouchNode && soundTouchNode.parameters) {
          // High quality mode: SoundTouch (independent tempo control)
          soundTouchNode.parameters.get('tempo').setValueAtTime(newPlaybackRate, audioContext.currentTime);
        } else if (currentSource) {
          // Performance mode: Basic playbackRate (pitch and tempo linked)
          currentSource.playbackRate.setValueAtTime(newPlaybackRate, audioContext.currentTime);
        }
        lastAppliedPlaybackRate = newPlaybackRate;
        speedValue = `${newPlaybackRate.toFixed(2)}x${isHighQualityMode ? ' (HQ)' : ''}`;
      } catch (e) {
        console.warn('Error updating playback rate:', e);
      }
    }
  }

  function updateFrequency(distance) {
    const now = Date.now();
    // Much faster updates for dramatic frequency changes (max 30 updates per second)
    if (now - lastFreqUpdateTime < 33) {
      return;
    }
    lastFreqUpdateTime = now;

    // Much less aggressive smoothing for instant frequency response
    smoothedFreqDistance = FREQ_SMOOTHING_FACTOR * smoothedFreqDistance + (1 - FREQ_SMOOTHING_FACTOR) * distance;
    
    // Use frequency control distance range
    const freqRange = FREQ_CONTROL_MAX_DISTANCE - FREQ_CONTROL_MIN_DISTANCE;
    const effectiveDistance = Math.max(0, Math.min(freqRange, smoothedFreqDistance - FREQ_CONTROL_MIN_DISTANCE));
    
    // Linear mapping for frequency control
    const normalizedDistance = effectiveDistance / freqRange;
    let newFrequency = FREQUENCY_MIN + normalizedDistance * (FREQUENCY_MAX - FREQUENCY_MIN);
    
    newFrequency = Math.max(FREQUENCY_MIN, Math.min(FREQUENCY_MAX, newFrequency));

    // Super sensitive updates for dramatic frequency changes
    if (Math.abs(newFrequency - lastAppliedFrequency) > 0.001) {
      try {
        if (isHighQualityMode && soundTouchNode && soundTouchNode.parameters) {
          // High quality mode: SoundTouch (independent pitch control)
          soundTouchNode.parameters.get('pitch').setValueAtTime(newFrequency, audioContext.currentTime);
          frequencyValue = `${newFrequency.toFixed(2)}x (HQ)`;
        } else {
          // In performance mode, frequency is tied to playback rate
          frequencyValue = `${newFrequency.toFixed(2)}x (Linked)`;
        }
        lastAppliedFrequency = newFrequency;
      } catch (e) {
        console.warn('Error updating frequency:', e);
      }
    }
  }

  function updateSlider(y) {
    const sliderPosition = Math.max(0, Math.min(1, 1 - y));
    sliderHandleStyle = `top: ${sliderPosition * 100}%`;
    sliderValue = `${Math.round(sliderPosition * 100)}%`;
  }
  
  function onResults(results) {
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    leftIndexText = 'Left Index: Not detected';
    leftThumbText = 'Left Thumb: Not detected';
    rightIndexText = 'Right Index: Not detected';
    rightThumbText = 'Right Thumb: Not detected';
    pinchStatusText = 'Pinch Status: Not detected';
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
      const hand1 = results.multiHandLandmarks[0];
      const hand2 = results.multiHandLandmarks[1];
      const index1 = hand1[8];
      const index2 = hand2[8];
      const distance = calculateDistance(index1, index2);
      updateVolume(distance);

      ctx.beginPath();
      ctx.moveTo(index1.x * canvasElement.width, index1.y * canvasElement.height);
      ctx.lineTo(index2.x * canvasElement.width, index2.y * canvasElement.height);
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 4;
      ctx.stroke();

      const midX = (index1.x + index2.x) * canvasElement.width / 2;
      const midY = (index1.y + index2.y) * canvasElement.height / 2;
      ctx.fillStyle = '#00FF00';
      ctx.font = '16px Arial';
      ctx.fillText(distance.toFixed(2), midX, midY);
    }

    if (results.multiHandLandmarks) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });

        const prefix = results.multiHandedness[i].label === 'Left' ? 'left' : 'right';
        const indexFinger = landmarks[8];
        const thumb = landmarks[4];
        const distance = calculateDistance(thumb, indexFinger);
        const isPinched = distance < PINCH_THRESHOLD;

        ctx.beginPath();
        ctx.moveTo(thumb.x * canvasElement.width, thumb.y * canvasElement.height);
        ctx.lineTo(indexFinger.x * canvasElement.width, indexFinger.y * canvasElement.height);
        ctx.strokeStyle = isPinched ? '#FF0000' : '#0000FF';
        ctx.lineWidth = 2;
        ctx.stroke();

        const midX = (thumb.x + indexFinger.x) * canvasElement.width / 2;
        const midY = (thumb.y + indexFinger.y) * canvasElement.height / 2;
        ctx.fillStyle = isPinched ? '#FF0000' : '#0000FF';
        ctx.font = '16px Arial';
        ctx.fillText(`${distance.toFixed(2)}`, midX, midY);

        if (isPinched) {
          pinchStatusText = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Hand: Pinched!`;
          pinchStatusColor = '#FF0000';
        } else {
            pinchStatusColor = '#007bff';
        }

        if (prefix === 'left') {
          // Left hand controls speed/tempo
          updatePlaybackRate(distance);
          leftIndexText = `Left Index: (${indexFinger.x.toFixed(2)}, ${indexFinger.y.toFixed(2)})`;
          leftThumbText = `Left Thumb: (${thumb.x.toFixed(2)}, ${thumb.y.toFixed(2)}) - Distance: ${distance.toFixed(2)}`;
        }

        if (prefix === 'right') {
          // Right hand controls frequency/pitch via pinch distance
          updateFrequency(distance);
          rightIndexText = `Right Index: (${indexFinger.x.toFixed(2)}, ${indexFinger.y.toFixed(2)})`;
          rightThumbText = `Right Thumb: (${thumb.x.toFixed(2)}, ${thumb.y.toFixed(2)}) - Distance: ${distance.toFixed(2)}`;
        }
      }
    }
  }

  onMount(() => {
    // Set dark mode as default
    document.documentElement.setAttribute('data-theme', 'dark');
    
    canvasElement.width = 640;
    canvasElement.height = 480;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      hands.close();
      if (audioContext) audioContext.close();
    };
  });
</script>

<div class="container">
  <div class="header">
    <h1>Hand Tracking Audio Control</h1>
    <button class="theme-toggle" on:click={toggleDarkMode}>
      {isDarkMode ? '☀️' : '🌙'}
    </button>
  </div>
  <div class="video-container">
    <video bind:this={videoElement} playsinline class="mirrored"></video>
    <canvas bind:this={canvasElement}></canvas>
  </div>
  <div class="controls">
    <div class="audio-player">
      <h2>Audio Controls</h2>
      <select bind:value={selectedTrack} on:change={onTrackChange} class="track-selector">
        {#each musicTracks as track}
          <option value={track.url}>{track.name}</option>
        {/each}
      </select>
      <div class="audio-buttons">
        <button on:click={setupAndPlayAudio}>{playButtonText}</button>
        <button class="quality-toggle" on:click={toggleQualityMode}>
          {isHighQualityMode ? '🎯 HQ Mode' : '⚡ Fast Mode'}
        </button>
      </div>
      <div class="volume-display">Volume: <span id="volume-value">{volumeValue}</span></div>
      <div class="speed-display">Speed: <span id="speed-value">{speedValue}</span></div>
      <div class="frequency-display">Pitch: <span id="frequency-value">{frequencyValue}</span></div>
    </div>
    <div class="slider-container">
      <h2>Virtual Slider</h2>
      <div class="slider-track">
        <div id="slider-handle" style={sliderHandleStyle}></div>
      </div>
      <div class="slider-value">Value: <span id="slider-value">{sliderValue}</span></div>
    </div>
  </div>
  <div class="tracking-info">
    <div id="left-index">{leftIndexText}</div>
    <div id="left-thumb">{leftThumbText}</div>
    <div id="right-index">{rightIndexText}</div>
    <div id="right-thumb">{rightThumbText}</div>
    <div id="pinch-status" style="color: {pinchStatusColor}">{pinchStatusText}</div>
  </div>
</div>

<style>
  :global(:root) {
    --bg-primary: #f0f0f0;
    --bg-secondary: white;
    --bg-tertiary: #f8f8f8;
    --text-primary: #333;
    --text-secondary: #666;
    --accent-color: #007bff;
    --accent-hover: #0056b3;
    --border-color: #ddd;
    --shadow: rgba(0, 0, 0, 0.1);
    --shadow-light: rgba(0, 0, 0, 0.05);
  }

  :global([data-theme="dark"]) {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --bg-tertiary: #363636;
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
    --accent-color: #4dabf7;
    --accent-hover: #339af0;
    --border-color: #555;
    --shadow: rgba(255, 255, 255, 0.1);
    --shadow-light: rgba(255, 255, 255, 0.05);
  }

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: Arial, sans-serif;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  .container {
    text-align: center;
    padding: 20px;
    background-color: var(--bg-secondary);
    border-radius: 10px;
    box-shadow: 0 0 10px var(--shadow);
    max-width: 800px;
    margin: 20px auto;
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .theme-toggle {
    background: var(--accent-color);
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    font-size: 24px;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.2s ease;
  }

  .theme-toggle:hover {
    background: var(--accent-hover);
    transform: scale(1.1);
  }

  h1, h2 {
    margin-bottom: 20px;
    color: var(--text-primary);
  }

  .video-container {
    position: relative;
    margin-bottom: 20px;
    display: inline-block;
  }

  video, canvas {
    width: 640px;
    height: 480px;
    border-radius: 8px;
  }

  .mirrored {
    transform: scaleX(-1);
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
  }

  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
    padding: 20px;
    background-color: var(--bg-tertiary);
    border-radius: 8px;
    transition: background-color 0.3s ease;
  }

  .audio-player, .slider-container {
    padding: 15px;
    background-color: var(--bg-secondary);
    border-radius: 8px;
    box-shadow: 0 2px 4px var(--shadow-light);
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  .track-selector {
    width: 100%;
    padding: 8px 12px;
    margin-bottom: 10px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 14px;
    transition: border-color 0.3s ease, background-color 0.3s ease;
  }

  .track-selector:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .audio-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .audio-player button {
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .audio-player button:hover {
    background-color: var(--accent-hover);
  }

  .quality-toggle {
    background-color: var(--bg-tertiary) !important;
    color: var(--text-primary) !important;
    border: 2px solid var(--accent-color) !important;
    font-size: 14px !important;
  }

  .quality-toggle:hover {
    background-color: var(--accent-color) !important;
    color: white !important;
  }

  .volume-display, .speed-display, .frequency-display, .slider-value {
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 10px;
    transition: color 0.3s ease;
  }

  .slider-track {
    width: 100%;
    height: 20px;
    background-color: var(--border-color);
    border-radius: 10px;
    position: relative;
    margin: 10px 0;
    transition: background-color 0.3s ease;
  }

  #slider-handle {
    width: 20px;
    height: 20px;
    background-color: var(--accent-color);
    border-radius: 50%;
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    cursor: pointer;
    transition: background-color 0.2s;
  }

  #slider-handle:hover {
    background-color: var(--accent-hover);
  }

  .tracking-info {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    padding: 10px;
    background-color: var(--bg-tertiary);
    border-radius: 8px;
    transition: background-color 0.3s ease;
  }

  .tracking-info div {
    padding: 10px;
    background-color: var(--bg-secondary);
    border-radius: 5px;
    box-shadow: 0 2px 4px var(--shadow-light);
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  #pinch-status {
    grid-column: 1 / -1;
    font-weight: bold;
    color: var(--accent-color);
  }
</style> 