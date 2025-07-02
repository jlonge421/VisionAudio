# VisionAudio: The Gesture-Based Audio Workstation!

VisionAudio is an interactive web application that transforms your webcam into a futuristic audio controller. By tracking hand gestures in real-time, users can manipulate audio playback in an intuitive, theremin-like experience, blending the physical and digital worlds.

This project was built to explore the frontiers of browser-based interaction, combining cutting-edge computer vision with the advanced capabilities of the Web Audio API to create a seamless and engaging user experience.

[**Try it Live!**](https://vision-audio-self.vercel.app/)

---

## Features

-   **Dual-Handed Tempo & Pitch Control:** Independently manipulate the song's speed (**tempo**) with the left hand and its pitch (**frequency**) with the right, just like a futuristic DJ.
-   **Dramatic Pitch Range:** The pitch control offers an extreme two-octave range in each direction (0.25x to 4.0x).
-   **Dynamic Volume Control:** Adjust the master volume by changing the distance between both hands.
-   **High-Quality Audio Engine:** A toggleable "HQ Mode" utilizes a **SoundTouch.js AudioWorklet** for professional-grade, pitch-independent tempo adjustments, eliminating the "chipmunk" effect at high speeds.
-   **Modern UI:** The interface features a mirrored webcam view for natural interaction, a dynamic playlist, and a sleek dark mode by default.

---

## How to Use

The application uses your webcam to track your hands. Allow camera access when prompted.

-   **Left Hand Pinch:** Controls the **Speed (Tempo)** of the music.
    -   *Pinch closer:* Slow down the music (down to 0.1x).
    -   *Pinch wider:* Speed up the music (up to 2.0x).
-   **Right Hand Pinch:** Controls the **Pitch (Frequency)** of the music.
    -   *Pinch closer:* Lower the pitch (down to two octaves).
    -   *Pinch wider:* Raise the pitch (up to two octaves).
-   **Distance Between Hands:** Controls the overall **Volume**.
    -   *Hands closer:* Lower the volume.
    -   *Hands wider:* Increase the volume.
-   **Quality Modes:**
    -   **⚡ Fast Mode (Default):** Reliable performance where speed and pitch are linked.
    -   **🎯 HQ Mode:** Independent control over speed and pitch. May introduce artifacts on some systems.

---

## Tech Stack

-   **Frontend:** Svelte & Vite (for a highly reactive and performant UI)
-   **Computer Vision:** Google's MediaPipe (for real-time, in-browser hand and finger tracking)
-   **Audio Engine:** Web Audio API (for low-level audio graph routing, volume, and effects)
-   **Advanced Audio:** SoundTouch.js (via a WebAssembly-powered AudioWorklet for high-quality pitch/tempo manipulation)
-   **Deployment:** Vercel

---

## Getting Started

This project is contained within the `vision-audio-svelte` directory.

### Prerequisites

-   Node.js (v18 or later)
-   npm

### Installation & Running Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/VisionAudio.git
    cd VisionAudio/vision-audio-svelte
    ```

2.  **Install dependencies:**
    This project has known peer dependency conflicts with Vite. Use the `--legacy-peer-deps` flag for a clean install.
    ```bash
    npm install --legacy-peer-deps
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:5173`.

---

## Deployment

This project is configured for easy deployment on Vercel.

-   **Framework Preset:** `Vite`
-   **Root Directory:** `vision-audio-svelte`
-   **Install Command:** `npm install --legacy-peer-deps`
-   **Build Command:** `npm run build`
-   **Output Directory:** `dist`

To handle the peer dependency issue on Vercel automatically, it's recommended to create a `.npmrc` file in the `vision-audio-svelte` directory with the following content:
```
legacy-peer-deps=true
```
This ensures that Vercel's build process uses the correct flag. 
