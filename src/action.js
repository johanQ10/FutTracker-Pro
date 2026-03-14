
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
let teamA = [];
let teamB = [];

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
        // video.play();
    });

    setupPlaybackControls(video);

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
    teamA = [];
    teamB = [];

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

    processBall(srcBall, dstBall);
    processPlayers(src, dst);
    processBallPossession(src);
    processLineUp(src);

    srcBall.delete();
    dstBall.delete();
    dst.delete();
}

function processSteps(step, dst) {
    const element = document.getElementById(`view-step-${step}`);
    const canvas = document.getElementById(`canvas-step-${step}`);

    if (element.checked)
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
    const textR = 'Referees';

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
        [255, 255, 255, 255],
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
        [255, 255, 255, 255],
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
        [255, 255, 255, 255],
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

    console.log('Equipo A:', resultA.bestFormation, resultA.ranking);
    console.log('Equipo B:', resultB.bestFormation, resultB.ranking);

    const textA = resultA.bestFormation || '0-0-0';
    const textB = resultB.bestFormation || '0-0-0';

    cv.putText(
        src,
        textA,
        textPosA,
        fontType,
        scaleFont,
        [255, 255, 255, 255],
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
        [255, 255, 255, 255],
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

        let threshold = 60;

        const { mergedCenters, mergedK } = mergeSimilarClusters(labels, centers, threshold);
        let centersFreq = Array.from({ length: mergedK }, (_, i) => [i, 0]);

        let teamLeftCluster = -1;
        let minX = canvasWidth;

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

            if (isA) players.push({ rect, color: solidColor, type: 'A' });
            else if (isB) players.push({ rect, color: solidColor, type: 'B' });
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
            clusterA = centersFreq[teamLeftCluster][0];
            clusterB = centersFreq[teamLeftCluster === 0 ? 1 : 0][0];

            colorA[0] = mergedCenters[centersFreq[teamLeftCluster][0]][0] | 0;
            colorA[1] = mergedCenters[centersFreq[teamLeftCluster][0]][1] | 0;
            colorA[2] = mergedCenters[centersFreq[teamLeftCluster][0]][2] | 0;

            colorB[0] = mergedCenters[centersFreq[teamLeftCluster === 0 ? 1 : 0][0]][0] | 0;
            colorB[1] = mergedCenters[centersFreq[teamLeftCluster === 0 ? 1 : 0][0]][1] | 0;
            colorB[2] = mergedCenters[centersFreq[teamLeftCluster === 0 ? 1 : 0][0]][2] | 0;

            clusterR = centersFreq[2][0];

            colorR[0] = mergedCenters[centersFreq[2][0]][0] | 0;
            colorR[1] = mergedCenters[centersFreq[2][0]][1] | 0;
            colorR[2] = mergedCenters[centersFreq[2][0]][2] | 0;

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

    console.log('Compactness Penalty:', compactnessPenalty.toFixed(2));
    console.log('Separation Reward:', separationReward.toFixed(2));
    console.log('Balance Penalty:', balancePenalty.toFixed(2));
    return compactnessPenalty + balancePenalty - separationReward;
}

function mean(values) {
    return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function variance(values) {
    const avg = mean(values);
    return values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
}