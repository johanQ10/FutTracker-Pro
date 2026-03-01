let playersP1 = new Array(20);
let playersP2 = new Array(20);

let colorR = 0;
let colorG = 0;
let colorB = 0;
let sumColorR = 0;
let sumColorG = 0;
let sumColorB = 0;
let count = 0;
let first = false;

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('videoInput');
    const canvas = document.getElementById('canvasOutput');
    const ctx = canvas.getContext('2d');
    let animationId = null;
    let isProcessing = false;

    function startProcessing() {
        if (isProcessing) return;
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

        video.src = URL.createObjectURL(file);
        video.play();
    });

    video.addEventListener('play', () => {
        console.log('Video: play');
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
});

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
    // averageCv(cv, src, dst);
    umbralGreenCv(cv, src, dst);
    morfologyCv(cv, dst);
    maskGreenFieldCv(cv, dst);
    removeContoursExtrasCv(cv, src, dst);
    removeFieldCv(cv, src, dst);
    // averageCv(cv, dst, dst);
    // kMeansColorCv(cv, dst);
    // popularityCv(cv, dst, dst);

    // contoursCv(cv, src, dst);
    // dst.copyTo(src);
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

    let lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [40, 70, 60, 0]);
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

function morfologyCv(cv, dst) {
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, kernel);
    cv.morphologyEx(dst, dst, cv.MORPH_OPEN, kernel);
    kernel.delete();
}

function maskGreenFieldCv(cv, dst) {
    cv.bitwise_not(dst, dst);
}

function removeContoursExtrasCv(cv, src, dst) {
    let type = document.querySelector('input[name="vista"]:checked')?.value || 'lateral';

    // Pseudocódigo de detección de movimiento/objetos tradicional
    let hsv = new cv.Mat();

    cv.cvtColor(dst, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);
        let rect = cv.boundingRect(contour);
        let contourArea = cv.contourArea(contour);
        let rectArea = rect.width * rect.height;
        let aspectRatio = rect.width / rect.height;
        let fillRatio = rectArea > 0 ? contourArea / rectArea : 0;

        let isLateral = (type === 'lateral');
        let condition;

        if (isLateral)
            condition = ((rect.width * 6) < rect.height) || 
                ((rect.height * 3) < rect.width) || 
                (rect.width > 200 || rect.height > 200) ||
                (rect.height < 12) ||
                (rectArea < 110) ||
                (contourArea < 70) ||
                (fillRatio < 0.26) ||
                (aspectRatio > 3.2);
        else 
            condition = (rect.width > 100 || rect.height > 100);

        if (condition)
            cv.drawContours(dst, contours, i, new cv.Scalar(0, 0, 0, 255), cv.FILLED);
        else {
            const offset = 5;
            let point1 = new cv.Point(rect.x - offset, rect.y - offset);
            let point2 = new cv.Point(rect.x + rect.width + offset, rect.y + rect.height + offset);

            const mask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
            const one = new cv.MatVector();
            one.push_back(contour);

            cv.drawContours(mask, one, 0, new cv.Scalar(255), cv.FILLED);

            let median = new cv.Mat();
            // cv.medianBlur(src, median, 3);

            const mean = cv.mean(src, mask);
            let color;

            if (!first) {
                color = [mean[0] | 0, mean[1] | 0, mean[2] | 0, 255];

                sumColorR += color[0];
                sumColorG += color[1];
                sumColorB += color[2];
                count++;
            } else {
                color = [colorR, colorG, colorB, 255];
            }

            cv.rectangle(src, point1, point2, color, 4);

            median.delete();
            one.delete();
            mask.delete();
        }

        contour.delete();
    }

    if (!first) {
        colorR = (sumColorR / count) | 0;
        colorG = (sumColorG / count) | 0;
        colorB = (sumColorB / count) | 0;
    }

    // first = true;

    hsv.delete();
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

function popularityCv(cv, src, dst) {
    let popularity = 300;

    cv.cvtColor(src, dst, cv.COLOR_RGBA2RGB, 0);

    let colorMap = new Map();

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            let pixel = dst.ucharPtr(i, j);
            let key = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
    }

    let palette = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, popularity)
        .map(e => e[0].split(',').map(Number));

    for (let i = 0; i < src.rows; i++) {
        for (let j = 0; j < src.cols; j++) {
            let pixel = dst.ucharPtr(i, j);
            let minDist = Infinity, idx = 0;

            for (let k = 0; k < palette.length; k++) {
                let dr = pixel[0] - palette[k][0];
                let dg = pixel[1] - palette[k][1];
                let db = pixel[2] - palette[k][2];
                let dist = dr * dr + dg * dg + db * db;

                if (dist < minDist) {
                    minDist = dist;
                    idx = k;
                }
            }

            pixel[0] = palette[idx][0];
            pixel[1] = palette[idx][1];
            pixel[2] = palette[idx][2];
        }
    }
}

function contoursCv(cv, src, dst) {
    let type = document.querySelector('input[name="vista"]:checked')?.value || 'lateral';

    // Pseudocódigo de detección de movimiento/objetos tradicional
    let hsv = new cv.Mat();

    cv.cvtColor(dst, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let sumWidth = 0;
    let sumHeight = 0;
    let count = 0;

    for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);
        let rect = cv.boundingRect(contour);
        let contourArea = cv.contourArea(contour);
        let rectArea = rect.width * rect.height;
        let aspectRatio = rect.width / rect.height;
        let fillRatio = rectArea > 0 ? contourArea / rectArea : 0;

        let point1 = new cv.Point(rect.x, rect.y);
        let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);

        let isLateral = (type === 'lateral');
        let condition;

        if (isLateral)
            condition = ((rect.width * 6) < rect.height) || 
                ((rect.height * 3) < rect.width) || 
                (rect.width > 200 || rect.height > 200) ||
                (rect.height < 12) ||
                (rectArea < 110) ||
                (contourArea < 70) ||
                (fillRatio < 0.26) ||
                (aspectRatio > 3.2);
        else 
            condition = false//(rect.width > 100 || rect.height > 100);

        if (condition)
            cv.drawContours(dst, contours, i, new cv.Scalar(0, 0, 0, 255), cv.FILLED);
        else {
            sumWidth += rect.width;
            sumHeight += rect.height;
            count++;
            cv.rectangle(src, point1, point2, [255, 0, 0, 255], 2);
        }
    }

    hsv.delete();
    // low.delete();
    // high.delete();
    // mask.delete();
    contours.delete();
    hierarchy.delete();
}