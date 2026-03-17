
let canvasWidth = 0;
let canvasHeight = 0;
const colorBorderText = [0, 0, 0, 255];
let colorA = [ 0, 0, 0, 255 ];
let colorB = [ 0, 0, 0, 255 ];
let colorR = [ 0, 0, 0, 255 ];
let clusterA = -1;
let clusterB = -1;
let clusterR = -1;
let count = 0;
let first = false;
let isLineUpShow = false;
let ballPoint1;
let ballPoint2;
let teamAPossession = 0;
let teamBPossession = 0;
let umbralContrastPlayer = 1.0;
let umbralContrastBall = 1.0;
let teamA = [];
let teamB = [];
let framePlayers = [];
let frameBallCenter = null;

const FIELD_WIDTH_METERS = 105;
const FIELD_HEIGHT_METERS = 68;
const LINEAR_HEAT_BINS = 36;
const LINEAR_HEAT_DECAY = 0.985;
let linearHeatHistogram = Array(LINEAR_HEAT_BINS).fill(0);

let homographyMode = false;
let homographyImagePoints = [];
let homographyMatrix = null;
let homographyPrevGray = null;
let homographyTrackedPoints = null;
let fieldStripeLines = [];
let fieldStripeCoverage = 0;
let snapRadius = 50;
const homographyFieldPoints = [
    { x: 0, y: 0 },
    { x: FIELD_WIDTH_METERS, y: 0 },
    { x: FIELD_WIDTH_METERS, y: FIELD_HEIGHT_METERS },
    { x: 0, y: FIELD_HEIGHT_METERS }
];

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
    const calibrateHomographyButton = document.getElementById('btn-calibrate-homography');

    const contrastSlider = document.getElementById('contrast-slider');
    const contrastValue = document.getElementById('contrast-value');
    const contrastSliderBall = document.getElementById('contrast-slider-ball');
    const contrastValueBall = document.getElementById('contrast-value-ball');
    const snapRadiusSlider = document.getElementById('snap-radius-slider');
    const snapRadiusValue = document.getElementById('snap-radius-value');

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

    if (snapRadiusSlider) {
        const syncSnapRadius = () => {
            const rawValue = Number(snapRadiusSlider.value);
            snapRadius = Math.max(10, Math.min(600, Math.round(rawValue)));

            if (snapRadiusValue)
                snapRadiusValue.textContent = `${snapRadius}px`;
        };

        snapRadiusSlider.addEventListener('input', syncSnapRadius);
        syncSnapRadius();
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
        // video.play();
    });

    setupPlaybackControls(video);

    if (calibrateHomographyButton) {
        calibrateHomographyButton.addEventListener('click', () => {
            homographyMode = true;
            homographyImagePoints = [];
            setHomographyStatus('Modo calibracion activo: click en 4 puntos del campo (sup-izq, sup-der, inf-der, inf-izq).');
        });
    }

    canvas.addEventListener('click', (event) => {
        if (!homographyMode) return;

        const point = getCanvasPointFromEvent(canvas, event);
        const snappedPoint = snapPointToFieldStripe(point);
        homographyImagePoints.push(point);

        if (snappedPoint)
            homographyImagePoints[homographyImagePoints.length - 1] = snappedPoint;

        if (homographyImagePoints.length < 4) {
            setHomographyStatus(`Punto ${homographyImagePoints.length}/4 capturado.`);
            return;
        }

        homographyMode = false;

        if (rebuildHomographyFromImagePoints(homographyImagePoints)) {
            setHomographyStatus('Homografia calibrada. Seguimiento activo para compensar paneo.');
        } else {
            setHomographyStatus('No se pudo calibrar la homografia. Repite la seleccion de puntos.');
        }
    });

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
    document.getElementById('view-inicial').addEventListener('change', (e) => {
        document.getElementById('content-inicial').style.display = e.target.checked ? 'grid' : 'none';
    });
    document.getElementById('view-step-0').addEventListener('change', (e) => {
        document.getElementById('content-step-0').style.display = e.target.checked ? 'grid' : 'none';
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
    colorA = [ 0, 0, 0, 255 ];
    colorB = [ 0, 0, 0, 255 ]; 
    colorR = [ 0, 0, 0, 255 ];
    clusterA = -1;
    clusterB = -1;
    clusterR = -1;
    count = 0;
    first = false;
    isLineUpShow = false;
    teamAPossession = 0;
    teamBPossession = 0;
    teamA = [];
    teamB = [];
    framePlayers = [];
    frameBallCenter = null;
    linearHeatHistogram = Array(LINEAR_HEAT_BINS).fill(0);
    homographyMode = false;
    homographyImagePoints = [];
    snapRadius = 50;
    fieldStripeLines = [];
    fieldStripeCoverage = 0;

    const snapRadiusSlider = document.getElementById('snap-radius-slider');
    const snapRadiusValue = document.getElementById('snap-radius-value');

    if (snapRadiusSlider)
        snapRadiusSlider.value = String(snapRadius);

    if (snapRadiusValue)
        snapRadiusValue.textContent = `${snapRadius}px`;

    if (homographyMatrix) {
        homographyMatrix.delete();
        homographyMatrix = null;
    }

    if (homographyPrevGray) {
        homographyPrevGray.delete();
        homographyPrevGray = null;
    }

    if (homographyTrackedPoints) {
        homographyTrackedPoints.delete();
        homographyTrackedPoints = null;
    }

    setHomographyStatus('Homografia reiniciada. Calibra nuevamente para el nuevo video.');

    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function processVideo(video, canvas, ctx, shouldContinue, setAnimationId) {
    // if (first) return;
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

    if (!isLineUpShow && first) {
        cv.imshow(document.getElementById('canvas-inicial'), src);
        isLineUpShow = true;
    }
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

    src.copyTo(srcBall);

    detectFieldWhiteStripes(src);
    updateHomographyTracking(src);

    processBall(srcBall, dstBall);
    processPlayers(src, dst);
    processBallPossession(src);

    drawFieldStripeDebug(src);
    processLinearHeatBar(src);

    processLineUp(src);

    srcBall.delete();
    dstBall.delete();
    dst.delete();
}

function processSteps(step, dst) {
    const element = document.getElementById(`view-step-${step}`);
    const canvas = document.getElementById(`canvas-step-${step}`);

    if (step === 0 || element.checked)
        cv.imshow(canvas, dst);
}

function processPlayers(src, dst) {
    contrastCv(cv, src, dst); processSteps(1, dst);
    umbralGreenCv(cv, dst, dst); processSteps(2, dst);
    morfologyCv(cv, dst, !first ? 3 : 5);  processSteps(3, dst);
    maskGreenFieldCv(cv, dst);  processSteps(4, dst);
    contoursPlayersCv(cv, src, dst); processSteps(5, dst);
}

function processBall(src, dst) {
    if (!first) return;

    contrastCv(cv, src, dst, true);
    umbralGreenCv(cv, dst, dst, true); processSteps(6, dst);
    maskGreenFieldCv(cv, dst);  processSteps(7, dst);
    contoursBallCv(cv, src, dst); processSteps(8, dst);
}

function processBallPossession(src) {
    if (!isOverlayEnabled('overlay-possession')) return;
    
    const teamANameInput = document.getElementById('team-a-name').value.trim() || 'Team A';
    const teamBNameInput = document.getElementById('team-b-name').value.trim() || 'Team B';

    const totalPossession = teamAPossession + teamBPossession;
    const offsetSeparate = 25;

    const textPosA = new cv.Point(10, 70);
    const textPosB = new cv.Point(10, textPosA.y + offsetSeparate);
    const textPosR = new cv.Point(10, textPosB.y + offsetSeparate);

    const textA = teamANameInput + ': ' + (totalPossession <= 0 ? 0 : Math.round((teamAPossession * 100) / totalPossession)) + '%';
    const textB = teamBNameInput + ': ' + (totalPossession <= 0 ? 0 : Math.round((teamBPossession * 100) / totalPossession)) + '%';
    const textR = 'Referee';

    const fillWidth = 2;
    const strokeWidth = 5;
    const scaleFont = 0.8;
    const lineType = cv.LINE_AA;
    const fontType = cv.FONT_HERSHEY_SIMPLEX;

    cv.putText(
        src,
        textA,
        textPosA,
        fontType,
        scaleFont,
        colorBorderText,
        strokeWidth,
        lineType
    );

    cv.putText(
        src,
        textA,
        textPosA,
        fontType,
        scaleFont,
        intensityColorContrast(colorA[0], colorA[1], colorA[2]),
        fillWidth,
        lineType
    );

    cv.putText(
        src,
        textB,
        textPosB,
        fontType,
        scaleFont,
        colorBorderText,
        strokeWidth,
        lineType
    );

    cv.putText(
        src,
        textB,
        textPosB,
        fontType,
        scaleFont,
        intensityColorContrast(colorB[0], colorB[1], colorB[2]),
        fillWidth,
        lineType
    );

    cv.putText(
        src,
        textR,
        textPosR,
        fontType,
        scaleFont,
        colorBorderText,
        strokeWidth,
        lineType
    );

    cv.putText(
        src,
        textR,
        textPosR,
        fontType,
        scaleFont,
        intensityColorContrast(colorR[0], colorR[1], colorR[2]),
        fillWidth,
        lineType
    );
}

function processLineUp(src) {
    if (!isOverlayEnabled('overlay-line-ups')) return;

    const offsetSeparate = 25;
    const offsetRight = 150;

    const textPosA = new cv.Point(canvasWidth - offsetRight, 70);
    const textPosB = new cv.Point(canvasWidth - offsetRight, textPosA.y + offsetSeparate);

    const fillWidth = 2;
    const strokeWidth = 5;
    const scaleFont = 0.8;
    const lineType = cv.LINE_AA;
    const fontType = cv.FONT_HERSHEY_SIMPLEX;

    if (teamA.length === 0 || teamB.length === 0) return;

    const resultA = estimateFormation(teamA, { attackDirection: 'leftToRight' });
    const resultB = estimateFormation(teamB, { attackDirection: 'rightToLeft' });

    if (!isLineUpShow) {
        console.log('Equipo A:', resultA.bestFormation, resultA.ranking);
        console.log('Equipo B:', resultB.bestFormation, resultB.ranking);
    }

    const textA = resultA.bestFormation || '0-0-0';
    const textB = resultB.bestFormation || '0-0-0';

    cv.putText(
        src,
        textA,
        textPosA,
        fontType,
        scaleFont,
        colorBorderText,
        strokeWidth,
        lineType
    );

    cv.putText(
        src,
        textA,
        textPosA,
        fontType,
        scaleFont,
        intensityColorContrast(colorA[0], colorA[1], colorA[2]),
        fillWidth,
        lineType
    );

    cv.putText(
        src,
        textB,
        textPosB,
        fontType,
        scaleFont,
        colorBorderText,
        strokeWidth,
        lineType
    );

    cv.putText(
        src,
        textB,
        textPosB,
        fontType,
        scaleFont,
        intensityColorContrast(colorB[0], colorB[1], colorB[2]),
        fillWidth,
        lineType
    );
}

function processLinearHeatBar(src) {
    if (!isOverlayEnabled('overlay-linear-heatmap')) return;

    if (homographyMatrix)
        updateLinearHeatHistogramFromFrame();

    const marginX = Math.round(canvasWidth * 0.12);
    const barWidth = Math.max(240, canvasWidth - (marginX * 2));
    const barHeight = 22;
    const top = Math.max(70, canvasHeight - 54);
    const left = marginX;
    const segmentWidth = barWidth / LINEAR_HEAT_BINS;

    cv.rectangle(
        src,
        new cv.Point(left - 2, top - 2),
        new cv.Point(left + barWidth + 2, top + barHeight + 2),
        [0, 0, 0, 180],
        cv.FILLED
    );

    const maxBin = Math.max(...linearHeatHistogram, 1e-6);

    for (let i = 0; i < LINEAR_HEAT_BINS; i++) {
        const normalized = linearHeatHistogram[i] / maxBin;
        const color = getHeatColor(normalized);
        const x1 = left + Math.floor(i * segmentWidth);
        const x2 = left + Math.ceil((i + 1) * segmentWidth);

        cv.rectangle(
            src,
            new cv.Point(x1, top),
            new cv.Point(x2, top + barHeight),
            color,
            cv.FILLED
        );
    }

    const centerX = left + Math.floor(barWidth / 2);
    cv.line(
        src,
        new cv.Point(centerX, top - 4),
        new cv.Point(centerX, top + barHeight + 4),
        [255, 255, 255, 255],
        1,
        cv.LINE_AA
    );

    const leftLoad = linearHeatHistogram.slice(0, Math.floor(LINEAR_HEAT_BINS / 2)).reduce((acc, value) => acc + value, 0);
    const rightLoad = linearHeatHistogram.slice(Math.floor(LINEAR_HEAT_BINS / 2)).reduce((acc, value) => acc + value, 0);
    const totalLoad = leftLoad + rightLoad;
    const leftPct = totalLoad > 0 ? Math.round((leftLoad * 100) / totalLoad) : 50;
    const rightPct = 100 - leftPct;

    const statusText = homographyMatrix
        ? `Inclinacion territorial: IZQ ${leftPct}% | DER ${rightPct}%`
        : 'Inclinacion territorial: homografia no calibrada';

    const textPos = new cv.Point(left, top - 10);

    cv.putText(src, statusText, textPos, cv.FONT_HERSHEY_SIMPLEX, 0.55, [0, 0, 0, 255], 4, cv.LINE_AA);
    cv.putText(src, statusText, textPos, cv.FONT_HERSHEY_SIMPLEX, 0.55, [235, 235, 235, 255], 2, cv.LINE_AA);
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
    framePlayers = [];

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates = []; // { rect, color:[r,g,b] }

    for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);

        if (!isPlayerCandidate(contour)) {
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
    const others = [];

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

        let teamLeftCluster = -1;
        let minX = 10000;
        let colorMin = [0, 0, 0, 255];

        for (let i = 0; i < n; i++) {
            const rect = candidates[i].rect;
            const point1 = new cv.Point(rect.x - offset, rect.y - offset);
            const point2 = new cv.Point(rect.x + rect.width + offset, rect.y + rect.height + offset);

            const cluster = labels.intAt(i, 0);

            centersFreq[cluster][0] = cluster;
            centersFreq[cluster][1]++;

            if (rect.x < minX) {
                minX = rect.x;
                teamLeftCluster = cluster;
                colorMin = [mergedCenters[cluster][0] | 0, mergedCenters[cluster][1] | 0, mergedCenters[cluster][2] | 0, 255];
            }

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

            if (isA) {
                players.push({ rect, color: solidColor, type: 'A' });
                framePlayers.push({ x: rect.x + (rect.width / 2), y: rect.y + rect.height, type: 'A' });
            }
            else if (isB) {
                players.push({ rect, color: solidColor, type: 'B' });
                framePlayers.push({ x: rect.x + (rect.width / 2), y: rect.y + rect.height, type: 'B' });
            }
            else if (isR) referees.push({ rect, color: solidColor, type: 'R' });
            else others.push({ rect, color: solidColor, type: 'O' });

            if ((isA && isOverlayEnabled('overlay-team-a')) || 
                (isB && isOverlayEnabled('overlay-team-b')) || 
                (!isR && !isA && !isB && !first)
            ) {
                cv.rectangle(src, point1, point2, solidColor, 4);

                const teamANameInput = document.getElementById('team-a-name').value.trim() || 'Team A';
                const teamBNameInput = document.getElementById('team-b-name').value.trim() || 'Team B';
                const text = isA ? teamANameInput : isB ? teamBNameInput : '';
                const textOrg = new cv.Point(point1.x - 15, point1.y - 10);

                cv.putText(
                    src,
                    text,
                    textOrg,
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    colorBorderText,
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
            let indexA = teamLeftCluster == centersFreq[0][0] ? 0 : 1;
            let indexB = teamLeftCluster == centersFreq[0][0] ? 1 : 0;

            clusterA = centersFreq[indexA][0];
            clusterB = centersFreq[indexB][0];

            colorA[0] = mergedCenters[centersFreq[indexA][0]][0] | 0;
            colorA[1] = mergedCenters[centersFreq[indexA][0]][1] | 0;
            colorA[2] = mergedCenters[centersFreq[indexA][0]][2] | 0;

            colorB[0] = mergedCenters[centersFreq[indexB][0]][0] | 0;
            colorB[1] = mergedCenters[centersFreq[indexB][0]][1] | 0;
            colorB[2] = mergedCenters[centersFreq[indexB][0]][2] | 0;

            clusterR = centersFreq[2][0];

            colorR[0] = mergedCenters[centersFreq[2][0]][0] | 0;
            colorR[1] = mergedCenters[centersFreq[2][0]][1] | 0;
            colorR[2] = mergedCenters[centersFreq[2][0]][2] | 0;

            let colorAvg = [ (colorA[0] + colorB[0]) / 2, (colorA[1] + colorB[1]) / 2, (colorA[2] + colorB[2]) / 2 ];

            console.log('Color A:', colorA);
            console.log('Color B:', colorB);
            console.log('Color R:', colorR, 'Color Avg:', colorAvg);

            if (distRgb(colorR, colorAvg) < threshold && centersFreq.length >= 4) {
                clusterR = centersFreq[3][0];

                colorR[0] = mergedCenters[centersFreq[3][0]][0] | 0;
                colorR[1] = mergedCenters[centersFreq[3][0]][1] | 0;
                colorR[2] = mergedCenters[centersFreq[3][0]][2] | 0;

                console.log('Color R:', colorR);
            }

            first = true;

            console.log('Cluster A:', clusterA, 'Color A:', colorA);
            console.log('Cluster B:', clusterB, 'Color B:', colorB);

            candidates.forEach(({ rect, color }) => {
                const x = [color[0], color[1], color[2]];
                const aC = [colorA[0], colorA[1], colorA[2]];
                const bC = [colorB[0], colorB[1], colorB[2]];

                let isATeam = false, isBTeam = false;

                if (distRgb(x, aC) < threshold) {
                    isATeam = true;
                    r = colorA[0];
                    g = colorA[1];
                    b = colorA[2];
                }
                else if (distRgb(x, bC) < threshold) {
                    isBTeam = true;
                    r = colorB[0];
                    g = colorB[1];
                    b = colorB[2];
                }
                
                if (isATeam)
                    teamA.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height });
                else if (isBTeam)
                    teamB.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height });
            });
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
        if (isOverlayEnabled('overlay-referee')) {
            const point1 = new cv.Point(referees[minIndex].rect.x - offset, referees[minIndex].rect.y - offset);
            const point2 = new cv.Point(referees[minIndex].rect.x + referees[minIndex].rect.width + offset, referees[minIndex].rect.y + referees[minIndex].rect.height + offset);

            cv.rectangle(src, point1, point2, referees[minIndex].color, 4);

            const text = 'Referee';
            const textOrg = new cv.Point(point1.x - 15, point1.y - 10);

            cv.putText(
                src,
                text,
                textOrg,
                cv.FONT_HERSHEY_SIMPLEX,
                0.6,
                colorBorderText,
                4,
                cv.LINE_AA
            );

            cv.putText(
                src,
                text,
                textOrg,
                cv.FONT_HERSHEY_SIMPLEX,
                0.6,
                referees[minIndex].color,
                2,
                cv.LINE_AA
            );
        }
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

    frameBallCenter = null;

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
    frameBallCenter = { x: rect.x + (rect.width / 2), y: rect.y + (rect.height / 2) };

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

function isPlayerCandidate(contour) {
    const rect = cv.boundingRect(contour);
    const contourArea = cv.contourArea(contour);
    const rectArea = rect.width * rect.height;
    const aspectRatio = rect.width / rect.height;
    const fillRatio = rectArea > 0 ? contourArea / rectArea : 0;

    if ((rect.width * 6) < rect.height) return false;
    if ((rect.height * 3) < rect.width) return false;
    if (rect.width > 200 || rect.height > 200) return false;

    if (first) {
        if (rectArea < 110) return false;
        if (contourArea < 70) return false;
        if (fillRatio < 0.26) return false;
        if (aspectRatio > 3.2) return false;
    }

    const margin = !first ? 50 : 20;
    const rightBottom = new cv.Point(rect.x + rect.width, rect.y + rect.height);

    if (rightBottom.y + margin > canvasHeight) return false;

    return true;
}

function isBallCandidate(contour) {
    const area = cv.contourArea(contour);

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

function isDepthCorrectionEnabled() {
    const control = document.getElementById('toggle-depth-correction');
    return !control || control.checked;
}

function estimateFormation(points, options = {}) {
    const {
        attackDirection = 'leftToRight',
        candidates = [
            [4, 3, 3],
            [4, 2, 3, 1],
            [4, 4, 2],
            [3, 4, 3],
            [3, 5, 2],
            [4, 1, 4, 1],
            [5, 3, 2],
            [5, 4, 1],
            [5, 1, 3, 1],
            [3, 4, 2, 1],
            [3, 1, 5, 1],
            [3, 1, 4, 2],
            [3, 2, 4, 1],
            [3, 2, 3, 2],
            [2, 4, 3, 1],
            [1, 3, 4, 2],
            [1, 3, 3, 3],
            [2, 2, 3, 3],
            [2, 2, 4, 2],
        ]
    } = options;

    if (!Array.isArray(points) || points.length !== 10) {
        // throw new Error('Se esperan exactamente 10 jugadores de campo.');
    }

    const xs = points.map((point) => point.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const players = points.map((point) => {
        const depth = attackDirection === 'rightToLeft' ? maxX - point.x : point.x - minX;
        return { ...point, depth };
    });

    players.sort((a, b) => a.depth - b.depth);

    const results = candidates.map((shape) => {
        const lines = splitPlayersByShape(players, shape);
        const score = scoreShape(lines);

        return {
            formation: shape.join('-'),
            score,
            lines
        };
    });

    results.sort((a, b) => a.score - b.score);

    return {
        bestFormation: results[0].formation,
        bestScore: results[0].score,
        ranking: results
    };
}

function splitPlayersByShape(players, shape) {
    const lines = [];
    let start = 0;

    for (const size of shape) {
        const linePlayers = players.slice(start, start + size);
        lines.push(linePlayers);
        start += size;
    }

    return lines;
}

function scoreShape(lines) {
    let compactnessPenalty = 0;
    let separationReward = 0;
    let balancePenalty = 0;
    const useDepthCorrection = isDepthCorrectionEnabled();

    let correctedLines = lines.map((line) =>
        line.map((player) => ({
            ...player,
            depthCorrected: player.depth
        }))
    );

    if (useDepthCorrection) {
        const allPlayers = lines.flat();
        const meanYAll = mean(allPlayers.map((player) => player.y));
        const meanDepthAll = mean(allPlayers.map((player) => player.depth));

        let covDepthY = 0;
        let varY = 0;

        for (const player of allPlayers) {
            const dy = player.y - meanYAll;
            const dd = player.depth - meanDepthAll;
            covDepthY += dy * dd;
            varY += dy * dy;
        }

        let perspectiveSlope = varY > 1e-6 ? covDepthY / varY : 0;

        correctedLines = lines.map((line) =>
            line.map((player) => ({
                ...player,
                depthCorrected: player.depth - perspectiveSlope * (player.y - meanYAll)
            }))
        );
    } else {
        correctedLines = lines.map((line) =>
            line.map((player) => ({
                ...player,
                depthCorrected: player.depth
            }))
        );
    }

    const centers = correctedLines.map((line) => mean(line.map((player) => player.depthCorrected)));

    for (const line of correctedLines) {
        const depths = line.map((player) => player.depthCorrected);
        const ys = line.map((player) => player.y);

        compactnessPenalty += variance(depths) * 1.5;

        if (line.length >= 2) {
            const ySpread = Math.max(...ys) - Math.min(...ys);

            if (ySpread < 35)
                balancePenalty += (35 - ySpread) * 0.6;
        }
    }

    for (let i = 1; i < centers.length; i++) {
        const gap = centers[i] - centers[i - 1];

        if (gap <= 0) {
            separationReward -= 1000;
            continue;
        }

        separationReward += Math.min(gap, 140) * 2;

        if (gap < 20)
            balancePenalty += (20 - gap) * 4;
    }

    let result = compactnessPenalty + balancePenalty - separationReward;

    if (isNaN(result))
        result = 100000;

    return result;
}

function mean(values) {
    return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function variance(values) {
    const avg = mean(values);
    return values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
}

// --- Heatmap --- //
function setHomographyStatus(message) {
    const statusLabel = document.getElementById('homography-status');

    if (statusLabel)
        statusLabel.textContent = message;
}

function getCanvasPointFromEvent(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function rebuildHomographyFromImagePoints(imagePoints) {
    const matrix = buildHomographyMatrix(imagePoints, homographyFieldPoints);

    if (!matrix)
        return false;

    if (homographyMatrix)
        homographyMatrix.delete();

    homographyMatrix = matrix;
    rebuildTrackedPointsMat();

    if (homographyPrevGray) {
        homographyPrevGray.delete();
        homographyPrevGray = null;
    }

    return true;
}

function buildHomographyMatrix(imagePoints, fieldPoints) {
    if (!Array.isArray(imagePoints) || imagePoints.length !== 4)
        return null;

    const srcData = [];
    const dstData = [];

    for (let i = 0; i < 4; i++) {
        srcData.push(imagePoints[i].x, imagePoints[i].y);
        dstData.push(fieldPoints[i].x, fieldPoints[i].y);
    }

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, srcData);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, dstData);
    let matrix = null;

    try {
        matrix = cv.getPerspectiveTransform(srcPts, dstPts);
    } catch (error) {
        matrix = null;
    }

    srcPts.delete();
    dstPts.delete();

    if (!matrix || matrix.rows !== 3 || matrix.cols !== 3)
        return null;

    return matrix;
}

function rebuildTrackedPointsMat() {
    if (homographyTrackedPoints) {
        homographyTrackedPoints.delete();
        homographyTrackedPoints = null;
    }

    if (!homographyImagePoints || homographyImagePoints.length !== 4)
        return;

    const data = [];

    for (const point of homographyImagePoints)
        data.push(point.x, point.y);

    homographyTrackedPoints = cv.matFromArray(4, 1, cv.CV_32FC2, data);
}

function updateHomographyTracking(src) {
    if (!homographyMatrix || !homographyTrackedPoints) return;
    if (typeof cv.calcOpticalFlowPyrLK !== 'function') return;

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    if (!homographyPrevGray) {
        homographyPrevGray = gray.clone();
        gray.delete();
        return;
    }

    const nextPoints = new cv.Mat();
    const status = new cv.Mat();
    const err = new cv.Mat();

    cv.calcOpticalFlowPyrLK(
        homographyPrevGray,
        gray,
        homographyTrackedPoints,
        nextPoints,
        status,
        err
    );

    const updatedPoints = [];
    let validPoints = 0;

    for (let i = 0; i < 4; i++) {
        const valid = status.ucharAt(i, 0) === 1;
        const x = nextPoints.data32F[i * 2];
        const y = nextPoints.data32F[(i * 2) + 1];

        if (valid && Number.isFinite(x) && Number.isFinite(y)) {
            const snappedPoint = snapPointToFieldStripe({ x, y });
            updatedPoints.push(snappedPoint || { x, y });
            validPoints++;
        }
    }

    if (validPoints === 4) {
        homographyImagePoints = updatedPoints;

        const updatedMatrix = buildHomographyMatrix(homographyImagePoints, homographyFieldPoints);

        if (updatedMatrix) {
            if (homographyMatrix)
                homographyMatrix.delete();

            homographyMatrix = updatedMatrix;

            if (homographyTrackedPoints)
                homographyTrackedPoints.delete();

            homographyTrackedPoints = nextPoints.clone();
        }
    }

    if (homographyPrevGray)
        homographyPrevGray.delete();

    homographyPrevGray = gray.clone();

    nextPoints.delete();
    status.delete();
    err.delete();
    gray.delete();
}

function projectPointToField(point) {
    if (!homographyMatrix || !point) return null;

    const srcPoint = cv.matFromArray(1, 1, cv.CV_32FC2, [point.x, point.y]);
    const dstPoint = new cv.Mat();

    cv.perspectiveTransform(srcPoint, dstPoint, homographyMatrix);

    const x = dstPoint.data32F[0];
    const y = dstPoint.data32F[1];

    srcPoint.delete();
    dstPoint.delete();

    if (!Number.isFinite(x) || !Number.isFinite(y))
        return null;

    return { x, y };
}

function updateLinearHeatHistogramFromFrame() {
    linearHeatHistogram = linearHeatHistogram.map((value) => value * LINEAR_HEAT_DECAY);

    const samples = [];

    if (frameBallCenter)
        samples.push({ point: frameBallCenter, weight: 3.0 });

    for (const player of framePlayers)
        samples.push({ point: player, weight: 0.75 });

    for (const sample of samples) {
        const fieldPoint = projectPointToField(sample.point);

        if (!fieldPoint) continue;
        if (fieldPoint.x < -8 || fieldPoint.x > FIELD_WIDTH_METERS + 8) continue;

        const normalizedX = Math.max(0, Math.min(0.9999, fieldPoint.x / FIELD_WIDTH_METERS));
        const index = Math.floor(normalizedX * LINEAR_HEAT_BINS);

        linearHeatHistogram[index] += sample.weight;
    }
}

function getHeatColor(t) {
    const value = Math.max(0, Math.min(1, t));

    const r = Math.round(40 + (215 * value));
    const g = Math.round(55 + (95 * Math.max(0, 1 - Math.abs(value - 0.5) * 2)));
    const b = Math.round(135 - (95 * value));

    return [r, g, b, 255];
}

function detectFieldWhiteStripes(src) {
    const shouldDetect = isOverlayEnabled('overlay-field-stripes') || homographyMode || !!homographyMatrix;

    if (!shouldDetect) {
        fieldStripeLines = [];
        fieldStripeCoverage = 0;
        return;
    }

    const rgb = new cv.Mat();
    const hsv = new cv.Mat();
    const whiteMask = new cv.Mat();
    const greenMask = new cv.Mat();
    const whiteOnField = new cv.Mat();
    const edges = new cv.Mat();
    const lines = new cv.Mat();

    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV, 0);

    const lowerWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 170, 0]);
    const upperWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 70, 255, 255]);
    const lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [30, 20, 40, 0]);
    const upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [95, 255, 255, 255]);

    cv.inRange(hsv, lowerWhite, upperWhite, whiteMask);
    cv.inRange(hsv, lowerGreen, upperGreen, greenMask);

    const kernelField = cv.Mat.ones(9, 9, cv.CV_8U);
    cv.dilate(greenMask, greenMask, kernelField);
    cv.erode(greenMask, greenMask, kernelField);
    cv.erode(greenMask, greenMask, kernelField);
    cv.dilate(greenMask, greenMask, kernelField);
    cv.dilate(greenMask, greenMask, kernelField);
    
    cv.bitwise_and(whiteMask, greenMask, whiteOnField);

    const kernelClean = cv.Mat.ones(3, 3, cv.CV_8U);
    // cv.morphologyEx(whiteOnField, whiteOnField, cv.MORPH_OPEN, kernelClean);
    // cv.morphologyEx(whiteOnField, whiteOnField, cv.MORPH_CLOSE, kernelClean);

    cv.Canny(whiteOnField, edges, 60, 130, 3, false);//here
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 28, 20, 12);

    processSteps(0, edges);

    const linesDetected = [];

    for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4];
        const y1 = lines.data32S[(i * 4) + 1];
        const x2 = lines.data32S[(i * 4) + 2];
        const y2 = lines.data32S[(i * 4) + 3];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy);

        if (length < 24) continue;

        linesDetected.push({ x1, y1, x2, y2, length });
    }

    const whitePixels = cv.countNonZero(whiteOnField);
    const totalPixels = whiteOnField.rows * whiteOnField.cols;

    fieldStripeCoverage = totalPixels > 0 ? whitePixels / totalPixels : 0;
    fieldStripeLines = linesDetected;

    rgb.delete();
    hsv.delete();
    whiteMask.delete();
    greenMask.delete();
    whiteOnField.delete();
    edges.delete();
    lines.delete();
    lowerWhite.delete();
    upperWhite.delete();
    lowerGreen.delete();
    upperGreen.delete();
    kernelField.delete();
    kernelClean.delete();
}

function drawFieldStripeDebug(src) {
    if (!isOverlayEnabled('overlay-field-stripes') && !homographyMode) return;

    for (const line of fieldStripeLines) {
        cv.line(
            src,
            new cv.Point(line.x1, line.y1),
            new cv.Point(line.x2, line.y2),
            [0, 0, 0, 255],
            2,
            cv.LINE_AA
        );
    }

    if (homographyImagePoints.length === 4) {
        for (let i = 0; i < 4; i++) {
            const a = homographyImagePoints[i];
            const b = homographyImagePoints[(i + 1) % 4];

            cv.line(
                src,
                new cv.Point(Math.round(a.x), Math.round(a.y)),
                new cv.Point(Math.round(b.x), Math.round(b.y)),
                [0, 220, 255, 255],
                2,
                cv.LINE_AA
            );
        }
    }

    for (let i = 0; i < homographyImagePoints.length; i++) {
        const point = homographyImagePoints[i];
        const color = i < 4 ? [0, 220, 255, 255] : [180, 180, 180, 255];

        cv.circle(src, new cv.Point(Math.round(point.x), Math.round(point.y)), 6, colorBorderText, cv.FILLED, cv.LINE_AA);
        cv.circle(src, new cv.Point(Math.round(point.x), Math.round(point.y)), 5, color, cv.FILLED, cv.LINE_AA);
    }

    const debugText = `Lineas campo: ${fieldStripeLines.length} | Cobertura blanca: ${(fieldStripeCoverage * 100).toFixed(2)}%`;
    const textPos = new cv.Point(10, canvasHeight - 10);

    cv.putText(src, debugText, textPos, cv.FONT_HERSHEY_SIMPLEX, 0.52, [0, 0, 0, 255], 4, cv.LINE_AA);
    cv.putText(src, debugText, textPos, cv.FONT_HERSHEY_SIMPLEX, 0.52, [255, 255, 255, 255], 2, cv.LINE_AA);
}

function snapPointToFieldStripe(point, radius = snapRadius) {
    if (!fieldStripeLines || fieldStripeLines.length === 0)
        return null;

    let bestPoint = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const line of fieldStripeLines) {
        const nearest = nearestPointOnSegment(point, line);

        if (nearest.distance < bestDistance) {
            bestDistance = nearest.distance;
            bestPoint = nearest.point;
        }
    }

    if ((snapRadius >= 600 ? false : bestDistance > radius) || !bestPoint)
        return null;

    return bestPoint;
}

function nearestPointOnSegment(point, segment) {
    const ax = segment.x1;
    const ay = segment.y1;
    const bx = segment.x2;
    const by = segment.y2;
    const abx = bx - ax;
    const aby = by - ay;
    const apx = point.x - ax;
    const apy = point.y - ay;
    const denom = (abx * abx) + (aby * aby);

    let t = denom > 0 ? ((apx * abx) + (apy * aby)) / denom : 0;
    t = Math.max(0, Math.min(1, t));

    const x = ax + (abx * t);
    const y = ay + (aby * t);
    const dx = point.x - x;
    const dy = point.y - y;

    return {
        point: { x, y },
        distance: Math.hypot(dx, dy)
    };
}
