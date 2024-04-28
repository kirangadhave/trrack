/**
 * Captures and stores a sequence of screenshots of the current tab.
 * First, opens a MediaStream of the current tab, then captures screenshots
 * on repaints after captureNextRepaint() is called.
 * A screenshot can also be captured on-demand via capture().
 * Requires browser permissions to capture screen.
 * Must be activated via start() and deactivated via stop(); failure to stop
 * will result in a memory leak.
 */
export class ScreenshotStream {
    /**
     * Video element for capturing screenshots. Null if not started or stopped.
     */
    private video: HTMLVideoElement | null = null;

    /**
     * Array of captured screenshots.
     */
    private screenshots: ImageData[] = [];

    /**
     * Optional callback to run after each screenshot is captured.
     */
    public newScreenshotCallback: ((frame: ImageData) => void) | null;

    /**
     * Binds capture, stop, and captureNextRepaint to the class.
     * @throws Error if the getDisplayMedia API is not available.
     */
    constructor(newScreenshotCallback?: (frame: ImageData) => void) {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error(
                'MediaDevices API or getDisplayMedia() not available'
            );
        }

        this.newScreenshotCallback = newScreenshotCallback ?? null;

        // We need to functions that can be used as callbacks to the class
        this.capture = this.capture.bind(this);
        this.stop = this.stop.bind(this);
        this.captureNextRepaint = this.captureNextRepaint.bind(this);
    }

    /**
     * Starts the media stream needed to capture screenshots on-demand.
     * Will prompt the user for permission to capture the screen.
     * @throws Error if unable to start the recording; usually due to the user denying permission.
     * @param callback Optional callback to run after the stream is started.
     */
    public async start(callback?: () => void): Promise<void> {
        this.video = document.createElement('video');
        this.video.autoplay = true;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.style.pointerEvents = 'none';
        this.video.style.visibility = 'hidden';
        this.video.style.position = 'fixed';
        this.video.style.top = '0';
        this.video.style.left = '0';

        try {
            await navigator.mediaDevices
                .getDisplayMedia(/*displayMediaOptions*/)
                .then((stream) => {
                    // TS is not confident that this.video is not null (but I am), so we need to check
                    this.video ? (this.video.srcObject = stream) : null;
                });
        } catch (e) {
            this.video = null;
            throw new Error(`Unable to start recording: ${e}`);
        }

        if (this.video.srcObject) {
            // Needs to be in the DOM to capture screenshots
            document.body.appendChild(this.video);
            callback ? callback() : null;
        } else {
            // I honestly don't know how we'd get here
            throw new Error('Unable to start recording; no stream available');
        }
    }

    /**
     * Captures a screenshot and stores it in the screenshots array.
     * Also pushes the screenshot to the newScreenshotCallback if available.
     * Bound to the class in the constructor.
     * @throws Error if recording has not been started.
     * @throws Error if unable to get 2D rendering context.
     * @returns The captured screenshot.
     */
    public capture(): ImageData {
        if (!this.video) {
            throw new Error('Recording not started');
        }

        const videoSettings = (this.video.srcObject as MediaStream)
            ?.getVideoTracks()[0]
            .getSettings();
        const canvas = document.createElement('canvas');
        canvas.width = videoSettings.width || 0;
        canvas.height = videoSettings.height || 0;

        const context = canvas.getContext('2d');
        if (!context) {
            // GetContext can return undefined and null (probably due to lack of browser support)
            throw new Error('Unable to get 2D rendering context');
        }
        context.drawImage(this.video, 0, 0, canvas.width, canvas.height);

        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        this.push(frame);

        canvas.remove();
        return frame;
    }

    /**
     * Captures a screenshot after the next repaint and adds it to the screenshot array.
     * Useful if you want to screenshot a state change that you've just processed.
     * Bound to the class in the constructor.
     */
    public captureNextRepaint(): void {
        requestAnimationFrame(() => {
            const mc = new MessageChannel();
            mc.port1.onmessage = this.capture;
            mc.port2.postMessage(undefined);
        });
    }

    /**
     * Stops the media stream and removes the video element from the DOM.
     * Must be called to prevent memory leaks.
     * Bound to the class in the constructor.
     */
    public stop(): void {
        if (this.video) {
            this.video.srcObject = null;
            this.video.remove();
            this.video = null;
        }
    }

    /**
     * Pushes a screenshot frame to the `screenshots` array
     * and invokes the `newScreenshotCallback` if available.
     * @param frame - The screenshot frame to be pushed.
     */
    private push(frame: ImageData): void {
        this.screenshots.push(frame);
        this.newScreenshotCallback ? this.newScreenshotCallback(frame) : null;
    }

    /**
     * Returns the nth most recent screenshot in the array of stored screenshots.
     * @param n - The index of the screenshot to retrieve.
     *  1 is the most recent screenshot, 0 is the least recent.
     * @returns The nth screenshot.
     */
    public getNth(n: number): ImageData {
        if (n < 0 || n >= this.screenshots.length) {
            throw new Error(`Screenshot index out of bounds: ${n}`);
        }
        return this.screenshots[this.screenshots.length - 1 - n];
    }

    /**
     * Returns the number of stored screenshots.
     * @returns The number of stored screenshots.
     */
    public count(): number {
        return this.screenshots.length;
    }

    /**
     * Returns a copy of the array of stored screenshots.
     * @returns The stored screenshots.
     */
    public getAll(): ImageData[] {
        return [...this.screenshots];
    }
}

/**
 * Downloads a screenshot as a PNG file.
 * @param frame - The screenshot frame to download.
 * @param name - The name of the file to download.
 */
export function downloadScreenshot(frame: ImageData, name: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to get 2D rendering context');
    }
    context.putImageData(frame, 0, 0);

    const a = document.createElement('a');
    a.href = canvas.toDataURL();
    a.download = name;
    a.click();

    canvas.remove();
    a.remove();
}
