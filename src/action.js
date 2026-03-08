
let colorA = [ 0, 0, 0, 255 ];
let colorB = [ 0, 0, 0, 255 ];
let colorR = [ 0, 0, 0, 255 ];
let clusterA = -1;
let clusterB = -1;
let clusterR = -1;
let count = 0;
let first = false;

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video-input');
    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    let animationId = null;
    let isProcessing = false;

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
    const canvas = document.getElementById('canvas-output');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function processVideo(video, canvas, ctx, shouldContinue, setAnimationId) {
    if (!shouldContinue() || video.paused || video.ended) return;
    // 1. Get current frame from video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // 2. Create Mat OpenvCv src and dst
    let src = cv.imread(canvas);
    let dst = new cv.Mat();
    // 3. Process current frame (image)
    processImage(src, dst);
    // 4. Show the result on the canvas
    cv.imshow(canvas, src);
    // 5. Free memory
    src.delete();
    dst.delete();
    // 6. Call the next frame
    const id = requestAnimationFrame(() => processVideo(video, canvas, ctx, shouldContinue, setAnimationId));
    setAnimationId(id);
}

function processImage(src, dst) {
    processPlayers(src, dst);
    // processReferee(src, dst);

    // averageCv(cv, src, dst);
    // removeFieldCv(cv, src, dst);
    // averageCv(cv, dst, dst);
    // kMeansColorCv(cv, dst);
    // popularityCv(cv, dst, dst);

    // contoursCv(cv, src, dst);
    // dst.copyTo(src);
}

function processSteps(step, dst) {
    const element = document.getElementById(`view-step-${step}`);
    const canvas = document.getElementById(`canvas-step-${step}`);

    if (element.checked)
        cv.imshow(canvas, dst);
}

function processPlayers(src, dst) {
    umbralGreenCv(cv, src, dst); processSteps(1, dst);
    morfologyCv(cv, dst, 5);  processSteps(2, dst);
    maskGreenFieldCv(cv, dst);  processSteps(3, dst);
    contoursPlayersCv(cv, src, dst); processSteps(4, dst);
}

function averageCv(cv, src, dst) {
    // cv.blur(src, dst, new cv.Size(7, 7), new cv.Point(-1, -1), cv.BORDER_DEFAULT);
    cv.medianBlur(src, dst, 7);
}

function umbralGreenCv(cv, src, dst) {
    let rgb = new cv.Mat();
    let hsv = new cv.Mat();
    let maskGreen = new cv.Mat();

    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV, 0);

    let lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [40, 20, 60, 0]);
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
        let contour = contours.get(i);
        let rect = cv.boundingRect(contour);
        let contourArea = cv.contourArea(contour);
        let rectArea = rect.width * rect.height;
        let aspectRatio = rect.width / rect.height;
        let fillRatio = rectArea > 0 ? contourArea / rectArea : 0;

        let condition = ((rect.width * 6) < rect.height) || 
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

        let indexUnion1 = -1;
        let indexUnion2 = -1;

        const threshold = 50;
        const dist = (a, b) => {
                const dr = a[0] - b[0];
                const dg = a[1] - b[1];
                const db = a[2] - b[2];
                return Math.sqrt(dr * dr + dg * dg + db * db);
            };

        if (!first) {
            for (let i = 0; i < centers.rows; i++) {
                for (let j = i + 1; j < centers.rows; j++) {
                    const a = [centers.floatAt(i, 0), centers.floatAt(i, 1), centers.floatAt(i, 2)];
                    const b = [centers.floatAt(j, 0), centers.floatAt(j, 1), centers.floatAt(j, 2)];

                    if (dist(a, b) < threshold) {
                        indexUnion1 = i;
                        indexUnion2 = j;
                    }
                }
            }
        }

        let centersFreq = [
            [0, 0], 
            [0, 0],
            [0, 0],
            [0, 0]
        ];

        for (let i = 0; i < n; i++) {
            const rect = candidates[i].rect;
            const point1 = new cv.Point(rect.x - offset, rect.y - offset);
            const point2 = new cv.Point(rect.x + rect.width + offset, rect.y + rect.height + offset);

            let cluster;

            if (labels.intAt(i, 0) === indexUnion2)
                cluster = indexUnion1;
            else cluster = labels.intAt(i, 0);

            centersFreq[cluster][0] = cluster;
            centersFreq[cluster][1]++;

            let r = centers.floatAt(cluster, 0) | 0;
            let g = centers.floatAt(cluster, 1) | 0;
            let b = centers.floatAt(cluster, 2) | 0;

            let isA = false, isB = false, isR = false;

            if (first) {
                const x = [r, g, b];
                const aC = [colorA[0], colorA[1], colorA[2]];
                const bC = [colorB[0], colorB[1], colorB[2]];
                const rC = [colorR[0], colorR[1], colorR[2]];

                if (dist(x, aC) < threshold) {
                    isA = true;
                    r = colorA[0];
                    g = colorA[1];
                    b = colorA[2];
                }
                if (dist(x, bC) < threshold) {
                    isB = true;
                    r = colorB[0];
                    g = colorB[1];
                    b = colorB[2];
                }
                if (dist(x, rC) < threshold) {
                    isR = true;
                    r = colorR[0];
                    g = colorR[1];
                    b = colorR[2];
                }
            }

            const solidColor = intensityColorContrast(r, g, b);//[r, g, b, 255]

            if (isA || isB || isR)
                cv.rectangle(src, point1, point2, solidColor, 4);

            const text = isA ? 'Team A' : isB ? 'Team B' : isR ? 'Referee' : '';
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

        if (indexUnion2 !== -1)
            centersFreq[indexUnion2][0] = indexUnion2;

        centersFreq.sort((a, b) => b[1] - a[1]);

        if (!first) {
            clusterA = centersFreq[0][0];
            clusterB = centersFreq[1][0];

            colorA[0] = centers.floatAt(centersFreq[0][0], 0) | 0;
            colorA[1] = centers.floatAt(centersFreq[0][0], 1) | 0;
            colorA[2] = centers.floatAt(centersFreq[0][0], 2) | 0;

            colorB[0] = centers.floatAt(centersFreq[1][0], 0) | 0;
            colorB[1] = centers.floatAt(centersFreq[1][0], 1) | 0;
            colorB[2] = centers.floatAt(centersFreq[1][0], 2) | 0;

            clusterR = centersFreq[2][0];

            colorR[0] = centers.floatAt(centersFreq[2][0], 0) | 0;
            colorR[1] = centers.floatAt(centersFreq[2][0], 1) | 0;
            colorR[2] = centers.floatAt(centersFreq[2][0], 2) | 0;
        }

        first = true;

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

    contours.delete();
    hierarchy.delete();
}

function removeFieldCv(cv, src, dst) {
    let mask = new cv.Mat();
    cv.bitwise_and(src, src, mask, dst);
    mask.copyTo(dst);
    mask.delete();
}

function kMeansColorCv(cv, dst) {
    let maxIter = 3;
    let k = 10;

    cv.cvtColor(dst, dst, cv.COLOR_RGBA2RGB, 0);

    let rows = dst.rows, cols = dst.cols;
    // let arr = [];

    // for (let i = 0; i < rows; i++) {
        // for (let j = 0; j < cols; j++) {
            // let pixel = dst.ucharPtr(i, j);
            // arr.push(pixel[0], pixel[1], pixel[2]);
        // }
    // }

    // let matrix = cv.matFromArray(rows * cols, 3, cv.CV_32F, arr);
    let samples = cv.matFromArray(rows * cols, 3, cv.CV_8U, dst.data);
    let matrix = new cv.Mat();
    samples.convertTo(matrix, cv.CV_32F);

    let labels = new cv.Mat();
    let centers = new cv.Mat();

    cv.kmeans(
        matrix,
        k,
        labels,
        new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, maxIter, 1.0),
        3,
        cv.KMEANS_PP_CENTERS,
        // cv.KMEANS_RANDOM_CENTERS,
        centers
    );

    // Crear la imagen resultante
    let newImg = new cv.Mat(rows, cols, dst.type());
    // let idx = 0;

    // for (let i = 0; i < rows; i++) {
        // for (let j = 0; j < cols; j++, idx++) {
            // let centerIdx = labels.intAt(idx, 0);
            // let pixel = newImg.ucharPtr(i, j);
            // pixel[0] = centers.floatAt(centerIdx, 0);
            // pixel[1] = centers.floatAt(centerIdx, 1);
            // pixel[2] = centers.floatAt(centerIdx, 2);
        // }
    // }

    const labelsData = labels.data32S;     // N labels
    const centersData = centers.data32F;   // k*3 (RGB)
    const out = newImg.data;               // Uint8Array, tamaño N*3
    const total = rows * cols;

    for (let i = 0; i < total; i++) {
        const c = labelsData[i] * 3;
        const o = i * 3;

        out[o]     = centersData[c]     | 0;
        out[o + 1] = centersData[c + 1] | 0;
        out[o + 2] = centersData[c + 2] | 0;
    }

    samples.delete();
    matrix.delete();
    labels.delete();
    centers.delete();
    newImg.copyTo(dst);
    newImg.delete();
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

    // Union-Find
    const parent = Array.from({ length: k }, (_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const union = (a, b) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[rb] = ra;
    };

    const center = (i) => [
        centers.floatAt(i, 0),
        centers.floatAt(i, 1),
        centers.floatAt(i, 2)
    ];

    const dist = (a, b) => {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    // 1) Unir clusters cercanos
    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            if (dist(center(i), center(j)) < threshold) {
                union(i, j);
            }
        }
    }

    // 2) Contar cuántas muestras tiene cada cluster original
    const counts = new Array(k).fill(0);
    for (let i = 0; i < labelsData.length; i++) counts[labelsData[i]]++;

    // 3) Construir centroides fusionados (promedio ponderado por cantidad)
    const rootAcc = new Map(); // root -> {sumR,sumG,sumB,total}
    for (let i = 0; i < k; i++) {
        const root = find(i);
        const c = center(i);
        const w = counts[i] || 0;
        if (!rootAcc.has(root)) rootAcc.set(root, { sumR: 0, sumG: 0, sumB: 0, total: 0 });
        const acc = rootAcc.get(root);
        acc.sumR += c[0] * w;
        acc.sumG += c[1] * w;
        acc.sumB += c[2] * w;
        acc.total += w;
    }

    // 4) Reindexar grupos fusionados a [0..m-1]
    const roots = Array.from(rootAcc.keys());
    const rootToNew = new Map();
    roots.forEach((r, idx) => rootToNew.set(r, idx));

    const mergedCenters = roots.map((r) => {
        const a = rootAcc.get(r);
        const denom = a.total || 1;
        return [
            (a.sumR / denom) | 0,
            (a.sumG / denom) | 0,
            (a.sumB / denom) | 0
        ];
    });

    // old cluster -> new cluster
    const oldToNew = new Array(k);
    for (let i = 0; i < k; i++) oldToNew[i] = rootToNew.get(find(i));

    // 5) Remap labels en sitio
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
    // Tiny ball in wide shots usually appears as very small blobs.
    if (area < 4 || area > 180) return false;
    
    const peri = cv.arcLength(contour, true);
    if (peri <= 0) return false;
    
    const circularity = (4 * Math.PI * area) / (peri * peri);
    // Relax circularity for pixelated small contours.
    if (circularity < 0.35) return false;
    
    const r = cv.boundingRect(contour);
    const ratio = r.width / r.height;

    if (ratio < 0.55 || ratio > 1.8) return false;
    if (r.width > 24 || r.height > 24) return false;

    // Keep console clean during frame processing.
    // console.log(`Ball candidate: area=${area.toFixed(2)}, peri=${peri.toFixed(2)}, circularity=${circularity.toFixed(2)}, ratio=${ratio.toFixed(2)}`);

  return true;
}