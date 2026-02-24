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

    // 1. Cargar el video desde el archivo
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
    // 2. Capturar el frame actual del video en el canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // 3. Convertir el contenido del canvas a una Matriz de OpenCV
    let src = cv.imread(canvas);
    let dst = new cv.Mat(); // Aquí guardarás el resultado procesado

    // --- AQUÍ VA TU LÓGICA DE PDI (Procesamiento Digital de Imágenes) ---
    // Ejemplo: Convertir a escala de grises para detectar bordes
    // cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
    averageCv(cv, src, dst);
    umbralGreenCv(cv, src, dst);
    let vista = document.querySelector('input[name="vista"]:checked').value;
    console.log(`Vista seleccionada: ${vista}`);
    contoursCv(cv, src, dst, vista);
    // -----------------------------------------------------------------

    // 4. Mostrar el resultado en el canvas
    cv.imshow(canvas, src);

    // 5. Liberar memoria (CRÍTICO en JS para evitar que el navegador explote)
    // src.delete();
    src.delete();
    dst.delete();

    // 6. Llamar al siguiente frame
    const id = requestAnimationFrame(() => processVideo(video, canvas, ctx, shouldContinue, setAnimationId));

    setAnimationId(id);
}


function kMeansColorCv(cv, canvas) {
    let maxIter = 5;
    let kmeansInput = 8;

    if (kmeansInput === '')
        kmeansInput = '8';
        
    let k = parseInt(kmeansInput);

    let src = cv.imread(canvas);
    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);

    let rows = src.rows, cols = src.cols;

    let arr = [];

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let pixel = src.ucharPtr(i, j);
            arr.push(pixel[0], pixel[1], pixel[2]);
        }
    }

    let matrix = cv.matFromArray(rows * cols, 3, cv.CV_32F, arr);
    let labels = new cv.Mat();
    let centers = new cv.Mat();

    cv.kmeans(
        matrix, k, labels,
        new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, maxIter, 1.0),
        1, cv.KMEANS_RANDOM_CENTERS, centers
    );

    // Crear la imagen resultante
    let newImg = new cv.Mat(rows, cols, src.type());
    let idx = 0;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++, idx++) {
            let centerIdx = labels.intAt(idx, 0);
            let pixel = newImg.ucharPtr(i, j);
            pixel[0] = centers.floatAt(centerIdx, 0);
            pixel[1] = centers.floatAt(centerIdx, 1);
            pixel[2] = centers.floatAt(centerIdx, 2);
        }
    }

    src.delete();
    matrix.delete();
    labels.delete();
    centers.delete();
    return newImg;
}

function averageCv(cv, src, dst) {
    let ksize = new cv.Size(7, 7);
    cv.blur(src, dst, ksize, new cv.Point(-1, -1), cv.BORDER_DEFAULT);
    // cv.medianBlur(src, dst, 3);
}

function umbralGreenCv(cv, src, dst) {
    let rgb = new cv.Mat();
    let hsv = new cv.Mat();
    let maskGreen = new cv.Mat();

    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV, 0);

    let lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [40, 70, 60, 0]);
    let upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [75, 255, 255, 255]);

    cv.inRange(hsv, lowerGreen, upperGreen, maskGreen);
    // Limpieza opcional (reduce ruido)
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(maskGreen, maskGreen, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(maskGreen, maskGreen, cv.MORPH_CLOSE, kernel);

    cv.bitwise_not(maskGreen, dst);

    rgb.delete();
    hsv.delete();
    maskGreen.delete();
    lowerGreen.delete();
    upperGreen.delete();
    kernel.delete();
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

function contoursCv(cv, src, dst, type = 'lateral') {
    // Pseudocódigo de detección de movimiento/objetos tradicional
    let hsv = new cv.Mat();

    cv.cvtColor(dst, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    // Dibujar Bounding Box

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