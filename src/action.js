
let canvasWidth = 0;
let canvasHeight = 0;
let colorA = [ 0, 0, 0, 255 ];
let colorB = [ 0, 0, 0, 255 ];
let colorR = [ 0, 0, 0, 255 ];
let clusterA = -1;
let clusterB = -1;
let clusterR = -1;
let count = 0;
let first = false;
let ballPoint1;
let ballPoint2;
let teamAPossession = 0;
let teamBPossession = 0;
let umbralContrastPlayer = 1.0;
let umbralContrastBall = 1.0;
let currentRefereeFootPoint = null;

const HEATMAP_CANVAS_WIDTH = 840;
const HEATMAP_CANVAS_HEIGHT = 544;
const HEATMAP_GRID_WIDTH = 140;
const HEATMAP_GRID_HEIGHT = 90;
const HEATMAP_SMOOTH_RADIUS = 3;

let isCalibratingField = false;
let fieldCalibrationPoints = [];
let trackedFieldPoints = [];
let fieldHomographyMat = null;
let projectionConfidence = 0;
let autoProjectionFrameCount = 0;
let previousGrayFrame = null;
let projectionMode = '3A';
let projectionEdgeDetector = 'canny';

let refereeHeatmapGrid = new Float32Array(HEATMAP_GRID_WIDTH * HEATMAP_GRID_HEIGHT);
let refereeHeatmapMax = 0;
let lastProjectedRefereePoint = null;
let heatmapBufferCanvas = null;

const distRgb = (a, b) => {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
};

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video-input');
    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');

    const contrastSlider = document.getElementById('contrast-slider');
    const contrastValue = document.getElementById('contrast-value');
    const contrastSliderBall = document.getElementById('contrast-slider-ball');
    const contrastValueBall = document.getElementById('contrast-value-ball');

    let animationId = null;
    let isProcessing = false;

    if (contrastSlider) {
        const syncContrast = () => {
            const rawValue = Number(contrastSlider.value);
            umbralContrastPlayer = Math.max(0.5, Math.min(2.0, rawValue / 100));

            if (contrastValue)
                contrastValue.textContent = `${umbralContrastPlayer.toFixed(2)}x`;
        };

        contrastSlider.addEventListener('input', syncContrast);
        syncContrast();
    }
    
    if (contrastSliderBall) {
        const syncContrastBall = () => {
            const rawValue = Number(contrastSliderBall.value);
            umbralContrastBall = Math.max(0.5, Math.min(2.0, rawValue / 100));

            if (contrastValueBall)
                contrastValueBall.textContent = `${umbralContrastBall.toFixed(2)}x`;
        };

        contrastSliderBall.addEventListener('input', syncContrastBall);
        syncContrastBall();
    }

    function syncCanvasSizeWithVideo() {
        if (!video.videoWidth || !video.videoHeight) return false;
        const width = 860;
        canvas.width = width;
        canvas.height = video.videoHeight * width / video.videoWidth;
        video.width = canvas.width;
        video.height = canvas.height;
        return true;
    }

    function startProcessing() {
        if (isProcessing) return;
        if (!syncCanvasSizeWithVideo()) return;
        isProcessing = true;

        processVideo(video, canvas, ctx, () => isProcessing, (id) => { animationId = id; });
    }

    function stopProcessing() {
        isProcessing = false;

        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // 1. Load video from file input
    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];

        if (!file) return;

        reset();

        video.src = URL.createObjectURL(file);
        video.play();
    });

    setupPlaybackControls(video);
    setupProjectionControls(video, canvas);

    video.addEventListener('play', () => {
        console.log('Video: play');
        startProcessing();
    });

    video.addEventListener('loadedmetadata', () => {
        syncCanvasSizeWithVideo();
        if (!video.paused && !video.ended)
            startProcessing();
    });

    video.addEventListener('pause', () => {
        console.log('Video: pause');
        stopProcessing();
    });

    video.addEventListener('ended', () => {
        console.log('Video: ended');
        stopProcessing();
    });

    renderRefereeHeatmap();
    toggleCanvas();
});

function setupPlaybackControls(video) {
    const playButton = document.getElementById('btn-play');
    const pauseButton = document.getElementById('btn-pause');
    const resetButton = document.getElementById('btn-reset');

    if (playButton) {
        playButton.addEventListener('click', async () => {
            if (!video || (!video.src && video.readyState === 0)) return;

            try {
                await video.play();
            } catch (error) {
                console.error('No se pudo reanudar el video:', error);
            }
        });
    }

    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            if (!video) return;
            video.pause();
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (!video || (!video.src && video.readyState === 0)) return;
            video.pause();
            video.currentTime = 0;
            reset();
        });
    }
}

function toggleCanvas() {
    document.getElementById('view-original').addEventListener('change', (e) => {
        document.getElementById('content-original').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-procesado').addEventListener('change', (e) => {
        document.getElementById('content-procesado').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-1').addEventListener('change', (e) => {
        document.getElementById('content-step-1').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-2').addEventListener('change', (e) => {
        document.getElementById('content-step-2').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-3').addEventListener('change', (e) => {
        document.getElementById('content-step-3').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-4').addEventListener('change', (e) => {
        document.getElementById('content-step-4').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-5').addEventListener('change', (e) => {
        document.getElementById('content-step-5').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-6').addEventListener('change', (e) => {
        document.getElementById('content-step-6').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-7').addEventListener('change', (e) => {
        document.getElementById('content-step-7').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-8').addEventListener('change', (e) => {
        document.getElementById('content-step-8').style.display = e.target.checked ? 'grid' : 'none';
    });
}

function reset() {
    isChanged = false;
    colorA = [ 0, 0, 0, 255 ];
    colorB = [ 0, 0, 0, 255 ]; 
    colorR = [ 0, 0, 0, 255 ];
    clusterA = -1;
    clusterB = -1;
    clusterR = -1;
    count = 0;
    first = false;
    teamAPossession = 0;
    teamBPossession = 0;

    currentRefereeFootPoint = null;
    lastProjectedRefereePoint = null;
    projectionConfidence = 0;
    autoProjectionFrameCount = 0;
    isCalibratingField = false;
    fieldCalibrationPoints = [];
    trackedFieldPoints = [];

    clearRefereeHeatmapData();
    releaseProjectionMemory();
    updateProjectionStatus('Sin calibrar. Pausa el video y marca 4 puntos del campo.');
    renderRefereeHeatmap();

    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function processVideo(video, canvas, ctx, shouldContinue, setAnimationId) {
    if (!shouldContinue() || video.paused || video.ended) return;
    // 1. Get current frame from video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    // 2. Create Mat OpenvCv src and dst
    let src = cv.imread(canvas);
    // 3. Process current frame (image)
    processImage(src);
    // 4. Show the result on the canvas
    cv.imshow(canvas, src);
    // 5. Free memory
    src.delete();
    // 6. Call the next frame
    const id = requestAnimationFrame(() => processVideo(video, canvas, ctx, shouldContinue, setAnimationId));
    setAnimationId(id);
}

function processImage(src) {
    let dst = new cv.Mat();
    let dstBall = new cv.Mat();
    let srcBall = new cv.Mat();
    let srcHeatMap = new cv.Mat();

    src.copyTo(srcBall);
    src.copyTo(srcHeatMap);

    // sobelEdges(srcHeatMap);

    processBall(srcBall, dstBall);
    // processPlayers(src, dst);
    processRefereeProjection(src);
    processBallPossession(src);

    srcBall.delete();
    dstBall.delete();
    srcHeatMap.delete();
    dst.delete();
}

function sobelEdges(src) {
    const srcGray = new cv.Mat();
    const gradX16 = new cv.Mat();
    const gradY16 = new cv.Mat();
    const absX = new cv.Mat();
    const absY = new cv.Mat();
    const edges = new cv.Mat();

    cv.cvtColor(src, srcGray, cv.COLOR_RGBA2GRAY, 0);

    cv.blur(srcGray, srcGray, new cv.Size(5, 5), new cv.Point(-1, -1), cv.BORDER_DEFAULT);
    // cv.medianBlur(srcGray, srcGray, 3);

    // ddepth recomendado: CV_16S para no perder signo
    cv.Sobel(srcGray, gradX16, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.Sobel(srcGray, gradY16, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);

    cv.convertScaleAbs(gradX16, absX);
    cv.convertScaleAbs(gradY16, absY);

    // combinación simple de magnitudes
    cv.addWeighted(absX, 0.5, absY, 0.5, 0, edges);

    gradX16.delete();
    gradY16.delete();
    absX.delete();
    absY.delete();
    srcGray.delete();

    // cv.erode(edges, edges, cv.Mat.ones(3, 3, cv.CV_8U));
    cv.dilate(edges, edges, cv.Mat.ones(3, 3, cv.CV_8U));

    cv.threshold(edges, edges, 20, 255, cv.THRESH_BINARY);

    processSteps(9, edges);
}


function processSteps(step, dst) {
    const element = document.getElementById(`view-step-${step}`);
    const canvas = document.getElementById(`canvas-step-${step}`);

    if (step == 9)
        cv.imshow(canvas, dst);
    else if (element.checked)
        cv.imshow(canvas, dst);
}

function processPlayers(src, dst) {
    contrastCv(cv, src, dst); processSteps(1, dst);
    umbralGreenCv(cv, dst, dst); processSteps(2, dst);
    morfologyCv(cv, dst, 5);  processSteps(3, dst);
    maskGreenFieldCv(cv, dst);  processSteps(4, dst);
    contoursPlayersCv(cv, src, dst); processSteps(5, dst);
}

function processBall(src, dst) {
    contrastCv(cv, src, dst, true);
    umbralGreenCv(cv, dst, dst, true); processSteps(6, dst);
    maskGreenFieldCv(cv, dst);  processSteps(7, dst);
    contoursBallCv(cv, src, dst); processSteps(8, dst);
}

function processBallPossession(src) {
    if (!isOverlayEnabled('overlay-possession')) return;

    const totalPossession = teamAPossession + teamBPossession;
    const textPosA = new cv.Point(10, 70);
    const textA = 'Team A: ' + (totalPossession <= 0 ? 0 : Math.round((teamAPossession * 100) / totalPossession)) + '%';
    const textPosB = new cv.Point(10, 90);
    const textB = 'Team B: ' + (totalPossession <= 0 ? 0 : Math.round((teamBPossession * 100) / totalPossession)) + '%';
    const fillWidth = 2;
    const strokeWidth = 4;

    cv.putText(
        src,
        textA,
        textPosA,
        cv.FONT_HERSHEY_SIMPLEX,
        0.6,
        [255, 255, 255, 255],
        strokeWidth,
        cv.LINE_AA
    );

    cv.putText(
        src,
        textA,
        textPosA,
        cv.FONT_HERSHEY_SIMPLEX,
        0.6,
        intensityColorContrast(colorA[0], colorA[1], colorA[2]),
        fillWidth,
        cv.LINE_AA
    );

    cv.putText(
        src,
        textB,
        textPosB,
        cv.FONT_HERSHEY_SIMPLEX,
        0.6,
        [255, 255, 255, 255],
        strokeWidth,
        cv.LINE_AA
    );

    cv.putText(
        src,
        textB,
        textPosB,
        cv.FONT_HERSHEY_SIMPLEX,
        0.6,
        intensityColorContrast(colorB[0], colorB[1], colorB[2]),
        fillWidth,
        cv.LINE_AA
    );
}

function blurCv(cv, src, dst) {
    // cv.blur(src, dst, new cv.Size(7, 7), new cv.Point(-1, -1), cv.BORDER_DEFAULT);
    cv.medianBlur(src, dst, 7);
}

function contrastCv(cv, src, dst, isBall = false) {
    const beta = 128 * (1 - (isBall ? umbralContrastBall : umbralContrastPlayer));
    cv.convertScaleAbs(src, dst, isBall ? umbralContrastBall : umbralContrastPlayer, beta);
}

function umbralGreenCv(cv, src, dst, isBall = false) {
    let rgb = new cv.Mat();
    let hsv = new cv.Mat();
    let maskGreen = new cv.Mat();

    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV, 0);

    let lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [38, isBall ? 120 : 20, 60, 0]);
    let upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [75, 255, 255, 255]);

    cv.inRange(hsv, lowerGreen, upperGreen, dst);

    rgb.delete();
    hsv.delete();
    maskGreen.delete();
    lowerGreen.delete();
    upperGreen.delete();
/*
Guía rápida de ajuste:
- Si detecta "poco verde": baja S/V mínimo
  [30, 35, 25] a [90, 255, 255]
- Si detecta "demasiado" (ropa/sombras): sube S/V mínimo
  [35, 70, 60] a [85, 255, 255]
- Si falla en tono: mueve H
  verde amarillento -> baja H_min (25-30)
  verde azulado     -> sube H_max (85-95)
*/
}

function morfologyCv(cv, dst, kernelSize = 5) {
    const kernel = cv.Mat.ones(kernelSize, kernelSize, cv.CV_8U);
    cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(dst, dst, cv.MORPH_OPEN, kernel);
    kernel.delete();
}

function maskGreenFieldCv(cv, dst) {
    cv.bitwise_not(dst, dst);
}

function contoursPlayersCv(cv, src, dst) {
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates = []; // { rect, color:[r,g,b] }

    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);
        const contourArea = cv.contourArea(contour);
        const rectArea = rect.width * rect.height;
        const aspectRatio = rect.width / rect.height;
        const fillRatio = rectArea > 0 ? contourArea / rectArea : 0;

        const condition = ((rect.width * 6) < rect.height) || 
            ((rect.height * 3) < rect.width) || 
            (rect.width > 200 || rect.height > 200) ||
            (rect.height < 12) ||
            (rectArea < 110) ||
            (contourArea < 70) ||
            (fillRatio < 0.26) ||
            (aspectRatio > 3.2);

        if (condition) {
            cv.drawContours(dst, contours, i, new cv.Scalar(0, 0, 0, 255), cv.FILLED);
            contour.delete();
            continue;
        }

        const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        const one = new cv.MatVector();
        one.push_back(contour);
        cv.drawContours(mask, one, 0, new cv.Scalar(255), cv.FILLED);

        const mean = cv.mean(src, mask);
        const color = [mean[0] | 0, mean[1] | 0, mean[2] | 0];

        candidates.push({ rect, color });

        one.delete();
        mask.delete();
        contour.delete();
    }

    const requestedK = 4;
    const n = candidates.length;
    const k = Math.min(requestedK, n);
    const maxIter = 10;
    const attempts = 3;
    const offset = 10;

    const players = [];
    const referees = [];

    if (k >= 2) {
        const samplesArray = [];

        for (let i = 0; i < n; i++)
            samplesArray.push(candidates[i].color[0], candidates[i].color[1], candidates[i].color[2]);

        const samples = cv.matFromArray(n, 3, cv.CV_32F, samplesArray);
        const labels = new cv.Mat();
        const centers = new cv.Mat();

        cv.kmeans(
            samples,
            k,
            labels,
            new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, maxIter, 1.0),
            attempts,
            cv.KMEANS_PP_CENTERS,
            centers
        );

        let threshold = 50;

        const { mergedCenters, mergedK } = mergeSimilarClusters(labels, centers, threshold);
        let centersFreq = Array.from({ length: mergedK }, (_, i) => [i, 0]);

        for (let i = 0; i < n; i++) {
            const rect = candidates[i].rect;
            const point1 = new cv.Point(rect.x - offset, rect.y - offset);
            const point2 = new cv.Point(rect.x + rect.width + offset, rect.y + rect.height + offset);

            const cluster = labels.intAt(i, 0);

            centersFreq[cluster][0] = cluster;
            centersFreq[cluster][1]++;

            let r = mergedCenters[cluster][0] | 0;
            let g = mergedCenters[cluster][1] | 0;
            let b = mergedCenters[cluster][2] | 0;

            let isA = false, isB = false, isR = false;

            if (first) {
                const x = [r, g, b];
                const aC = [colorA[0], colorA[1], colorA[2]];
                const bC = [colorB[0], colorB[1], colorB[2]];
                const rC = [colorR[0], colorR[1], colorR[2]];

                if (distRgb(x, aC) < threshold) {
                    isA = true;
                    r = colorA[0];
                    g = colorA[1];
                    b = colorA[2];
                }
                else if (distRgb(x, bC) < threshold) {
                    isB = true;
                    r = colorB[0];
                    g = colorB[1];
                    b = colorB[2];
                }
                else if (distRgb(x, rC) < threshold) {
                    isR = true;
                    r = colorR[0];
                    g = colorR[1];
                    b = colorR[2];
                }
            }

            const solidColor = intensityColorContrast(r, g, b);//[r, g, b, 255]

            if (isA) players.push({ rect, color: solidColor, type: 'A' });
            else if (isB) players.push({ rect, color: solidColor, type: 'B' });
            else if (isR) referees.push({ rect, color: solidColor, type: 'R' });

            if ((isA && isOverlayEnabled('overlay-team-a')) || (isB && isOverlayEnabled('overlay-team-b'))) {
                cv.rectangle(src, point1, point2, solidColor, 4);

                const text = isA ? 'Team A' : isB ? 'Team B' : '';
                const textOrg = new cv.Point(point1.x - 15, point1.y - 10);

                cv.putText(
                    src,
                    text,
                    textOrg,
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    [255, 255, 255, 255],
                    4,
                    cv.LINE_AA
                );

                cv.putText(
                    src,
                    text,
                    textOrg,
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    solidColor,
                    2,
                    cv.LINE_AA
                );
            }
        }

        centersFreq.sort((a, b) => b[1] - a[1]);

        if (!first && centersFreq.length >= 3) {
            clusterA = centersFreq[0][0];
            clusterB = centersFreq[1][0];

            colorA[0] = mergedCenters[centersFreq[0][0]][0] | 0;
            colorA[1] = mergedCenters[centersFreq[0][0]][1] | 0;
            colorA[2] = mergedCenters[centersFreq[0][0]][2] | 0;

            colorB[0] = mergedCenters[centersFreq[1][0]][0] | 0;
            colorB[1] = mergedCenters[centersFreq[1][0]][1] | 0;
            colorB[2] = mergedCenters[centersFreq[1][0]][2] | 0;

            clusterR = centersFreq[2][0];

            colorR[0] = mergedCenters[centersFreq[2][0]][0] | 0;
            colorR[1] = mergedCenters[centersFreq[2][0]][1] | 0;
            colorR[2] = mergedCenters[centersFreq[2][0]][2] | 0;

            first = true;
        }

        samples.delete();
        labels.delete();
        centers.delete();
    } else {
        for (let i = 0; i < n; i++) {
            const rect = candidates[i].rect;
            const color = candidates[i].color;

            let point1 = new cv.Point(rect.x - offset, rect.y - offset);
            let point2 = new cv.Point(rect.x + rect.width + offset, rect.y + rect.height + offset);

            cv.rectangle(src, point1, point2, [color[0], color[1], color[2], 255], 4);
        }
    }

    let minDistance = 1000;
    let minIndex = 0;
    let index = 0;
    const centerCanvas = new cv.Point(canvasWidth / 2, canvasHeight / 2);

    for (const referee of referees) {
        const point = new cv.Point((referee.rect.x + referee.rect.x + referee.rect.width) / 2, (referee.rect.y + referee.rect.y + referee.rect.height) / 2);
        const dist = distance(point, centerCanvas);

        if (dist < minDistance) {
            minDistance = dist;
            minIndex = index;
        }

        index++;
    }

    if (referees.length > 0) {
        const selectedRef = referees[minIndex];
        currentRefereeFootPoint = new cv.Point(
            selectedRef.rect.x + (selectedRef.rect.width / 2),
            selectedRef.rect.y + selectedRef.rect.height
        );

        if (isOverlayEnabled('overlay-referee')) {
            const point1 = new cv.Point(selectedRef.rect.x - offset, selectedRef.rect.y - offset);
            const point2 = new cv.Point(selectedRef.rect.x + selectedRef.rect.width + offset, selectedRef.rect.y + selectedRef.rect.height + offset);

            cv.rectangle(src, point1, point2, selectedRef.color, 4);

            const text = 'Referee';
            const textOrg = new cv.Point(point1.x - 15, point1.y - 10);

            cv.putText(
                src,
                text,
                textOrg,
                cv.FONT_HERSHEY_SIMPLEX,
                0.6,
                [255, 255, 255, 255],
                4,
                cv.LINE_AA
            );

            cv.putText(
                src,
                text,
                textOrg,
                cv.FONT_HERSHEY_SIMPLEX,
                0.6,
                selectedRef.color,
                2,
                cv.LINE_AA
            );
        }
    } else {
        currentRefereeFootPoint = null;
    }

    if (ballPoint1 != null && ballPoint2 != null) {
        if (isOverlayEnabled('overlay-ball-box'))
            cv.rectangle(src, ballPoint1, ballPoint2, [255, 255, 255, 255], 4);

        minDistance = 1000;
        minIndex = 0;
        index = 0;

        if (players.length > 0) {
            for (const player of players) {
                const centerBall = new cv.Point((ballPoint1.x + ballPoint2.x) / 2, (ballPoint1.y + ballPoint2.y) / 2);
                const point = new cv.Point((player.rect.x + player.rect.x + player.rect.width) / 2, (player.rect.y + player.rect.y + player.rect.height) / 2);
                const dist = distance(point, centerBall);

                if (dist < minDistance) {
                    minDistance = dist;
                    minIndex = index;
                }

                index++;
            }

            if (players[minIndex].type === 'A') teamAPossession++;
            else teamBPossession++;
        }
    }

    contours.delete();
    hierarchy.delete();
}

function contoursBallCv(cv, src, dst) {
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates = [];

    const centerCanvas = new cv.Point(canvasWidth / 2, canvasHeight / 2);

    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);

        if (!isBallCandidate(contour)) {
            cv.drawContours(dst, contours, i, new cv.Scalar(0, 0, 0, 255), cv.FILLED);
            contour.delete();
            continue;
        }

        const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        const one = new cv.MatVector();
        one.push_back(contour);
        cv.drawContours(mask, one, 0, new cv.Scalar(255), cv.FILLED);

        const point = new cv.Point((rect.x + rect.x + rect.width) / 2, (rect.y + rect.y + rect.height) / 2);

        const dist = distance(point, centerCanvas);

        candidates.push({ rect, dist });

        one.delete();
        mask.delete();
        contour.delete();
    }

    if (candidates.length === 0) {
        ballPoint1 = null;
        ballPoint2 = null;
        contours.delete();
        hierarchy.delete();
        return;
    }

    candidates.sort((a, b) => a.dist - b.dist);

    const offset = 5;
    const rect = candidates[0].rect;
    ballPoint1 = new cv.Point(rect.x - offset, rect.y - offset);
    ballPoint2 = new cv.Point(rect.x + rect.width + offset, rect.y + rect.height + offset);

    contours.delete();
    hierarchy.delete();
}

function removeFieldCv(cv, src, dst) {
    let mask = new cv.Mat();
    cv.bitwise_and(src, src, mask, dst);
    mask.copyTo(dst);
    mask.delete();
}

// --- Utils --- //
function clampColorChannel(value) {
    return Math.max(0, Math.min(255, value | 0));
}

function intensityColorContrast(r, g, b) {
    const contrast = 1.35;
    const saturation = 1.25;
    const contrastR = (r - 128) * contrast + 128;
    const contrastG = (g - 128) * contrast + 128;
    const contrastB = (b - 128) * contrast + 128;

    const gray = 0.299 * contrastR + 0.587 * contrastG + 0.114 * contrastB;

    const outR = gray + (contrastR - gray) * saturation;
    const outG = gray + (contrastG - gray) * saturation;
    const outB = gray + (contrastB - gray) * saturation;

    return [
        clampColorChannel(outR),
        clampColorChannel(outG),
        clampColorChannel(outB),
        255
    ];
}

function mergeSimilarClusters(labels, centers, threshold = 30) {
    const k = centers.rows;
    const labelsData = labels.data32S; // Int32Array (n x 1)

    if (!first) {
        console.log('labelsData:', labelsData);
        console.log('centers:', centers);
    }

    const oldToNew = new Array(k).fill(-1);
    const mergedCenters = [];

    const center = (i) => [
        centers.floatAt(i, 0),
        centers.floatAt(i, 1),
        centers.floatAt(i, 2)
    ];

    // Conserva el primer centroide y descarta los que sean muy parecidos.
    for (let i = 0; i < k; i++) {
        const currentCenter = center(i);
        let foundIndex = -1;

        for (let j = 0; j < mergedCenters.length; j++) {
            if (distRgb(currentCenter, mergedCenters[j]) < threshold) {
                foundIndex = j;
                break;
            }
        }

        if (foundIndex === -1) {
            oldToNew[i] = mergedCenters.length;
            mergedCenters.push(currentCenter);
        } else oldToNew[i] = foundIndex;
    }

    // Remap labels en sitio con el cluster deduplicado.
    for (let i = 0; i < labelsData.length; i++) {
        labelsData[i] = oldToNew[labelsData[i]];
    }

    return {
        mergedCenters, // array JS: [ [r,g,b], ... ]
        mergedK: mergedCenters.length
    };
}

function isBallCandidate(contour) {
    const area = cv.contourArea(contour);
    // Ajusta según resolución/zoom del video
    if (area < 6 || area > 140) return false;

    const peri = cv.arcLength(contour, true);
    if (peri <= 0) return false;

    const circularity = (4 * Math.PI * area) / (peri * peri);
    if (circularity < 0.5) return false;

    const r = cv.boundingRect(contour);
    if (r.width < 3 || r.height < 3) return false;
    if (r.width > 20 || r.height > 20) return false;

    const aspect = r.width / r.height;
    if (aspect < 0.68 || aspect > 1.45) return false;

    const rectArea = r.width * r.height;
    const extent = rectArea > 0 ? area / rectArea : 0;
    // Si es muy bajo, suele ser ruido/alargado irregular
    if (extent < 0.38) return false;

    const hull = new cv.Mat();
    cv.convexHull(contour, hull, false, true);
    const hullArea = cv.contourArea(hull);
    hull.delete();

    const solidity = hullArea > 0 ? area / hullArea : 0;
    if (solidity < 0.82) return false;

    const enc = cv.minEnclosingCircle(contour); // { center, radius }
    const circleArea = Math.PI * enc.radius * enc.radius;
    const circleFill = circleArea > 0 ? area / circleArea : 0;
    // Para blobs pequeños/pixelados, este rango funciona bien
    if (circleFill < 0.4 || circleFill > 1.35) return false;

    const margin = 40;
    const rect = cv.boundingRect(contour);
    const leftTop = new cv.Point(rect.x, rect.y);
    const rightTop = new cv.Point(rect.x + rect.width, rect.y);
    const leftBottom = new cv.Point(rect.x, rect.y + rect.height);
    const rightBottom = new cv.Point(rect.x + rect.width, rect.y + rect.height);

    const condition = (leftTop.x - margin < 0) || 
            (leftTop.y - margin < 0) || 
            (rightTop.x + margin > canvasWidth) || 
            (rightTop.y - margin < 0) || 
            (leftBottom.x - margin < 0) || 
            (leftBottom.y + margin > canvasHeight) || 
            (rightBottom.x + margin > canvasWidth) || 
            (rightBottom.y + margin > canvasHeight);

    if (condition) return false;

    return true;
}

function distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.hypot(dx, dy); // sqrt(dx*dx + dy*dy)
}

function isOverlayEnabled(id) {
    const control = document.getElementById(id);
    return !control || control.checked;
}

function setupProjectionControls(video, canvas) {
    const calibrateButton = document.getElementById('btn-calibrate-field');
    const clearHeatmapButton = document.getElementById('btn-clear-ref-heatmap');
    const projectionModeSelect = document.getElementById('projection-mode');
    const projectionEdgeDetectorSelect = document.getElementById('projection-edge-detector');

    if (projectionModeSelect) {
        projectionModeSelect.addEventListener('change', (event) => {
            projectionMode = event.target.value === '3B' ? '3B' : '3A';
            releasePreviousGrayFrame();

            if (projectionMode === '3B') {
                updateProjectionStatus('Modo 3B activo. Estimando homografía automática por líneas del campo.');
            } else {
                updateProjectionStatus(fieldHomographyMat ? 'Modo 3A activo. Tracking desde calibración manual.' : 'Modo 3A activo. Pausa y calibra 4 puntos.');
            }
        });
    }

    if (projectionEdgeDetectorSelect) {
        projectionEdgeDetectorSelect.addEventListener('change', (event) => {
            const value = String(event.target.value || 'canny').toLowerCase();
            projectionEdgeDetector = (value === 'sobel' || value === 'prewitt') ? value : 'canny';
            if (projectionMode === '3B') {
                updateProjectionStatus(`Modo 3B activo. Detector: ${projectionEdgeDetector}.`);
            }
        });
    }

    if (calibrateButton) {
        calibrateButton.addEventListener('click', () => {
            if (!video || (!video.src && video.readyState === 0)) {
                updateProjectionStatus('Carga un video antes de calibrar.');
                return;
            }

            if (!video.paused) {
                updateProjectionStatus('Pausa el video para marcar los 4 puntos.');
                return;
            }

            isCalibratingField = true;
            fieldCalibrationPoints = [];
            trackedFieldPoints = [];
            projectionConfidence = 0;
            updateProjectionStatus('Calibración activa: marca 4 puntos (sup-izq, sup-der, inf-der, inf-izq).');
        });
    }
console.log('setupProjectionControls 3');
    if (clearHeatmapButton) {
        clearHeatmapButton.addEventListener('click', () => {
            clearRefereeHeatmapData();
            renderRefereeHeatmap(lastProjectedRefereePoint);
            updateProjectionStatus(fieldHomographyMat ? 'Mapa reiniciado.' : 'Mapa limpiado. Falta calibrar.');
        });
    }
console.log('setupProjectionControls 4');
    if (canvas) {
        canvas.addEventListener('click', (event) => {
            if (!isCalibratingField) return;

            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
            const y = ((event.clientY - rect.top) * canvas.height) / rect.height;

            fieldCalibrationPoints.push({ x, y });

            if (fieldCalibrationPoints.length < 4) {
                updateProjectionStatus(`Punto ${fieldCalibrationPoints.length}/4 marcado.`);
                return;
            }

            isCalibratingField = false;
            trackedFieldPoints = fieldCalibrationPoints.map((p) => ({ x: p.x, y: p.y }));

            const ok = updateHomographyFromPoints(trackedFieldPoints);
            if (!ok) {
                updateProjectionStatus('No se pudo calcular la homografía. Repite calibración.');
                return;
            }

            projectionConfidence = 1;
            clearRefereeHeatmapData();
            lastProjectedRefereePoint = null;
            renderRefereeHeatmap();
            releasePreviousGrayFrame();
            updateProjectionStatus('Calibrado. 3A activo: seguimiento automático de puntos.');
        });
    }
}

function processRefereeProjection(src) {//here
    if (isCalibratingField || fieldCalibrationPoints.length > 0 || trackedFieldPoints.length === 4) {
        console.log('processRefereeProjection 1');
        drawFieldCalibrationOverlay(src, trackedFieldPoints.length === 4 ? trackedFieldPoints : fieldCalibrationPoints);
    }

    if (projectionMode === '3B') {
        console.log('processRefereeProjection 2');
        updateHomographyAuto3B(src);
    }
    else {
        console.log('processRefereeProjection 3');
        updateHomographyAuto3A(src);
    }

    if (!fieldHomographyMat || !currentRefereeFootPoint) {
        console.log('processRefereeProjection 4');
        renderRefereeHeatmap(lastProjectedRefereePoint);
        return;
    }

    const projected = projectPointToTopView(currentRefereeFootPoint);
    if (!projected) {
        console.log('processRefereeProjection 5');
        renderRefereeHeatmap(lastProjectedRefereePoint);
        return;
    }

    lastProjectedRefereePoint = projected;

    if (projectionConfidence >= 0.55)
        accumulateRefereeHeatmap(projected.x, projected.y);

    renderRefereeHeatmap(projected);
}

function updateHomographyAuto3A(src) {
    console.log('updateHomographyAuto3A 1');
    const autoControl = document.getElementById('projection-auto-track');
    const autoEnabled = !autoControl || autoControl.checked;

    if (!autoEnabled || trackedFieldPoints.length !== 4 || !fieldHomographyMat) {
        releasePreviousGrayFrame();
        return;
    }
console.log('updateHomographyAuto3A 2');
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    if (!previousGrayFrame) {
        previousGrayFrame = gray.clone();
        gray.delete();
        return;
    }
console.log('updateHomographyAuto3A 3');
    const prevPtsData = [];
    for (const p of trackedFieldPoints)
        prevPtsData.push(p.x, p.y);

    const prevPts = cv.matFromArray(4, 1, cv.CV_32FC2, prevPtsData);
    const nextPts = new cv.Mat();
    const status = new cv.Mat();
    const err = new cv.Mat();
    const winSize = new cv.Size(21, 21);
    const maxLevel = 3;
    const termCriteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_COUNT, 30, 0.01);
console.log('updateHomographyAuto3A 4');
    cv.calcOpticalFlowPyrLK(previousGrayFrame, gray, prevPts, nextPts, status, err, winSize, maxLevel, termCriteria);
console.log('updateHomographyAuto3A 5');
    const tracked = [];
    let validCount = 0;

    for (let i = 0; i < 4; i++) {
        if (status.data[i] === 1) {
            tracked.push({ x: nextPts.data32F[i * 2], y: nextPts.data32F[i * 2 + 1] });
            validCount++;
        } else {
            tracked.push({ x: trackedFieldPoints[i].x, y: trackedFieldPoints[i].y });
        }
    }
console.log('updateHomographyAuto3A 6');
    const geomOk = isValidQuadrilateral(tracked, src.cols, src.rows);

    if (validCount >= 3 && geomOk) {
        trackedFieldPoints = tracked;
        const hOk = updateHomographyFromPoints(trackedFieldPoints);
        projectionConfidence = hOk ? computeProjectionConfidence(validCount, trackedFieldPoints, src.cols, src.rows) : 0;
    } else {
        projectionConfidence *= 0.92;
    }
console.log('updateHomographyAuto3A 7');
    if (autoProjectionFrameCount % 15 === 0)
        refineTrackingWithFieldLines(src);

    autoProjectionFrameCount++;

    previousGrayFrame.delete();
    previousGrayFrame = gray.clone();
console.log('updateHomographyAuto3A 8');
    prevPts.delete();
    nextPts.delete();
    status.delete();
    err.delete();
    gray.delete();
}

function updateHomographyAuto3B(src) {
    console.log('updateHomographyAuto3B 1');
    const detectedQuad = detectFieldQuadrilateralFromLines(src);

    if (!detectedQuad) {
        projectionConfidence *= 0.92;
        return;
    }

    if (!isValidQuadrilateral(detectedQuad.points, src.cols, src.rows)) {
        projectionConfidence *= 0.88;
        return;
    }

    if (trackedFieldPoints.length === 4) {
        trackedFieldPoints = smoothTrackedPoints(trackedFieldPoints, detectedQuad.points, 0.3);
    } else {
        trackedFieldPoints = detectedQuad.points.map((p) => ({ x: p.x, y: p.y }));
    }

    const hOk = updateHomographyFromPoints(trackedFieldPoints);
    if (!hOk) {
        projectionConfidence *= 0.85;
        return;
    }

    const lineScore = Math.max(0, Math.min(1, detectedQuad.lineCount / 16));
    const areaScore = Math.max(0, Math.min(1, polygonArea(trackedFieldPoints) / (src.cols * src.rows * 0.12)));
    projectionConfidence = Math.max(0, Math.min(1, (0.65 * lineScore) + (0.35 * areaScore)));
}

function detectFieldQuadrilateralFromLines(src) {
    console.log('detectFieldQuadrilateralFromLines 1');
    const rgb = new cv.Mat();
    const hsv = new cv.Mat();
    const whiteMask = new cv.Mat();
    const greenMask = new cv.Mat();
    const lineMask = new cv.Mat();
    const edges = new cv.Mat();
    const lines = new cv.Mat();

    contrastCv(cv, src, src);

    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV, 0);

    const lowWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 155, 0]);
    const highWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 75, 255, 255]);
    const lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [30, 30, 35, 0]);
    const highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [95, 255, 255, 255]);//here

    cv.inRange(hsv, lowWhite, highWhite, whiteMask);
    cv.inRange(hsv, lowGreen, highGreen, greenMask);

    processSteps(9, whiteMask);

    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(greenMask, greenMask, kernel);
    cv.bitwise_and(whiteMask, greenMask, lineMask);

    buildProjectionEdges(lineMask, edges);

    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 35, 35, 12);

    const endpoints = [];

    for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4];
        const y1 = lines.data32S[i * 4 + 1];
        const x2 = lines.data32S[i * 4 + 2];
        const y2 = lines.data32S[i * 4 + 3];
        const len = Math.hypot(x2 - x1, y2 - y1);

        if (len < 45)
            continue;

        endpoints.push({ x: x1, y: y1 });
        endpoints.push({ x: x2, y: y2 });
    }

    let result = null;

    if (endpoints.length >= 8) {
        const pointsData = [];
        for (const point of endpoints)
            pointsData.push(point.x, point.y);

        const pointsMat = cv.matFromArray(endpoints.length, 1, cv.CV_32SC2, pointsData);
        const hull = new cv.Mat();
        cv.convexHull(pointsMat, hull, false, true);

        const hullPoints = extractPointsFromSc2Mat(hull);
        let quad = null;

        if (hullPoints.length >= 4)
            quad = buildQuadFromPoints(hullPoints);

        if (!quad)
            quad = buildQuadFromPoints(endpoints);

        if (quad)
            result = { points: quad, lineCount: Math.max(1, lines.rows) };

        pointsMat.delete();
        hull.delete();
    }

    rgb.delete();
    hsv.delete();
    whiteMask.delete();
    greenMask.delete();
    lineMask.delete();
    edges.delete();
    lines.delete();
    lowWhite.delete();
    highWhite.delete();
    lowGreen.delete();
    highGreen.delete();
    kernel.delete();

    return result;
}

function buildProjectionEdges(lineMask, edgesOut) {
    if (projectionEdgeDetector === 'sobel') {
        buildSobelEdges(lineMask, edgesOut);
        return;
    }

    if (projectionEdgeDetector === 'prewitt') {
        buildPrewittEdges(lineMask, edgesOut);
        return;
    }

    cv.Canny(lineMask, edgesOut, 35, 120);
}

function buildSobelEdges(grayMask, edgesOut) {
    const gradX16 = new cv.Mat();
    const gradY16 = new cv.Mat();
    const absX = new cv.Mat();
    const absY = new cv.Mat();
    const mix = new cv.Mat();

    cv.Sobel(grayMask, gradX16, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.Sobel(grayMask, gradY16, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);

    cv.convertScaleAbs(gradX16, absX);
    cv.convertScaleAbs(gradY16, absY);
    cv.addWeighted(absX, 0.5, absY, 0.5, 0, mix);
    cv.threshold(mix, edgesOut, 55, 255, cv.THRESH_BINARY);

    gradX16.delete();
    gradY16.delete();
    absX.delete();
    absY.delete();
    mix.delete();
}

function buildPrewittEdges(grayMask, edgesOut) {
    const kx = cv.matFromArray(3, 3, cv.CV_32F, [
        -1, 0, 1,
        -1, 0, 1,
        -1, 0, 1
    ]);
    const ky = cv.matFromArray(3, 3, cv.CV_32F, [
        -1, -1, -1,
         0,  0,  0,
         1,  1,  1
    ]);

    const gx32 = new cv.Mat();
    const gy32 = new cv.Mat();
    const absX = new cv.Mat();
    const absY = new cv.Mat();
    const mix = new cv.Mat();

    cv.filter2D(grayMask, gx32, cv.CV_32F, kx);
    cv.filter2D(grayMask, gy32, cv.CV_32F, ky);

    cv.convertScaleAbs(gx32, absX);
    cv.convertScaleAbs(gy32, absY);
    cv.addWeighted(absX, 0.5, absY, 0.5, 0, mix);
    cv.threshold(mix, edgesOut, 55, 255, cv.THRESH_BINARY);

    kx.delete();
    ky.delete();
    gx32.delete();
    gy32.delete();
    absX.delete();
    absY.delete();
    mix.delete();
}

function refineTrackingWithFieldLines(src) {
    console.log('refineTrackingWithFieldLines 1');
    if (trackedFieldPoints.length !== 4) return;

    const rgb = new cv.Mat();
    const hsv = new cv.Mat();
    const whiteMask = new cv.Mat();
    const edges = new cv.Mat();
    const lines = new cv.Mat();
console.log('refineTrackingWithFieldLines 2');
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV, 0);
    const lowWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 160, 0]);
    const highWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 70, 255, 255]);
    cv.inRange(hsv, lowWhite, highWhite, whiteMask);
    cv.Canny(whiteMask, edges, 40, 130);
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 45, 45, 12);
console.log('refineTrackingWithFieldLines 3');
    let support = 0;
    for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4];
        const y1 = lines.data32S[i * 4 + 1];
        const x2 = lines.data32S[i * 4 + 2];
        const y2 = lines.data32S[i * 4 + 3];
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len > 65) support++;
    }
console.log('refineTrackingWithFieldLines 4');
    if (support < 2)
        projectionConfidence *= 0.95;
    else if (support > 6)
        projectionConfidence = Math.min(1, projectionConfidence + 0.04);
console.log('refineTrackingWithFieldLines 5');
    rgb.delete();
    hsv.delete();
    whiteMask.delete();
    edges.delete();
    lines.delete();
    lowWhite.delete();
    highWhite.delete();
}

function updateHomographyFromPoints(points) {
    console.log('updateHomographyFromPoints 1');
    if (!points || points.length !== 4)
        return false;

    const srcData = [];
    for (const p of points)
        srcData.push(p.x, p.y);

    const dstData = [
        0, 0,
        HEATMAP_CANVAS_WIDTH - 1, 0,
        HEATMAP_CANVAS_WIDTH - 1, HEATMAP_CANVAS_HEIGHT - 1,
        0, HEATMAP_CANVAS_HEIGHT - 1
    ];

    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcData);
    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstData);
    const h = cv.getPerspectiveTransform(srcMat, dstMat);
    console.log('updateHomographyFromPoints 2');
    if (fieldHomographyMat)
        fieldHomographyMat.delete();

    fieldHomographyMat = h;

    srcMat.delete();
    dstMat.delete();

    return !!fieldHomographyMat;
}

function projectPointToTopView(point) {
        
    const srcPoint = cv.matFromArray(1, 1, cv.CV_32FC2, [point.x, point.y]);
    const dstPoint = new cv.Mat();

    cv.perspectiveTransform(srcPoint, dstPoint, fieldHomographyMat);

    const x = dstPoint.data32F[0];
    const y = dstPoint.data32F[1];

    srcPoint.delete();
    dstPoint.delete();

    if (!Number.isFinite(x) || !Number.isFinite(y))
        return null;

    return {
        x: Math.max(0, Math.min(HEATMAP_CANVAS_WIDTH - 1, x)),
        y: Math.max(0, Math.min(HEATMAP_CANVAS_HEIGHT - 1, y))
    };
}

function drawFieldCalibrationOverlay(src, points) {
    console.log('drawFieldCalibrationOverlay 1');
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const center = new cv.Point(p.x, p.y);

        cv.circle(src, center, 7, [0, 255, 255, 255], -1);
        cv.circle(src, center, 10, [0, 0, 0, 255], 2);

        cv.putText(src, `${i + 1}`, new cv.Point(p.x + 10, p.y - 8), cv.FONT_HERSHEY_SIMPLEX, 0.55, [255, 255, 255, 255], 2, cv.LINE_AA);

        if (i > 0) {
            const prev = points[i - 1];
            cv.line(src, new cv.Point(prev.x, prev.y), center, [255, 255, 0, 255], 2, cv.LINE_AA);
        }
    }

    if (points.length === 4) {
        cv.line(src, new cv.Point(points[3].x, points[3].y), new cv.Point(points[0].x, points[0].y), [255, 255, 0, 255], 2, cv.LINE_AA);
    }
}

function renderRefereeHeatmap(projectedPoint = null) {
    console.log('renderRefereeHeatmap 1');
    const canvas = document.getElementById('canvas-ref-heatmap');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    drawTopViewField(ctx, canvas.width, canvas.height);

    if (!heatmapBufferCanvas) {
        heatmapBufferCanvas = document.createElement('canvas');
        heatmapBufferCanvas.width = HEATMAP_GRID_WIDTH;
        heatmapBufferCanvas.height = HEATMAP_GRID_HEIGHT;
    }
    console.log('renderRefereeHeatmap 2');
    const bufferCtx = heatmapBufferCanvas.getContext('2d');
    const image = bufferCtx.createImageData(HEATMAP_GRID_WIDTH, HEATMAP_GRID_HEIGHT);

    for (let i = 0; i < refereeHeatmapGrid.length; i++) {
        if (refereeHeatmapMax <= 0 || refereeHeatmapGrid[i] <= 0)
            continue;

        const p = i * 4;
        const t = Math.max(0, Math.min(1, refereeHeatmapGrid[i] / refereeHeatmapMax));
        const color = heatColor(t);

        image.data[p] = color[0];
        image.data[p + 1] = color[1];
        image.data[p + 2] = color[2];
        image.data[p + 3] = color[3];
    }

    bufferCtx.putImageData(image, 0, 0);

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(heatmapBufferCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    console.log('renderRefereeHeatmap 3');
    if (projectedPoint) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(projectedPoint.x, projectedPoint.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawProjectionHud(ctx, canvas.width);
    console.log('renderRefereeHeatmap 4');
}

function drawProjectionHud(ctx, width) {
    console.log('drawProjectionHud 1');
    const confidencePct = Math.round(Math.max(0, Math.min(1, projectionConfidence)) * 100);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(width - 228, 10, 218, 52);

    ctx.fillStyle = '#f3f4f6';
    ctx.font = '600 13px Barlow';
    ctx.fillText(`${projectionMode} Confianza: ${confidencePct}%`, width - 216, 31);

    ctx.fillStyle = projectionConfidence >= 0.55 ? '#22c55e' : '#f97316';
    ctx.fillRect(width - 216, 40, Math.round(200 * Math.max(0, Math.min(1, projectionConfidence))), 8);
    ctx.restore();
}

function drawTopViewField(ctx, width, height) {
    console.log('drawTopViewField 1');
    const pad = 16;
    const left = pad;
    const top = pad;
    const fieldW = width - (pad * 2);
    const fieldH = height - (pad * 2);
    const midX = left + (fieldW / 2);
    const midY = top + (fieldH / 2);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1f7a3b';
    ctx.fillRect(left, top, fieldW, fieldH);

    for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
        ctx.fillRect(left + (i * fieldW / 9), top, fieldW / 9, fieldH);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, fieldW, fieldH);

    ctx.beginPath();
    ctx.moveTo(midX, top);
    ctx.lineTo(midX, top + fieldH);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, Math.min(fieldW, fieldH) * 0.12, 0, Math.PI * 2);
    ctx.stroke();

    const areaW = fieldW * 0.16;
    const areaH = fieldH * 0.42;
    const areaTop = midY - (areaH / 2);
    ctx.strokeRect(left, areaTop, areaW, areaH);
    ctx.strokeRect(left + fieldW - areaW, areaTop, areaW, areaH);
}

function heatColor(value) {
    console.log('heatColor 1');
    const t = Math.max(0, Math.min(1, value));

    let r = 0;
    let g = 0;
    let b = 0;

    if (t < 0.25) {
        g = t * 4 * 255;
        b = 255;
    } else if (t < 0.5) {
        g = 255;
        b = (1 - ((t - 0.25) * 4)) * 255;
    } else if (t < 0.75) {
        r = (t - 0.5) * 4 * 255;
        g = 255;
    } else {
        r = 255;
        g = (1 - ((t - 0.75) * 4)) * 255;
    }

    const alpha = Math.min(245, Math.round(35 + (t * 210)));
    return [r | 0, g | 0, b | 0, alpha];
}

function accumulateRefereeHeatmap(x, y) {
    console.log('accumulateRefereeHeatmap 1');

    const gx = Math.round((x / HEATMAP_CANVAS_WIDTH) * (HEATMAP_GRID_WIDTH - 1));
    const gy = Math.round((y / HEATMAP_CANVAS_HEIGHT) * (HEATMAP_GRID_HEIGHT - 1));

    for (let dy = -HEATMAP_SMOOTH_RADIUS; dy <= HEATMAP_SMOOTH_RADIUS; dy++) {
        for (let dx = -HEATMAP_SMOOTH_RADIUS; dx <= HEATMAP_SMOOTH_RADIUS; dx++) {
            const px = gx + dx;
            const py = gy + dy;

            if (px < 0 || px >= HEATMAP_GRID_WIDTH || py < 0 || py >= HEATMAP_GRID_HEIGHT)
                continue;

            const dist2 = (dx * dx) + (dy * dy);
            const weight = Math.exp(-dist2 / 4);
            const idx = (py * HEATMAP_GRID_WIDTH) + px;

            refereeHeatmapGrid[idx] += weight;
            if (refereeHeatmapGrid[idx] > refereeHeatmapMax)
                refereeHeatmapMax = refereeHeatmapGrid[idx];
        }
    }
}

function clearRefereeHeatmapData() {
    refereeHeatmapGrid.fill(0);
    refereeHeatmapMax = 0;
}

function updateProjectionStatus(message) {
    const status = document.getElementById('projection-status');
    if (status)
        status.textContent = message;
}

function releasePreviousGrayFrame() {
    if (previousGrayFrame) {
        previousGrayFrame.delete();
        previousGrayFrame = null;
    }
}

function releaseProjectionMemory() {
    releasePreviousGrayFrame();

    if (fieldHomographyMat) {
        fieldHomographyMat.delete();
        fieldHomographyMat = null;
    }
}

function computeProjectionConfidence(validCount, points, width, height) {
    console.log('computeProjectionConfidence 1');
    const trackScore = validCount / 4;

    let inside = 0;
    for (const p of points) {
        if (p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)
            inside++;
    }

    const insideScore = inside / 4;
    const area = polygonArea(points);
    const areaScore = Math.max(0, Math.min(1, area / (width * height * 0.08)));

    return Math.max(0, Math.min(1, (0.5 * trackScore) + (0.25 * insideScore) + (0.25 * areaScore)));
}

function isValidQuadrilateral(points, width, height) {
    console.log('isValidQuadrilateral 1');
    if (!points || points.length !== 4)
        return false;

    for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
        if (p.x < -30 || p.x > width + 30 || p.y < -30 || p.y > height + 30) return false;
    }

    const area = polygonArea(points);
    if (area < width * height * 0.01)
        return false;

    return true;
}

function polygonArea(points) {
    console.log('polygonArea 1');
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        area += (p1.x * p2.y) - (p2.x * p1.y);
    }
    return Math.abs(area / 2);
}

function extractPointsFromSc2Mat(mat) {
    console.log('extractPointsFromSc2Mat 1');
    const points = [];
    const data = mat.data32S;

    if (!data || data.length < 2)
        return points;

    for (let i = 0; i < data.length; i += 2)
        points.push({ x: data[i], y: data[i + 1] });

    return points;
}

function buildQuadFromPoints(points) {
    console.log('buildQuadFromPoints 1');
    if (!points || points.length < 4)
        return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const byQuadrant = [null, null, null, null];

    for (const p of points) {
        const q = (p.x >= cx ? 1 : 0) + (p.y >= cy ? 2 : 0);

        if (!byQuadrant[q]) {
            byQuadrant[q] = { x: p.x, y: p.y };
            continue;
        }

        const prev = byQuadrant[q];
        const prevDist = Math.hypot(prev.x - cx, prev.y - cy);
        const currDist = Math.hypot(p.x - cx, p.y - cy);

        if (currDist > prevDist)
            byQuadrant[q] = { x: p.x, y: p.y };
    }

    const fallback = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
    ];

    const quad = [
        byQuadrant[0] || fallback[0],
        byQuadrant[1] || fallback[1],
        byQuadrant[3] || fallback[2],
        byQuadrant[2] || fallback[3]
    ];

    return orderQuadrilateralPoints(quad);
}

function orderQuadrilateralPoints(points) {
    console.log('orderQuadrilateralPoints 1');
    const sorted = points.slice().sort((a, b) => a.y - b.y);
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = sorted.slice(2, 4).sort((a, b) => b.x - a.x);
    return [top[0], top[1], bottom[0], bottom[1]];
}

function smoothTrackedPoints(previousPoints, newPoints, alpha) {
    console.log('smoothTrackedPoints 1');
    const a = Math.max(0, Math.min(1, alpha));

    return previousPoints.map((p, i) => ({
        x: ((1 - a) * p.x) + (a * newPoints[i].x),
        y: ((1 - a) * p.y) + (a * newPoints[i].y)
    }));
}